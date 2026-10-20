# OrbNOC

Projeto full stack para **Network Operations Center (NOC)**, desenvolvido para centralizar o gerenciamento de dispositivos de rede e o acompanhamento de incidentes em uma interface web.

## 🛠️ Tecnologias utilizadas

- **Backend:** Java 17, Spring Boot 3.3.5, Spring Data JPA e H2 (desenvolvimento)
- **Frontend:** Angular 19 e TypeScript
- **Build:** Maven (backend) e npm (frontend)

## 📁 Estrutura do projeto

```text
OrbNOC/
├── backend/          # API REST com Spring Boot
├── frontend/         # Aplicação Angular
└── docs/              # Documentação do projeto
```

## 🚀 Como executar o projeto

### Backend

Acesse o diretório do backend e inicie a aplicação:

```bash
cd backend
mvn spring-boot:run
```

Após a inicialização, a API estará disponível em:

- **API REST:** http://localhost:8080
- **Console H2:** http://localhost:8080/h2-console

Configuração do banco de dados H2:

```text
JDBC URL: jdbc:h2:mem:orbnocdb
```

### Frontend

Em outro terminal, acesse o diretório do frontend e execute:

```bash
cd frontend
npm install
npm start
```

A aplicação Angular estará disponível em:

http://localhost:4200

## 🔌 Endpoints iniciais

| Recurso | Rota |
|---|---|
| Incidentes | `/api/incidents` |
| Dispositivos | `/api/devices` |

## 🗺️ Próximas melhorias planejadas

- [ ] Implementar autenticação e autorização com Spring Security e JWT.
- [ ] Desenvolver um dashboard com métricas de disponibilidade.
- [ ] Implementar consultas periódicas para monitoramento do status dos dispositivos.
- [ ] Integrar ferramentas de monitoramento, como Zabbix e Prometheus.

---

**OrbNOC** — Monitoramento de redes e gerenciamento de incidentes em um só lugar.
