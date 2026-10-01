# 🛰️ OrbNOC

**OrbNOC** é uma plataforma de monitoramento de equipamentos de rede com acompanhamento em tempo real, alertas, diagnóstico e relatórios operacionais.

Cada usuário pode cadastrar seus próprios dispositivos e acompanhar:

- 🟢 Status dos dispositivos
- 📡 Latência
- 📊 Jitter
- 📉 Perda de pacotes
- 🚨 Alertas de indisponibilidade
- ⏱️ Monitoramento de SLA
- 🔔 Notificações via Telegram
- 🔎 Diagnóstico de rede
- 🗺️ Visualização em mapa
- 📑 Relatórios CSV e XLSX
- 🖥️ Wallboard operacional

O monitoramento é executado por um **worker independente**, responsável pelas checagens periódicas dos dispositivos.

---

## 🚀 Stack

| Camada | Tecnologia |
|---|---|
| **API** | FastAPI · Python 3.12 · uv · Ruff · Pytest |
| **Banco de dados** | PostgreSQL · SQLAlchemy 2 Async · Alembic |
| **Monitoramento** | Worker Python independente |
| **Mensageria** | Redis Pub/Sub |
| **Tempo real** | WebSocket nativo do FastAPI |
| **Checagens** | ICMP com fallback automático para TCP |
| **Autenticação** | Argon2 · JWT · Cookies `httpOnly` |
| **Autorização** | `admin` · `user` |
| **Frontend** | Next.js 16 · TypeScript · Tailwind CSS 4 · TanStack Query · Radix/shadcn-style |
| **Proxy reverso** | Caddy |
| **Banco de métricas** | PostgreSQL com agregação horária e retenção |

> O PostgreSQL armazena as métricas sem utilização do TimescaleDB.

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
          ┌─────────────────┐          ┌─────────────────┐
          │    Next.js      │          │    FastAPI      │
          │    Frontend     │          │      API        │
          └─────────────────┘          └────────┬────────┘
                                                │
                           ┌────────────────────┼────────────────────┐
                           │                    │                    │
                           ▼                    ▼                    ▼
                    ┌────────────┐      ┌──────────────┐    ┌──────────────┐
                    │   Redis    │      │ PostgreSQL   │    │  WebSocket   │
                    │  Pub/Sub   │      │              │    │    /ws       │
                    └─────▲──────┘      └──────▲───────┘    └──────────────┘
                          │                    │
                          │                    │
                    ┌─────┴────────────────────┴──────┐
                    │          Worker Python           │
                    │       ICMP / TCP Checks          │
                    └──────────────────────────────────┘
```

### Fluxo principal

1. O usuário acessa o frontend através do Caddy.
2. O Next.js consome a API FastAPI.
3. O worker executa as checagens dos dispositivos.
4. As métricas são persistidas no PostgreSQL.
5. Eventos são publicados através do Redis.
6. A API distribui atualizações em tempo real via WebSocket.
7. Mudanças de estado e violações de SLA podem gerar notificações via Telegram.

---

## ⚙️ Como funciona

### Estados dos dispositivos

Um dispositivo pode assumir três estados:

```text
unknown → online → offline
             ↑        │
             └────────┘
```

Estados disponíveis:

- `unknown`
- `online`
- `offline`

Um dispositivo somente passa para `offline` após **3 falhas consecutivas**.

O número de falhas é configurável por dispositivo, evitando alertas causados por uma única perda momentânea.

---

### 🔄 Worker de monitoramento

O monitoramento é executado por um processo independente:

```bash
python -m app.worker
```

Características:

- Um único worker.
- Sem eleição de líder.
- Concorrência limitada.
- Uma nova rodada não começa enquanto a anterior estiver em execução.
- Cada rodada registra as métricas.
- O estado do dispositivo é atualizado conforme o resultado.
- Eventos são gerados somente quando necessário.
- Notificações são enviadas apenas quando ocorre uma mudança relevante.

Eventos monitorados:

- Dispositivo ficou offline.
- Dispositivo voltou online.
- SLA foi excedido.
- SLA voltou ao normal.

---

## 📊 Monitoramento de SLA

O SLA é calculado através de agregações por hora, evitando depender apenas da relação instantânea entre dispositivos online e total de dispositivos.

Janelas disponíveis:

- `24h`
- `7d`
- `30d`

O histórico de uptime e os limites de SLA são persistidos no servidor.

---

## 🔔 Alertas e Telegram

Os alertas são persistidos no backend e podem ser reconhecidos pelo usuário.

O sistema permite:

- Reconhecer alertas individualmente.
- Reconhecer todos os alertas.
- Configurar limites de SLA.
- Configurar integração com Telegram.
- Testar notificações.
- Testar dispositivos.

### Segurança do Telegram

O token do Telegram:

- É armazenado criptografado usando **Fernet**.
- Nunca é retornado pela API.
- A API informa somente se existe um token configurado.

---

## 🔎 Diagnóstico de rede

O OrbNOC disponibiliza ferramentas de diagnóstico:

- Ping
- Traceroute
- DNS Lookup
- Teste de porta
- Diagnóstico completo

Os comandos são executados sem shell, utilizando argumentos estruturados.

Os hosts são previamente validados para impedir acesso a destinos indevidos.

### Restrições de rede

São bloqueados:

- Loopback
- Endereços link-local
- Endereços de metadata de provedores de nuvem

Redes privadas permanecem permitidas através da configuração:

```env
ALLOW_PRIVATE_NETWORKS=true
```

Isso permite utilizar o OrbNOC para monitoramento de infraestrutura local.

---

## 🌐 ICMP e fallback TCP

O worker tenta utilizar ICMP para as verificações.

Em ambientes que bloqueiam ICMP, o sistema detecta automaticamente a limitação e utiliza conexões TCP.

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

O endpoint:

```text
GET /health
```

informa o modo atual através do campo:

```text
icmp_mode
```

Em ambientes Docker, o worker utiliza:

```text
CAP_NET_RAW
```

---

## 📑 Relatórios

O backend disponibiliza relatórios operacionais nos formatos:

- CSV
- XLSX

Os arquivos são gerados no servidor e possuem proteção contra **injeção de fórmulas**.

O relatório em PDF utiliza a própria tela de impressão do navegador:

```text
/reports/print
```

---

## ❤️ Health Checks

O endpoint:

```text
GET /health
```

realiza verificações reais de:

- PostgreSQL
- Redis
- Heartbeat do worker

Caso algum componente essencial esteja indisponível, o endpoint retorna:

```text
503 Service Unavailable
```

Também existe o endpoint:

```text
GET /health/live
```

para verificação básica de disponibilidade da aplicação.

---

# 🐳 Executando com Docker

## 1. Configurar ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env` e configure pelo menos:

```env
JWT_SECRET=
POSTGRES_PASSWORD=
ADMIN_PASSWORD=
```

Para gerar um segredo JWT:

```bash
openssl rand -hex 32
```

---

## 2. Iniciar o ambiente

```bash
docker compose up --build
```

Depois, acesse:

```text
http://localhost:8080
```

Entre utilizando:

```text
ADMIN_USERNAME
ADMIN_PASSWORD
```

> Não existe login demo. Cada usuário possui sua própria conta e acessa somente seus dispositivos, alertas e configurações do Telegram.

---

# 👥 Gerenciamento de usuários

Usuários com perfil `admin` podem acessar **Usuários** pelo cabeçalho da aplicação.

É possível:

- Criar usuários.
- Redefinir senhas.
- Desativar usuários.
- Reativar usuários.
- Alterar perfil.
- Remover usuários.

Perfis disponíveis:

```text
admin
user
```

Quando um usuário é desativado:

- O login é bloqueado.
- Seus dispositivos deixam de ser monitorados.

---

## 📝 Registro público

O cadastro público vem desativado por padrão.

Para habilitar:

```env
REGISTRATION_ENABLED=true
```

---

# 🔐 Redefinir senha do administrador

O administrador definido no `.env` é criado somente na primeira inicialização, quando o banco ainda está vazio.

Alterar posteriormente:

```env
ADMIN_PASSWORD=
```

não altera a senha já armazenada no banco.

Para redefinir a senha:

```bash
docker compose exec backend \
  python -m app.create_admin \
  --reset \
  -u admin \
  -p 'NovaSenha123'
```

Também é possível omitir a senha:

```bash
docker compose exec backend \
  python -m app.create_admin --reset -u admin
```

Nesse caso, o sistema solicitará a nova senha.

Sem `-u`, o valor de `ADMIN_USERNAME` será utilizado.

---

# ⏱️ Intervalo de monitoramento

O intervalo padrão é:

```text
30 segundos
```

Por dispositivo, é possível configurar valores entre:

```text
5 segundos → 3600 segundos
```

Com a configuração padrão:

```text
30s × 3 falhas = ~90s
```

Portanto, um dispositivo normalmente será considerado offline após aproximadamente **90 segundos** de falhas consecutivas.

---

# 🚀 Produção

Configure:

```env
SITE_ADDRESS=seu.dominio
PUBLIC_URL=https://seu.dominio
ENVIRONMENT=production
```

Em produção:

- `JWT_SECRET` forte é obrigatório.
- Cookies utilizam a flag `Secure`.
- HTTPS é necessário.
- O Caddy gerencia automaticamente o certificado TLS.

---

# 💻 Desenvolvimento

## Requisitos

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- Node.js 20.9+
- PostgreSQL
- Redis
- `traceroute`

---

## Backend

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

---

## Frontend

```bash
cd frontend

npm install

cp .env.example .env.local

npm run dev
```

No ambiente de desenvolvimento sem Caddy, adicione ao `.env` do backend:

```env
EXTRA_ORIGINS=http://localhost:3000
```

Isso permite que o mecanismo de CSRF aceite a origem do frontend local.

---

# 🗃️ Migrations

Após alterar os modelos em:

```text
backend/app/db/models.py
```

gere uma nova migration:

```bash
uv run alembic revision \
  --autogenerate \
  -m "descrição"
```

Depois aplique:

```bash
uv run alembic upgrade head
```

---

# 🧪 Testes

## Backend

```bash
cd backend

uv run ruff check .
uv run pytest
```

Os testes utilizam PostgreSQL e Redis reais.

Configurações:

```env
TEST_DATABASE_URL=
TEST_REDIS_URL=
```

Por padrão, o banco de testes utiliza:

```text
orbnoc_test
```

no PostgreSQL local.

As migrations são aplicadas do zero a cada execução dos testes.

---

## Frontend

```bash
cd frontend

npm run typecheck
npm run lint
npm run build
```

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
├── docker-compose.yml
├── Caddyfile
├── .env.example
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── README.md
├── SECURITY.md
└── LICENSE
```

---

# 🔌 API

## Autenticação

| Método | Endpoint | Descrição |
|---|---|---|
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/logout` | Logout |
| `GET` | `/api/auth/me` | Usuário autenticado |
| `GET` | `/api/auth/config` | Configuração de autenticação |
| `POST` | `/api/auth/register` | Registro, quando habilitado |

---

## Usuários

> Disponível para administradores.

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/users` | Listar usuários |
| `POST` | `/api/users` | Criar usuário |
| `PATCH` | `/api/users/{id}` | Atualizar usuário |
| `DELETE` | `/api/users/{id}` | Remover usuário |

---

## Dispositivos

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/devices` | Listar dispositivos |
| `POST` | `/api/devices` | Criar dispositivo |
| `PATCH` | `/api/devices/{id}` | Atualizar dispositivo |
| `DELETE` | `/api/devices/{id}` | Remover dispositivo |
| `GET` | `/api/devices/{id}/ping` | Ping |
| `POST` | `/api/devices/{id}/check-port` | Testar porta |
| `GET` | `/api/devices/{id}/history` | Histórico |
| `GET` | `/api/devices/{id}/sla` | SLA |

---

## Alertas

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/alerts` | Listar alertas |
| `POST` | `/api/alerts/{id}/ack` | Reconhecer alerta |
| `POST` | `/api/alerts/ack-all` | Reconhecer todos |
| `GET` | `/api/alerts/telegram` | Configuração Telegram |
| `POST` | `/api/alerts/telegram` | Configurar Telegram |
| `DELETE` | `/api/alerts/telegram` | Remover Telegram |
| `POST` | `/api/alerts/sla/configure` | Configurar SLA |
| `POST` | `/api/alerts/test-telegram` | Testar Telegram |
| `POST` | `/api/alerts/test-host` | Testar host |

---

## Diagnóstico

| Método | Endpoint |
|---|---|
| `POST` | `/api/diagnostic/ping` |
| `POST` | `/api/diagnostic/traceroute` |
| `POST` | `/api/diagnostic/port-check` |
| `POST` | `/api/diagnostic/dns-lookup` |
| `POST` | `/api/diagnostic/full-diagnostic` |

---

## Relatórios

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/sla` | Indicadores de SLA |
| `GET` | `/api/uptime-series` | Série histórica de uptime |
| `GET` | `/api/reports/summary` | Resumo operacional |
| `GET` | `/api/reports/export` | Exportação CSV/XLSX |

Exemplo:

```text
/api/reports/export?format=csv&window=24h
```

Janelas disponíveis:

```text
24h
7d
30d
```

---

## Tempo real

WebSocket:

```text
WS /ws
```

A autenticação utiliza o cookie de sessão.

Mensagens principais:

```text
devices_update
event
```

---

## Health

```text
GET /health
GET /health/live
```

---

# 📐 Convenções da API

Os campos seguem `snake_case`.

Exemplos:

```json
{
  "latency": 12.4,
  "latency_ms": 12.4,
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

## 📚 Documentação da API

A documentação interativa pode ser habilitada através de:

```env
ENABLE_DOCS=true
```

Depois, acesse:

```text
/api/docs
```

---

# 🔒 Segurança

O OrbNOC possui mecanismos de proteção para diferentes áreas da aplicação:

- Senhas protegidas com Argon2.
- JWT armazenado em cookie `httpOnly`.
- Cookies `Secure` em produção.
- Proteção CSRF baseada em origens conhecidas.
- Rate limit para login utilizando Redis.
- Tokens do Telegram criptografados.
- Validação de hosts para diagnóstico.
- Bloqueio de loopback e endereços de metadata.
- Execução de comandos sem shell.
- Proteção contra injeção de fórmulas em relatórios.
- Controle de acesso por perfil.
- Isolamento dos dispositivos por usuário.

---

# 📌 Principais características

```text
┌───────────────────────────────────────────────────────┐
│                       OrbNOC                          │
├───────────────────────────────────────────────────────┤
│                                                       │
│  📡 Monitoramento ICMP / TCP                          │
│  📊 Latência · Jitter · Packet Loss                   │
│  🚨 Alertas e SLA                                     │
│  🔔 Telegram                                          │
│  🔎 Diagnóstico de rede                              │
│  📈 Histórico e uptime                               │
│  🗺️ Mapa                                             │
│  📑 CSV / XLSX                                       │
│  🖥️ Wallboard                                        │
│  ⚡ WebSocket em tempo real                           │
│  👥 Controle de usuários                             │
│  🔐 Autenticação e autorização                        │
│  ❤️ Health checks                                    │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

# 📄 Licença

Este projeto está licenciado sob a licença **MIT**.

Consulte o arquivo [`LICENSE`](./LICENSE) para mais informações.
