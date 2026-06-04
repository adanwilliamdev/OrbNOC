🛰️ OrbNOC

<div align="center">Enterprise Network Operations Center Platform

Plataforma moderna para monitoramento de infraestrutura, disponibilidade e desempenho em tempo real.

"Version" (https://img.shields.io/badge/version-2.1.0-blue)
"Status" (https://img.shields.io/badge/status-active-success)
"Next.js" (https://img.shields.io/badge/Next.js-14-black)
"Node.js" (https://img.shields.io/badge/Node.js-20+-green)
"PostgreSQL" (https://img.shields.io/badge/PostgreSQL-16-blue)
"Socket.IO" (https://img.shields.io/badge/WebSocket-Realtime-purple)
"License" (https://img.shields.io/badge/license-MIT-orange)

Real-Time Monitoring • Alert Management • Network Visualization • Operational Analytics

🌐 Ambiente Online

Frontend: https://orbnoc-taer.onrender.com

Backend API: https://orbnoc-backend-nmlq.onrender.com

</div>---

📖 Sobre o Projeto

O OrbNOC é uma plataforma de monitoramento de infraestrutura desenvolvida para equipes de Network Operations Center (NOC), provedores de internet, administradores de sistemas e profissionais de tecnologia que necessitam de visibilidade operacional em tempo real.

A solução centraliza informações críticas da infraestrutura em uma única interface, permitindo acompanhar disponibilidade, desempenho, incidentes e indicadores operacionais de forma simples e eficiente.

Com comunicação em tempo real via WebSocket, geração automática de alertas e dashboards interativos, o OrbNOC auxilia equipes na redução do tempo de resposta a incidentes e na melhoria da confiabilidade dos serviços monitorados.

---

📸 Visão Geral da Plataforma

Dashboard Operacional

Monitoramento centralizado dos dispositivos, métricas e indicadores em tempo real.

Centro de Alertas

Gerenciamento de incidentes, reconhecimento de alertas e análise de criticidade.

Mapa de Rede

Visualização topológica da infraestrutura utilizando React Flow.

Wallboard

Modo otimizado para exibição em televisores e painéis de operação.

---

🎯 Principais Diferenciais

- Monitoramento em tempo real via WebSocket
- Dashboard operacional moderno e responsivo
- Mapa de rede interativo com React Flow
- Sistema profissional de alertas e incidentes
- Integração com Telegram para notificações
- Relatórios operacionais e métricas históricas
- Diagnóstico avançado de conectividade
- Wallboard dedicado para ambientes NOC
- Arquitetura Full Stack escalável

---

✨ Funcionalidades

📡 Monitoramento em Tempo Real

- Disponibilidade de hosts
- TCP Connect Monitoring
- Latência, jitter e perda de pacotes
- Uptime e indicadores de SLA
- Atualização automática em tempo real

🔔 Gestão de Alertas

- Alertas visuais e sonoros
- Integração com Telegram
- Histórico de incidentes
- Reconhecimento de alertas
- Controle de criticidade
- Monitoramento de SLA

📊 Dashboard Operacional

- Indicadores de desempenho (KPIs)
- Gráficos interativos
- Filtros avançados
- Pesquisa rápida
- Ordenação dinâmica
- Atualização via WebSocket

🗺️ Mapa de Rede

- Visualização topológica
- Layout hierárquico
- Layout radial
- Layout em grade
- Status visual por dispositivo
- Conexões animadas

🚨 Centro de Alertas

- Filtros por severidade
- Estatísticas operacionais
- Reconhecimento de incidentes
- Tendências de alertas

📈 Relatórios

- Exportação para Excel (CSV)
- Relatórios de disponibilidade
- Histórico de latência
- Filtros por período
- Indicadores operacionais

🔧 Diagnóstico Avançado

- Ping avançado
- Teste de portas TCP
- DNS Lookup
- Traceroute simulado
- Diagnóstico automatizado

📺 Wallboard

- Exibição em tela cheia
- Atualização automática
- Interface otimizada para NOC
- Indicadores ampliados para monitoramento contínuo

🔒 Segurança

- Autenticação JWT
- Hash de senhas com bcrypt
- Controle de sessões
- Configuração segura de CORS

---

🏗️ Arquitetura da Solução

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

---

🛠️ Stack Tecnológica

Frontend

Tecnologia| Finalidade
Next.js 14| Framework principal
React| Construção da interface
Tailwind CSS| Estilização
Socket.IO Client| Comunicação em tempo real
React Flow| Topologia de rede
Recharts| Visualização de dados
jsPDF| Relatórios PDF
SheetJS| Exportação Excel

Backend

Tecnologia| Finalidade
Node.js| Runtime
Express.js| API REST
Socket.IO| Comunicação em tempo real
JWT| Autenticação
bcrypt| Segurança
node-cron| Agendamentos

Banco de Dados

Tecnologia| Finalidade
PostgreSQL| Produção
SQLite| Desenvolvimento

DevOps

Tecnologia| Finalidade
Docker| Containerização
Docker Compose| Orquestração local
GitHub Actions| CI/CD
Render| Hospedagem

---

📈 Métricas do Projeto

- Plataforma Full Stack
- Comunicação em tempo real
- Mais de 10 módulos operacionais
- Integração com Telegram
- Dashboard responsivo
- Deploy em nuvem
- Arquitetura escalável

---

📁 Estrutura do Projeto

OrbNOC/
├── backend/
│   └── server.js
├── frontend/
│   └── src/app/
│       ├── page.js
│       ├── alerts/page.js
│       ├── reports/page.js
│       ├── network-map/page.js
│       ├── diagnostic/page.js
│       ├── wallboard/page.js
│       ├── login/page.js
│       └── register/page.js
├── docs/
├── docker-compose.yml
└── README.md

---

🚀 Instalação Local

Pré-requisitos

- Node.js 20+
- NPM
- PostgreSQL (Opcional)

Backend

cd backend
npm install
cp .env.example .env
npm start

Servidor disponível em:

http://localhost:3001

Frontend

cd frontend
npm install
npm run dev

Aplicação disponível em:

http://localhost:3000

---

☁️ Deploy

A plataforma está preparada para implantação em ambientes cloud utilizando Render, Docker ou infraestrutura própria.

Backend

DATABASE_URL=postgresql://...
JWT_SECRET=sua_chave_secreta
PORT=10000

Frontend

NEXT_PUBLIC_API_URL=https://seu-backend.onrender.com
NEXT_PUBLIC_WS_URL=wss://seu-backend.onrender.com

«Observação: Ambientes Render não permitem ICMP Ping nativo. O OrbNOC utiliza TCP Connect Monitoring como alternativa.»

---

🛣️ Roadmap

Versão| Status| Recursos
2.1| ✅ Concluído| Dashboard, Alertas, Relatórios, Mapa de Rede, Wallboard
2.5| 🚧 Em Desenvolvimento| SLA por Cliente, E-mail, Agendamento de Relatórios
3.0| 🔮 Planejado| Inteligência Artificial, RCA, Multi-Tenant, API Pública

---

📊 Status do Projeto

Módulo| Status
Dashboard| ✅
WebSocket| ✅
Centro de Alertas| ✅
Relatórios| ✅
Mapa de Rede| ✅
Diagnóstico| ✅
Wallboard| ✅
Autenticação JWT| ✅
Integração Telegram| ✅
Deploy Cloud| ✅

---

🤝 Contribuição

Contribuições são bem-vindas.

git checkout -b feature/minha-feature
git commit -m "feat: nova funcionalidade"
git push origin feature/minha-feature

Após isso, abra um Pull Request.

---

📄 Licença

Distribuído sob a licença MIT.

---

<div align="center">Desenvolvido por Adan W. O. Santos

OrbNOC Platform

Infrastructure Monitoring • Network Operations Center • Real-Time Analytics

© 2026 OrbNOC

</div>