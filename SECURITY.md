# Política de segurança

## Reportando uma vulnerabilidade

Não abra uma issue pública. Envie os detalhes em particular (aba **Security → Report a vulnerability** do
repositório, ou diretamente ao mantenedor) com:

- descrição do problema e impacto;
- passos para reproduzir;
- versão ou commit afetado.

A resposta inicial acontece em até 7 dias.

## Boas práticas para quem instala

- Defina um `JWT_SECRET` forte (mínimo de 32 caracteres) e nunca o versione.
- Sirva a aplicação por HTTPS e use `COOKIE_SECURE=true`.
- Mantenha `REGISTRATION_ENABLED=false` em instalações públicas e crie usuários pelo painel de administração.
- Em instalações expostas à internet, use `ALLOW_PRIVATE_NETWORKS=false`, a menos que monitorar a rede interna seja o objetivo.
- Remova `ADMIN_FORCE_RESET` e, depois do primeiro acesso, `ADMIN_PASSWORD` do ambiente.
- Faça backup do PostgreSQL e restrinja o acesso a ele à aplicação.

## Backup e restauração

O `docker-compose.yml` inclui o serviço `backup`: um `pg_dump -Fc` a cada `BACKUP_INTERVAL_HOURS` (padrão 24 h), gravado de forma atômica no volume `backups` (`orbnoc-AAAAMMDDTHHMMSSZ.dump`), mantendo `BACKUP_KEEP_DAYS` dias (padrão 14). O serviço não publica portas.

- Teste a restauração periodicamente: `docker compose exec backup sh /ops/restore-test.sh` restaura o dump mais recente num banco temporário, confere as tabelas `users`, `devices` e `metrics` e a contagem de `users`, e remove o banco ao final.
- O volume `backups` fica no mesmo host do banco: copie os dumps para fora dele (outro servidor ou armazenamento de objetos) e proteja-os, pois contêm hashes de senha e segredos cifrados.
- Para restaurar de verdade: `pg_restore --clean --if-exists --no-owner -d orbnoc /backups/orbnoc-<data>.dump` (com o app parado).

