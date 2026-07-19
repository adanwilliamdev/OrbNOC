FROM node:18-alpine

WORKDIR /app

# iputils-ping garante um comando `ping` com saída padronizada (usado no
# monitoramento e diagnóstico ICMP real, mais confiável que TCP connect
# para dispositivos sem portas abertas, como celulares e IoT).
RUN apk add --no-cache iputils-ping

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3001

CMD ["node", "server.js"]
