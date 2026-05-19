// Runtime data layer for the Pleo dashboard.
//
// Loads DuckDB-WASM in the browser, mounts the parquet exports of each dbt
// mart, and runs all dashboard SQL right here. The result is shaped into
// `window.DATA` for the existing React/Recharts app to consume.
//
// Why this exists: previously `window.DATA` was a hardcoded JSON blob baked
// into index.html at build time. Now the dashboard genuinely queries the dbt
// marts at runtime — refresh the page and you see the latest numbers from the
// parquet files under `dashboard/data/`. No Python middleware required.

import * as duckdb from 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/+esm';

// ── Parquet files to register as tables ─────────────────────────────────────
// Names match the SQL identifiers we use below. The build script exports
// each mart with the same filename.
const TABLES = [
  'fct_quarterly_arr',
  'fct_pipeline_health',
  'fct_opportunities',
  'fct_rep_attainment',
  'fct_funnel_conversion',
  'fct_monthly_arr',
  'dim_accounts',
  'dim_reps',
  'int_pipeline_stage_history',
  'int_activity_outcomes_filled',
];

const DATA_DIR = new URL('data/', window.location.href).href.replace(/\/$/, '');

// ── DuckDB-WASM bootstrap ───────────────────────────────────────────────────

async function bootDuckDB() {
  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);

  // Worker has to be served from a same-origin URL — wrap the CDN worker in a
  // blob URL so the browser accepts it.
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
  );
  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);

  return db;
}

async function mountTables(db) {
  // Fetch each parquet as a full buffer and register it in-memory.
  // This avoids HTTP range requests (which Python's http.server doesn't support)
  // and works on any static host including GitHub Pages.
  const conn = await db.connect();
  await Promise.all(TABLES.map(async (t) => {
    const filename = `${t}.parquet`;
    const resp = await fetch(`${DATA_DIR}/${filename}`);
    if (!resp.ok) throw new Error(`Failed to fetch ${filename}: ${resp.status}`);
    const buf = await resp.arrayBuffer();
    await db.registerFileBuffer(filename, new Uint8Array(buf));
  }));
  for (const t of TABLES) {
    await conn.query(`CREATE OR REPLACE VIEW ${t} AS SELECT * FROM '${t}.parquet'`);
  }
  return conn;
}

// Convenience: turn an Arrow result into plain JS objects.
async function rows(conn, sql) {
  const result = await conn.query(sql);
  return result.toArray().map(r => r.toJSON());
}
async function one(conn, sql) {
  const r = await rows(conn, sql);
  return r[0] || {};
}

// Helper: round bigint/number safely (Arrow may return BigInts for INTs).
const num = (v) => v == null ? null : (typeof v === 'bigint' ? Number(v) : Number(v));

// ── Section queries — one per slice of window.DATA ──────────────────────────

async function buildHero(conn) {
  const q2  = await one(conn, `SELECT sum(target_eur) AS tgt, sum(closed_arr_eur) AS closed
                               FROM fct_quarterly_arr WHERE quarter = 'Q2 2026'`);
  const st  = await one(conn, `SELECT count(*)::int AS deals,
                                      sum(arr_eur) AS arr,
                                      sum(weighted_arr_eur) AS weighted,
                                      avg(days_since_last_activity) AS avg_silent
                               FROM fct_pipeline_health WHERE is_stale`);
  const pq2 = await one(conn, `SELECT sum(arr_eur) AS arr, sum(weighted_arr_eur) AS weighted
                               FROM fct_pipeline_health WHERE closes_in_q2_2026`);
  const wrR = await one(conn, `
    SELECT (count(*) FILTER (WHERE is_won))::double
           / nullif((count(*) FILTER (WHERE is_won OR is_lost)), 0) AS wr
    FROM fct_opportunities WHERE opp_created_date >= DATE '2024-01-01'`);

  const tgt   = num(q2.tgt);
  const close = num(q2.closed);
  const arr   = num(st.arr);
  const wr    = num(wrR.wr);

  return {
    asOf: '14 May 2026',
    q2Target:       Math.round(tgt),
    q2Closed:       Math.round(close),
    q2Gap:          Math.round(tgt - close),
    q2PipeGross:    Math.round(num(pq2.arr)),
    q2PipeWeighted: Math.round(num(pq2.weighted)),
    staleDeals:     num(st.deals),
    staleArr:       Math.round(arr),
    staleWeighted:  Math.round(num(st.weighted)),
    staleAvgSilent: Math.round(num(st.avg_silent)),
    winRatePct:     Math.round(wr * 100),
    recoveryEur:    Math.round(arr * 0.15 * wr),
  };
}

async function buildTrend(conn) {
  const r = await rows(conn, `
    SELECT right(quarter, 4) || ' ' || left(quarter, 2) AS quarter,
           round(sum(target_eur)/1000, 1)               AS target_k,
           round(sum(closed_arr_eur)/1000, 1)           AS closed_k
    FROM fct_quarterly_arr
    WHERE right(quarter, 4) IN ('2024','2025','2026')
    GROUP BY right(quarter, 4) || ' ' || left(quarter, 2)
    ORDER BY 1`);
  return r.map(x => ({ quarter: x.quarter, target_k: num(x.target_k), closed_k: num(x.closed_k) }));
}

async function buildPipelineQuality(conn) {
  const r = await one(conn, `
    SELECT
      (SELECT count(*) FROM fct_pipeline_health WHERE is_stale) AS stalled_deals,
      (SELECT sum(arr_eur) FROM fct_pipeline_health WHERE is_stale) AS stalled_arr,
      (SELECT count(*) FROM fct_pipeline_health WHERE close_date_slippage_days > 0) AS slipped_deals,
      (SELECT sum(arr_eur) FROM fct_pipeline_health WHERE close_date_slippage_days > 0) AS slipped_arr,
      (SELECT median(sales_cycle_days) FROM fct_opportunities WHERE is_won AND sales_cycle_days > 0) AS avg_cycle,
      (SELECT avg(arr_eur) FROM fct_opportunities WHERE is_won) AS asp_eur`);
  return {
    stalledDeals: num(r.stalled_deals),
    stalledArr:   Math.round(num(r.stalled_arr)),
    slippedDeals: num(r.slipped_deals),
    slippedArr:   Math.round(num(r.slipped_arr)),
    avgCycle:     r.avg_cycle != null ? Math.round(num(r.avg_cycle)) : null,
    aspEur:       r.asp_eur   != null ? Math.round(num(r.asp_eur)) : null,
  };
}

async function buildQualityFlags(conn) {
  const r = await rows(conn, `
    SELECT 'Stalled > 30d no activity' AS flag,
           count(*)::int AS deals,
           round(sum(arr_eur)/1000, 0) AS arr_keur,
           'Sales lead' AS flag_owner,
           'red' AS severity
      FROM fct_pipeline_health WHERE is_stale
    UNION ALL
    SELECT 'Slipped close date',
      count(*) FILTER (WHERE close_date_slippage_days > 0)::int,
      round(sum(arr_eur) FILTER (WHERE close_date_slippage_days > 0)/1000, 0),
      'Sales lead', 'red'
      FROM fct_pipeline_health
    UNION ALL
    SELECT 'Deals > 90d in stage',
      count(*) FILTER (WHERE stage_age_days > 90)::int,
      round(sum(arr_eur) FILTER (WHERE stage_age_days > 90)/1000, 0),
      'Sales lead', 'amber'
      FROM fct_pipeline_health
    UNION ALL
    SELECT 'No activity ever logged',
      count(*) FILTER (WHERE last_activity_date IS NULL)::int,
      coalesce(round(sum(arr_eur) FILTER (WHERE last_activity_date IS NULL)/1000, 0), 0),
      'RevOps', 'gray'
      FROM fct_pipeline_health`);
  return r.map(x => ({
    flag: x.flag, deals: num(x.deals), arr_keur: num(x.arr_keur),
    flag_owner: x.flag_owner, severity: x.severity,
  }));
}

async function buildAspBySource(conn) {
  const r = await rows(conn, `
    SELECT demand_source,
           count(*)::int AS won_deals,
           round(avg(arr_eur), 0) AS asp_eur,
           round(sum(arr_eur)/1000, 0) AS total_keur
    FROM fct_opportunities WHERE is_won
    GROUP BY 1 ORDER BY asp_eur DESC`);
  return r.map(x => ({
    demand_source: x.demand_source,
    won_deals: num(x.won_deals),
    asp_eur:   num(x.asp_eur),
    total_keur: num(x.total_keur),
  }));
}

async function buildVelocity(conn) {
  const r = await rows(conn, `
    WITH cleaned AS (
      SELECT h.opportunity_id, h.stage_age_days, o.stage AS stage
      FROM int_pipeline_stage_history h
      JOIN fct_opportunities o USING (opportunity_id)
      WHERE h.stage_age_days > 0 AND o.stage NOT IN ('Closed Won', 'Closed Lost')
    )
    SELECT stage,
           round(avg(stage_age_days), 1) AS avg_days,
           count(DISTINCT opportunity_id)::int AS opps
    FROM cleaned GROUP BY 1 ORDER BY avg_days DESC`);
  return r.map(x => ({ stage: x.stage, avg_days: num(x.avg_days), opps: num(x.opps) }));
}

async function buildTopStale(conn) {
  const r = await rows(conn, `
    SELECT account_name, rep_name, market, segment, stage,
           round(arr_eur/1000, 1) AS arr_keur,
           days_since_last_activity AS days_silent
    FROM fct_pipeline_health WHERE is_stale
    ORDER BY arr_eur DESC LIMIT 12`);
  return r.map(x => ({
    account_name: x.account_name, rep_name: x.rep_name,
    market: x.market, segment: x.segment, stage: x.stage,
    arr_keur: num(x.arr_keur), days_silent: num(x.days_silent),
  }));
}

async function buildStaleBySegment(conn) {
  const r = await rows(conn, `
    SELECT market, segment, count(*)::int AS deals,
           round(sum(arr_eur)/1000, 0) AS arr_keur
    FROM fct_pipeline_health WHERE is_stale
    GROUP BY 1, 2 ORDER BY arr_keur DESC`);
  return r.map(x => ({ market: x.market, segment: x.segment, deals: num(x.deals), arr_keur: num(x.arr_keur) }));
}

async function buildFunnel(conn) {
  const r = await one(conn, `
    SELECT sum(leads)::int AS leads, sum(mqls)::int AS mqls, sum(sqls)::int AS sqls,
           sum(demos)::int AS demos, sum(opps)::int AS opps, sum(won)::int AS won
    FROM fct_funnel_conversion WHERE event_month >= DATE '2026-02-01'`);
  return [
    { stage: 'Leads', count: num(r.leads) },
    { stage: 'MQL',   count: num(r.mqls) },
    { stage: 'SQL',   count: num(r.sqls) },
    { stage: 'Demo',  count: num(r.demos) },
    { stage: 'Opp',   count: num(r.opps) },
    { stage: 'Won',   count: num(r.won) },
  ];
}

async function buildFunnelBySource(conn) {
  const r = await rows(conn, `
    SELECT demand_source, segment,
           sum(leads)::int AS leads,
           sum(opps)::int  AS opps,
           sum(won)::int   AS won,
           round(sum(won_arr_eur)/1000, 0) AS won_keur,
           CASE WHEN sum(leads) > 0
                THEN round(sum(won)::double/sum(leads)*100, 1) END AS lead_to_won
    FROM fct_funnel_conversion
    WHERE event_month >= DATE '2025-05-01'
    GROUP BY 1, 2 ORDER BY lead_to_won DESC NULLS LAST`);
  return r.map(x => ({
    demand_source: x.demand_source, segment: x.segment,
    leads: num(x.leads), opps: num(x.opps), won: num(x.won),
    won_keur: x.won_keur != null ? num(x.won_keur) : null,
    lead_to_won: x.lead_to_won != null ? num(x.lead_to_won) : null,
  }));
}

async function buildSlippageTrend(conn) {
  const r = await rows(conn, `
    SELECT cast(snapshot_month AS varchar) AS snapshot_month,
           count(*) FILTER (WHERE close_date_slippage_days > 0)::int AS deals_slipped,
           count(*)::int AS total_deals,
           round(sum(arr_at_snapshot) FILTER (WHERE close_date_slippage_days > 0)/1000, 0) AS slipped_keur,
           round(
             100.0 * count(*) FILTER (WHERE close_date_slippage_days > 0)
             / nullif(count(*), 0), 1
           ) AS slip_rate
    FROM int_pipeline_stage_history
    WHERE snapshot_month >= DATE '2025-09-01'
    GROUP BY 1 ORDER BY 1`);
  return r.map(x => ({
    snapshot_month: x.snapshot_month,
    deals_slipped:  num(x.deals_slipped),
    total_deals:    num(x.total_deals),
    slipped_keur:   x.slipped_keur != null ? num(x.slipped_keur) : null,
    slip_rate:      x.slip_rate != null ? num(x.slip_rate) : null,
  }));
}

async function buildRepTable(conn) {
  // Q1 attainment per rep, Q2 attainment per rep (through May 14), merged.
  const q1 = await rows(conn, `
    SELECT rep_id, rep_name,
           sum(closed_won_arr_eur) AS won,
           sum(effective_monthly_target_eur) AS tgt
    FROM fct_rep_attainment WHERE quarter = 'Q1 2026'
    GROUP BY 1, 2`);
  const q2 = await rows(conn, `
    SELECT rep_id, rep_name, market, segment, team,
           sum(closed_won_arr_eur) AS won,
           sum(effective_monthly_target_eur) AS tgt
    FROM fct_rep_attainment
    WHERE quarter = 'Q2 2026' AND target_month <= DATE '2026-05-31'
    GROUP BY 1, 2, 3, 4, 5`);

  const q1Att = Object.fromEntries(q1.map(r => {
    const tgt = num(r.tgt), won = num(r.won);
    return [r.rep_id, tgt > 0 ? Math.round(won / tgt * 100) : 0];
  }));

  const merged = q2.map(r => {
    const tgt = num(r.tgt), won = num(r.won);
    return {
      rep_name: r.rep_name, market: r.market, segment: r.segment, team: r.team,
      tgt_eur: tgt, won_eur: won,
      q1_att: q1Att[r.rep_id] ?? 0,
      q2_att: tgt > 0 ? Math.round(won / tgt * 100) : 0,
    };
  });
  merged.sort((a, b) => (b.q1_att - a.q1_att) || (b.q2_att - a.q2_att));
  return merged;
}

async function buildPipeByMarket(conn) {
  const r = await rows(conn, `
    SELECT market, segment, count(*)::int AS open_deals,
           round(sum(arr_eur)/1000, 0) AS arr_keur,
           round(sum(weighted_arr_eur)/1000, 0) AS weighted_keur,
           count(*) FILTER (WHERE is_stale)::int AS stale_deals,
           round(coalesce(sum(arr_eur) FILTER (WHERE is_stale), 0)/1000, 0) AS stale_keur
    FROM fct_pipeline_health GROUP BY 1, 2 ORDER BY arr_keur DESC`);
  return r.map(x => ({
    market: x.market, segment: x.segment,
    open_deals: num(x.open_deals), arr_keur: num(x.arr_keur),
    weighted_keur: num(x.weighted_keur), stale_deals: num(x.stale_deals),
    stale_keur: num(x.stale_keur),
  }));
}

async function buildDrift(conn) {
  const r = await rows(conn, `
    SELECT 'Accounts — market label drift' AS field,
           count(*) FILTER (WHERE market_drift)::int AS drift_rows,
           count(*)::int AS total
      FROM dim_accounts
    UNION ALL SELECT 'Accounts — segment drift',
      count(*) FILTER (WHERE segment_drift)::int, count(*)::int FROM dim_accounts
    UNION ALL SELECT 'Accounts — country drift',
      count(*) FILTER (WHERE country_drift)::int, count(*)::int FROM dim_accounts
    UNION ALL SELECT 'Opportunities — stage drift',
      count(*) FILTER (WHERE stage_drift)::int, count(*)::int FROM fct_opportunities
    UNION ALL SELECT 'Opportunities — demand source drift',
      count(*) FILTER (WHERE demand_source_drift)::int, count(*)::int FROM fct_opportunities`);
  return r.map(x => ({ field: x.field, drift_rows: num(x.drift_rows), total: num(x.total) }));
}

async function buildCumulativeArr(conn) {
  const r = await rows(conn, `
    SELECT cast(month AS varchar) AS month,
           coalesce(new_arr_eur, 0)        AS new_arr_eur,
           coalesce(cumulative_arr_eur, 0) AS cumulative_arr_eur
    FROM fct_monthly_arr
    WHERE month >= DATE '2024-01-01' AND month <= DATE '2026-06-01'
    ORDER BY month`);
  return r.map(x => ({
    month: x.month,
    new_arr_eur: num(x.new_arr_eur),
    cumulative_arr_eur: num(x.cumulative_arr_eur),
  }));
}

// ── ARR trend · raw wins + monthly targets ─────────────────────────────────
// The chart in the dashboard supports two views (cumulative lines vs actuals
// bars) and three periods (month / quarter / year). Rather than precompute
// every combination in SQL, we ship the source rows (~25 wins, ~30 monthly
// targets) and let the front-end pivot them. That keeps the UI snappy when
// the user clicks through periods.
async function buildArrTrend(conn) {
  const wins = await rows(conn, `
    SELECT cast(close_date AS varchar) AS close_date, arr_eur
    FROM fct_opportunities
    WHERE is_won AND close_date >= DATE '2024-01-01'
    ORDER BY close_date`);
  const targets = await rows(conn, `
    SELECT cast(target_month AS varchar) AS month,
           sum(effective_monthly_target_eur) AS target
    FROM fct_rep_attainment
    WHERE target_month >= DATE '2024-01-01'
    GROUP BY 1 ORDER BY 1`);
  return {
    wins:    wins.map(w => ({ close_date: w.close_date, arr_eur: num(w.arr_eur) })),
    targets: targets.map(t => ({ month: t.month, target: num(t.target) })),
  };
}

// ── Raw rep attainment + open pipeline ─────────────────────────────────────
// The performance table now supports Month / Quarter / Year filtering, so we
// ship the granular rows and let the front-end aggregate per period.
async function buildRepAttainmentRaw(conn) {
  const r = await rows(conn, `
    SELECT cast(target_month AS varchar) AS month,
           rep_id, rep_name, market, segment, team,
           effective_monthly_target_eur AS target,
           closed_won_arr_eur           AS actuals
    FROM fct_rep_attainment
    WHERE target_month >= DATE '2024-01-01'
    ORDER BY target_month, rep_id`);
  return r.map(x => ({
    month: x.month, rep_id: x.rep_id, rep_name: x.rep_name,
    market: x.market, segment: x.segment, team: x.team,
    target: num(x.target), actuals: num(x.actuals),
  }));
}

async function buildPipelineOpenRaw(conn) {
  const r = await rows(conn, `
    SELECT cast(close_date AS varchar) AS close_date,
           market, segment, rep_id, rep_name,
           arr_eur, weighted_arr_eur
    FROM fct_pipeline_health
    ORDER BY close_date`);
  return r.map(x => ({
    close_date: x.close_date, market: x.market, segment: x.segment,
    rep_id: x.rep_id, rep_name: x.rep_name,
    arr: num(x.arr_eur), weighted: num(x.weighted_arr_eur),
  }));
}

// ── Performance pivot · region × segment cells ─────────────────────────────
// Feeds the expandable Region / Segment tabs. Each cell is a (market, segment)
// pair with Q2 2026 actuals / target / weighted-pipe. The same flat list is
// grouped either way at render time.
async function buildPerformancePivot(conn) {
  const r = await rows(conn, `
    WITH actuals AS (
      SELECT market, segment, sum(closed_won_arr_eur) AS won
      FROM fct_rep_attainment
      WHERE quarter = 'Q2 2026' AND target_month <= DATE '2026-05-31'
      GROUP BY 1, 2
    ),
    targets AS (
      SELECT market, segment, sum(effective_monthly_target_eur) AS tgt
      FROM fct_rep_attainment
      WHERE quarter = 'Q2 2026'
      GROUP BY 1, 2
    ),
    pipe AS (
      SELECT market, segment, sum(weighted_arr_eur) AS weighted
      FROM fct_pipeline_health
      WHERE closes_in_q2_2026
      GROUP BY 1, 2
    )
    SELECT coalesce(t.market, a.market, p.market)    AS market,
           coalesce(t.segment, a.segment, p.segment) AS segment,
           coalesce(a.won, 0)      AS actuals,
           coalesce(t.tgt, 0)      AS target,
           coalesce(p.weighted, 0) AS weighted
    FROM           targets t
    FULL OUTER JOIN actuals a ON a.market = t.market AND a.segment = t.segment
    FULL OUTER JOIN pipe    p ON p.market = t.market AND p.segment = t.segment
    WHERE coalesce(t.market, a.market, p.market) IS NOT NULL
    ORDER BY market, segment`);
  return r.map(x => ({
    market:   x.market,
    segment:  x.segment,
    actuals:  num(x.actuals),
    target:   num(x.target),
    weighted: num(x.weighted),
  }));
}

// ── ARR pace · cumulative by day-of-quarter, 3 series ──────────────────────
// Q2 2026 line stops at day 44 (the "as of" date), so the chart shows
// us still climbing while the comparison quarters complete.
async function buildArrPace(conn) {
  const r = await rows(conn, `
    WITH spine AS (SELECT unnest(generate_series(1, 91)) AS d),
    q2_2026 AS (
      SELECT date_diff('day', DATE '2026-04-01', close_date) + 1 AS day_in_q, sum(arr_eur) AS arr
      FROM fct_opportunities
      WHERE is_won AND close_date BETWEEN DATE '2026-04-01' AND DATE '2026-05-14'
      GROUP BY 1
    ),
    q1_2026 AS (
      SELECT date_diff('day', DATE '2026-01-01', close_date) + 1 AS day_in_q, sum(arr_eur) AS arr
      FROM fct_opportunities
      WHERE is_won AND close_date BETWEEN DATE '2026-01-01' AND DATE '2026-03-31'
      GROUP BY 1
    ),
    q2_2025 AS (
      SELECT date_diff('day', DATE '2025-04-01', close_date) + 1 AS day_in_q, sum(arr_eur) AS arr
      FROM fct_opportunities
      WHERE is_won AND close_date BETWEEN DATE '2025-04-01' AND DATE '2025-06-30'
      GROUP BY 1
    )
    SELECT s.d AS day_in_q,
           sum(coalesce(a.arr, 0)) OVER (ORDER BY s.d) AS q2_2026,
           sum(coalesce(b.arr, 0)) OVER (ORDER BY s.d) AS q1_2026,
           sum(coalesce(c.arr, 0)) OVER (ORDER BY s.d) AS q2_2025
    FROM spine s
    LEFT JOIN q2_2026 a ON a.day_in_q = s.d
    LEFT JOIN q1_2026 b ON b.day_in_q = s.d
    LEFT JOIN q2_2025 c ON c.day_in_q = s.d
    ORDER BY s.d`);

  // Null out the current-quarter line past day 44 so the line stops "today"
  // instead of running flat to the right edge.
  const AS_OF_DAY = 44;
  return r.map(x => ({
    day_in_q: num(x.day_in_q),
    q2_2026: num(x.day_in_q) <= AS_OF_DAY ? num(x.q2_2026) : null,
    q1_2026: num(x.q1_2026),
    q2_2025: num(x.q2_2025),
  }));
}

// Same-point checkpoint for the right-column insights.
async function buildPaceCheckpoints(conn) {
  const r = await rows(conn, `
    SELECT 'Q2 2026' AS quarter,
           count(*) FILTER (WHERE is_won AND close_date BETWEEN DATE '2026-04-01' AND DATE '2026-05-14') AS deals,
           coalesce(sum(arr_eur) FILTER (WHERE is_won AND close_date BETWEEN DATE '2026-04-01' AND DATE '2026-05-14'), 0) AS arr
      FROM fct_opportunities
    UNION ALL
    SELECT 'Q1 2026',
           count(*) FILTER (WHERE is_won AND close_date BETWEEN DATE '2026-01-01' AND DATE '2026-02-13'),
           coalesce(sum(arr_eur) FILTER (WHERE is_won AND close_date BETWEEN DATE '2026-01-01' AND DATE '2026-02-13'), 0)
      FROM fct_opportunities
    UNION ALL
    SELECT 'Q2 2025',
           count(*) FILTER (WHERE is_won AND close_date BETWEEN DATE '2025-04-01' AND DATE '2025-05-14'),
           coalesce(sum(arr_eur) FILTER (WHERE is_won AND close_date BETWEEN DATE '2025-04-01' AND DATE '2025-05-14'), 0)
      FROM fct_opportunities`);
  return r.map(x => ({ quarter: x.quarter, deals: num(x.deals), arr: num(x.arr) }));
}

// ── Performance · tabbed by Region / Segment / Rep ──────────────────────────
// Each tab returns rows with: actuals (Q2 closed-won to date), target (full Q2
// ramp-adjusted), and weighted pipeline (open deals closing in Q2). The two
// percentages are computed in the front-end so the totals row can re-derive
// them from the summed columns rather than averaging row-level percentages.
async function buildPerformance(conn) {
  const aggregate = async (dim) => {
    const r = await rows(conn, `
      WITH actuals AS (
        SELECT ${dim} AS dim, sum(closed_won_arr_eur) AS won
        FROM fct_rep_attainment
        WHERE quarter = 'Q2 2026' AND target_month <= DATE '2026-05-31'
        GROUP BY 1
      ),
      targets AS (
        SELECT ${dim} AS dim, sum(effective_monthly_target_eur) AS tgt
        FROM fct_rep_attainment
        WHERE quarter = 'Q2 2026'
        GROUP BY 1
      ),
      pipe AS (
        SELECT ${dim} AS dim, sum(weighted_arr_eur) AS weighted
        FROM fct_pipeline_health
        WHERE closes_in_q2_2026
        GROUP BY 1
      )
      SELECT coalesce(t.dim, a.dim, p.dim) AS name,
             coalesce(a.won, 0)      AS actuals,
             coalesce(t.tgt, 0)      AS target,
             coalesce(p.weighted, 0) AS weighted
      FROM targets t
      FULL OUTER JOIN actuals a ON a.dim = t.dim
      FULL OUTER JOIN pipe    p ON p.dim = t.dim
      ORDER BY target DESC, name`);
    return r.map(x => ({
      name:     x.name,
      actuals:  num(x.actuals),
      target:   num(x.target),
      weighted: num(x.weighted),
    }));
  };

  const byRep = await rows(conn, `
    WITH actuals AS (
      SELECT rep_id, sum(closed_won_arr_eur) AS won
      FROM fct_rep_attainment
      WHERE quarter = 'Q2 2026' AND target_month <= DATE '2026-05-31'
      GROUP BY 1
    ),
    targets AS (
      SELECT rep_id, any_value(rep_name) AS rep_name,
             any_value(market) AS market, any_value(segment) AS segment,
             sum(effective_monthly_target_eur) AS tgt
      FROM fct_rep_attainment
      WHERE quarter = 'Q2 2026'
      GROUP BY rep_id
    ),
    pipe AS (
      SELECT rep_id, sum(weighted_arr_eur) AS weighted
      FROM fct_pipeline_health
      WHERE closes_in_q2_2026
      GROUP BY 1
    )
    SELECT t.rep_name AS name,
           t.market || ' · ' || t.segment AS subline,
           coalesce(a.won, 0)      AS actuals,
           t.tgt                   AS target,
           coalesce(p.weighted, 0) AS weighted
    FROM targets t
    LEFT JOIN actuals a USING (rep_id)
    LEFT JOIN pipe    p USING (rep_id)
    ORDER BY t.tgt DESC, t.rep_name`);

  return {
    byRegion:  await aggregate('market'),
    bySegment: await aggregate('segment'),
    byRep:     byRep.map(x => ({
      name:     x.name,
      subline:  x.subline,
      actuals:  num(x.actuals),
      target:   num(x.target),
      weighted: num(x.weighted),
    })),
  };
}

// ── Q2 2026 forecast breakdown by category ─────────────────────────────────
// Open opportunities scheduled to close in Q2, grouped by forecast_category
// (Committed / Best Case / Pipeline). Plus already-closed-won for the
// "what's locked" portion of the headline.
async function buildForecast(conn) {
  const cats = await rows(conn, `
    SELECT forecast_category AS category,
           count(*)::int AS deals,
           sum(arr_eur) AS gross,
           sum(arr_eur * coalesce(close_probability_pct, 0) / 100.0) AS weighted
    FROM fct_opportunities
    WHERE close_date BETWEEN DATE '2026-04-01' AND DATE '2026-06-30'
      AND is_open
    GROUP BY 1`);
  const closed = await one(conn, `
    SELECT sum(arr_eur) FILTER (WHERE is_won)  AS closed_won,
           sum(arr_eur) FILTER (WHERE is_lost) AS closed_lost
    FROM fct_opportunities
    WHERE close_date BETWEEN DATE '2026-04-01' AND DATE '2026-06-30'`);
  const byCat = Object.fromEntries(cats.map(c => [c.category, c]));
  const get = (k) => byCat[k] ? num(byCat[k].weighted) : 0;
  return {
    committedWeighted: get('Committed'),
    bestCaseWeighted:  get('Best Case'),
    pipelineWeighted:  get('Pipeline'),
    closedWon:         num(closed.closed_won) || 0,
    closedLost:        num(closed.closed_lost) || 0,
  };
}

// ── Activity volume — weekly + per-rep ─────────────────────────────────────
async function buildActivity(conn) {
  // Weekly by activity_type for the trailing 12 weeks.
  const weekly = await rows(conn, `
    SELECT cast(date_trunc('week', activity_date) AS varchar) AS week,
           activity_type, count(*)::int AS cnt
    FROM int_activity_outcomes_filled
    WHERE activity_date BETWEEN DATE '2026-02-19' AND DATE '2026-05-14'
    GROUP BY 1, 2 ORDER BY 1, 2`);
  // Activities per rep, last 4 weeks. Join to dim_reps so reps with zero
  // activities still show up.
  const perRep = await rows(conn, `
    WITH a AS (
      SELECT rep_id, count(*)::int AS activities
      FROM int_activity_outcomes_filled
      WHERE activity_date BETWEEN DATE '2026-04-17' AND DATE '2026-05-14'
      GROUP BY 1
    )
    SELECT r.rep_name, r.market, r.segment, coalesce(a.activities, 0)::int AS activities
    FROM dim_reps r LEFT JOIN a USING (rep_id)
    ORDER BY activities ASC, r.rep_name`);
  return {
    weekly: weekly.map(x => ({ week: x.week, type: x.activity_type, cnt: num(x.cnt) })),
    perRep: perRep.map(x => ({
      rep_name: x.rep_name, market: x.market, segment: x.segment,
      activities: num(x.activities),
    })),
  };
}

// ── Sankey · funnel → outcomes (trail 12M + all-time opps) ─────────────────
async function buildSankey(conn) {
  const fn = await one(conn, `
    SELECT sum(leads)::int  AS leads,
           sum(mqls)::int   AS mqls,
           sum(sqls)::int   AS sqls,
           sum(demos)::int  AS demos
    FROM fct_funnel_conversion
    WHERE event_month BETWEEN DATE '2025-06-01' AND DATE '2026-05-31'`);
  const out = await one(conn, `
    SELECT
      count(*) FILTER (WHERE is_won)                      AS won,
      count(*) FILTER (WHERE is_lost)                     AS lost,
      count(*) FILTER (WHERE is_open AND NOT is_stale)    AS active,
      count(*) FILTER (WHERE is_open AND is_stale)        AS stale
    FROM fct_opportunities`);
  return {
    leads: num(fn.leads), mqls: num(fn.mqls), sqls: num(fn.sqls), demos: num(fn.demos),
    won:   num(out.won), lost: num(out.lost),
    active: num(out.active), stale: num(out.stale),
  };
}

// Recommendations are advisory, not data — they don't change row-by-row.
function buildActions(hero) {
  return [
    { title: 'Manager touch on Wise (J. Patel, €161K, 85d silent)',
      owner: 'UK Sales Lead', value: '€161K at-risk', when: 'This week', severity: 'red' },
    { title: 'UK Mid-Market re-engagement sprint (6 stale deals, €296K)',
      owner: 'UK Sales Lead', value: '~€10K recovered', when: '45 days', severity: 'amber' },
    { title: 'Automated weekly stale-deal alert (source already in fct_pipeline_health.is_stale)',
      owner: 'RevOps', value: `+€${Math.round(hero.recoveryEur/1000)}K recovered`, when: '45 days', severity: 'amber' },
    { title: 'Lock CRM picklists on segment / market / demand_source / stage',
      owner: 'RevOps + Sales Ops', value: 'Analyst time + forecast trust', when: 'This sprint', severity: 'gray' },
    { title: 'Open Q2 contingency review with Finance — flip RAG to RED',
      owner: 'CRO', value: '€310K target', when: 'This week', severity: 'red' },
  ];
}

// ── Entry point ─────────────────────────────────────────────────────────────

export async function loadData() {
  const db = await bootDuckDB();
  const conn = await mountTables(db);

  // Run every section query in parallel — each one is independent.
  const [
    hero, trend, pipelineQuality, qualityFlags, aspBySource, velocity,
    topStale, staleBySegment, funnel, funnelBySource, slippageTrend,
    rep, pipeByMarket, drift, cumulativeArr,
    arrPace, paceCheckpoints, performance
  ] = await Promise.all([
    buildHero(conn),
    buildTrend(conn),
    buildPipelineQuality(conn),
    buildQualityFlags(conn),
    buildAspBySource(conn),
    buildVelocity(conn),
    buildTopStale(conn),
    buildStaleBySegment(conn),
    buildFunnel(conn),
    buildFunnelBySource(conn),
    buildSlippageTrend(conn),
    buildRepTable(conn),
    buildPipeByMarket(conn),
    buildDrift(conn),
    buildCumulativeArr(conn),
    buildArrPace(conn),
    buildPaceCheckpoints(conn),
    buildPerformance(conn),
  ]);

  // Sequential — small, keeps the deps obvious.
  const arrTrend          = await buildArrTrend(conn);
  const performancePivot  = await buildPerformancePivot(conn);
  const repAttainment     = await buildRepAttainmentRaw(conn);
  const pipelineOpen      = await buildPipelineOpenRaw(conn);
  const forecast          = await buildForecast(conn);
  const activity          = await buildActivity(conn);
  const sankey            = await buildSankey(conn);

  return {
    hero, trend, pipelineQuality, qualityFlags, aspBySource, velocity,
    topStale, staleBySegment, funnel, funnelBySource, slippageTrend,
    rep, pipeByMarket, drift, cumulativeArr,
    arrPace, paceCheckpoints, performance,
    arrTrend, performancePivot, repAttainment, pipelineOpen,
    forecast, activity, sankey,
    actions: buildActions(hero),
  };
}
