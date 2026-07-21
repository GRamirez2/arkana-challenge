# diabetes-store README

This document explains what the diabetes store module does.

## What it is

The diabetes store is the backend data layer that powers diabetes metrics in the app.
It is responsible for loading data, validating database readiness, and returning filtered analytics.

## Main responsibilities

1. Load and clean CSV data

- Reads the diabetes CSV file from the backend data folder.
- Converts each row into a structured observation.
- Normalizes values:
  - empty text becomes empty string or null, depending on field
  - invalid or empty numeric values become null

This prevents bad source values from crashing or contaminating calculations.

2. Seed and validate the database

- Can seed all CSV observations into the database.
- Can optionally reset existing rows before seeding.
- Inserts records in chunks to avoid oversized single inserts.
- Can seed only if the table is empty.
- Checks that the table exists and has rows before analytics queries run.

If the table is missing or empty, it throws clear error messages with the commands to fix it.

3. Provide dataset metadata for the UI

- Returns a dataset overview:
  - row count
  - min and max year
  - count of indicators and states
  - sample values for common filters (age, race, sex, education)
- Returns full filter vocabulary values for:
  - indicators
  - states
  - topics
  - age
  - race
  - sex
  - education

This helps the frontend build dropdowns, quick summaries, and filter controls.

4. Run analytics queries

- Yearly series query:
  - groups rows by year
  - applies filters
  - averages estimates per year
  - returns row counts and rounded estimates

- Category breakdown query:
  - groups by a chosen dimension (age, sex, race, education, state, or indicator)
  - picks a target year (explicit input year or latest available year)
  - averages estimates per category
  - sorts output from highest to lowest estimate

## Why default unit/population rules exist

Some indicators are reported in multiple units (for example percentages and raw counts).
If these are mixed, averages become misleading.

The module applies default rules to keep comparisons meaningful:

- Indicator-specific default unit (for example Percentage or Rate per 1,000).
- Indicator-specific default population for Type 1/Type 2 prevalence views.

These defaults can still be overridden by explicit filters when needed.

## In short

The diabetes store is the single source of truth for:

- ingesting and normalizing diabetes observations
- ensuring database readiness
- exposing filter vocabulary and dataset summaries
- serving consistent, comparable trend and breakdown analytics
