# Política de segurança

## Reportando uma vulnerabilidade

Não abra uma issue pública. Use o recurso **Security → Report a vulnerability** do GitHub (relatório privado) ou contate o mantenedor diretamente. Informe passos para reproduzir, impacto e versão. Responderemos assim que possível.

## O que o OrbNOC faz por padrão

- **Sessão:** JWT em cookie `httpOnly`, `SameSite=Lax` e `Secure` em produção. O token nunca é exposto ao JavaScript.
- **Senhas:** Argon2. Login com rate limit (Redis) por IP + usuário e resposta idêntica para "usuário inexistente" e "senha errada".
- **Sem credenciais padrão:** não há login demo. O primeiro admin nasce de `ADMIN_PASSWORD`; sem ele, nenhum admin é criado. Registro público desligado.
- **CSRF:** requisições que alteram estado só aceitam `Origin` igual a `PUBLIC_URL`/`EXTRA_ORIGINS` (ou ao próprio `Host`). O WebSocket valida a origem também.
- **Segredos:** em produção o backend não sobe sem `JWT_SECRET` forte. O token do bot do Telegram é criptografado (Fernet) e nunca devolvido pela API.
- **SSRF / diagnóstico:** hosts são validados por sintaxe e por **todos** os endereços resolvidos; loopback, link-local (inclui `169.254.169.254`), não especificado, multicast e metadata de nuvem são sempre bloqueados. A validação é refeita a cada checagem do monitor (defesa contra DNS rebinding). Ferramentas de diagnóstico têm rate limit por usuário.
- **Sem shell:** o único subprocesso é o `traceroute`, chamado com argumentos em lista e `--` antes do alvo.
- **Isolamento:** todo dado (dispositivos, alertas, Telegram, relatórios) é filtrado pelo usuário dono.
- **Exportações:** células que começam com `=`, `+`, `-` ou `@` são neutralizadas (injeção de fórmula).

## Pontos de atenção para quem hospeda

- Redes privadas são monitoráveis de propósito. Numa instância **multiusuário exposta à internet**, defina `ALLOW_PRIVATE_NETWORKS=false` para que usuários não sondem a rede interna do servidor.
- O worker roda como root (com `CAP_NET_RAW` apenas) para o ICMP raw; a API roda sem privilégios.
- Use HTTPS em produção (o Caddy configura sozinho com um domínio real).
- Faça backup do PostgreSQL; o Redis não guarda nada crítico.
