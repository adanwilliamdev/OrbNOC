# 🛰️ OrbNOC

<h3 align="center">
Enterprise Network Operations Center Platform
</h3>

<p align="center">
Monitoramento de infraestrutura, disponibilidade e desempenho em tempo real.
</p>

<p align="center">

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Status](https://img.shields.io/badge/status-active-success)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)
![Socket.IO](https://img.shields.io/badge/WebSocket-Realtime-purple)
![License](https://img.shields.io/badge/license-MIT-orange)

</p>

---

# 🚀 Sobre o Projeto

O **OrbNOC** é uma plataforma moderna de monitoramento de infraestrutura desenvolvida para equipes de Network Operations Center (NOC), provedores de internet, administradores de sistemas e profissionais de TI que precisam acompanhar a disponibilidade e a saúde dos seus ativos em tempo real.

A plataforma oferece monitoramento contínuo, geração de alertas, análise de métricas e dashboards interativos para garantir máxima visibilidade operacional.

---

# ✨ Principais Recursos

### 📡 Monitoramento em Tempo Real

* Ping ICMP
* Latência
* Jitter
* Packet Loss
* Uptime
* Disponibilidade

### 🔔 Sistema de Alertas

* Alertas visuais
* Alertas sonoros
* Integração Telegram
* Integração Email
* Histórico de incidentes

### 📊 Dashboard Operacional

* KPIs em tempo real
* Gráficos interativos
* Widgets customizáveis
* Histórico de eventos
* Status dos dispositivos

### 📤 Relatórios

* PDF
* Excel
* CSV
* Exportação sob demanda

### 🔒 Segurança

* JWT Authentication
* Password Hashing (bcrypt)
* Controle de sessão
* Proteção CORS
* Validação de entradas

---

# 🖼️ Screenshots

## Dashboard Principal

<img src="./frontend/public/assets/images/dashboard-1.png" alt="OrbNOC Dashboard" width="100%">

---

# 🏗️ Arquitetura

```text
                    ┌─────────────┐
                    │   Browser   │
                    └──────┬──────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Next.js Frontend│
                  └────────┬────────┘
                           │
                     WebSocket
                           │
                           ▼
                  ┌─────────────────┐
                  │ Node.js Backend │
                  └────────┬────────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼

 PostgreSQL        Monitor Engine      Alert Engine
       │                   │                   │
       ▼                   ▼                   ▼

 Database          ICMP/TCP Checks    Telegram/Email
```

---

# 🛠️ Stack Tecnológica

## Frontend

* Next.js 14
* React
* TailwindCSS
* Socket.IO Client
* Recharts
* Lucide Icons
* jsPDF
* SheetJS

## Backend

* Node.js
* Express.js
* Socket.IO
* JWT
* bcrypt
* node-cron

## Banco de Dados

* PostgreSQL
* SQLite

## DevOps

* Docker
* Docker Compose
* GitHub Actions

---

# 📦 Estrutura do Projeto

```bash
OrbNOC/
│
├── backend/
│   ├── controllers/
│   ├── services/
│   ├── middleware/
│   ├── routes/
│   ├── models/
│   └── server.js
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── services/
│   ├── hooks/
│   ├── utils/
│   └── public/
│
├── docs/
│
├── docker-compose.yml
│
└── README.md
```

---

# 📊 Métricas Monitoradas

| Métrica           | Descrição            |
| ----------------- | -------------------- |
| Latência          | Tempo de resposta    |
| Jitter            | Variação da latência |
| Packet Loss       | Perda de pacotes     |
| Uptime            | Disponibilidade      |
| Status            | Online / Offline     |
| Tempo de Resposta | RTT Médio            |

---

# 🔌 API REST

## Dispositivos

| Método | Endpoint              |
| ------ | --------------------- |
| GET    | /api/devices          |
| POST   | /api/devices          |
| PUT    | /api/devices/:id      |
| DELETE | /api/devices/:id      |
| GET    | /api/devices/:id/ping |

---

## Autenticação

| Método | Endpoint           |
| ------ | ------------------ |
| POST   | /api/auth/register |
| POST   | /api/auth/login    |
| POST   | /api/auth/logout   |

---

# 🔔 Integração Telegram

## Criando o Bot

1. Abra o Telegram
2. Procure por @BotFather
3. Execute:

```text
/newbot
```

4. Copie o Token gerado

5. Descubra seu Chat ID usando:

```text
@userinfobot
```

6. Configure no OrbNOC

---

# 🚀 Instalação

## Pré-Requisitos

* Node.js 18+
* NPM
* PostgreSQL (Opcional)
* Docker (Opcional)

---

## Backend

```bash
cd backend

npm install
```

Crie o arquivo:

```env
DATABASE_URL=sqlite:./database.sqlite
JWT_SECRET=your_secret_key
PORT=3001
```

Execute:

```bash
npm start
```

Servidor:

```text
http://localhost:3001
```

---

## Frontend

```bash
cd frontend

npm install

npm run dev
```

Aplicação:

```text
http://localhost:3000
```

---

# 🐳 Deploy com Docker

```bash
docker-compose up -d
```

---

# ⚙️ Variáveis de Ambiente

```env
DATABASE_URL=postgresql://user:password@localhost:5432/orbnoc

JWT_SECRET=super_secret_key

PORT=3001

TELEGRAM_BOT_TOKEN=

TELEGRAM_CHAT_ID=

SMTP_HOST=

SMTP_PORT=

SMTP_USER=

SMTP_PASSWORD=
```

---

# 📈 Roadmap

## v2.0

* [x] Dashboard em Tempo Real
* [x] WebSocket
* [x] Alertas Telegram
* [x] Alertas Email
* [x] Relatórios PDF
* [x] Exportação Excel

## v2.5

* [ ] Monitoramento SNMP
* [ ] SLA Dashboard
* [ ] LDAP Authentication
* [ ] Syslog Collector

## v3.0

* [ ] AI Incident Analysis
* [ ] Root Cause Analysis
* [ ] Predictive Monitoring
* [ ] Network Discovery
* [ ] Topology Maps

---

# 🔮 Funcionalidades Futuras

* SNMP v2/v3
* NetFlow
* Syslog Server
* Active Directory
* Multi-Tenant
* RBAC
* Auditoria Completa
* Grafana Integration
* Prometheus Exporter
* Kubernetes Monitoring
* Cloud Monitoring

---

# 📊 Status do Projeto

| Funcionalidade   | Status |
| ---------------- | ------ |
| ICMP Monitoring  | ✅      |
| WebSocket        | ✅      |
| Dashboard        | ✅      |
| Exportação PDF   | ✅      |
| Exportação Excel | ✅      |
| Telegram Alerts  | ✅      |
| Email Alerts     | ✅      |
| Port Monitoring  | ✅      |
| Multiusuário     | ✅      |

---

# 🤝 Contribuindo

```bash
git checkout -b feature/new-feature

git commit -m "feat: add new feature"

git push origin feature/new-feature
```

Abra um Pull Request.

---

# 📄 Licença

MIT License

Copyright © 2026 Adan W. O. Santos

---

# ❤️ Desenvolvido por

### Adan W. O. Santos

**OrbNOC Platform**

Network Operations Center • Infrastructure Monitoring • Real-Time Analytics

<p align="center">
© 2026 OrbNOC Platform
</p>
