# arkana-challenge

Conversational diabetes explorer for the Arkana Labs take-home.

## What it does

- Loads the CSV in `backend/data/` into a local PostgreSQL database through Prisma.
- Lets the user ask a question, keep follow-up context, and render the response as a trend chart.
- Uses OpenAI when a session-scoped API key is provided from the frontend, with a local fallback so the app still runs offline.

## Run locally

```bash
npm install
npm run seed
npm run dev
```

Open the frontend at `http://localhost:5173` and the API at `http://localhost:3000`.

## Docker

Start both apps with:

```bash
docker-compose up
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
