FROM node:24-alpine AS build

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

RUN npm prune --omit=dev

FROM node:24-alpine AS runtime

WORKDIR /app/backend

ENV NODE_ENV=production

COPY --from=pruned /app/node_modules /app/node_modules
COPY --from=pruned /app/backend/package.json ./package.json
COPY --from=pruned /app/backend/dist ./dist
COPY --from=pruned /app/backend/prisma ./prisma
COPY --from=pruned /app/backend/data ./data

USER node

EXPOSE 3000

CMD ["node", "dist/server.js"]