FROM cgr.dev/chainguard/node:latest-dev AS build

USER root

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
COPY backend/prisma ./backend/prisma
RUN npm ci --workspace backend

COPY backend/tsconfig.json ./backend/tsconfig.json
COPY backend/src ./backend/src
COPY backend/data ./backend/data

RUN npm run build --workspace backend

FROM build AS db-init

WORKDIR /app/backend

FROM build AS pruned

RUN npm prune --omit=dev --workspace backend && npm cache clean --force

FROM cgr.dev/chainguard/node:latest AS runtime

WORKDIR /app/backend

ENV NODE_ENV=production

COPY --from=pruned --chown=65532:65532 /app/node_modules /app/node_modules
COPY --from=pruned --chown=65532:65532 /app/backend/package.json ./package.json
COPY --from=pruned --chown=65532:65532 /app/backend/dist ./dist
COPY --from=pruned --chown=65532:65532 /app/backend/prisma ./prisma
COPY --from=pruned --chown=65532:65532 /app/backend/data ./data

USER 65532:65532

EXPOSE 3000

CMD ["node", "dist/server.js"]