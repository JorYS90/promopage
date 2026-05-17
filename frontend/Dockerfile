# Dockerfile do FRONTEND — Vite build → Nginx serve estático
# Build: docker build -t promopage-web ./frontend
# Run:   docker run -d -p 80:80 promopage-web

# ---- Stage 1: build do Vite ----
FROM node:20-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Vite gera assets otimizados em /app/dist
RUN npm run build

# ---- Stage 2: Nginx servindo dist + proxy reverso pro API ----
FROM nginx:1.27-alpine

# Remove config default
RUN rm /etc/nginx/conf.d/default.conf

# Config custom: SPA fallback (qualquer rota → index.html) + proxy /api → backend
COPY nginx.conf /etc/nginx/conf.d/promopage.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
