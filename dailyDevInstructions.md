# Local Development Guide

## Prerequisites

- Node.js (via Volta or your preferred manager)
- Docker Desktop running
- `backend/.env` file with your OpenAI key (optional but recommended)

```
# backend/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/arkana?schema=public
OPENAI_API_KEY=your-key-here
OPENAI_MODEL=gpt-4.1-mini
CORS_ORIGINS=http://localhost:5173,http://localhost:8080
```

---

## First-time setup (run once)

```bash
npm install
```

**Terminal 1** — start Postgres:

```bash
npm run dev:db
```

Wait for the log line: `database system is ready to accept connections`

**Terminal 2** — apply schema, seed data, then start dev servers:

```bash
npm run dev:db:init   # applies Prisma schema to Postgres
npm run seed          # loads the 114k-row CSV into the database (~30s)
npm run dev           # starts backend (tsx watch, port 3000) + frontend (Vite HMR, port 5173)
```

---

## Daily use

**Terminal 1:**

```bash
npm run dev:db
```

Wait a few seconds until Postgres logs `ready to accept connections`.

**Terminal 2:**

```bash
npm run dev
```

Data persists in the `postgres-data` Docker volume between restarts.
You only need to re-run `dev:db:init` + `seed` if you deleted the volume:

```bash
docker compose -f docker-compose.dev.yml down -v   # this destroys data
```

---

## Stopping

- **Terminal 1 / Terminal 2:** `Ctrl+C` in each terminal.
- This stops the dev servers and the Postgres container. Data is preserved.

---

## URLs

| Service  | URL                          |
| -------- | ---------------------------- |
| Frontend | http://localhost:5173        |
| Backend  | http://localhost:3000        |
| Health   | http://localhost:3000/health |

---

## Useful scripts

```bash
npm run dev:backend   # backend only (tsx watch)
npm run dev:frontend  # frontend only (Vite)
npm run seed          # re-seed the database (resets data)
npm run build         # production build for both workspaces
```

---

## Dataset constraints (for asking good questions)

See the **How to explore the data** section in [README.md](README.md) for full question examples and follow-ups.
