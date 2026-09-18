FROM node:20-alpine AS base

# Instalar dependências
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
# Copiar também o package-lock.json e usar `npm ci` (em vez de `npm install`)
# garante que o build usa exatamente as versões resolvidas e testadas no
# repositório, não uma resolução nova a cada build (antes o lockfile nem
# era copiado para dentro da imagem, então era ignorado).
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Build da aplicação
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# O lockfile já tem os pacotes @next/swc-* corretos (lockfileVersion 3), mas o
# Next tenta "corrigir" ele buscando metadados no registry do npm durante o
# build; sem rede/registry confiável nesse passo, patch-incorrect-lockfile.js
# quebra com "Cannot read properties of undefined (reading 'os')" — não falha
# o build, só polui o log em todo passo do build. Como o lockfile já está
# correto, pulamos essa checagem.
ENV NEXT_IGNORE_INCORRECT_LOCKFILE=1
# NEXT_PUBLIC_* é embutido no bundle JS durante `next build` (roda AGORA,
# nesta etapa) — definir isso só como `environment:` no docker-compose (que
# só existe quando o container já está rodando) não tem efeito nenhum sobre
# o que vai pro navegador do usuário. Por isso precisa entrar como build arg.
# O valor padrão abaixo garante que o build de produção aponte para o backend
# mesmo que a plataforma (Render) não repasse a variável como build arg.
# Se ela for repassada (ou via --build-arg / docker-compose), sobrescreve o padrão.
ARG NEXT_PUBLIC_API_URL=https://orbnoc-jj74.onrender.com
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build
# Imagem de produção
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
