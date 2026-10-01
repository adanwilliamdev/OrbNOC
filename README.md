# 🛰️ OrbNOC

**OrbNOC** é uma plataforma de monitoramento de equipamentos de rede com acompanhamento em tempo real, alertas, diagnóstico e relatórios operacionais.

Cada usuário pode cadastrar seus próprios dispositivos e acompanhar:

- 🟢 Status dos dispositivos
- 📡 Latência, jitter e perda de pacotes
- 🚨 Alertas de indisponibilidade
- ⏱️ Monitoramento de SLA
- 🔔 Notificações via Telegram
- 🔎 Diagnóstico de rede
- 🗺️ Visualização em mapa
- 📑 Relatórios CSV e XLSX
- 🖥️ Wallboard operacional

O monitoramento é executado por um **worker Python independente**, responsável pelas verificações periódicas dos dispositivos.

---

## 🎥 Demonstração

[▶️ Assistir demonstração](https://github.com/user-attachments/assets/2b40a048-2ea3-4723-b909-7f1d90a4134d)

---

## 🚀 Stack

<p>
  <img src="https://img.shields.io/badge/Python%203.12-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Next.js%2016-000000?style=for-the-badge&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
</p>

<p>
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLAlchemy%202-BA2D2D?style=for-the-badge&logo=sqlalchemy&logoColor=white" />
  <img src="https://img.shields.io/badge/Alembic-1E1E1E?style=for-the-badge&logo=alembic&logoColor=white" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" />
</p>

<p>
  <img src="https://img.shields.io/badge/Tailwind%20CSS%204-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/TanStack%20Query-FF4154?style=for-the-badge&logo=reactquery&logoColor=white" />
  <img src="https://img.shields.io/badge/Caddy-1F88C9?style=for-the-badge&logo=caddy&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
</p>

| Área | Tecnologias |
|---|---|
| **API** | FastAPI · Python 3.12 · uv · Ruff · Pytest |
| **Frontend** | Next.js 16 · TypeScript · Tailwind CSS 4 · TanStack Query · Radix/shadcn-style |
| **Banco** | PostgreSQL · SQLAlchemy 2 Async · Alembic |
| **Monitoramento** | Worker Python independente · ICMP com fallback TCP |
| **Mensageria** | Redis Pub/Sub |
| **Tempo real** | WebSocket |
| **Autenticação** | Argon2 · JWT · Cookies `httpOnly` |
| **Autorização** | `admin` · `user` |
| **Proxy** | Caddy |
| **Métricas** | PostgreSQL · agregação horária · retenção |

> As métricas são armazenadas diretamente no PostgreSQL, sem TimescaleDB.

---

## 🏗️ Arquitetura

```text
                        ┌──────────────────┐
                        │    Navegador     │
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │      Caddy       │
                        │  Reverse Proxy   │
                        └────────┬─────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
             ┌──────────────┐          ┌──────────────┐
             │   Next.js    │          │   FastAPI    │
             │   Frontend   │          │     API      │
             └──────────────┘          └──────┬───────┘
                                              │
                         ┌────────────────────┼──────────────────┐
                         ▼                    ▼                  ▼
                  ┌────────────┐      ┌──────────────┐   ┌──────────────┐
                  │   Redis    │      │ PostgreSQL   │   │  WebSocket   │
                  │  Pub/Sub   │      │              │   │     /ws      │
                  └─────▲──────┘      └──────▲───────┘   └──────────────┘
                        │                    │
                        └──────────┬─────────┘
                                   │
                           ┌───────┴────────┐
                           │ Worker Python  │
                           │   ICMP / TCP   │
                           └────────────────┘
```

### Fluxo

1. O usuário acessa o frontend através do Caddy.
2. O Next.js consome a API FastAPI.
3. O worker executa as verificações dos dispositivos.
4. As métricas são persistidas no PostgreSQL.
5. Eventos são publicados através do Redis.
6. A API distribui atualizações via WebSocket.
7. Mudanças de estado e violações de SLA podem gerar notificações via Telegram.

---

## ⚙️ Monitoramento

### Estados

```text
unknown ──► online ──► offline
              ▲           │
              └───────────┘
```

Estados disponíveis:

- `unknown`
- `online`
- `offline`

Um dispositivo somente é considerado **offline após falhas consecutivas**, configuráveis por dispositivo.

O intervalo padrão é de **30 segundos**, com configuração entre **5 e 3600 segundos**.

Com `30s × 3 falhas`, o dispositivo normalmente será considerado offline após aproximadamente **90 segundos**.

### Worker

O monitoramento roda em um processo independente:

```bash
python -m app.worker
```

Características:

- Um único worker
- Sem eleição de líder
- Concorrência limitada
- Uma nova rodada não inicia enquanto a anterior estiver em execução
- Cada rodada registra métricas
- Estado atualizado conforme o resultado
- Eventos gerados somente quando necessários
- Notificações enviadas apenas em mudanças relevantes

Eventos:

- Dispositivo ficou offline
- Dispositivo voltou online
- SLA excedido
- SLA voltou ao normal

---

## 📊 SLA e métricas

O SLA utiliza **agregações horárias**, evitando depender apenas da relação instantânea entre dispositivos online e total de dispositivos.

Janelas disponíveis:

- `24h`
- `7d`
- `30d`

O histórico de uptime e os limites de SLA são persistidos no servidor.

---

## 🔔 Alertas e Telegram

Os alertas são persistidos no backend e podem ser reconhecidos individualmente ou em massa.

Recursos:

- Reconhecimento individual
- Reconhecimento de todos
- Configuração de SLA
- Integração com Telegram
- Teste de notificações
- Teste de dispositivos

### Segurança

O token do Telegram:

- É armazenado criptografado com **Fernet**
- Nunca é retornado pela API
- A API informa somente se existe um token configurado

---

## 🔎 Diagnóstico de rede

Ferramentas disponíveis:

- Ping
- Traceroute
- DNS Lookup
- Teste de porta
- Diagnóstico completo

Os comandos são executados **sem shell**, utilizando argumentos estruturados.

Os hosts são previamente validados para impedir acesso a destinos indevidos.

### Restrições

Bloqueados:

- Loopback
- Endereços link-local
- Endereços de metadata de provedores de nuvem

Redes privadas podem ser permitidas para monitoramento de infraestrutura local:

```env
ALLOW_PRIVATE_NETWORKS=true
```

---

## 🌐 ICMP com fallback TCP

O worker tenta utilizar ICMP para as verificações.

Quando ICMP é bloqueado, utiliza automaticamente TCP.

Portas utilizadas:

```text
443 · 80 · 22 · 53 · 8080 · 8443
```

Um **RST** também é considerado evidência de que o host está respondendo.

O endpoint `/health` informa o modo atual através de `icmp_mode`.

Em Docker, o worker utiliza:

```text
CAP_NET_RAW
```

---

## ❤️ Health Checks

### `/health`

Executa verificações reais de:

- PostgreSQL
- Redis
- Heartbeat do worker

Caso um componente essencial esteja indisponível:

```text
503 Service Unavailable
```

### `/health/live`

Verificação básica de disponibilidade da aplicação.

---

## 📑 Relatórios

Formatos disponíveis:

- CSV
- XLSX

Os arquivos são gerados no servidor e possuem proteção contra **injeção de fórmulas**.

O relatório PDF utiliza a própria impressão do navegador:

```text
/reports/print
```

---

## 🐳 Docker

### 1. Configurar ambiente

```bash
cp .env.example .env
```

Configure pelo menos:

```env
JWT_SECRET=
POSTGRES_PASSWORD=
ADMIN_PASSWORD=
```

Gerar um segredo JWT:

```bash
openssl rand -hex 32
```

### 2. Iniciar

```bash
docker compose up --build
```

A aplicação estará disponível em:

```text
http://localhost:8080
```

Entre utilizando:

```env
ADMIN_USERNAME
ADMIN_PASSWORD
```

> Não existe login demo. Cada usuário possui sua própria conta e acesso isolado aos dispositivos, alertas e configurações do Telegram.

---

## 👥 Usuários

Administradores podem acessar **Usuários** pelo cabeçalho da aplicação.

Operações:

- Criar usuários
- Redefinir senhas
- Desativar/reativar usuários
- Alterar perfil
- Remover usuários

Perfis:

```text
admin
user
```

Quando um usuário é desativado:

- O login é bloqueado
- Seus dispositivos deixam de ser monitorados

### Registro público

Desativado por padrão.

Para habilitar:

```env
REGISTRATION_ENABLED=true
```

---

## 🔐 Redefinição do administrador

O administrador definido no `.env` é criado somente na primeira inicialização, quando o banco está vazio.

Alterar posteriormente:

```env
ADMIN_PASSWORD=
```

não modifica a senha existente.

Para redefinir:

```bash
docker compose exec backend \
  python -m app.create_admin \
  --reset \
  -u admin \
  -p 'NovaSenha123'
```

Sem `-p`, o sistema solicita a nova senha.

Sem `-u`, utiliza `ADMIN_USERNAME`.

---

## 🚀 Produção

Configure:

```env
SITE_ADDRESS=seu.dominio
PUBLIC_URL=https://seu.dominio
ENVIRONMENT=production
```

Em produção:

- `JWT_SECRET` forte é obrigatório
- Cookies utilizam `Secure`
- HTTPS é necessário
- Caddy gerencia automaticamente o certificado TLS

---

## 💻 Desenvolvimento

### Requisitos

- Python 3.12+
- uv
- Node.js 20.9+
- PostgreSQL
- Redis
- traceroute

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

Worker:

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

Sem Caddy, adicione ao `.env` do backend:

```env
EXTRA_ORIGINS=http://localhost:3000
```

---

## 🗃️ Migrations

Após alterar:

```text
backend/app/db/models.py
```

gere a migration:

```bash
uv run alembic revision \
  --autogenerate \
  -m "descrição"
```

Aplique:

```bash
uv run alembic upgrade head
```

---

## 🧪 Testes

### Backend

```bash
cd backend

uv run ruff check .
uv run pytest
```

Os testes utilizam **PostgreSQL e Redis reais**.

Configuração:

```env
TEST_DATABASE_URL=
TEST_REDIS_URL=
```

Por padrão, o banco de testes utiliza:

```text
orbnoc_test
```

As migrations são aplicadas do zero a cada execução.

### Frontend

```bash
cd frontend

npm run typecheck
npm run lint
npm run build
```

---

## 📁 Estrutura

```text
orbnoc/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── services/
│   │   └── worker/
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
├── docker-compose.yml
├── Caddyfile
├── .env.example
├── .github/workflows/ci.yml
├── SECURITY.md
├── LICENSE
└── README.md
```

---

## 🔌 API

### Autenticação

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Usuário autenticado |
| GET | `/api/auth/config` | Configuração |
| POST | `/api/auth/register` | Registro, quando habilitado |

### Usuários

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/users` | Listar |
| POST | `/api/users` | Criar |
| PATCH | `/api/users/{id}` | Atualizar |
| DELETE | `/api/users/{id}` | Remover |

### Dispositivos

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/devices` | Listar |
| POST | `/api/devices` | Criar |
| PATCH | `/api/devices/{id}` | Atualizar |
| DELETE | `/api/devices/{id}` | Remover |
| GET | `/api/devices/{id}/ping` | Ping |
| POST | `/api/devices/{id}/check-port` | Testar porta |
| GET | `/api/devices/{id}/history` | Histórico |
| GET | `/api/devices/{id}/sla` | SLA |

### Alertas

| Método | Endpoint |
|---|---|
| GET | `/api/alerts` |
| POST | `/api/alerts/{id}/ack` |
| POST | `/api/alerts/ack-all` |
| GET | `/api/alerts/telegram` |
| POST | `/api/alerts/telegram` |
| DELETE | `/api/alerts/telegram` |
| POST | `/api/alerts/sla/configure` |
| POST | `/api/alerts/test-telegram` |
| POST | `/api/alerts/test-host` |

### Diagnóstico

```text
POST /api/diagnostic/ping
POST /api/diagnostic/traceroute
POST /api/diagnostic/port-check
POST /api/diagnostic/dns-lookup
POST /api/diagnostic/full-diagnostic
```

### Relatórios

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/sla` | Indicadores de SLA |
| GET | `/api/uptime-series` | Uptime histórico |
| GET | `/api/reports/summary` | Resumo operacional |
| GET | `/api/reports/export` | CSV/XLSX |

Exemplo:

```text
/api/reports/export?format=csv&window=24h
```

Janelas:

```text
24h · 7d · 30d
```

---

## ⚡ Tempo real

WebSocket:

```text
WS /ws
```

A autenticação utiliza o cookie de sessão.

Principais mensagens:

```text
devices_update
event
```

---

## 📐 Convenções da API

Os campos utilizam `snake_case`.

```json
{
  "latency": 12.4,
  "latency_ms": 12.4,
  "packet_loss": 0,
  "sla_threshold_ms": 100
}
```

Erros:

```json
{
  "detail": "mensagem"
}
```

---

## 📚 Documentação da API

A documentação interativa pode ser habilitada com:

```env
ENABLE_DOCS=true
```

Depois:

```text
/api/docs
```

---

## 🔒 Segurança

O OrbNOC implementa:

- 🔐 Senhas protegidas com Argon2
- 🍪 JWT em cookie `httpOnly`
- 🛡️ Cookies `Secure` em produção
- 🔄 Proteção CSRF baseada em origens conhecidas
- 🚦 Rate limit de login utilizando Redis
- 🔑 Tokens do Telegram criptografados
- 🌐 Validação de hosts para diagnóstico
- 🚫 Bloqueio de loopback e metadata
- 🧩 Execução de comandos sem shell
- 📊 Proteção contra injeção de fórmulas
- 👥 Controle de acesso por perfil
- 🔒 Isolamento dos dispositivos por usuário

---

## ✨ Principais recursos

| Recurso | Descrição |
|---|---|
| 📡 Monitoramento | ICMP / TCP |
| 📊 Métricas | Latência · Jitter · Packet Loss |
| 🚨 Alertas | Indisponibilidade e SLA |
| 🔔 Telegram | Notificações e testes |
| 🔎 Diagnóstico | Ping · Traceroute · DNS · Portas |
| 📈 Histórico | Uptime e métricas |
| 🗺️ Mapa | Visualização dos dispositivos |
| 📑 Relatórios | CSV / XLSX |
| 🖥️ Wallboard | Visão operacional |
| ⚡ Tempo real | WebSocket |
| 👥 Usuários | Admin / User |
| ❤️ Health | PostgreSQL · Redis · Worker |

---

## 📄 Licença

Este projeto está licenciado sob a **MIT License**.

Consulte o arquivo [`LICENSE`](LICENSE) para mais informações.
