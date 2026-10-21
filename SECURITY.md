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
