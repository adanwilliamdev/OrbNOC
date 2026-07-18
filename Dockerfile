# Estágio 1: Build do Frontend (Next.js)
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Estágio 2: Build do Backend (Node.js)
FROM node:18-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./

# Estágio 3: Imagem final
FROM node:18-alpine
WORKDIR /app

# Copiar frontend buildado
COPY --from=frontend-builder /app/frontend/out ./frontend/out
COPY --from=frontend-builder /app/frontend/package*.json ./frontend/

# Copiar backend
COPY --from=backend-builder /app/backend ./backend

# Instalar serve para servir o frontend estático
RUN npm install -g serve

# Expor portas
EXPOSE 3000 5000

# Iniciar ambos os serviços
CMD ["sh", "-c", "cd /app/backend && node server.js & cd /app/frontend && serve -s out -l 3000"]
