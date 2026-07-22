# Interview Flow Notes

## Purpose

This document is my interview walkthrough of what I built, why I made certain decisions, and how I reduced risk in the system.

## 1. Assistant Architecture Split

- Problem: The assistant logic started to become hard to reason about when planning, state updates, and answer rendering lived too close together.
- Change: I separated responsibilities into clear boundaries.
- Boundary: Planner for intent interpretation.
- Boundary: State for sanitization and conversation state merge.
- Boundary: Response for chart and answer policy.
- Boundary: Orchestration for end-to-end request flow.
- Impact: The code became easier to test, safer to evolve, and clearer to explain during debugging and reviews.

## 2. LLM Safety Before Database Queries

- Problem: Planner output could return invalid runtime shapes (arrays, empty values, null-like values) that were unsafe for strict query builders.
- Change: I treated planner output as untrusted input and added runtime sanitization and normalization before building query filters.
- Impact: Prevented runtime query failures and reduced risk of 500 errors caused by malformed planner data.

## 3. Data Integrity for Analytics

- Problem: The dataset mixes different units for some indicators (percentage, counts, rates), and averaging mixed units creates misleading metrics.
- Change: I introduced indicator-specific default unit and population rules before aggregation logic runs.
- Impact: Trend and comparison outputs became consistent and analytically defensible.

## 4. Dataset Constraint Handling

- Problem: The source data allows only one non-All demographic dimension at a time in many cases, which can produce empty results if combined incorrectly.
- Change: I constrained and normalized filter combinations to match what the data actually supports.
- Impact: Fewer dead-end queries, better answer reliability, and cleaner user follow-up behavior.

## 5. Planner Strategy and Reliability

- Problem: Relying only on external model planning would make the app fragile when keys are missing or calls fail.
- Change: I implemented a model-first path with deterministic fallback behavior.
- Impact: The app remains functional without external model access and still supports richer planning when a key is available.

## 6. Frontend Experience and Rendering

- Problem: Chart behavior can become inconsistent if chart type is inferred only on the frontend without backend context.
- Change: I used backend-provided render metadata to drive chart behavior and formatting decisions.
- Impact: More predictable visual output and easier coordination between backend answer logic and frontend rendering.

## 7. Dev and Infra Decisions

- Problem: Workspace dependency handling and container builds can drift or fail if lockfile strategy is unclear.
- Change: I aligned around workspace-aware install and build behavior plus stable compose startup flow including schema and seed lifecycle.
- Impact: More reproducible local runs and fewer environment-specific onboarding issues.

## 8. Testing and Regression Control

- Problem: Refactors around assistant behavior can silently break nuanced intent or response logic.
- Change: I added focused backend regression tests around assistant response behavior and key inference paths.
- Impact: Safer iteration speed and higher confidence during refactors.

## 9. Tradeoffs I Would Call Out

- I optimized for correctness and reliability over maximum planner flexibility.
- I accepted stricter filter normalization to avoid invalid analytics.
- I kept rendering policy deterministic so outputs are explainable and repeatable.

## 10. How I Would Demo It Live

- Start with a baseline trend question and show follow-up continuity.
- Run one category comparison and explain dataset-compatible filtering.
- Explain one reliability guardrail.
- Guardrail: Runtime sanitization before DB filters.
- Guardrail: Unit normalization before aggregation.
- Guardrail: Fallback planning path.

## 11. What I Would Improve Next

- Expand test coverage for more multi-turn and edge-case planner outputs.
- Add richer observability around planner decisions and filter normalization.
- Add explicit user-facing hints when dataset constraints force filter adjustments.

---

---

# 5-Minute Deep Dive Interview Script

## Opening (20-30 seconds)

Thanks for the opportunity. I built a conversational diabetes explorer that answers natural-language questions over CDC state-level diabetes data.  
The core user flow is: ask a question, retain follow-up context, and get a chart plus a concise explanation.  
My focus was not just feature completeness, but data correctness, reliability under imperfect AI output, and maintainable architecture.

## Problem Framing (30-45 seconds)

I treated this as a full-stack reliability problem with three major risks:

- Risk 1: Planner output can be malformed at runtime.
- Risk 2: Public-health data can be mis-aggregated if units are mixed.
- Risk 3: Multi-turn conversational state can become inconsistent over follow-ups.

So I optimized for safe defaults, deterministic behavior, and explicit boundaries.

## Architecture Decisions (60-90 seconds)

I split the assistant into four boundaries so each layer has one job:

- Planner boundary:
  Interprets user intent and proposes filters/render hints.
  It supports model-first planning when an API key exists.

- State boundary:
  Treats planner output as untrusted.
  Sanitizes values and merges next-state over prior conversation state.

- Response boundary:
  Decides how to summarize results and how to render them, including chart kind and value formatting.

- Orchestration boundary:
  Coordinates end-to-end flow: load dataset context, run planner, sanitize/merge state, execute store queries, then compose final payload.

Why this mattered:

- Refactors became safer.
- Unit testing became more targeted.
- Production debugging became faster because each failure maps to a clear boundary.

## Safety and Runtime Hardening (60-75 seconds)

One of my most important decisions was to enforce a strict trust boundary between LLM output and query construction.

Problem:

- Even if TypeScript types look strict, runtime planner output can still contain arrays, null-like values, empty strings, or mismatched structures.

Change:

- I sanitize and normalize planner output before it reaches database filters.

Impact:

- Prevented query-construction failures and reduced 500-class errors.
- Made behavior more predictable in both model and fallback planning paths.

This is a key point I’d emphasize: typed code alone is not enough when the source is model-generated runtime data.

## Data Integrity and Analytics Correctness (75-90 seconds)

The biggest analytics risk came from mixed units in the source dataset.

Problem:

- Some indicators are available in different units, like percentages, counts, or rates.
- If you average across mixed units, the result can look valid syntactically but be analytically wrong.

Change:

- I applied indicator-specific default unit and default population rules before aggregation.

Impact:

- Results became comparable and defensible.
- Trend lines and category comparisons are based on aligned measurement semantics.

This was a high-leverage fix because it prevents silent correctness bugs, which are more dangerous than loud failures.

## Dataset Constraints and Query Validity (45-60 seconds)

The dataset has structural constraints, especially around demographic dimensions.

Problem:

- In many cases, only one demographic dimension can be specific at a time.
- Invalid combinations often produce empty or misleading outputs.

Change:

- I normalized filter combinations to align with valid dataset slices.

Impact:

- Fewer dead-end queries.
- Better conversational continuity in follow-ups.
- More trustworthy user experience.

## Product Behavior and UX Strategy (45-60 seconds)

I designed the planner strategy for graceful degradation.

- Model-first path:
  Uses richer interpretation when a key is provided.

- Deterministic fallback path:
  Keeps the app functional when external model calls are unavailable.

This gives reliability under real-world constraints like missing keys, network issues, or API failures.

On rendering, I prefer backend-driven render metadata so frontend visuals stay consistent with backend interpretation logic.

## Testing Strategy (45-60 seconds)

I focused tests on regression-prone logic, not just happy paths.

- Assistant response behavior.
- Inference and render-policy edge cases.
- Behavior affected by refactors in planner/state/response boundaries.

The goal was confidence in iteration speed: make architectural improvements without accidentally changing user-facing behavior.

## Tradeoffs and Why (45 seconds)

The three deliberate tradeoffs I made:

- Correctness over flexibility:
  I preferred stricter normalization to avoid invalid analytics.

- Determinism over novelty:
  I kept render behavior and key policy decisions explainable.

- Reliability over maximal AI dependence:
  Fallback logic ensures product continuity without external model dependencies.

If challenged on this, I’d say these are production-minded tradeoffs for a data-facing app where trust matters.

## What I’d Improve Next (30-45 seconds)

With more time, I would:

- Expand multi-turn and adversarial planner-output tests.
- Add richer observability around planner decisions and normalization outcomes.
- Improve user-facing transparency when constraints force filter adjustments.

## Closing (15-20 seconds)

In short, I built this to be conversational and useful, but also safe and defensible: strong boundaries, validated runtime behavior, and analytics integrity as first-class concerns.

---

# Optional Q&A Add-On (Likely Follow-Ups)

## Q1: Why not rely fully on TypeScript instead of runtime sanitization?

TypeScript only protects compile-time assumptions. Planner output is runtime data from an external system.  
Runtime guards are mandatory to prevent invalid query payloads and production errors.

## Q2: What was your highest-risk bug class?

Silent analytics corruption from mixed units.  
It can pass tests if only shape is validated, but the result is semantically wrong.

## Q3: Why split architecture this way for a small project?

Because even small conversational systems get complex quickly with state + planning + rendering.  
Boundary separation reduced coupling and made behavior easier to test and explain.

## Q4: How did you handle failure when OpenAI is unavailable?

Deterministic fallback planning path.  
The app still answers and renders using local logic, so users aren’t blocked by external dependency failures.

## Q5: If you had one week more, where would you invest?

Multi-turn robustness tests and observability.  
Those two investments improve confidence and shorten debugging loops the most.

---

---

## Frontend API Flow Path

### 1. App Startup Metadata Flow

1. Startup entry

- On mount, the app checks for a stored session key at [frontend/src/App.vue#L371](http://_vscodecontentref_/1).
- Setup actions trigger initialization from [frontend/src/App.vue#L344](http://_vscodecontentref_/2) or [frontend/src/App.vue#L359](http://_vscodecontentref_/3), which calls initializeApp at [frontend/src/App.vue#L253](http://_vscodecontentref_/4).

2. Overview API call

- initializeApp calls loadOverview at [frontend/src/App.vue#L236](http://_vscodecontentref_/5).
- loadOverview calls fetchDatasetOverview at [frontend/src/App.vue#L241](http://_vscodecontentref_/6).
- fetchDatasetOverview is defined at [frontend/src/lib/api.ts#L128](http://_vscodecontentref_/7).
- The RPC client endpoint is configured at [frontend/src/lib/api.ts#L108](http://_vscodecontentref_/8).
- Base URL resolution is handled at [frontend/src/lib/api.ts#L84](http://_vscodecontentref_/9).

3. Where startup data is stored

- Returned overview data is assigned at [frontend/src/App.vue#L242](http://_vscodecontentref_/10).
- The overview state ref is declared at [frontend/src/App.vue#L28](http://_vscodecontentref_/11).

---

### 2. User Question / Chat Request Flow

1. Trigger points

- Main form submit triggers askQuestion at [frontend/src/App.vue#L647](http://_vscodecontentref_/12).
- Quick prompts call usePrompt at [frontend/src/App.vue#L329](http://_vscodecontentref_/13), which also routes to askQuestion.

2. Outbound API call

- askQuestion starts at [frontend/src/App.vue#L266](http://_vscodecontentref_/14).
- The request is sent at [frontend/src/App.vue#L286](http://_vscodecontentref_/15) via sendDiabetesQuestion.
- Payload includes:

1. question
2. current conversation state
3. optional OpenAI API key

- sendDiabetesQuestion is defined at [frontend/src/lib/api.ts#L132](http://_vscodecontentref_/16).
- It uses the same RPC endpoint configured at [frontend/src/lib/api.ts#L108](http://_vscodecontentref_/17).

3. Where response data is stored

- Full response is first assigned to assistant state at [frontend/src/App.vue#L292](http://_vscodecontentref_/18).
- assistant ref is declared at [frontend/src/App.vue#L29](http://_vscodecontentref_/19).
- conversationState is updated at [frontend/src/App.vue#L306](http://_vscodecontentref_/20), declared at [frontend/src/App.vue#L30](http://_vscodecontentref_/21).
- Transcript is updated before and after request at [frontend/src/App.vue#L280](http://_vscodecontentref_/22) and [frontend/src/App.vue#L309](http://_vscodecontentref_/23).

### State Update Behavior on Response

- assistant is overwritten on each successful API response.
- In the normal path, the latest response replaces the previous assistant snapshot.
- In the no-data path, assistant is still replaced, but with a patched version of the latest response.

- conversationState is also overwritten on each request.
- In the normal path, it is replaced with the new result state.
- In the no-data path, it is replaced with a patched state that preserves prior filters.

- transcript is the only part that keeps growing over time.
- Each request appends a user entry and then appends an assistant entry.

- Summary: assistant and conversationState are replace-per-turn snapshots, while transcript is the accumulating history.

---

### 3. Where Returned Data Is Rendered

1. Chart bindings in App

- series prop binding at [frontend/src/App.vue#L819](http://_vscodecontentref_/24)
- breakdown prop binding at [frontend/src/App.vue#L820](http://_vscodecontentref_/25)
- subtitle fallback to assistant answer at [frontend/src/App.vue#L826](http://_vscodecontentref_/26)

2. Chart component consumption

- Props accepted in [frontend/src/components/series-chart.vue#L19](http://_vscodecontentref_/27).
- Chart type selection logic at [frontend/src/components/series-chart.vue#L99](http://_vscodecontentref_/28).
- Empty-state rendering at [frontend/src/components/series-chart.vue#L341](http://_vscodecontentref_/29).

3. Assistant response text rendering

- Transcript loop at [frontend/src/App.vue#L854](http://_vscodecontentref_/30).
- Displayed text field at [frontend/src/App.vue#L866](http://_vscodecontentref_/31).

---

### One-Line Summary

The request starts in askQuestion in App, goes through lib/api RPC calls to the backend, returns into assistant and conversationState refs, and then gets rendered in SeriesChart and the transcript UI.

---

---

## How context carries forward between questions

In this app, follow-up context is carried forward by sending a **state object** on every new question, not by sending the full chat transcript to the backend.

### What persists between turns

1. filters (main thing that drives follow-ups)
2. lastQuestion
3. lastAnswer
4. lastRender
5. turnCount

### How it works

1. The frontend keeps the latest conversationState in memory.
2. On the next question, the frontend includes that state in the request.
3. The backend planner uses question + state to decide updated filters.
4. The backend merges previous filters with new/sanitized filters, so old filters persist unless explicitly overridden.

### Important nuance

1. If a query returns no data, the frontend rolls filters back to the previous valid filters so bad filters do not carry into future turns.
2. The transcript shown in the UI is mainly for display; it is not the primary context mechanism for backend follow-ups.
3. This is session-level memory in the running app, not long-term persisted conversation memory in a database. On page reload, conversation state resets (except API key, which is stored in sessionStorage).
