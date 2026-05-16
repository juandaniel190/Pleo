# AI usage log

**Tools used:** Claude (Anthropic) via Cowork mode (file tools + DuckDB sandbox).

**Where AI helped:**
- Scaffolding the dbt project files (folders, `dbt_project.yml`, `profiles.yml`, package list). I reviewed each generated file and made the materialisation and var choices myself.
- Writing the per-model `.yml` and `.md` docblock pairs. Tedious, repetitive — exactly where AI shines.
- Drafting Python for the Excel→CSV extraction with primary-key and foreign-key validation. I dictated the validation rules (which PKs to check, which FKs to walk); the AI wrote the loop.
- Generating the HTML dashboard scaffold (CSS layout, Chart.js wiring). I specified the two-tier layout and the four hero KPI cards; the AI produced the markup.

**Where I made the judgment call:**
- Defining the staging / intermediate / marts split and what goes in each layer (driven by feedback from my previous project — currency-conversion-style transformations are not allowed in staging, etc.).
- Choosing the stale-deal threshold (30 days, matching the brief's worked example).
- The OPP-127 deduplication rule (keep earliest `created_at`).
- The decision to re-derive canonical labels from `*_raw` rather than trust Pleo's pre-cleaned columns — and to expose `*_drift` flags so the disagreement is auditable.
- The recovery math (15% re-engagement × historical win rate) and which figures land in the dashboard hero.
- The story arc — pace, risk, attainment, funnel, automation — and what counts as a finding vs noise.
- The "lock down CRM picklists" automation recommendation, sourced from spotting that `segment_raw` has 11 values for 3 canonical segments and 2 accounts disagree with Pleo's clean `market`.

**Prompts that produced real lifts** (illustrative, paraphrased):
- *"Inspect every sheet, give me distinct values for every `*_raw` field, null counts per column, and the first two data rows so I can lock down the staging schema before writing any SQL."* → Saved 20–30 minutes of manual Excel sleuthing.
- *"Write the eight intermediate models. Each should be a view with `config()`, its own `.yml` schema file, and its own `.md` file with a `{% docs %}` block. Use the `normalize_label` macro for canonical-label re-derivation."* → Saved ~1 hour of boilerplate.
- *"Build the dashboard from `dbt_pleo/marts` running on DuckDB. Two tiers: CRO hero at the top with four KPI cards, supporting drilldowns below. Use the Pleo Telescope palette."* → Saved ~1.5 hours of layout/CSS work.

**Time saved vs done manually:** ~3–4 hours of mechanical work (scaffolding, schema files, dashboard styling) that I could redirect toward analysis decisions and the assumptions log.
