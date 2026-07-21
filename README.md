# arkana-challenge

Conversational diabetes explorer for the Arkana Labs take-home.

## What it does

- Loads the CSV in `backend/data/` into a local PostgreSQL database through Prisma.
- Lets the user ask a question, keep follow-up context, and render the response as a trend chart.
- Uses OpenAI when a session-scoped API key is provided from the frontend, with a local fallback so the app still runs offline.

> **Developing locally?** See [dailyDevInstructions.md](dailyDevInstructions.md).

## Docker

From your terminal, first change into this repository's root folder:

```bash
cd arkana-challenge
```

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

Once the stack is up, open `http://localhost:8080` to use the app.

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

## How to explore the data

The app answers natural language questions about a CDC diabetes dataset covering all 50 U.S. states + DC from 2000–2024. Each question updates the chart and keeps context for follow-ups.

Dataset source: CDC, "USDSS State Burden/Magnitude Diabetes Indicators".
About this dataset: https://data.cdc.gov/U-S-Diabetes-Surveillance-System/USDSS-State-Burden-Magnitude-Diabetes-Indicators/b559-sbez/about_data

### VISUALIZATION

The backend chooses a chart type from your question and the shape of the returned data.

#### Line chart

A line chart is used for time trends when your question is about how values change over years.

- Typical trigger: trend-over-time questions without category breakdown language.
- Also used when you explicitly ask for a line chart.
- If there are very few time points, the UI may switch to bars for readability.

Examples:

- `Show diagnosed diabetes trend in Texas from 2010 to 2024`
- `What does the diabetes trend look like nationally since 2005?`
- `Show this as a line chart`

#### Bar chart

A bar chart is used for comparisons across categories (for example age, sex, race, education, state, or indicator) and for short time ranges.

- Trigger words like `compare`, `break down`, `by age`, `male vs female`, `race`, `education`, or `by state` usually produce category breakdown data.
- Percentage/rate metrics in a breakdown render as bars.
- A short trend window (about 5 points or fewer) can also render as bars.

Examples:

- `Compare male vs female diagnosed diabetes rates in Georgia`
- `Break down diabetes by age group in Florida`
- `Show diabetes by education level in Kentucky`

#### Pie chart

A pie chart is used only when the data is a category breakdown and pie-slice formatting is valid.

- Best trigger: explicitly ask for a pie chart.
- Works when there are at least 2 categories and not too many slices.
- If a pie would be too crowded, the app falls back to a bar chart.

Examples:

- `Show a pie chart of diabetes by age group in Florida for 2024`
- `Break down diagnosed type 2 diabetes by race in Texas as a pie chart`
- `Compare indicators in California as a pie chart for 2023`

### Dataset constraint to keep in mind

Only **one** demographic dimension can be non-"All" at a time:

| Dimension                                    | Compatible age values            |
| -------------------------------------------- | -------------------------------- |
| Specific age range (18-44, 45-64, 65+, etc.) | race=All, sex=All, education=All |
| Sex (Male / Female)                          | age=Age-Adjusted or Crude        |
| Race (Hispanic, Non-Hispanic White, etc.)    | age=Age-Adjusted or Crude        |
| Education (< High School, etc.)              | age=Age-Adjusted or Crude        |

The AI planner handles this automatically — just ask naturally.

---

### Trends over time

- `Show Diagnosed Diabetes trend in Texas from 2010 to 2024`
- `Show Newly Diagnosed Diabetes in California over time`
- `What does the diabetes trend look like nationally from 2000 to 2024?`

**Good follow-ups:**

- `Narrow to the last 5 years`
- `How does that compare to 2005?`
- `Show only the most recent year`

---

### Age breakdown

- `Break down diabetes by age group in Florida`
- `Show the 18-44 age group in Ohio`
- `Compare 18-44 vs 65+ diagnosed diabetes rates in Michigan`

**Good follow-ups:**

- `Now show the 45-64 group`
- `Switch to the 75+ age group`
- `What does this look like since 2015?`

---

### Sex comparison (age-adjusted)

- `Compare male vs female diagnosed diabetes rates in Georgia`
- `Show women only in Arkansas`
- `What is the diabetes rate for men in New York, age-adjusted?`

**Good follow-ups:**

- `Now show the female trend`
- `How does this compare between 2010 and 2020?`
- `Switch to Newly Diagnosed Diabetes`

---

### Race / ethnicity breakdown (age-adjusted)

- `Show diagnosed diabetes for Hispanic adults in Texas`
- `Compare Non-Hispanic Black and Non-Hispanic White rates in Mississippi`
- `Show Non-Hispanic Asian or Pacific Islander adults in California, age-adjusted`

**Good follow-ups:**

- `Now show Non-Hispanic White for comparison`
- `Narrow to 2015–2022`
- `Switch to Type 2 Diabetes`

---

### Education level (age-adjusted)

- `Show diabetes rates by education level in Kentucky`
- `Show adults with less than high school education in Alabama`
- `Compare education levels for diabetes in Michigan, age-adjusted`

**Good follow-ups:**

- `Now show the college-educated group`
- `How has this changed since 2010?`

---

### Indicator comparisons

- `Show Newly Diagnosed Diabetes in Florida`
- `Compare Diagnosed Type 1 vs Type 2 Diabetes in Colorado`
- `What is the rate of newly diagnosed diabetes in Texas since 2015?`

**Good follow-ups:**

- `Switch to Diagnosed Diabetes`
- `Show the same for California`
- `Narrow to 2018–2024`
