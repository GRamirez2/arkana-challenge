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

RUN npm run build --workspace backend && npm prune --omit=dev

FROM node:24-alpine AS runtime

WORKDIR /app/backend

ENV NODE_ENV=production

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/backend/package.json ./package.json
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/backend/data ./data

USER node

EXPOSE 3000

CMD ["node", "dist/server.js"]