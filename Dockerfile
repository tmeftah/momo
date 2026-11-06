# syntax=docker/dockerfile:1

# ---------- 1. Build the Vue client ----------
FROM node:22-bookworm-slim AS client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---------- 2. Server production dependencies (better-sqlite3 is native) ----------
FROM node:22-bookworm-slim AS server-deps
WORKDIR /app/server
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# ---------- 3. Runtime ----------
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    PUBLIC_DIR=/app/server/public \
    TZ=Europe/Paris
# tzdata: SQLite "localtime" (today's sales, cash register) needs the zone files
RUN apt-get update \
 && apt-get install -y --no-install-recommends tzdata \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
COPY --from=server-deps /app/server/node_modules ./node_modules
COPY server/package.json ./
COPY server/src ./src
COPY --from=client /app/client/dist ./public
RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/index.js"]
