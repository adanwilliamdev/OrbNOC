from __future__ import annotations

from fastapi import FastAPI

from .config import get_settings
from .cors_middleware import WildcardCorsMiddleware
from .database import Base, engine
from .exceptions import register_exception_handlers
from .rate_limit import AuthRateLimitMiddleware
from .routers import auth, catalog, dashboard, progress, tmdb, users

settings = get_settings()

app = FastAPI(
    title="Biblioteca API",
    description="API da Biblioteca (filmes e séries) — conversão para Python/FastAPI",
    version="1.0.0",
    docs_url="/swagger-ui.html",
    openapi_url="/v3/api-docs",
)

# Ordem importa: o middleware adicionado por último é o mais externo (roda primeiro
# na requisição). Colocamos CORS por fora do rate limit, igual ao Nest original.
app.add_middleware(AuthRateLimitMiddleware)
app.add_middleware(WildcardCorsMiddleware)

register_exception_handlers(app)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(catalog.router)
app.include_router(progress.router)
app.include_router(dashboard.router)
app.include_router(tmdb.router)


@app.on_event("startup")
def on_startup() -> None:
    # Cria as tabelas automaticamente caso ainda não existam (substitui as
    # migrations do Prisma por simplicidade). Para produção com dados reais,
    # prefira ferramentas de migração como o Alembic.
    Base.metadata.create_all(bind=engine)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.port, reload=False)
