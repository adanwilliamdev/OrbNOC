# 🛰️ OrbNOC

> **Plataforma de monitoramento de infraestrutura de rede com observabilidade em tempo real, alertas inteligentes e diagnóstico de conectividade.**

O **OrbNOC** é uma plataforma para monitoramento de dispositivos e hosts de rede. Usuários podem cadastrar equipamentos, acompanhar disponibilidade, latência, jitter e perda de pacotes em tempo real, além de receber alertas quando um dispositivo fica indisponível ou ultrapassa um limite de SLA.

A plataforma também oferece **diagnóstico de rede, traceroute, DNS, teste de portas, mapas, relatórios, histórico de disponibilidade e wallboard operacional**.

---

## ✨ Principais recursos

- 📡 Monitoramento contínuo de hosts e dispositivos
- 🟢 Estados `unknown`, `online` e `offline`
- 📊 Latência, jitter e perda de pacotes
- 🚨 Alertas de indisponibilidade e SLA
- 📱 Notificações via Telegram
- 🔄 Atualizações em tempo real via WebSocket
- 📈 Histórico e métricas de disponibilidade
- 📅 SLA por janelas de 24h, 7 dias e 30 dias
- 🧪 Diagnóstico completo de conectividade
- 🌐 Ping, traceroute, DNS e teste de portas
- 🗺️ Visualização geográfica dos dispositivos
- 📑 Exportação de relatórios em CSV e XLSX
- 🖥️ Wallboard operacional
- 👤 Controle de usuários e permissões
- 🔐 Autenticação com JWT, cookies `httpOnly` e Argon2
- ❤️ Health checks para API, banco, Redis e worker
- 🐳 Ambiente completo via Docker Compose

---

## 🧱 Stack

| Camada | Tecnologias |
| --- | --- |
| **Backend** | Python 3.12 · FastAPI · uv · Ruff · Pytest |
| **Banco de dados** | PostgreSQL · SQLAlchemy 2 Async · Alembic |
| **Monitoramento** | Python Worker · ICMP · TCP |
| **Mensageria** | Redis Pub/Sub |
| **Tempo real** | FastAPI WebSocket |
| **Autenticação** | Argon2 · JWT · HTTPOnly Cookies |
| **Frontend** | Next.js 16 · TypeScript · Tailwind CSS 4 |
| **UI** | Radix UI · shadcn/ui |
| **Estado / Data Fetching** | TanStack Query |
| **Proxy** | Caddy |
| **Infraestrutura** | Docker · Docker Compose |

---

## 🏗️ Arquitetura

```text
                         ┌──────────────────────┐
                         │      Navegador       │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │        Caddy         │
                         │      Reverse Proxy   │
                         └──────────┬───────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     │                             │
                     ▼                             ▼
             ┌───────────────┐             ┌───────────────┐
             │    Next.js    │             │    FastAPI    │
             │   Frontend    │             │     API       │
             └───────────────┘             └───────┬───────┘
                                                   │
                              ┌────────────────────┼────────────────────┐
                              │                    │                    │
                              ▼                    ▼                    ▼
                       ┌────────────┐      ┌──────────────┐      ┌────────────┐
                       │   Redis    │      │  PostgreSQL  │      │ WebSocket  │
                       │ Pub / Sub  │      │              │      │    /ws     │
                       └─────┬──────┘      └──────▲───────┘      └────────────┘
                             │                    │
                             ▼                    │
                       ┌──────────────┐           │
                       │    Worker    │───────────┘
                       │ ICMP / TCP   │
                       └──────────────┘
```

### Fluxo

1. O usuário acessa o frontend através do Caddy.
2. O Next.js fornece a interface da aplicação.
3. O FastAPI gerencia autenticação, dispositivos, métricas e APIs.
4. O Worker realiza as verificações de conectividade.
5. O Worker publica eventos através do Redis.
6. O backend processa os eventos e persiste as métricas no PostgreSQL.
7. Alterações de estado são enviadas ao frontend via WebSocket.
8. Alertas são disparados somente quando ocorre uma mudança relevante.

---

## ⚙️ Monitoramento

O OrbNOC utiliza um **worker separado** responsável pelas verificações de conectividade.

```bash
python -m app.worker
```

O worker possui concorrência limitada e garante que uma nova rodada não seja iniciada antes da conclusão da anterior.

### Estados

```text
unknown
   │
   ▼
 online ──────────────► offline
   ▲                       │
   └───────────────────────┘
```

Um dispositivo somente passa para `offline` após **3 falhas consecutivas**, valor configurável individualmente por dispositivo.

Isso evita alertas causados por uma única perda de pacote ou falha momentânea.

---

## 📡 ICMP e fallback TCP

O monitoramento utiliza **ICMP** através do `icmplib`.

Quando o ambiente não permite ICMP, o OrbNOC detecta essa limitação e utiliza automaticamente **TCP** como fallback.

Portas utilizadas no fallback:

```text
443
80
22
53
8080
8443
```

Um `RST` também é considerado evidência de que o host está respondendo.

Em ambientes Docker, o worker utiliza:

```text
CAP_NET_RAW
```

O endpoint `/health` informa o modo de monitoramento através do campo:

```json
{
  "icmp_mode": "icmp"
}
```

ou:

```json
{
  "icmp_mode": "tcp"
}
```

---

## 📊 Métricas e SLA

O OrbNOC registra métricas de monitoramento no PostgreSQL.

São acompanhados:

- Latência
- Jitter
- Perda de pacotes
- Disponibilidade
- Estado do dispositivo
- Violações de SLA

O SLA pode ser consultado nas seguintes janelas:

```text
24 horas
7 dias
30 dias
```

O cálculo utiliza **agregações horárias**, evitando depender apenas de uma fotografia instantânea do estado do dispositivo.

O PostgreSQL utiliza índices específicos para as tabelas de métricas, além de processos de retenção e agregação.

> O projeto não utiliza TimescaleDB.

---

## 🚨 Alertas

Os alertas são persistidos no servidor e podem ser reconhecidos pelos usuários.

Eventos monitorados:

- 🔴 Dispositivo ficou offline
- 🟢 Dispositivo voltou online
- ⚠️ SLA excedido
- ✅ SLA normalizado

O sistema evita notificações repetitivas e envia alertas somente quando ocorre uma mudança relevante.

---

## 📱 Telegram

O OrbNOC permite configurar notificações via Telegram.

O token do bot:

- É criptografado utilizando **Fernet**
- Nunca é retornado pela API
- Pode ser testado diretamente pela aplicação
- Possui indicador informando se existe um token configurado

A API nunca expõe o token armazenado.

---

## 🔐 Segurança

A aplicação utiliza múltiplas camadas de proteção:

- Argon2 para armazenamento seguro de senhas
- JWT
- Cookies `httpOnly`
- Cookies `Secure` em produção
- Controle de acesso por função
- Proteção contra CSRF
- Rate limiting no login
- Validação de hosts
- Bloqueio de endereços sensíveis
- Proteção contra injeção de fórmulas em relatórios
- Tokens do Telegram criptografados

### Redes bloqueadas

O diagnóstico bloqueia automaticamente:

- Loopback
- Endereços link-local
- Endereços de metadata de provedores de nuvem

Redes privadas podem ser habilitadas através de:

```env
ALLOW_PRIVATE_NETWORKS=true
```

Isso permite que o OrbNOC monitore dispositivos da rede interna.

---

## 🧪 Diagnóstico de rede

O módulo de diagnóstico permite executar:

```text
Ping
Traceroute
DNS Lookup
Port Check
Full Diagnostic
```

Os comandos são executados sem shell e utilizando argumentos estruturados.

Hosts são validados antes da execução para reduzir riscos de execução arbitrária.

---

## 📑 Relatórios

A plataforma permite gerar relatórios diretamente pelo backend.

Formatos disponíveis:

```text
CSV
XLSX
```

Os relatórios possuem proteção contra **injeção de fórmulas**.

Para PDF, o sistema utiliza a versão de impressão do navegador:

```text
/reports/print
```

---

## ❤️ Health Check

O endpoint:

```text
GET /health
```

realiza verificações reais dos componentes críticos:

- PostgreSQL
- Redis
- Worker heartbeat

Caso algum componente essencial esteja indisponível, a API retorna:

```text
503 Service Unavailable
```

O endpoint:

```text
GET /health/live
```

é utilizado para verificar apenas se a aplicação está em execução.

---

# 🚀 Executando com Docker

## Pré-requisitos

- Docker
- Docker Compose

Clone o projeto e configure o ambiente:

```bash
cp .env.example .env
```

Edite as principais variáveis:

```env
JWT_SECRET=
POSTGRES_PASSWORD=
ADMIN_PASSWORD=
```

Para gerar um segredo JWT:

```bash
openssl rand -hex 32
```

Inicie a aplicação:

```bash
docker compose up --build
```

Acesse:

```text
http://localhost:8080
```

Entre utilizando:

```text
ADMIN_USERNAME
ADMIN_PASSWORD
```

Por segurança, não existe usuário demo.

O registro público também permanece desabilitado por padrão:

```env
REGISTRATION_ENABLED=false
```

Usuários podem ser criados pelo administrador através da API:

```http
POST /api/users
```

---

# 🌐 Produção

Configure:

```env
SITE_ADDRESS=seu.dominio.com
PUBLIC_URL=https://seu.dominio.com
ENVIRONMENT=production
```

Em produção:

- HTTPS é obrigatório
- O cookie utiliza `Secure`
- O JWT precisa utilizar um segredo forte
- O Caddy gerencia automaticamente os certificados TLS

---

# 🛠️ Desenvolvimento

## Requisitos

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- Node.js 20.9+
- PostgreSQL
- Redis
- Traceroute

### Backend

```bash
cd backend

cp .env.example .env

uv sync

uv run alembic upgrade head

uv run uvicorn app.main:get_app \
  --factory \
  --reload \
  --port 8000
```

Em outro terminal:

```bash
cd backend

uv run python -m app.worker
```

### Frontend

```bash
cd frontend

npm install

cp .env.example .env.local

npm run dev
```

No desenvolvimento sem Caddy, configure no `.env` do backend:

```env
EXTRA_ORIGINS=http://localhost:3000
```

Isso permite que o CSRF reconheça a origem do frontend local.

---

# 🗄️ Migrations

Após alterar os modelos em:

```text
backend/app/db/models.py
```

gere uma nova migration:

```bash
cd backend

uv run alembic revision \
  --autogenerate \
  -m "descrição da migration"
```

Depois aplique:

```bash
uv run alembic upgrade head
```

---

# 🧪 Testes

### Backend

```bash
cd backend

uv run ruff check .

uv run pytest
```

### Frontend

```bash
cd frontend

npm run typecheck
npm run lint
npm run build
```

Os testes do backend utilizam instâncias reais de PostgreSQL e Redis.

Variáveis utilizadas:

```env
TEST_DATABASE_URL=
TEST_REDIS_URL=
```

Por padrão, o banco de testes utiliza:

```text
orbnoc_test
```

no PostgreSQL local.

As migrations são aplicadas do zero durante cada execução dos testes.

---

# 📁 Estrutura do projeto

```text
orbnoc/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── services/
│   │   └── worker/
│   │
│   ├── alembic/
│   ├── tests/
│   ├── pyproject.toml
│   └── Dockerfile
│
├── frontend/
│   └── src/
│       └── app/
│           └── (authenticated)/
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── docker-compose.yml
├── Caddyfile
├── .env.example
├── SECURITY.md
├── LICENSE
└── README.md
```

---

# 🔌 API

## Autenticação

| Método | Endpoint |
| --- | --- |
| `POST` | `/api/auth/login` |
| `POST` | `/api/auth/logout` |
| `GET` | `/api/auth/me` |
| `GET` | `/api/auth/config` |
| `POST` | `/api/auth/register` |

> O registro depende de `REGISTRATION_ENABLED`.

## Usuários

| Método | Endpoint |
| --- | --- |
| `GET` | `/api/users` |
| `POST` | `/api/users` |
| `PATCH` | `/api/users/{id}` |

> Acesso administrativo.

## Dispositivos

| Método | Endpoint |
| --- | --- |
| `GET` | `/api/devices` |
| `POST` | `/api/devices` |
| `PATCH` | `/api/devices/{id}` |
| `DELETE` | `/api/devices/{id}` |
| `GET` | `/api/devices/{id}/ping` |
| `POST` | `/api/devices/{id}/check-port` |
| `GET` | `/api/devices/{id}/history` |
| `GET` | `/api/devices/{id}/sla` |

## Alertas

| Método | Endpoint |
| --- | --- |
| `GET` | `/api/alerts` |
| `POST` | `/api/alerts/{id}/ack` |
| `POST` | `/api/alerts/ack-all` |
| `GET` | `/api/alerts/telegram` |
| `POST` | `/api/alerts/telegram` |
| `DELETE` | `/api/alerts/telegram` |
| `POST` | `/api/alerts/sla/configure` |
| `POST` | `/api/alerts/test-telegram` |
| `POST` | `/api/alerts/test-host` |

## Diagnóstico

```text
POST /api/diagnostic/ping
POST /api/diagnostic/traceroute
POST /api/diagnostic/port-check
POST /api/diagnostic/dns-lookup
POST /api/diagnostic/full-diagnostic
```

## Relatórios

| Método | Endpoint |
| --- | --- |
| `GET` | `/api/sla` |
| `GET` | `/api/uptime-series` |
| `GET` | `/api/reports/summary` |
| `GET` | `/api/reports/export` |

Exemplo:

```text
/api/reports/export?format=xlsx&window=30d
```

Formatos:

```text
csv
xlsx
```

Janelas:

```text
24h
7d
30d
```

## Tempo real

```text
WS /ws
```

A conexão utiliza o cookie de sessão e pode receber eventos como:

```text
devices_update
event
```

---

# 📚 Documentação da API

A documentação interativa pode ser habilitada através de:

```env
ENABLE_DOCS=true
```

Depois, acesse:

```text
/api/docs
```

---

# 📦 Formato dos dados

A API utiliza `snake_case` nos campos.

Exemplos:

```json
{
  "latency": 24.5,
  "latency_ms": 24.5,
  "packet_loss": 0,
  "sla_threshold_ms": 100
}
```

Erros seguem o formato:

```json
{
  "detail": "mensagem"
}
```

---

# 🔄 Comunicação em tempo real

O frontend recebe atualizações através do WebSocket:

```text
Frontend
   │
   │ WebSocket /ws
   ▼
FastAPI
   │
   │ eventos
   ▼
Redis Pub/Sub
   ▲
   │
Worker
```

O Redis é utilizado exclusivamente para:

- Comunicação entre Worker e API
- Rate limiting do login

---

# 📜 Licença

Este projeto está licenciado sob a licença **MIT**.

Consulte o arquivo [`LICENSE`](./LICENSE) para mais informações.
