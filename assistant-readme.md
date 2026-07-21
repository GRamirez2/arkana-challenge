# assistant README

This document explains what the assistant module does.

## What it is

The assistant module is the orchestration layer for question answering.
It takes a user question, decides which diabetes filters to apply, queries the data store, and returns both data and visualization instructions.

## Main responsibilities

1. Accept user input and conversation state

- Receives the latest question.
- Receives prior state (existing filters, prior render mode, turn count).
- Receives an optional OpenAI API key override.

2. Load dataset context before planning

- Fetches dataset overview (year range, sample indicators/states, counts).
- Fetches filter vocabulary (valid indicator/state/topic/age/race/sex/education values).

This gives the planner a valid set of values to work with.

3. Plan filters and render intent

- Primary path: tries OpenAI-based planning.
  - The prompt enforces strict constraints (use known vocabulary, preserve prior filters unless explicitly changed, avoid invalid structures).
- Fallback path: if OpenAI planning is unavailable or fails, uses local heuristics.
  - Heuristics parse state names, demographic terms, indicator mentions, year constraints, and table/chart intent.

4. Sanitize planner output for runtime safety

Planner output is treated as untrusted at runtime, even if compile-time types look correct.

- Converts invalid shapes to safe values.
  - Example: array filters become one value.
  - Example: numeric strings for years are parsed to numbers.
- Drops empty/invalid values.

This prevents Prisma query crashes (for example, when a model returns an array for a scalar field).

5. Merge with conversational state

- Applies sanitized filter changes over existing state filters.
- Updates:
  - lastQuestion
  - lastAnswer (planning note)
  - lastRender
  - turnCount

6. Run data queries

- Always runs a yearly time-series query with the applied filters.
- Optionally runs a breakdown query when the question implies comparison/breakdown.
  - Supported breakdown dimensions: age, sex, race, education, state, indicator.
  - If a single year is implied (yearMin equals yearMax), uses that year directly.

7. Decide chart behavior and labels

- Infers value format from metric unit:
  - percentage
  - rate
  - number
- Selects chart kind intelligently:
  - line/bar/pie based on request and data shape.
  - avoids invalid pie selections (for example, unsupported values or too many slices).
- Builds metric labels and subtitle text (year range or snapshot year).

8. Build the final human-readable answer

- For trend views: summarizes time range, latest estimate, and trend direction/magnitude.
- For breakdown views: summarizes category count and top category.
- For no-data cases: returns a clear message and suggests broadening filters.

9. Return one structured response payload

The final payload includes:

- answer (natural language summary)
- updated conversation state
- render spec (chart type, labels, format)
- yearly series data
- optional breakdown data
- applied filters

## Key supporting behaviors

- Text normalization and candidate matching:
  - case-insensitive matching
  - punctuation-insensitive parsing
  - state alias mapping (full state names to abbreviations)
- Year parsing:
  - explicit year or year range
  - "latest"/"recent" handling
  - "since YYYY" handling
- Breakdown inference:
  - detects comparison intent and maps to the most likely demographic dimension.

## In short

The assistant module is the conversation brain, not the data source itself.
It translates natural-language intent into safe filters, executes diabetes-store queries, and returns data plus presentation guidance the frontend can render immediately.
