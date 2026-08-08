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

### 🖥️ Projeto configurado para rodar 100% localmente

</div>

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
* python-socketio
* PyJWT + bcrypt
* httpx (alertas Telegram)
* dnspython (diagnóstico DNS)

## Banco de Dados

* PostgreSQL

## Infraestrutura

* Docker / Docker Compose (local)

---

# 📂 Estrutura do Projeto

```
OrbNOC/
├── backend-python/       # Backend em Python (FastAPI + Socket.IO)
│   ├── app/
│   │   ├── app.py             # Criação da app FastAPI (CORS, rotas, logger)
│   │   ├── config.py          # Variáveis de ambiente
│   │   ├── database.py        # Pool asyncpg, criação de tabelas, seed do admin
│   │   ├── security.py        # Hash de senha + JWT
│   │   ├── auth_dependency.py # Dependência de autenticação das rotas
│   │   ├── sockets.py          # Servidor Socket.IO
│   │   ├── routes/             # auth, devices, alerts, diagnostic, public
│   │   └── services/           # ping, dns, telegram, monitor
│   ├── server.py               # Entrypoint (uvicorn + loop de monitoramento)
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
├── frontend/               # Next.js
│   └── .env.example
├── docker-compose.yml
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

**Login de demonstração** (criado automaticamente):

```
usuário: admin
senha:   admin123
```

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

Por padrão o frontend já aponta para `http://localhost:3001` (backend local), sem precisar configurar nada — mas se quiser ser explícito:

```bash
cd frontend
cp .env.example .env.local
```

---

# 🔧 Variáveis de Ambiente (backend-python)

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `PORT` | `3001` | Porta HTTP do backend |
| `JWT_SECRET` | *(valor de dev, trocar em produção)* | Segredo usado para assinar os tokens JWT |
| `DATABASE_URL` | — | String de conexão PostgreSQL (`postgresql://user:pass@host:5432/db`) |
| `DATABASE_SSL` | `false` | `true` para exigir SSL (bancos remotos) |
| `FRONTEND_URL` | `http://localhost:3000` | Usado no CORS do WebSocket |
| `MONITOR_INTERVAL_MS` | `10000` | Intervalo entre varreduras de monitoramento |

---

# 🛣️ Roadmap

* [x] Dashboard Operacional
* [x] Alertas Telegram
* [x] Topologia de Rede
* [x] Diagnóstico Integrado
* [x] Wallboard
* [x] Backend em Python (FastAPI)

### Próximas Funcionalidades

* [ ] Multi-Tenant
* [ ] SNMP Monitoring
* [ ] NetFlow
* [ ] Syslog Server
* [ ] Mobile App
* [ ] Dark/Light Themes

---

# 🤝 Contribuição

Contribuições são bem-vindas.

1. Fork o projeto
2. Crie uma branch
3. Faça commit das alterações
4. Abra um Pull Request

---

# 📄 Licença

Distribuído sob a licença MIT.

---

<div align="center">

### Desenvolvido por Adan William

Network Monitoring • NOC • Observability • Infrastructure

</div>
