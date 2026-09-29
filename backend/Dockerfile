# syntax=docker/dockerfile:1
FROM python:3.12-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.12-slim
# traceroute: usado pelo diagnóstico. Usuário sem privilégios: o ICMP usa socket não privilegiado
# (o Docker libera via net.ipv4.ping_group_range) e, se o ambiente bloquear, cai para TCP.
RUN apt-get update \
    && apt-get install -y --no-install-recommends traceroute \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --no-create-home orbnoc
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
USER orbnoc
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["api"]
