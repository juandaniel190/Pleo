# Part 4 — SQL queries

Five BigQuery-compatible standard-SQL queries that each join at least two tables and answer a specific question relevant to the weekly review.

| # | Query | Purpose |
|---|---|---|
| 01 | `01_q2_pace_vs_target.sql` | Q2 2026 pace vs ramp-adjusted target by market × segment. Drives the headline RAG. |
| 02 | `02_stale_pipeline_callsheet.sql` | Stale-deal call sheet sorted by ARR. The Monday morning to-do list. |
| 03 | `03_rep_attainment_q2_2026.sql` | Q2 rep attainment, ramp-adjusted, with ramp status from the rep dimension. |
| 04 | `04_funnel_conversion_by_demand_source.sql` | Lead → won conversion by demand source × segment for trailing 12 months. |
| 05 | `05_close_date_slippage_trend.sql` | Month-over-month close-date slippage on currently-open deals. |

Schema references: every query points at `main_marts.*` or `main_intermediate.*` from the dbt project in `dbt_pleo/`. To run in BigQuery, replace the three-part identifier `pleo.main_marts.X` with `your_project.your_dataset.X` and adjust `safe_divide`/`filter` if your dialect differs (DuckDB also supports both).
