# 🛰️ OrbNOC

<div align="center">

<img src="./frontend/public/assets/images/banner.png" alt="OrbNOC Banner" width="100%" />

# Enterprise Network Operations Center Platform

### Monitoramento de infraestrutura, disponibilidade e desempenho em tempo real

[![Version](https://img.shields.io/badge/version-2.1.0-blue)]()
[![Status](https://img.shields.io/badge/status-active-success)]()
[![Next.js](https://img.shields.io/badge/Next.js-14-black)]()
[![Python](https://img.shields.io/badge/Python-3.12-blue)]()
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-05998b)]()
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)]()
[![License](https://img.shields.io/badge/license-MIT-orange)]()

### 🖥️ Roda localmente com Docker Compose e em produção com Render + Vercel + Neon

</div>

---

## 🚀 Demo

| Ambiente    | URL                                    |
| ----------- | -------------------------------------- |
| Frontend    | <https://orb-noc-hazel.vercel.app>     |
| Backend API | <https://orbnoc-jj74.onrender.com>     |

---

## 📋 Índice

* Sobre
* Principais Recursos
* Screenshots
* Arquitetura
* Stack Tecnológica
* Estrutura do Projeto
* Rodando Localmente
* Variáveis de Ambiente
* Segurança
* Testes e Lint
* Deploy em Produção
* Roadmap
* Contribuição
* Licença

---

# 📖 Sobre o Projeto

O **OrbNOC** é uma plataforma moderna de **Network Operations Center (NOC)** desenvolvida para monitoramento contínuo de infraestrutura de rede, servidores e serviços críticos.

Projetado para provedores de internet, equipes de operações, MSPs e administradores de sistemas, o OrbNOC fornece uma visão centralizada da saúde operacional do ambiente através de dashboards em tempo real, alertas inteligentes e ferramentas avançadas de diagnóstico.

O backend é escrito em **Python (FastAPI)**. O contrato da API REST e o protocolo WebSocket (Socket.IO) são compatíveis com o `socket.io-client` usado pelo frontend em Next.js.

### Principais Benefícios

✅ Monitoramento em tempo real
✅ Alertas automatizados
✅ Diagnóstico integrado
✅ Dashboard operacional moderno
✅ Wallboard para NOC
✅ Arquitetura escalável

---

# ✨ Principais Recursos

## 📡 Monitoramento

* Disponibilidade de Hosts (ICMP + fallback TCP)
* Monitoramento de Portas
* Latência
* Jitter
* Packet Loss
* SLA
* Uptime

## 🔔 Sistema de Alertas

* Alertas em tempo real
* Integração Telegram
* Histórico de incidentes
* Reconhecimento de alertas
* Escalonamento de criticidade

## 📊 Dashboard Operacional

* KPIs em tempo real
* Gráficos interativos
* Filtros avançados
* Busca instantânea
* Ordenação dinâmica
* Atualização via WebSocket

## 🗺️ Topologia de Rede

* React Flow
* Layout Hierárquico
* Layout Radial
* Layout Grid
* Status visual dos dispositivos
* Links animados

## 🔧 Ferramentas de Diagnóstico

* Ping Avançado
* Traceroute
* DNS Lookup (com reverse lookup via registro PTR)
* TCP Port Scanner
* Diagnóstico Inteligente

## 📺 Wallboard

* Modo TV
* Atualização automática
* Visualização otimizada para NOC
* Exibição de incidentes críticos

---

# 📸 Screenshots

## Dashboard Principal

<img src="./frontend/public/assets/images/dashboard.png" alt="Dashboard" width="100%" />

## Centro de Alertas

<img src="./frontend/public/assets/images/alerts.png" alt="Alerts" width="100%" />

## Mapa de Rede

<img src="./frontend/public/assets/images/topology.png" alt="Topology" width="100%" />

---

# 🏗️ Arquitetura

```mermaid
graph TD

A[Browser] --> B[Next.js Frontend]

B --> C[Socket.IO]
B --> D[REST API]

C --> E[Python Backend / FastAPI]
D --> E

E --> F[(PostgreSQL)]

E --> G[Monitor Engine]
E --> H[Alert Engine]

G --> I[TCP / ICMP Checks]
G --> J[Latency Monitoring]

H --> K[Telegram]
```

### Topologia de produção

```mermaid
graph LR

U[Usuário] --> V[Vercel<br/>Frontend Next.js]
V -- REST + WebSocket --> R[Render<br/>Backend FastAPI - Docker]
R --> N[(Neon<br/>PostgreSQL)]
R -- ICMP / TCP --> T[Dispositivos monitorados]
```

---

# ⚙️ Stack Tecnológica

## Frontend

* Next.js 14
* React 18
* TypeScript
* Tailwind CSS
* Recharts
* React Flow
* Socket.IO Client

## Backend

* Python 3.12
* FastAPI
* asyncpg (driver PostgreSQL assíncrono)
* SQLAlchemy 2.0 (async) + Alembic
* python-socketio
* PyJWT + bcrypt
* httpx (alertas Telegram)
* dnspython (diagnóstico DNS)

## Banco de Dados

* PostgreSQL (local via Docker Compose; em produção, Neon ou PostgreSQL do Render)

## Infraestrutura

* Docker / Docker Compose (local)
* Render (backend, via Blueprint `render.yaml`)
* Vercel (frontend)
* Neon (PostgreSQL gerenciado)
* GitHub Actions (CI)

---

# 📂 Estrutura do Projeto

```
OrbNOC/
├── backend-python/
│   ├── app/
│   │   ├── app.py               # Criação da app FastAPI (CORS, logger, registro das rotas)
│   │   ├── config.py            # Variáveis de ambiente (inclui normalização da DATABASE_URL)
│   │   ├── database.py          # Pool asyncpg, criação de tabelas (bootstrap) e seed do admin
│   │   ├── security.py          # Hash de senha + JWT
│   │   ├── auth_dependency.py   # Dependência de autenticação das rotas
│   │   ├── rate_limit.py        # Configuração do slowapi (limiter usado em login/registro)
│   │   ├── sockets.py           # Servidor Socket.IO
│   │   ├── db/                  # SQLAlchemy 2.0 async: engine.py, base.py, models.py
│   │   ├── repositories/        # device_repository.py, user_repository.py
│   │   ├── routes/              # auth, devices, alerts, diagnostic, public, admin
│   │   └── services/            # ping, traceroute, dns, telegram, monitor, device
│   ├── migrations/              # Alembic (env.py, versions/ — baseline do schema)
│   ├── tests/                   # unitários (services/repositories) + tests/integration (Postgres real via testcontainers)
│   ├── server.py                # Entrypoint (uvicorn + loop de monitoramento)
│   ├── alembic.ini
│   ├── pyproject.toml           # Config do pytest e do ruff
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── .dockerignore
│   ├── .env.example
│   └── Dockerfile
├── frontend/                    # Next.js 14 (App Router)
│   ├── src/
│   │   ├── app/                 # Rotas: /, /login, /alerts, /diagnostic, /network-map, /reports, /wallboard, /health
│   │   ├── components/dashboard/# Componentes extraídos da página principal (KPIs, tabelas, gráficos, modais)
│   │   ├── lib/                 # Funções auxiliares (ex.: cálculo de latência)
│   │   ├── types/               # Tipos TypeScript compartilhados
│   │   └── config.ts            # URL da API (NEXT_PUBLIC_API_URL)
│   ├── public/
│   ├── package.json
│   ├── .env.example
│   └── Dockerfile
├── .github/workflows/ci.yml     # Lint + testes (backend e frontend) + build das imagens Docker
├── docker-compose.yml           # Ambiente local completo (Postgres + backend + frontend)
├── render.yaml                  # Blueprint do Render (backend + PostgreSQL)
├── CONTRIBUTING.md
└── README.md
```

---

# 🚀 Rodando Localmente

## Pré-requisitos

* [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e rodando (para a Opção 1)
* Ou, para rodar sem Docker: Python 3.11+, Node.js 20+ e PostgreSQL instalados localmente

## Opção 1 — Docker Compose (recomendado, sobe tudo com 1 comando)

Sobe o PostgreSQL, o backend e o frontend juntos, já configurados para se falarem via `localhost`. As tabelas do banco e um usuário de demonstração são criados automaticamente na primeira inicialização.

```bash
docker compose up --build
```

Acesse:

* **Frontend:** http://localhost:3000
* **Backend API:** http://localhost:3001
* **PostgreSQL:** localhost:5433 (usuário `postgres`, senha `postgres`, banco `orbnoc`)

**Login de demonstração** (criado automaticamente **apenas em desenvolvimento**):

```
usuário: admin
senha:   admin123
```

Em produção (`ENVIRONMENT=production`) esse usuário **não** é criado — veja [Segurança](#-segurança).

Para parar:

```bash
docker compose down
```

Para parar **e apagar os dados do banco** (útil se algo ficou inconsistente e você quer recomeçar do zero):

```bash
docker compose down -v
```

### Problemas comuns

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| `Conflict. The container name "/orbnoc-db" is already in use` | Sobrou container de uma execução anterior | `docker compose down` e rode `up --build` de novo |
| Erro 500 ao logar / `relation "..." does not exist` nos logs | Backend subiu antes do Postgres estar pronto | Já tratado via healthcheck + retry automático; se persistir, rode `docker compose down -v` para recriar o banco do zero |
| Falha ao baixar imagens (`no such host`, `registry-1.docker.io`) | Problema de DNS/rede do Docker Desktop | Reinicie o Docker Desktop, ou configure DNS manual (8.8.8.8 / 1.1.1.1) em *Settings → Docker Engine* |

## Opção 2 — Rodando manualmente (sem Docker)

### Backend

```bash
cd backend-python
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# edite .env e ajuste DATABASE_URL para o seu PostgreSQL local
python server.py
```

> Requer Python 3.11+ e o comando `ping` disponível no sistema (no Linux,
> pacote `iputils-ping`; no Windows/macOS já vem instalado por padrão).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Por padrão o frontend já aponta para `http://localhost:3001` (backend local), sem precisar configurar nada — mas se quiser ser explícito, ou apontar para um backend remoto:

```bash
cd frontend
cp .env.example .env.local
# edite NEXT_PUBLIC_API_URL e reinicie o `npm run dev`
```

---

# 🔧 Variáveis de Ambiente

## Backend (`backend-python`)

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `PORT` | `3001` | Porta HTTP do backend (o Render define automaticamente) |
| `ENVIRONMENT` | `development` | Use `production` para ativar as travas de segurança de produção (ver [Segurança](#-segurança)) |
| `JWT_SECRET` | *(valor de dev, trocar em produção)* | Segredo usado para assinar os tokens JWT. **Obrigatório e sem valor padrão aceito quando `ENVIRONMENT=production`** — o backend recusa subir se detectar o segredo de desenvolvimento em produção. |
| `DATABASE_URL` | — | String de conexão PostgreSQL (`postgresql://user:pass@host:5432/db`). Aceita também `postgres://`, e os parâmetros `sslmode` e `channel_binding` (comuns no Neon) são tratados automaticamente. O backend não sobe sem ela. |
| `DATABASE_SSL` | `false` | `true` para exigir SSL. Ligado automaticamente se a URL tiver `sslmode=require` |
| `FRONTEND_URL` | `http://localhost:3000` | Origem liberada no CORS (HTTP e WebSocket). Sem `/` no final |
| `EXTRA_CORS_ORIGINS` | — | Origens extras liberadas no CORS, separadas por vírgula |
| `CORS_ORIGIN_REGEX` | — | Regex opcional para liberar vários domínios de uma vez (ex.: previews da Vercel). Ex.: `^https://(meu-app\|meu-app-[a-z0-9-]+-meuusuario)\.vercel\.app$` |
| `ADMIN_USERNAME` | `admin` | Usuário admin criado na primeira subida |
| `ADMIN_EMAIL` | `admin@orbnoc.local` | E-mail do admin criado na primeira subida |
| `ADMIN_PASSWORD` | — | Senha do admin. Em desenvolvimento, se vazia, usa `admin123`. **Em produção, se vazia, nenhum admin é criado** |
| `MONITOR_INTERVAL_MS` | `10000` | Intervalo entre varreduras de monitoramento |
| `LOGIN_RATE_LIMIT` | `5/minute` | Limite de tentativas de login por IP |
| `REGISTER_RATE_LIMIT` | `3/minute` | Limite de registros por IP |

## Frontend (`frontend`)

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | URL pública do backend. **É embutida no JavaScript durante o build**: se você alterar o valor, é preciso fazer um novo build/deploy (na Vercel, um redeploy). |

---

# 🔒 Segurança

* **CORS** é restrito à(s) origem(ns) definidas em `FRONTEND_URL`/`EXTRA_CORS_ORIGINS` (e, opcionalmente, a uma regex em `CORS_ORIGIN_REGEX`) — nunca reflete qualquer origem. A mesma regra vale para o WebSocket (Socket.IO).
* **JWT_SECRET**: o backend recusa iniciar em produção (`ENVIRONMENT=production`) se detectar o segredo de desenvolvimento. Gere um valor próprio, por exemplo com `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`. Trocar o segredo desloga todos os usuários.
* **Usuário admin**: em desenvolvimento, `admin/admin123` é criado automaticamente para facilitar o uso local. Em produção o backend **só cria o admin se `ADMIN_PASSWORD` estiver definida** — nunca sobe uma senha pública e conhecida. O seed só cria o usuário se ele ainda não existir; para trocar a senha de um admin já criado, apague o registro (`DELETE FROM users WHERE username = 'admin';`) e reinicie o backend com a nova `ADMIN_PASSWORD`.
* **Rate limiting** em `/api/auth/login` e `/api/auth/register` (configurável via env vars acima).
* **RBAC**: usuários com `role = 'admin'` têm acesso a `/api/admin/*` (listar usuários, ver logs de acesso, remover usuários).
* **Segredos**: nunca versione `.env` nem compartilhe capturas de tela com `JWT_SECRET` ou `DATABASE_URL` visíveis. Se um segredo vazar, gere outro e atualize a variável no provedor.
* **Vulnerabilidades conhecidas do frontend** (`npm audit`): a biblioteca `xlsx` (SheetJS) tem CVEs sem correção publicada no momento (prototype pollution / ReDoS). Se a exportação para Excel não for essencial, considere substituí-la por uma alternativa mantida (ex: `exceljs`) ou mover a geração para o backend.

---

# 🧪 Testes e Lint

```bash
cd backend-python
pip install -r requirements-dev.txt
pytest -v          # security, services (ping, traceroute, device), repositories,
                   # rotas (incl. RBAC) e testes de integração contra Postgres real
ruff check .       # lint
```

Os testes em `tests/integration/` sobem um PostgreSQL real via **testcontainers** e rodam as migrations do Alembic de verdade — exigem Docker disponível na máquina (em ambientes sem Docker, são pulados automaticamente em vez de falhar). Os demais testes usam SQLite in-memory com o schema gerado a partir dos models SQLAlchemy.

```bash
cd frontend
npm run lint
npm run build
```

O workflow `.github/workflows/ci.yml` roda automaticamente ambos em cada push/PR para `main`, além de validar que as imagens Docker buildam.

---

# ☁️ Deploy em Produção

A configuração de referência usa **Render** (backend), **Vercel** (frontend) e **Neon** (PostgreSQL), mas qualquer combinação equivalente funciona.

## 1. Banco de dados

* **Neon (ou outro PostgreSQL gerenciado):** crie o banco e copie a connection string. Não é necessário remover `?sslmode=require&channel_binding=require` da URL — o backend trata esses parâmetros.
* **PostgreSQL do Render:** o `render.yaml` já cria um banco e liga o `DATABASE_URL` ao backend automaticamente (use a *Internal Database URL*, na mesma região do backend).

## 2. Backend no Render

O repositório inclui um Blueprint (`render.yaml`) que cria o serviço web do backend (Docker, usando `backend-python/Dockerfile`) e um PostgreSQL gerenciado.

1. Suba o projeto para o GitHub, com o `render.yaml` na raiz da branch de deploy.
2. No Render: **New → Blueprint** e selecione o repositório e a branch.
3. Preencha as variáveis solicitadas:
   * `FRONTEND_URL`: URL pública do frontend (ex.: `https://orb-noc-hazel.vercel.app`, sem `/` no final).
   * `ADMIN_PASSWORD`: senha do usuário `admin` (obrigatória para que o admin seja criado em produção).
   * `CORS_ORIGIN_REGEX` (opcional): para liberar as URLs de preview da Vercel.
4. Se for usar o Neon em vez do banco do Render, remova o bloco `databases` do `render.yaml` e defina `DATABASE_URL` manualmente no serviço.
5. Após o deploy, teste `https://<seu-servico>.onrender.com/health`.

> Se você criar o serviço **manualmente** (sem Blueprint), configure em *Settings*: *Dockerfile Path* `./backend-python/Dockerfile` e *Docker Build Context* `./backend-python`, e defina no *Environment*: `ENVIRONMENT=production`, `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL` e `ADMIN_PASSWORD`.

Observações:

* O `JWT_SECRET` é gerado automaticamente pelo Blueprint.
* O monitoramento roda dentro do processo do servidor; por isso o plano `starter` (sem hibernação) é recomendado. No plano gratuito o serviço hiberna sem tráfego e o monitoramento para junto.
* O backend só consegue monitorar dispositivos alcançáveis pela internet. IPs de rede local (192.168.x.x, 10.x.x.x) não são acessíveis a partir do Render; para monitorar uma LAN, rode o backend dentro da rede ou use uma VPN.

## 3. Frontend na Vercel

1. Importe o repositório na Vercel e defina o **Root Directory** como `frontend`.
2. Em *Environment Variables*, crie `NEXT_PUBLIC_API_URL` com a URL do backend (ex.: `https://orbnoc-jj74.onrender.com`, sem `/` no final).
3. Faça o deploy. Sempre que alterar `NEXT_PUBLIC_API_URL`, faça um novo deploy (a variável é gravada no build).

## 4. Checklist de produção

1. **`ENVIRONMENT=production`** e um `JWT_SECRET` forte e único (o backend recusa subir sem isso).
2. **`FRONTEND_URL`** com o domínio real do frontend (HTTPS) — não deixe o padrão de localhost.
3. **TLS**: Render e Vercel já entregam HTTPS. Se hospedar por conta própria, coloque um reverse proxy com TLS (Nginx, Caddy ou o load balancer do provedor) na frente — nem o backend Python nem o Next.js standalone servem HTTPS diretamente.
4. **Banco com backup**: o schema é criado automaticamente no primeiro boot (`create_tables`, em `database.py`), e o projeto tem migrations Alembic (`backend-python/migrations/`) com o baseline do schema; nada disso substitui o backup dos dados. Confira a política de backup e retenção do seu provedor.
5. **`ADMIN_PASSWORD` forte** definida antes do primeiro deploy (veja [Segurança](#-segurança)).
6. **Logs**: o backend loga em stdout; use o painel de logs do provedor ou um agregador (ex.: Loki, CloudWatch).
7. **Uma única instância do backend**: o loop de monitoramento roda dentro do processo, então rodar múltiplas réplicas duplica as leituras e os alertas. Mantenha uma instância responsável pelo loop, ou externalize-o para um worker dedicado antes de escalar horizontalmente.

## 5. Problemas comuns em produção

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| Frontend chama `localhost:3001` (`ERR_CONNECTION_REFUSED`) | `NEXT_PUBLIC_API_URL` ausente no momento do build | Defina a variável e faça um novo deploy/build (limpando o cache de build, se necessário) |
| `blocked by CORS policy` no console | A origem do frontend não está liberada no backend | Confira `FRONTEND_URL` (sem `/` no final) e adicione outras origens em `EXTRA_CORS_ORIGINS` ou `CORS_ORIGIN_REGEX`. Confirme também que o último deploy do backend ficou *Live* — se falhou, o Render mantém a versão antiga no ar. Um backend fora do ar ou hibernando também aparece como erro de CORS |
| `Connection refused` ao conectar no PostgreSQL / `DATABASE_URL não está definida` | Variável `DATABASE_URL` ausente no serviço | Defina `DATABASE_URL` no *Environment* do backend |
| `JWT_SECRET não definido` / backend recusa subir em produção | Segredo padrão de desenvolvimento em uso | Defina um `JWT_SECRET` próprio |
| Login do admin não funciona em produção | `ADMIN_PASSWORD` não definida (admin não criado) ou admin antigo com outra senha | Defina `ADMIN_PASSWORD`, apague o registro do admin no banco e reinicie o backend |
| `failed to calculate checksum ... "/requirements.txt": not found` no build | Contexto do Docker apontando para a raiz do repositório | Use *Dockerfile Path* `./backend-python/Dockerfile` e *Docker Build Context* `./backend-python` (ou o Blueprint) |

---

# 🛣️ Roadmap

* [x] Dashboard Operacional
* [x] Alertas Telegram
* [x] Topologia de Rede
* [x] Diagnóstico Integrado (traceroute real via SO)
* [x] Wallboard
* [x] Backend em Python (FastAPI)
* [x] Testes automatizados + CI (GitHub Actions)
* [x] Rate limiting, RBAC e CORS restrito
* [x] Histórico de métricas (série temporal por dispositivo)
* [x] Deploy em produção (Render + Vercel + Neon)

### Próximas Funcionalidades

* [ ] Multi-Tenant
* [ ] SNMP Monitoring
* [ ] NetFlow
* [ ] Syslog Server
* [ ] Mobile App
* [ ] Dark/Light Themes
* [ ] Notificações por e-mail e webhook genérico (hoje só Telegram está implementado, embora o schema já tenha `email_alerts_enabled`)
* [ ] Gráfico de uptime/latência histórico no frontend consumindo `GET /api/devices/{id}/history`

---

# 🤝 Contribuição

Contribuições são bem-vindas. Veja o [CONTRIBUTING.md](./CONTRIBUTING.md) para o passo a passo (setup, testes, padrão de commits e PRs).

---

# 📄 Licença

Distribuído sob a licença MIT.

---

<div align="center">

### Desenvolvido por Adan William

Network Monitoring • NOC • Observability • Infrastructure

</div>
