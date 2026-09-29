# Contribuindo para o OrbNOC

O passo a passo de ambiente, testes e migrations está no [README](./README.md#desenvolvimento).

Antes de abrir um PR, rode o mesmo que o CI roda:

```bash
cd backend  && uv run ruff check . && uv run ruff format --check . && uv run pytest
cd frontend && npm run typecheck && npm run lint && npm run build
```

- Crie a branch a partir de `main` e faça commits pequenos e descritivos.
- Rotas, services e regras de negócio novos precisam de teste (os testes do backend usam PostgreSQL e Redis reais).
- Mudou o esquema? Altere `app/db/models.py` e gere a migration com `uv run alembic revision --autogenerate`; revise o arquivo antes de commitar.
- Campos da API ficam em `snake_case` (contrato com o frontend).
- Vulnerabilidades: veja [SECURITY.md](./SECURITY.md) — não abra issue pública.
