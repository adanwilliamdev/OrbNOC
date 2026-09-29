# 🛰️ OrbNOC

Painel que vigia equipamentos de rede e avisa quando algo cai. Quem loga cadastra hosts; um worker checa cada um a cada poucos segundos, mostra status, latência, jitter e perda ao vivo, avisa no Telegram quando o status muda ou o limite de latência (SLA) estoura, e oferece diagnóstico, mapa, relatórios e wallboard.

## Stack

| Peça | Escolha |
| --- | --- |
| API | FastAPI · Python 3.12 · uv · ruff · pytest |
| Banco | PostgreSQL · SQLAlchemy 2 async · Alembic (tabela de métricas indexada + agregação por hora + job de retenção; sem TimescaleDB) |
| Monitor | Processo separado (`python -m app.worker`) — um worker só, sem eleição de líder |
| Worker → API | Redis pub/sub (o Redis serve só a isso e ao rate limit do login) |
| Tempo real | WebSocket nativo do FastAPI (`/ws`) |
| Checagens | `icmplib` (ICMP) com fallback automático para conexão TCP quando o ambiente bloqueia ICMP |
| Auth | Argon2 · JWT em cookie `httpOnly` · papéis `admin`/`user` |
| Frontend | Next.js 16 · TypeScript · Tailwind 4 · TanStack Query · Radix/shadcn-style |
| Proxy | Caddy: uma única origem (`/api`, `/ws` → backend; resto → Next.js) |

```text
navegador ──► Caddy ─┬─► frontend (Next.js)
                     └─► backend (FastAPI) ◄── Redis pub/sub ◄── worker (checagens ICMP/TCP)
                                │                                   │
                                └──────────── PostgreSQL ◄──────────┘
```

## Como funciona

- **Estados:** `unknown`, `online`, `offline`. Um host só vira `offline` após **3 falhas seguidas** (configurável por dispositivo), o que elimina o falso alarme de uma perda isolada.
- **Rodada do worker:** concorrência limitada; uma rodada nunca começa antes de a anterior terminar. Cada rodada grava a métrica, atualiza o estado, gera o evento e notifica **só quando algo muda** (queda, recuperação, SLA excedido, SLA normalizado).
- **SLA por janela** (24 h, 7 d, 30 d), calculado a partir dos agregados por hora — não mais o "online ÷ total" do instante.
- **Alertas persistidos no servidor** (com reconhecimento), assim como limites de SLA e série de uptime. Nada disso mora mais no `localStorage`.
- **Telegram:** o token é criptografado (Fernet) e **nunca** volta pela API; só se informa se há um token salvo.
- **Diagnóstico:** ping, traceroute real, DNS e teste de porta — sem shell (argumentos em lista) e com host validado. Loopback, link-local e endereços de metadata de nuvem são sempre bloqueados; redes privadas ficam liberadas (`ALLOW_PRIVATE_NETWORKS`), porque monitorar a LAN é o objetivo.
- **Relatórios:** CSV e XLSX gerados no backend (com proteção contra injeção de fórmula). O PDF é a tela de impressão do navegador (`/reports/print`).
- **`/health`:** verifica de verdade o banco, o Redis e o heartbeat do worker (503 se algo estiver fora).

## Como executar (Docker)

```bash
cp .env.example .env
# edite: JWT_SECRET (openssl rand -hex 32), POSTGRES_PASSWORD e ADMIN_PASSWORD
docker compose up --build
```

Acesse **http://localhost:8080** e entre com `ADMIN_USERNAME` / `ADMIN_PASSWORD`. Não existe login demo; o registro público vem desligado (`REGISTRATION_ENABLED=false`) — o admin cria usuários pela API (`POST /api/users`).

Produção: defina `SITE_ADDRESS=seu.dominio`, `PUBLIC_URL=https://seu.dominio` e `ENVIRONMENT=production` (exige `JWT_SECRET` forte e usa cookie `Secure`, portanto HTTPS). O Caddy obtém e renova o certificado sozinho.

> ICMP em contêiner: o worker roda com `CAP_NET_RAW`. Se a plataforma bloquear ICMP (ex.: Render), o monitor detecta na partida e passa a usar conexão TCP nas portas 443, 80, 22, 53, 8080 e 8443 (um `RST` também prova que o host responde). `GET /health` informa o modo em `icmp_mode`.

## Desenvolvimento

Requisitos: Python 3.12+, [uv](https://docs.astral.sh/uv/), Node 20.9+, PostgreSQL, Redis e `traceroute`.

```bash
# backend
cd backend
cp .env.example .env            # ajuste DATABASE_URL, REDIS_URL, ADMIN_PASSWORD
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:get_app --factory --reload --port 8000     # API
uv run python -m app.worker                                        # monitor (outro terminal)

# frontend
cd frontend
npm install
cp .env.example .env.local      # BACKEND_URL e NEXT_PUBLIC_WS_URL (só para dev sem Caddy)
npm run dev
```

No dev sem Caddy, adicione `EXTRA_ORIGINS=http://localhost:3000` no `.env` do backend (o CSRF só aceita origens conhecidas).

Migration nova: altere `app/db/models.py` e rode `uv run alembic revision --autogenerate -m "descrição"`.

## Testes

```bash
cd backend && uv run ruff check . && uv run pytest     # precisa de PostgreSQL e Redis
cd frontend && npm run typecheck && npm run lint && npm run build
```

Os testes do backend rodam contra PostgreSQL e Redis **reais** (`TEST_DATABASE_URL`, `TEST_REDIS_URL`; padrão `orbnoc_test` no localhost) e aplicam as migrations do zero a cada execução.

## Estrutura

```text
orbnoc/
├── backend/
│   ├── app/{api, core, db, services, worker}/
│   ├── alembic/   tests/   pyproject.toml   Dockerfile
├── frontend/      (Next 16, páginas em src/app/(authenticated)/)
├── docker-compose.yml   Caddyfile   .env.example
├── .github/workflows/ci.yml
└── README.md   SECURITY.md   LICENSE
```

## API (resumo)

| Área | Rotas |
| --- | --- |
| Auth | `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` · `GET /api/auth/config` · `POST /api/auth/register` (se habilitado) |
| Usuários (admin) | `GET/POST /api/users` · `PATCH /api/users/{id}` |
| Dispositivos | `GET/POST /api/devices` · `PATCH/DELETE /api/devices/{id}` · `GET .../ping` · `POST .../check-port` · `GET .../history` · `GET .../sla` |
| Alertas | `GET /api/alerts` · `POST /api/alerts/{id}/ack` · `POST /api/alerts/ack-all` · `GET/POST/DELETE /api/alerts/telegram` · `POST /api/alerts/sla/configure` · `POST /api/alerts/test-telegram` · `POST /api/alerts/test-host` |
| Diagnóstico | `POST /api/diagnostic/{ping, traceroute, port-check, dns-lookup, full-diagnostic}` |
| Relatórios | `GET /api/sla` · `GET /api/uptime-series` · `GET /api/reports/summary` · `GET /api/reports/export?format=csv\|xlsx&window=24h\|7d\|30d` |
| Tempo real | `WS /ws` (cookie de sessão) — mensagens `devices_update` e `event` |
| Saúde | `GET /health` · `GET /health/live` |

Os campos seguem `snake_case` (`latency`, `latency_ms`, `packet_loss`, `sla_threshold_ms`…). Erros vêm como `{"detail": "mensagem"}`. Documentação interativa: `ENABLE_DOCS=true` → `/api/docs`.

## Licença

[MIT](./LICENSE).
