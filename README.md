# 📚 Biblioteca Fullstack

Sistema de gerenciamento de biblioteca desenvolvido com **Python (FastAPI), SQLAlchemy, PostgreSQL e React**.

A aplicação oferece autenticação segura, gerenciamento de usuários e catálogo, controle de progresso, dashboard e integração com a API do **TMDB**.

> Este backend foi convertido de Node.js/NestJS/Prisma para Python/FastAPI/SQLAlchemy,
> mantendo o mesmo contrato de API (mesmas rotas, mesmos campos JSON em camelCase,
> mesmos cookies httpOnly) — o frontend React não precisou de nenhuma mudança
> estrutural para continuar funcionando.

## 🚀 Funcionalidades

* 🔐 Autenticação com JWT e cookies `httpOnly`
* 🔄 Rotação de Refresh Token
* 👤 Gerenciamento de usuários
* 🛡️ Autorização baseada em roles (apenas admins veem/usam as ações de gestão no frontend)
* 📚 Gerenciamento de catálogo
* 📊 Controle de progresso e dashboard
* 🎬 Integração com TMDB
* 🚦 Rate limiting
* ⚡ Cache em memória com TTL
* 📖 Swagger (via FastAPI, em `/swagger-ui.html`)
* 🐳 Docker Compose

## 🛠️ Tecnologias

**Backend:** Python · FastAPI · SQLAlchemy · Pydantic · PostgreSQL · PyJWT

**Frontend:** React · TypeScript · Vite

**Infraestrutura:** Docker · Docker Compose · Railway

## 📂 Estrutura

```text
biblioteca-fullstack-main/
├── backend/          # API FastAPI + SQLAlchemy
│   └── app/
│       ├── routers/  # auth, users, catalog, progress, dashboard, tmdb
│       ├── models.py, schemas.py, security.py, ...
│       └── main.py
├── frontend/         # React + Vite
├── docker-compose.yml
└── railway.json
```

## ⚙️ Execução

### Backend

```bash
cd backend

cp .env.example .env
python3 -m venv .venv && source .venv/bin/activate   # opcional, mas recomendado
pip install -r requirements.txt

uvicorn app.main:app --reload --port 8080
```

Sem um `DATABASE_URL` definido, a aplicação usa automaticamente um arquivo SQLite
local (`biblioteca.db`) e cria as tabelas no primeiro start — ótimo para rodar
rapidamente sem precisar do Postgres. Em produção, defina `DATABASE_URL` apontando
para o Postgres (veja `backend/.env.example`).

### Frontend

```bash
cd frontend

cp .env.example .env
npm install

npm run dev
```

### Docker

```bash
docker compose up --build
```

## 🌐 Acesso

| Serviço    | Endereço                                |
| ---------- | --------------------------------------- |
| Frontend   | `http://localhost:5173`                 |
| Backend    | `http://localhost:8080`                 |
| Swagger    | `http://localhost:8080/swagger-ui.html` |
| OpenAPI    | `http://localhost:8080/v3/api-docs`     |
| PostgreSQL | `localhost:5432`                        |

## 🔐 Segurança

* JWT com cookies `httpOnly`
* Refresh Token com rotação
* Controle de acesso por `ADMIN` / `USER`
* Rate limiting
* Validação de dados
* CORS configurável
* Variáveis sensíveis via `.env`

## 📄 Licença

Projeto desenvolvido para fins de estudo, aprendizado e demonstração de conhecimentos em desenvolvimento Fullstack.
