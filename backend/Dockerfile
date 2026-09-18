FROM python:3.12-slim

WORKDIR /app

# libpq-dev/gcc são necessários para compilar psycopg2 caso não haja wheel pronta
# para a arquitetura da imagem; curl é usado apenas para o healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

RUN addgroup --system fastapi && adduser --system --ingroup fastapi fastapi
USER fastapi

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
