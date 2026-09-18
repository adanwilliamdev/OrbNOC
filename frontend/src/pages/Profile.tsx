import { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../api/auth';

export function Profile() {
  const { user, refreshUser } = useAuth();
  const [nome, setNome] = useState(user?.nome || '');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await updateProfile(nome);
      await refreshUser();
      setMessage('Perfil atualizado com sucesso!');
    } catch {
      setMessage('Não foi possível atualizar o perfil.');
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <div className="page">
      <h1>Meu Perfil</h1>
      <form className="profile-card" onSubmit={handleSubmit}>
        <div className="profile-avatar-row">
          <div className="profile-avatar">{user.nome[0]?.toUpperCase()}</div>
          <div className="profile-avatar-name">
            <strong>{user.nome}</strong>
            <span>{user.email}</span>
          </div>
          <span className="badge account-type">{user.role === 'ADMIN' ? 'Administrador' : 'Usuário'}</span>
        </div>

        {message && <div className="alert-info">{message}</div>}

        <div className="profile-fields-grid">
          <label>
            Nome
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </label>

          <label>
            E-mail
            <input type="email" value={user.email} disabled />
          </label>
        </div>

        <div className="profile-actions">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
