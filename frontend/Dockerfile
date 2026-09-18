FROM node:20-alpine AS build
WORKDIR /app
# Copiamos também o package-lock.json e usamos `npm ci`: instala exatamente as
# versões travadas no lockfile (build determinístico) e é mais rápido/cacheável
# que `npm install` em CI/Docker.
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Imagem "unprivileged" do nginx: já roda como usuário não-root por padrão,
# escutando na porta 8080 em vez de 80.
FROM nginxinc/nginx-unprivileged:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
