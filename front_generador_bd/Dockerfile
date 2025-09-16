# ---- Builder ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund; \
    else \
      npm i --no-audit --no-fund; \
    fi

COPY . .

# Build SSR (browser + server) -> dist/front_generador_bd
RUN npx ng build --configuration production

# ---- Runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

# Copia artefactos con ownership del usuario node ya existente
COPY --from=builder --chown=node:node /app/dist ./dist

# Usa el usuario 'node' que ya viene en la imagen
USER node

EXPOSE 4000
CMD ["node", "dist/front_generador_bd/server/server.mjs"]
