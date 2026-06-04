```markdown
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

**Backend API:** https://orbnoc-backend-nmlq.onrender.com

</div>

---

## 📖 Sobre o Projeto

O **OrbNOC** é uma plataforma moderna de monitoramento de infraestrutura desenvolvida para equipes de Network Operations Center (NOC), provedores de internet, administradores de sistemas e profissionais de TI que precisam acompanhar a disponibilidade e a saúde dos seus ativos em tempo real.

A plataforma oferece monitoramento contínuo, geração de alertas, análise de métricas e dashboards interativos para garantir máxima visibilidade operacional.

---

## ✨ Funcionalidades

### 📡 Monitoramento em Tempo Real

- Disponibilidade de Hosts
- TCP Connect Monitoring (portas 80/443)
- Latência, Jitter e Packet Loss
- Uptime e SLA

### 🔔 Sistema de Alertas

- Alertas visuais e sonoros
- Integração Telegram (formato profissional)
- Histórico de incidentes
- Reconhecimento de alertas
- Alertas de limiar (SLA)

### 📊 Dashboard Operacional

- KPIs com hierarquia visual
- Gráficos interativos (Recharts)
- Filtros avançados e busca
- Ordenação por status, nome, IP ou latência
- Atualização via WebSocket

### 🗺️ Mapa de Rede

- Visualização topológica (React Flow)
- Layouts: Hierárquico, Radial e Grade
- Status colorido por dispositivo
- Conexões animadas

### 🚨 Centro de Alertas

- Filtros por criticidade
- Estatísticas de alertas
- Reconhecimento de incidentes
- Tendência de alertas

### 📊 Relatórios

- Exportação Excel (CSV)
- Gráficos de disponibilidade
- Gráficos de evolução de latência
- Filtro por período (24h/7d/30d)

### 🔧 Diagnóstico Avançado

- Ping avançado (latência, perda, min/máx)
- Traceroute (simulado)
- Teste de portas TCP
- DNS Lookup (A, AAAA, MX, TXT, CNAME)
- Diagnóstico completo inteligente

### 📺 Wallboard

- Modo TV para NOC
- Letras gigantes
- Atualização automática
- Ideal para telas de monitoramento

### 🔒 Segurança

- Autenticação JWT
- Password Hashing (bcrypt)
- Controle de sessão
- Proteção CORS

---

## 🏗️ Arquitetura

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

 Database         TCP Checks        Telegram / Email
```

---

🛠️ Stack Tecnológica

Frontend

· Next.js 14
· React
· TailwindCSS
· Socket.IO Client
· React Flow (Mapa de Rede)
· Recharts (Gráficos)
· jsPDF
· SheetJS (Excel)

Backend

· Node.js 20+
· Express.js
· Socket.IO
· JWT
· bcrypt
· node-cron

Banco de Dados

· PostgreSQL (Produção)
· SQLite (Desenvolvimento)

DevOps

· Docker
· Docker Compose
· GitHub Actions
· Render.com (Deploy)

---

📁 Estrutura do Projeto

```text
OrbNOC/
├── backend/
│   └── server.js
├── frontend/
│   └── src/app/
│       ├── page.js           # Dashboard
│       ├── alerts/page.js    # Centro de Alertas
│       ├── reports/page.js   # Relatórios
│       ├── network-map/page.js # Mapa de Rede
│       ├── diagnostic/page.js # Diagnóstico
│       ├── wallboard/page.js # Wallboard
│       ├── login/page.js     # Login
│       └── register/page.js  # Registro
├── docs/
├── docker-compose.yml
└── README.md
```

---

🔐 Credenciais de Demonstração

```text
Usuário: admin
Senha: admin123
```

---

🚀 Instalação Local

Pré-requisitos

· Node.js 20+
· NPM
· PostgreSQL (opcional)

Backend

```bash
cd backend
npm install

# Configure o arquivo .env
cp .env.example .env

# Execute
npm start
```

Servidor: http://localhost:3001

Frontend

```bash
cd frontend
npm install
npm run dev
```

Aplicação: http://localhost:3000

---

☁️ Deploy no Render

Backend

```text
Root Directory: backend
Build Command: npm install
Start Command: npm start
```

Variáveis de Ambiente:

```env
DATABASE_URL=postgresql://...
JWT_SECRET=sua_chave_secreta
PORT=10000
```

Frontend

```text
Root Directory: frontend
Build Command: npm install && npm run build
Start Command: npm start
```

Variáveis de Ambiente:

```env
NEXT_PUBLIC_API_URL=https://seu-backend.onrender.com
NEXT_PUBLIC_WS_URL=wss://seu-backend.onrender.com
NODE_ENV=production
```

⚠️ Observação: O Render não permite ICMP Ping nativamente. O OrbNOC utiliza TCP Connect (portas 80/443) como alternativa.

---

⚙️ Variáveis de Ambiente

Backend (.env)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/orbnoc
JWT_SECRET=super_secret_key
PORT=3001

TELEGRAM_BOT_TOKEN=seu_token_aqui
TELEGRAM_CHAT_ID=seu_chat_id_aqui

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu_email@gmail.com
SMTP_PASSWORD=sua_senha
```

Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NODE_ENV=development
```

---

🔔 Integração Telegram

Criando o Bot

1. Abra o Telegram
2. Procure por @BotFather
3. Execute /newbot
4. Copie o token gerado
5. Descubra seu Chat ID com @userinfobot
6. Configure no OrbNOC (Dashboard → Telegram)

---

📌 Roadmap

v2.1 ✅ (Concluído)

· Dashboard em Tempo Real
· Centro de Alertas
· Mapa de Rede (React Flow)
· Relatórios Avançados
· Diagnóstico Avançado
· Wallboard para NOC
· Alertas Telegram (formato profissional)

v2.5 🚧 (Em desenvolvimento)

· SLA por Cliente
· Monitoramento de Portas Específicas
· Agendamento de Relatórios
· Notificações por Email

v3.0 🔮 (Planejado)

· AI Incident Analysis
· Root Cause Analysis
· Predictive Monitoring
· Multi-Tenant
· API Pública

---

📊 Status do Projeto

Módulo Status
Dashboard ✅
WebSocket ✅
Alertas Telegram ✅
Relatórios ✅
Mapa de Rede ✅
Centro de Alertas ✅
Diagnóstico ✅
Wallboard ✅
Autenticação JWT ✅
Deploy no Render ✅

---

🤝 Contribuição

```bash
git checkout -b feature/minha-feature
git commit -m "feat: adiciona nova funcionalidade"
git push origin feature/minha-feature
```

Abra um Pull Request.

---

📄 Licença

MIT License

Copyright © 2026 Adan W. O. Santos

---

<div align="center">

Desenvolvido por Adan W. O. Santos

OrbNOC Platform

Infrastructure Monitoring • Network Operations Center • Real-Time Analytics

© 2026 OrbNOC

</div>
```
