# arkana-challenge

Conversational diabetes explorer for the Arkana Labs take-home.

## What it does

- Loads the CSV in `backend/data/` into a local PostgreSQL database through Prisma.
- Lets the user ask a question, keep follow-up context, and render the response as a trend chart.
- Uses OpenAI when a session-scoped API key is provided from the frontend, with a local fallback so the app still runs offline.

## Run locally

Postgres runs in Docker; backend and frontend run directly on your machine with hot-reload. No image rebuilds needed for code changes.

**First time setup:**

```bash
npm install
npm run dev:db        # terminal 1 — starts Postgres only
npm run dev:db:init   # terminal 2 — applies Prisma schema
npm run seed          # terminal 2 — seeds the database
npm run dev           # terminal 2 — starts backend (tsx watch) + frontend (Vite HMR)
```

**Daily use:**

```bash
npm run dev:db   # terminal 1
npm run dev      # terminal 2
```

Fill in your `OPENAI_API_KEY` in `backend/.env` if you need AI features locally.

Open the frontend at `http://localhost:5173` and the API at `http://localhost:3000`.

## Docker

Start both apps with:

```bash
docker-compose up
```

If you ran it in the terminal, stop it with `Ctrl+C`. To stop and remove the containers from another terminal, use:

```bash
docker-compose down
```

If you change code and want a clean restart that rebuilds the images, use:

```bash
docker-compose up --build
```

Useful Docker commands:

```bash
docker-compose up         # start the full stack
docker-compose up --build # rebuild images and start the stack
docker-compose down       # stop and remove containers
docker-compose logs -f    # follow container logs
```

The compose setup builds production images, applies the Prisma schema with a one-shot init container, starts the backend on port `3000`, and serves the compiled frontend through nginx on port `8080`.

### Workspace lockfiles

This repository uses npm workspaces (`backend` and `frontend`) with a single lockfile at the repo root (`package-lock.json`).

- In this setup, npm tracks dependency resolution centrally in the root lockfile.
- A workspace package like `frontend` will typically not get its own `frontend/package-lock.json`.
- Commit the root `package-lock.json` to Git. That is the lockfile that should be reviewed and versioned.

Why Dockerfiles use `npm install` in this repo:

- `npm ci` expects a lockfile that matches the package being installed in that build context.
- Because workspace lock state is centralized at the root, per-folder image builds can fail when they rely on local lockfiles only.

This repository's Dockerfiles now use strict workspace-targeted `npm ci` from the root lockfile:

- Docker build context is the repository root.
- The build copies root `package.json` + root `package-lock.json` and workspace manifests.
- Dependency install uses `npm ci --workspace backend` or `npm ci --workspace frontend`.

This keeps Docker builds reproducible while preserving the single-lockfile workspace model.

## Environment

- `OPENAI_API_KEY`: optional, enables the LLM planner.
- `OPENAI_MODEL`: optional, defaults to `gpt-4.1-mini`.
- `DATABASE_URL`: required for the backend, set automatically in Docker Compose.
- `VITE_API_BASE_URL`: optional frontend override for the backend URL.

The frontend stores a user-submitted OpenAI key in `sessionStorage` for the current browser tab only. If the user skips the key prompt, the app still works with the local planner.
