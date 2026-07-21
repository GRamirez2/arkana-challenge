FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace frontend

COPY frontend/tsconfig.json ./frontend/tsconfig.json
COPY frontend/tsconfig.node.json ./frontend/tsconfig.node.json
COPY frontend/vite.config.ts ./frontend/vite.config.ts
COPY frontend/index.html ./frontend/index.html
COPY frontend/postcss.config.cjs ./frontend/postcss.config.cjs
COPY frontend/tailwind.config.cjs ./frontend/tailwind.config.cjs
COPY frontend/env.d.ts ./frontend/env.d.ts
COPY frontend/src ./frontend/src

ARG VITE_API_BASE_URL=http://localhost:3000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build --workspace frontend

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=101:101 /app/frontend/dist /usr/share/nginx/html

USER 101:101

EXPOSE 8080