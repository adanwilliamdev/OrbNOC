FROM python:3.12-slim

WORKDIR /app

# iputils-ping garante um comando `ping` com saída padronizada (usado no
# monitoramento e diagnóstico ICMP real, mais confiável que TCP connect
# para dispositivos sem portas abertas, como celulares e IoT).
# traceroute é usado pelo diagnóstico de rota real (app/services/traceroute_service.py).
RUN apt-get update \
    && apt-get install -y --no-install-recommends iputils-ping traceroute \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 3001

CMD ["python", "server.py"]
