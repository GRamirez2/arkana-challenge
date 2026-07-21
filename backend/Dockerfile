FROM cgr.dev/chainguard/node:latest-dev AS build

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

COPY --from=pruned --chown=nonroot:nonroot /app/node_modules /app/node_modules
COPY --from=pruned --chown=nonroot:nonroot /app/backend/package.json ./package.json
COPY --from=pruned --chown=nonroot:nonroot /app/backend/dist ./dist
COPY --from=pruned --chown=nonroot:nonroot /app/backend/prisma ./prisma
COPY --from=pruned --chown=nonroot:nonroot /app/backend/data ./data

USER nonroot

EXPOSE 3000

CMD ["dist/server.js"]