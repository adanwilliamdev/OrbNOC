<p align="center">
  <img src="docs/img/OrbNOC_capa.png" alt="OrbNOC" width="720">
</p>

<h1 align="center">OrbNOC</h1>
<p align="center">Plataforma de monitoramento de rede em tempo real, feita 100% em Java.</p>

<p align="center">
  <img alt="Java 21" src="https://img.shields.io/badge/Java-21-orange">
  <img alt="Spring Boot 3.5" src="https://img.shields.io/badge/Spring%20Boot-3.5-6db33f">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-336791">
  <img alt="Licença MIT" src="https://img.shields.io/badge/licen%C3%A7a-MIT-blue">
</p>

---

O OrbNOC acompanha a disponibilidade e a latência de roteadores, switches, servidores e serviços, avisa
quando algo cai ou fica lento e mostra tudo num painel que se atualiza sozinho.

## Recursos

- **Monitoramento contínuo** por ICMP (ping) ou TCP (porta), com intervalo e limite de falhas por dispositivo.
  Um host só é marcado offline após N falhas seguidas, o que elimina falsos alarmes.
- **Tempo real**: o painel, o mapa e o wallboard se atualizam via WebSocket, sem recarregar a página.
- **Alertas** de queda, recuperação e latência acima do limite (SLA), com confirmação de leitura e
  notificação opcional por **Telegram** (o token fica cifrado no banco).
- **Mapa de rede** com layouts hierárquico, radial e em grade, com zoom e arrastar.
- **Relatórios de SLA** de 24 h, 7 dias e 30 dias, com exportação em **CSV** e **Excel** e versão para impressão.
- **Diagnóstico**: ping, traceroute, DNS e teste de portas a partir do servidor.
- **Wallboard** em tela cheia para TVs de NOC.
- **Usuários** com perfis (administrador e usuário), cada um vendo apenas os próprios dispositivos.

## Arquitetura

Um único serviço Spring Boot faz tudo: API REST, páginas (Thymeleaf), WebSocket e o monitor em segundo plano.
O banco é o PostgreSQL.

```
Navegador ──HTTP/WebSocket──► OrbNOC (Spring Boot) ──JDBC──► PostgreSQL
                                 ├─ API REST (/api/...)
                                 ├─ Páginas e fragmentos HTML (Thymeleaf)
                                 ├─ WebSocket (/ws)
                                 └─ Monitor (threads virtuais: ICMP/TCP, métricas, alertas)
```

| Camada | Tecnologia |
| --- | --- |
| Linguagem / runtime | Java 21 (threads virtuais) |
| Aplicação | Spring Boot 3.5 (Web, Data JPA, WebSocket) |
| Interface | Thymeleaf renderizado no servidor, CSS próprio e um único arquivo JavaScript sem dependências |
| Banco | PostgreSQL 16 + Flyway (migrações) |
| Segurança | Argon2 para senhas, sessão em cookie httpOnly assinado (HS256), AES-256-GCM para segredos |
| Exportação | Apache POI (XLSX) |

## Como rodar

### Com Docker (recomendado)

```bash
cp .env.example .env
# edite o .env: defina POSTGRES_PASSWORD, JWT_SECRET (openssl rand -base64 48) e ADMIN_PASSWORD
docker compose up -d --build
```

Acesse <http://localhost:8080> e entre com o usuário e a senha de administrador definidos no `.env`.

Para HTTPS automático com Caddy (domínio apontando para o servidor):

```bash
# no .env: SITE_ADDRESS=noc.exemplo.com, PUBLIC_URL=https://noc.exemplo.com, COOKIE_SECURE=true
docker compose --profile https up -d
```

### Sem Docker (desenvolvimento)

Requisitos: JDK 21, Maven 3.9+ e um PostgreSQL acessível.

```bash
export DATABASE_URL=jdbc:postgresql://localhost:5432/orbnoc
export DATABASE_USER=orbnoc
export DATABASE_PASSWORD=orbnoc
export ADMIN_PASSWORD='Troque123'
mvn spring-boot:run
```

Para o ICMP funcionar sem privilégios no Linux, permita sockets de datagrama ICMP:

```bash
sudo sysctl -w net.ipv4.ping_group_range="0 2147483647"
```

Sem ICMP o monitor usa conexões TCP em portas comuns como alternativa (o `/health` informa o modo ativo).

### Provedores com `DATABASE_URL` no formato `postgresql://`

A aplicação aceita tanto `jdbc:postgresql://...` (com `DATABASE_USER` e `DATABASE_PASSWORD`) quanto o formato
`postgresql://usuario:senha@host:5432/banco?sslmode=require` usado por Neon, Supabase e Render.

## Configuração

Tudo é feito por variáveis de ambiente (veja o [`.env.example`](.env.example)).

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `JWT_SECRET` | — | Assinatura da sessão. Obrigatória em produção (mínimo de 32 caracteres) |
| `ENCRYPTION_KEY` | usa `JWT_SECRET` | Chave dos segredos guardados no banco |
| `ADMIN_USERNAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin` / — / vazio | Admin criado na primeira inicialização |
| `ADMIN_FORCE_RESET` | `false` | Redefine a senha do admin existente (recuperação de acesso) |
| `REGISTRATION_ENABLED` | `false` | Permite auto-cadastro na tela de login |
| `PUBLIC_URL` / `EXTRA_ORIGINS` | `http://localhost:8080` | Origens aceitas em requisições que alteram estado |
| `COOKIE_SECURE` | `true` em produção | Cookie só por HTTPS |
| `ALLOW_PRIVATE_NETWORKS` | `true` | `false` bloqueia alvos em redes privadas |
| `MONITOR_CONCURRENCY` | `20` | Checagens simultâneas |
| `PROBE_TIMEOUT_SECONDS` | `2` | Tempo limite de cada checagem |
| `METRICS_RETENTION_DAYS` | `14` | Retenção das amostras brutas (agregados horários: 400 dias) |

Recuperar o acesso de administrador: defina `ADMIN_PASSWORD` e `ADMIN_FORCE_RESET=true`, reinicie o
serviço e remova `ADMIN_FORCE_RESET` em seguida.

## Segurança

- Senhas com Argon2; login com limite de tentativas por IP e usuário.
- Sessão em cookie `httpOnly` + `SameSite=Lax`; proteção CSRF por verificação de origem em toda requisição que altera estado.
- Alvos de diagnóstico e monitoramento passam por validação: loopback, link-local, endereços de metadata de
  nuvem, multicast e reservados são sempre bloqueados; redes privadas podem ser desativadas.
- Comandos do sistema (`ping`, `traceroute`) são executados sem shell, com argumentos em lista e IP já resolvido e validado.
- Cabeçalhos de segurança (CSP, `X-Frame-Options`, `nosniff`, HSTS em produção).
- Veja também a [política de segurança](SECURITY.md).

## Desenvolvimento

```bash
mvn verify          # compila e roda os testes unitários e de integração (requer Docker)
mvn spring-boot:run # sobe a aplicação
```

### Testes

| Tipo | Classes | Comando | Requisitos |
|---|---|---|---|
| Unitários | `*Test` (regras puras de `core`, helpers de UI) | `mvn test` | nenhum |
| Integração | `*IT` (API, segurança, monitor, banco) | `mvn verify` | Docker |

Os testes de integração sobem a aplicação inteira contra um **PostgreSQL real** (Testcontainers,
imagem `postgres:16-alpine`, a mesma do `docker-compose.yml`). Um único contêiner é compartilhado por
toda a suíte e o banco é esvaziado antes de cada teste. As sondas de rede são simuladas, então nada
sai da máquina. Sem Docker, os `*IT` são ignorados localmente e **falham no CI** (variável `CI`).

Para rodar uma classe: `mvn verify -Dit.test=DeviceApiIT` (e `-Dtest=NaoExiste -Dsurefire.failIfNoSpecifiedTests=false`
para pular os unitários). Novos testes de integração estendem `dev.orbnoc.support.IntegrationTestBase`.

Estrutura:

```
src/main/java/dev/orbnoc
├── core      regras puras e testáveis (validação de hosts, sondas, máquina de estados, tokens, criptografia)
├── domain    entidades JPA
├── repo      repositórios Spring Data
├── service   casos de uso, monitor, tempo real, notificações, relatórios
├── web/api   API REST
├── web/ui    páginas Thymeleaf, gráficos SVG e layout do mapa
└── ws        WebSocket
src/main/resources
├── db/migration   migrações Flyway
├── templates      páginas e fragmentos HTML
└── static         CSS e JavaScript
```

Veja o [guia de contribuição](CONTRIBUTING.md).

## Licença

MIT — veja [LICENSE](LICENSE).
