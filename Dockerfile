# syntax=docker/dockerfile:1

# The npm cache mounts keep downloaded packages between builds, so a dependency
# change only fetches what is new.

# ---------- 1. Build the Vue client ----------
FROM node:22-bookworm-slim AS client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
# npm silently skips an optional package whose download fails (Vite's native
# bundler binary), and Docker would cache that broken install. Loading it in the
# same step makes the step fail instead, so the next build retries it.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit --no-fund \
 && node -e "require('rolldown')"
COPY client/ ./
RUN npm run build

# ---------- 2. Server production dependencies ----------
# better-sqlite3 and sharp ship prebuilt binaries for Linux x64 and arm64.
# Without --ignore-scripts npm compiles SQLite from source, which needs
# python3/make/g++ and takes minutes on a small server.
FROM node:22-bookworm-slim AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts --prefer-offline --no-audit --no-fund \
 && node -e "new (require('better-sqlite3'))(':memory:').close(); require('sharp')"

# ---------- 3. Runtime ----------
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    PUBLIC_DIR=/app/server/public \
    TZ=Europe/Paris
# SQLite "localtime" (today's sales, cash register) needs /usr/share/zoneinfo:
# the node image already includes tzdata, so there is nothing to install.
WORKDIR /app/server
COPY --from=server-deps /app/server/node_modules ./node_modules
COPY server/package.json ./
COPY server/src ./src
COPY --from=client /app/client/dist ./public
# Chrome extension, downloadable from Réglages (served as a ZIP by the API)
COPY extension /app/extension
RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/index.js"]
