# syntax=docker/dockerfile:1
FROM python:3.12-slim-bookworm AS builder
COPY --from=ghcr.io/astral-sh/uv:0.5 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PATH="/app/.venv/bin:$PATH"

# traceroute: diagnóstico real (funciona sem root). iputils-ping não é necessário: o ICMP do
# monitor vem do icmplib (socket raw no worker; modo não privilegiado como alternativa).
RUN apt-get update \
    && apt-get install -y --no-install-recommends traceroute \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --no-create-home orbnoc

WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

EXPOSE 8000
# Padrão: API sem privilégios. O worker é executado como root no docker-compose (ver comentário lá).
USER orbnoc
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:get_app --factory --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
