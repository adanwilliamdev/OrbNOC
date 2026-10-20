# OrbNOC

Projeto full stack Java para **Network Operations Center (NOC)**.

## Stack

- **Backend:** Java 17 + Spring Boot 3.3.5 + Spring Data JPA + H2 (dev)
- **Frontend:** Angular 19 + TypeScript
- **Build:** Maven (backend) / npm (frontend)

## Estrutura

\\\
OrbNOC/
â”œâ”€â”€ backend/          # Spring Boot (API REST)
â”œâ”€â”€ frontend/         # Angular
â””â”€â”€ docs/
\\\

## Como rodar

### Backend
\\\ash
cd backend
mvn spring-boot:run
\\\
API em \http://localhost:8080\.
Console H2 em \http://localhost:8080/h2-console\ (JDBC URL: \jdbc:h2:mem:orbnocdb\).

### Frontend
\\\ash
cd frontend
npm install
npm start
\\\
Acesse \http://localhost:4200\.

## Endpoints iniciais

| Recurso     | Rota               |
|-------------|--------------------|
| Incidentes  | \/api/incidents\  |
| Dispositivos| \/api/devices\    |

## PrÃ³ximos passos sugeridos

1. Adicionar autenticaÃ§Ã£o (Spring Security + JWT).
2. Criar dashboard com mÃ©tricas de disponibilidade.
3. Implementar polling de status de dispositivos.
4. Integrar com ferramentas de monitoramento (Zabbix, Prometheus).
