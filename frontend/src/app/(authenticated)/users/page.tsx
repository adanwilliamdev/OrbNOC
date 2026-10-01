'use client';

import { useState, type FormEvent } from 'react';
import { KeyRound, Plus, Users, ShieldCheck, ShieldOff, Trash2, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import PageShell from '@/components/layout/PageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUserMutations, useUsers, type UserChanges } from '@/hooks/use-users';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { AdminUser } from '@/types/dashboard';

/** Mesmas regras do backend (validate_password). */
function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'A senha deve conter letras e números';
  return null;
}

export default function UsersPage() {
  const { user: me } = useSession();
  const isAdmin = me?.role === 'admin';
  const { data: users = [], isLoading, error } = useUsers(isAdmin);
  const { update, remove } = useUserMutations();
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<AdminUser | null>(null);

  if (!isAdmin) {
    return (
      <PageShell title="Usuários" subtitle="Acesso restrito" icon={<Users />}>
        <p role="alert" className="rounded-xl border border-bad/25 bg-bad/10 p-6 text-center text-bad">
          Somente administradores podem gerenciar usuários.
        </p>
      </PageShell>
    );
  }

  const change = (u: AdminUser, changes: UserChanges, done: string) =>
    update.mutate({ id: u.id, changes }, { onSuccess: () => toast.success(done), onError: (e) => toast.error(errorMessage(e)) });

  const handleDelete = (u: AdminUser) => {
    if (!window.confirm(`Remover "${u.username}"? Os dispositivos, alertas e configurações dele também serão apagados.`)) return;
    remove.mutate(u.id, { onSuccess: () => toast.success(`${u.username} removido`), onError: (e) => toast.error(errorMessage(e)) });
  };

  return (
    <PageShell
      title="Usuários"
      subtitle="Cada usuário tem seu próprio login e enxerga apenas os próprios dispositivos"
      icon={<Users />}
      maxWidth="max-w-6xl"
      actions={
        <Button onClick={() => setCreating(true)}>
          <Plus /> Novo usuário
        </Button>
      }
    >
      {error && <p role="alert" className="mb-4 text-sm text-bad">{errorMessage(error)}</p>}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Último acesso</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-subtle">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {users.map((u) => {
              const self = u.id === me?.id;
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium text-foreground">
                    {u.username} {self && <span className="text-xs text-subtle">(você)</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role === 'admin' ? 'Admin' : 'Usuário'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.is_active ? 'success' : 'destructive'} dot>{u.is_active ? 'Ativo' : 'Desativado'}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{u.last_login ? new Date(u.last_login).toLocaleString() : 'Nunca'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setResetting(u)} aria-label={`Redefinir senha de ${u.username}`}>
                        <KeyRound className="size-3" /> Senha
                      </Button>
                      {!self && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => change(u, { is_active: !u.is_active }, u.is_active ? `${u.username} desativado` : `${u.username} reativado`)}>
                            {u.is_active ? <UserX className="size-3" /> : <UserCheck className="size-3" />} {u.is_active ? 'Desativar' : 'Reativar'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => change(u, { role: u.role === 'admin' ? 'user' : 'admin' }, `Perfil de ${u.username} atualizado`)}>
                            {u.role === 'admin' ? <ShieldOff className="size-3" /> : <ShieldCheck className="size-3" />} {u.role === 'admin' ? 'Tornar usuário' : 'Tornar admin'}
                          </Button>
                          <Button size="sm" variant="ghost" className="hover:bg-bad/15 hover:text-bad" onClick={() => handleDelete(u)} aria-label={`Remover ${u.username}`}>
                            <Trash2 className="size-3" /> Remover
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-xs text-subtle">Usuário desativado não consegue entrar e os dispositivos dele deixam de ser monitorados até ser reativado.</p>

      <CreateUserDialog open={creating} onClose={() => setCreating(false)} />
      <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
    </PageShell>
  );
}

function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>{open && <CreateForm onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function CreateForm({ onClose }: { onClose: () => void }) {
  const { create } = useUserMutations();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [localError, setLocalError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problem = passwordProblem(password) ?? (/^[A-Za-z0-9_.-]{3,100}$/.test(username.trim()) ? null : 'Usuário: 3 a 100 caracteres (letras, números, _ . -)');
    setLocalError(problem ?? '');
    if (problem) return;
    create.mutate(
      { username: username.trim(), email: email.trim(), password, role },
      {
        onSuccess: () => {
          toast.success(`Usuário ${username.trim()} criado`);
          onClose();
        },
      },
    );
  };
  const error = localError || (create.error ? errorMessage(create.error) : '');

  return (
    <form onSubmit={submit} className="contents">
      <DialogHeader>
        <DialogTitle>Novo usuário</DialogTitle>
        <DialogDescription>Passe o login e a senha inicial para a pessoa. Ela poderá entrar na hora.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="new-username">Usuário</Label>
          <Input id="new-username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-email">Email</Label>
          <Input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-password">Senha inicial</Label>
          <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="8+ caracteres, letras e números" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-role">Perfil</Label>
          <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'user')}>
            <SelectTrigger id="new-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">Usuário (vê só os próprios dispositivos)</SelectItem>
              <SelectItem value="admin">Admin (gerencia usuários)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {error && (
          <p role="alert" className="text-xs text-bad">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Criando...' : 'Criar usuário'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ResetPasswordDialog({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  return (
    <Dialog open={user !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>{user && <ResetForm key={user.id} user={user} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function ResetForm({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { update } = useUserMutations();
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problem = passwordProblem(password);
    setLocalError(problem ?? '');
    if (problem) return;
    update.mutate(
      { id: user.id, changes: { password } },
      {
        onSuccess: () => {
          toast.success(`Senha de ${user.username} redefinida`);
          onClose();
        },
      },
    );
  };
  const error = localError || (update.error ? errorMessage(update.error) : '');

  return (
    <form onSubmit={submit} className="contents">
      <DialogHeader>
        <DialogTitle>Redefinir senha</DialogTitle>
        <DialogDescription>Nova senha para {user.username}. Passe-a para a pessoa.</DialogDescription>
      </DialogHeader>
      <div className="space-y-1">
        <Label htmlFor="reset-password">Nova senha</Label>
        <Input id="reset-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="8+ caracteres, letras e números" required />
        {error && (
          <p role="alert" className="text-xs text-bad">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Salvando...' : 'Redefinir'}
        </Button>
      </DialogFooter>
    </form>
  );
}
