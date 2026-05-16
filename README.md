# Pleo RevOps Performance Analyst — Technical Challenge

**Author:** Daniel Amezquita · **Stack:** dbt + DuckDB → Jupyter → React + Recharts

**[→ View dashboard](https://juandaniel190.github.io/Pleo/)**

## What's here

```
Amezquita_Daniel_RevOps/
├── PROJECT_PLAN.md            # the plan I wrote before touching code
├── README.md                  # this file
├── requirements.txt           # Python dependencies
├── dbt_pleo/                  # dbt project — staging → intermediate → marts on DuckDB
├── analysis/                  # Jupyter notebook with the full analysis (10 sections)
├── dashboard/                 # single-HTML React dashboard (GitHub Pages-ready)
│   ├── index.html             #   the dashboard itself — open this
│   ├── app.jsx                #   the React component tree (loaded by index.html)
│   ├── build_dashboard.py     #   regenerates index.html from the dbt marts
│   └── _data.json             #   snapshot of the data the dashboard renders
├── design/                    # Pleo brand palette (Telescope) + theme.css
├── .claude/skills/            # 8 installed B2B RevOps skills (NEON-Rutger)
└── deliverables/              # everything to submit
    ├── 01_data_model.md
    ├── 02_dashboard.html      # copy of dashboard/index.html
    ├── 04_sql_queries/        # 5 BigQuery-compatible queries
    ├── 04_python_script.py    # Excel → CSV (raw values only — dbt does all cleaning)
    ├── analysis_notebook.ipynb
    ├── assumptions_log.md
    └── ai_usage_log.md
```

## Run it locally

```bash
# 1. Install dependencies
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

# 2. Build the warehouse
cd dbt_pleo && DBT_PROFILES_DIR=. dbt build --full-refresh && cd ..

# 3. Run the notebook + rebuild the dashboard
jupyter nbconvert --to notebook --execute analysis/revops_analysis.ipynb --output revops_analysis.ipynb
python dashboard/build_dashboard.py

# 4. Serve (CDN scripts require HTTP — don't open index.html directly)
python3 -m http.server 8000 --directory dashboard
# → http://localhost:8000
```

## Deploy the dashboard to GitHub Pages

`dashboard/index.html` is a single self-contained file:
- CDN React 18 + Babel (in-browser JSX transpilation) + Recharts + Tailwind
- All data is hardcoded as JS literals (no fetch, no API)
- No build step, no `npm install`

To host on GitHub Pages: commit the repo, turn on Pages in the repo settings, point it at the `main` branch root (or `/dashboard`). The shareable URL becomes `https://<user>.github.io/<repo>/dashboard/index.html`.

## dbt design choices (addressing prior feedback)

- **Staging → Intermediate → Marts** with every business rule pushed into `intermediate/`. Staging is rename + cast only.
- **Per-model `.yml`** for every model (descriptions only — minimal tests, only PK uniqueness on dims and facts).
- **No external packages.** Two local macros: `parse_date` (handles ISO + `DD/MM/YYYY` + `YYYY-MM` in the same column) and `parse_percent` (strips `%` defensively, casting input to varchar first).
- **Per-model `config()` blocks**: staging=view, intermediate=view, marts=table. Folder defaults also set in `dbt_project.yml`.
- **No Python data transformations** — `04_python_script.py` extracts raw Excel to CSV. All cleaning lives in dbt via the macros.
- **UK** as the canonical market label (Pleo's `UKI` source value is renamed in the intermediate layer).
- **Seeds → staging via `ref()`** (not `source()`) so `dbt build` properly orders seeds before staging views and never hits a race condition.
- **Mixed-format columns force-typed to `varchar` at the seed layer** in `dbt_project.yml` so DuckDB's CSV sniffer doesn't fight the staging macros.

## Headline findings

- **Q2 2026 is RED.** Six weeks in, €0 closed of a €310.6K ramp-adjusted target.
- **34 open deals worth €1.34M (€384K weighted) are stale** (no AE activity in 30+ days).
- **9 open deals worth €405K slipped** close date at the last snapshot.
- **23 deals have been in the same stage for >90 days** — €785K of stuck pipeline.
- **Wise** (UK Enterprise, J. Patel, €161K, 85 days silent) — manager-touch action this week.
- **Every rep is at 0% Q2 attainment** — this is a system problem, not a rep coaching problem.
- **Automation #1:** weekly stale-deal alert → +€44K recovered ARR in 45 days (15% re-engage × 22% historical win rate).
- **Automation #2:** lock CRM picklists — `segment_raw` has 11 distinct values for 3 canonical segments.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Could not convert string "DD/MM/YYYY" to 'DATE'` on seed load | You're on a stale `target/`. Run `dbt clean && dbt build --full-refresh`. The current `dbt_project.yml` types every mixed-format column as varchar at the seed layer so the staging macros can parse them. |
| `'replace(INTEGER, …)'` binder error in `stg_pleo__opportunities` | Same root cause — `dbt clean && dbt build --full-refresh`. `parse_percent` already casts input to varchar defensively. |
| `IO Error: Could not remove file ".duckdb.wal"` | The DuckDB target file is locked. Close any open notebook / dbt process and delete the file: `rm /tmp/pleo.duckdb*`. |
| Dashboard chart areas are blank | Open browser devtools → Console. Likely a CDN load issue — try again on a normal network (Recharts / Tailwind / React come from unpkg + jsdelivr). |

## What's intentionally deferred

- Five-slide PPTX deck (built later from the same marts)
- Supabase / Postgres target — DuckDB only
