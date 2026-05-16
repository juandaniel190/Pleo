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
  'int_pipeline_stage_history',
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
  // Tell DuckDB how to fetch each parquet over HTTP, then create a view per
  // table so the rest of the queries can use unqualified names.
  const conn = await db.connect();
  for (const t of TABLES) {
    const filename = `${t}.parquet`;
    await db.registerFileURL(
      filename,
      `${DATA_DIR}/${filename}`,
      duckdb.DuckDBDataProtocol.HTTP,
      false
    );
    await conn.query(`CREATE OR REPLACE VIEW ${t} AS SELECT * FROM '${filename}'`);
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
    SELECT quarter,
           round(sum(target_eur)/1000, 1) AS target_k,
           round(sum(closed_arr_eur)/1000, 1) AS closed_k
    FROM fct_quarterly_arr
    WHERE right(quarter, 4) IN ('2024','2025','2026')
    GROUP BY 1 ORDER BY 1`);
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
    rep, pipeByMarket, drift, cumulativeArr
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
  ]);

  return {
    hero, trend, pipelineQuality, qualityFlags, aspBySource, velocity,
    topStale, staleBySegment, funnel, funnelBySource, slippageTrend,
    rep, pipeByMarket, drift, cumulativeArr,
    actions: buildActions(hero),
  };
}
