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
![Node.js](https://img.shields.io/badge/Node.js-20+-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)
![Socket.IO](https://img.shields.io/badge/WebSocket-Realtime-purple)
![License](https://img.shields.io/badge/license-MIT-orange)

</p>

---

# 🚀 Sobre o Projeto

O **OrbNOC** é uma plataforma moderna de monitoramento de infraestrutura desenvolvida para equipes de Network Operations Center (NOC), provedores de internet, administradores de sistemas e profissionais de TI que precisam acompanhar a disponibilidade e a saúde dos seus ativos em tempo real.

A plataforma oferece monitoramento contínuo, geração de alertas, análise de métricas e dashboards interativos para garantir máxima visibilidade operacional.

---

# 🌐 Deploy Online

| Serviço      | URL                                      |
| ------------ | ---------------------------------------- |
| Frontend     | https://orbnoc-taer.onrender.com         |
| Backend API  | https://orbnoc-backend-nmlq.onrender.com |
| Documentação | Em breve                                 |

## Credenciais de Demonstração

```text
Usuário: admin
Senha: admin123
```

---

# ✨ Principais Recursos

## 📡 Monitoramento em Tempo Real

* Ping ICMP / TCP Connect
* Latência
* Jitter
* Packet Loss
* Uptime
* Disponibilidade

## 🔔 Sistema de Alertas

* Alertas visuais
* Alertas sonoros
* Integração Telegram
* Integração Email
* Histórico de incidentes
* Alertas de SLA

## 📊 Dashboard Operacional

* KPIs em tempo real
* Gráficos interativos
* Widgets customizáveis
* Histórico de eventos
* Status dos dispositivos

## 📤 Relatórios

* PDF
* Excel
* CSV
* Exportação sob demanda

## 🔒 Segurança

* JWT Authentication
* Password Hashing (bcrypt)
* Controle de sessão
* Proteção CORS
* Validação de entradas

---

# 🖼️ Screenshots

## Dashboard Principal

![Dashboard OrbNOC](frontend/public/assets/images/dashboard-1.png)

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
                     WebSocket (WSS)
                           │
                           ▼
                  ┌─────────────────┐
                  │ Node.js Backend │
                  └────────┬────────┘
                           │
      ┌────────────────────┼────────────────────┐
      ▼                    ▼                    ▼

 PostgreSQL        Monitor Engine       Alert Engine
      │                    │                    │
      ▼                    ▼                    ▼

 Database         TCP Checks      Telegram / Email
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

* Node.js 20+
* Express.js
* Socket.IO
* JWT
* bcrypt
* node-cron

## Banco de Dados

* PostgreSQL
* SQLite (Desenvolvimento)

## DevOps

* Docker
* Docker Compose
* GitHub Actions
* Render.com

---

# 📦 Estrutura do Projeto

```text
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

## Autenticação

| Método | Endpoint           |
| ------ | ------------------ |
| POST   | /api/auth/register |
| POST   | /api/auth/login    |
| POST   | /api/auth/logout   |

## Alertas

| Método | Endpoint              |
| ------ | --------------------- |
| GET    | /api/alerts/telegram  |
| POST   | /api/alerts/telegram  |
| GET    | /api/alerts/email     |
| POST   | /api/alerts/email     |
| POST   | /api/alerts/notify    |
| POST   | /api/alerts/test-host |

---

# 🔔 Integração Telegram

## Criando o Bot

1. Abra o Telegram
2. Procure por **@BotFather**
3. Execute:

```text
/newbot
```

4. Copie o token gerado
5. Descubra seu Chat ID usando:

```text
@userinfobot
```

6. Configure no OrbNOC:

```text
Dashboard → Configurações → Telegram
```

---

# 🚀 Instalação Local

## Pré-Requisitos

* Node.js 20+
* NPM
* PostgreSQL (Opcional)
* Docker (Opcional)

## Backend

```bash
cd backend
npm install
```

Crie o arquivo `.env`:

```env
DATABASE_URL=postgresql://localhost:5432/orbnoc
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

# ☁️ Deploy no Render

## Backend

```text
Root Directory: backend
Build Command: npm install
Start Command: npm start
```

### Variáveis

```env
DATABASE_URL=
JWT_SECRET=
PORT=10000
```

## Frontend

```text
Root Directory: frontend
Build Command: npm install && npm run build
Start Command: npm start
```

### Variáveis

```env
NEXT_PUBLIC_API_URL=
NODE_ENV=production
```

---

# ⚠️ Observação

O Render não permite ICMP Ping nativamente.

Por isso o OrbNOC utiliza:

```text
TCP Connect (80/443)
```

como alternativa para validação de disponibilidade.

---

# 🐳 Deploy com Docker

```bash
docker-compose up -d
```

---

# ⚙️ Variáveis de Ambiente

## Backend

```env
DATABASE_URL=postgresql://user:password@localhost:5432/orbnoc
JWT_SECRET=super_secret_key
PORT=3001

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=

CORS_ORIGIN=https://seu-frontend.onrender.com
```

## Frontend

```env
NEXT_PUBLIC_API_URL=https://seu-backend.onrender.com
NEXT_PUBLIC_WS_URL=wss://seu-backend.onrender.com
NODE_ENV=production
```

---

# 📈 Roadmap

## v2.0 ✅

* Dashboard em Tempo Real
* WebSocket
* Alertas Telegram
* Alertas Email
* Relatórios PDF
* Exportação Excel
* TCP Connect
* Deploy no Render

## v2.5 🚧

* Monitoramento SNMP
* SLA Dashboard
* LDAP Authentication
* Syslog Collector
* Múltiplos Dashboards

## v3.0 🔮

* AI Incident Analysis
* Root Cause Analysis
* Predictive Monitoring
* Network Discovery
* Topology Maps

---

# 📊 Status do Projeto

| Funcionalidade      | Status |
| ------------------- | ------ |
| TCP/HTTP Monitoring | ✅      |
| WebSocket           | ✅      |
| Dashboard           | ✅      |
| Exportação PDF      | ✅      |
| Exportação Excel    | ✅      |
| Telegram Alerts     | ✅      |
| Email Alerts        | ✅      |
| Port Monitoring     | ✅      |
| Multiusuário        | ✅      |
| Autenticação JWT    | ✅      |
| Deploy no Render    | ✅      |

---

# 🤝 Contribuindo

```bash
git checkout -b feature/nova-funcionalidade
git commit -m "feat: adiciona nova funcionalidade"
git push origin feature/nova-funcionalidade
```

Abra um Pull Request.

---

# 📄 Licença

MIT License

Copyright © 2026 Adan W. O. Santos

---

# ❤️ Desenvolvido por

**Adan W. O. Santos**

OrbNOC Platform

Network Operations Center • Infrastructure Monitoring • Real-Time Analytics

<p align="center">
© 2026 OrbNOC Platform
</p>
