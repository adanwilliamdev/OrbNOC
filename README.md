# 🛰️ OrbNOC

<div align="center">

# Enterprise Network Operations Center Platform

Monitoramento de infraestrutura, disponibilidade e desempenho em tempo real.

![Version](https://img.shields.io/badge/version-2.1.0-blue)
![Status](https://img.shields.io/badge/status-active-success)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Node.js](https://img.shields.io/badge/Node.js-20+-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)
![Socket.IO](https://img.shields.io/badge/WebSocket-Realtime-purple)
![License](https://img.shields.io/badge/license-MIT-orange)

### 🌐 Acesso Online

**Frontend:** https://orbnoc-taer.onrender.com

**API:** https://orbnoc-backend-nmlq.onrender.com

</div>

---

## 📖 Sobre

O OrbNOC é uma plataforma moderna para monitoramento de infraestrutura desenvolvida para equipes de NOC, provedores de internet e profissionais de TI.

A solução oferece monitoramento contínuo, visualização em tempo real, geração de alertas inteligentes e análise operacional através de dashboards interativos.

---

## ✨ Principais Funcionalidades

### 📡 Monitoramento

* Disponibilidade de Hosts
* TCP Connect Monitoring
* Latência
* Jitter
* Packet Loss
* Uptime
* SLA

### 🔔 Sistema de Alertas

* Alertas em Tempo Real
* Integração Telegram
* Integração Email
* Histórico de Incidentes
* Reconhecimento de Alertas

### 📊 Dashboard Operacional

* KPIs Executivos
* Gráficos Interativos
* Filtros Avançados
* Busca por IP ou Host
* Atualização via WebSocket

### 🗺️ Mapa de Rede

* React Flow
* Layout Hierárquico
* Layout Radial
* Layout em Grade
* Topologia Visual

### 📈 Relatórios

* Exportação PDF
* Exportação Excel
* Histórico de Disponibilidade
* Tendência de Latência
* Filtros por Período

---

## 🖼️ Screenshots

### Dashboard Principal

![Dashboard](frontend/public/assets/images/dashboard-1.png)

### Mapa de Rede

![Network Map](frontend/public/assets/images/Mapa-de-rede.png)

### Centro de Alertas

![Alerts](frontend/public/assets/images/Central-alertas.png)

---

## 🏗️ Arquitetura

```mermaid
flowchart TD

A[Browser]
B[Next.js Frontend]
C[WebSocket]
D[Node.js Backend]
E[PostgreSQL]
F[Monitor Engine]
G[Alert Engine]
H[Telegram]
I[Email]

A --> B
B --> C
C --> D

D --> E
D --> F
D --> G

G --> H
G --> I
```

## 🛠️ Stack Tecnológica

### Frontend

* Next.js 14
* React
* TailwindCSS
* Socket.IO Client
* React Flow
* Recharts
* jsPDF
* SheetJS

### Backend

* Node.js
* Express.js
* Socket.IO
* JWT
* bcrypt
* node-cron

### Banco de Dados

* PostgreSQL
* SQLite

### DevOps

* Docker
* Docker Compose
* GitHub Actions
* Render

---

## 📁 Estrutura do Projeto

```text
OrbNOC
├── backend
├── frontend
├── docs
├── docker-compose.yml
└── README.md
```

---

## 🔐 Credenciais Demo

```text
Usuário: admin
Senha: admin123
```

---

## 🚀 Instalação

### Backend

```bash
cd backend
npm install
npm start
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## ⚙️ Variáveis de Ambiente

### Backend

```env
DATABASE_URL=
JWT_SECRET=

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

SMTP_HOST=
SMTP_USER=
SMTP_PASSWORD=
```

### Frontend

```env
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_WS_URL=
```

---

## 📌 Roadmap

### v2.1

* ✅ Dashboard em Tempo Real
* ✅ Centro de Alertas
* ✅ Mapa de Rede
* ✅ Relatórios Avançados

### v2.5

* 🚧 SLA por Cliente
* 🚧 Wallboard NOC
* 🚧 Monitoramento de Portas

### v3.0

* 🔮 AI Incident Analysis
* 🔮 Root Cause Analysis
* 🔮 Predictive Monitoring
* 🔮 Multi-Tenant

---

## 📊 Status

| Módulo      | Status |
| ----------- | ------ |
| Dashboard   | ✅      |
| WebSocket   | ✅      |
| Alertas     | ✅      |
| Relatórios  | ✅      |
| JWT Auth    | ✅      |
| Network Map | ✅      |
| Deploy      | ✅      |

---

## 🤝 Contribuição

```bash
git checkout -b feature/minha-feature
git commit -m "feat: nova funcionalidade"
git push origin feature/minha-feature
```

---

## 📄 Licença

MIT License

---

<div align="center">

### Desenvolvido por Adan W. O. Santos

OrbNOC Platform

Infrastructure Monitoring • Network Operations Center • Real-Time Analytics

© 2026 OrbNOC

</div>
