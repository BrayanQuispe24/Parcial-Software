# ===== Etapa 1: Build SSR =====
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
# Soporta ambos casos (con o sin lock)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

# Build producción (si tu app tiene SSR habilitado, esto genera browser + server)
# produce: dist/front_generador_bd/server/server.mjs
RUN npx ng build --configuration=production

# ===== Etapa 2: Runtime =====
FROM node:20-alpine AS runtime
ENV NODE_ENV=production PORT=4000 HOST=0.0.0.0
WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY --from=build /app/dist ./dist
EXPOSE 4000
CMD ["node", "dist/front_generador_bd/server/server.mjs"]
