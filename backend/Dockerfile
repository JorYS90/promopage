# Dockerfile do BACKEND — Node 20 LTS slim
# Build: docker build -t promopage-api ./backend
# Run:   docker run -d -p 4010:4010 --env-file .env -v promopage-data:/app/data promopage-api

FROM node:20-bookworm-slim AS deps

# build-essentials pra compilar better-sqlite3 (binding nativo)
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- Stage final (sem build tools) ----
FROM node:20-bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
      tini \
    && rm -rf /var/lib/apt/lists/*

# Usuário não-root pra segurança
RUN useradd -m -u 1001 promopage
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=promopage:promopage . .

# Garante que os diretórios persistentes existam (montados como volume em prod)
RUN mkdir -p /app/data /app/uploads /app/projetos /app/backups /app/logs \
    && chown -R promopage:promopage /app

USER promopage

ENV NODE_ENV=production
ENV PORT=4010
EXPOSE 4010

# tini lida com SIGTERM/SIGINT direito (graceful shutdown)
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/server.js"]
