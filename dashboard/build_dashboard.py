"""Render the React-style single-HTML dashboard from /tmp/pleo.duckdb.

Pattern: CDN React 18 + Babel + Recharts, no build step.
Design language: Finstatement / Crystal — Organic Brutalism. Monochrome base
(black/white/grey), green/red as the only semantic accents.
"""
from __future__ import annotations
import duckdb, json, math
from pathlib import Path


def clean_nans(obj):
    """Recursively replace NaN floats with None so the output is valid JSON."""
    if isinstance(obj, dict):
        return {k: clean_nans(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_nans(v) for v in obj]
    if isinstance(obj, float) and math.isnan(obj):
        return None
    return obj


ROOT = Path(__file__).resolve().parent.parent
con = duckdb.connect('/tmp/pleo.duckdb', read_only=True)


def q(sql): return con.execute(sql).df()


# ---- Pull every dataset ----------------------------------------------------

hero_row = q("""
  select sum(target_eur) tgt, sum(closed_arr_eur) closed
  from main_marts.fct_quarterly_arr where quarter='Q2 2026'
""").iloc[0]
stale_row = q("""
  select count(*) deals, sum(arr_eur) arr, sum(weighted_arr_eur) weighted, avg(days_since_last_activity) avg_silent
  from main_marts.fct_pipeline_health where is_stale
""").iloc[0]
q2_pipe = q("""
  select sum(arr_eur) arr, sum(weighted_arr_eur) weighted
  from main_marts.fct_pipeline_health where closes_in_q2_2026
""").iloc[0]
wr = q("""
  select count(*) filter (where is_won)::double / nullif(count(*) filter (where is_won or is_lost), 0) wr
  from main_marts.fct_opportunities where opp_created_date >= date '2024-01-01'
""").iloc[0]['wr']

hero = {
    'asOf': '14 May 2026',
    'q2Target': int(hero_row['tgt']),
    'q2Closed': int(hero_row['closed']),
    'q2Gap': int(hero_row['tgt'] - hero_row['closed']),
    'q2PipeGross': int(q2_pipe['arr']),
    'q2PipeWeighted': int(q2_pipe['weighted']),
    'staleDeals': int(stale_row['deals']),
    'staleArr': int(stale_row['arr']),
    'staleWeighted': int(stale_row['weighted']),
    'staleAvgSilent': int(stale_row['avg_silent']),
    'winRatePct': round(float(wr) * 100, 0),
    'recoveryEur': int(stale_row['arr'] * 0.15 * wr),
}

trend = q("""
  select quarter, round(sum(target_eur)/1000, 1) as target_k,
         round(sum(closed_arr_eur)/1000, 1) as closed_k
  from main_marts.fct_quarterly_arr
  where right(quarter, 4) in ('2024','2025','2026')
  group by 1 order by 1
""").to_dict('records')

pq_row = q("""
  select
    (select count(*) from main_marts.fct_pipeline_health where is_stale) stalled_deals,
    (select sum(arr_eur) from main_marts.fct_pipeline_health where is_stale) stalled_arr,
    (select count(*) from main_marts.fct_pipeline_health where close_date_slippage_days > 0) slipped_deals,
    (select sum(arr_eur) from main_marts.fct_pipeline_health where close_date_slippage_days > 0) slipped_arr,
    (select median(sales_cycle_days) from main_marts.fct_opportunities where is_won and sales_cycle_days > 0) avg_cycle,
    (select avg(arr_eur) from main_marts.fct_opportunities where is_won) asp_eur
""").iloc[0]
pipeline_quality = {
    'stalledDeals': int(pq_row['stalled_deals']),
    'stalledArr':   int(pq_row['stalled_arr']),
    'slippedDeals': int(pq_row['slipped_deals']),
    'slippedArr':   int(pq_row['slipped_arr']),
    'avgCycle':     round(float(pq_row['avg_cycle']), 0) if pq_row['avg_cycle'] is not None else None,
    'aspEur':       int(pq_row['asp_eur']) if pq_row['asp_eur'] is not None else None,
}

quality_flags = q("""
  select 'Stalled > 30d no activity' as flag,
         count(*) deals, round(sum(arr_eur)/1000, 0) arr_keur, 'Sales lead' as flag_owner, 'red' as severity
    from main_marts.fct_pipeline_health where is_stale
  union all
  select 'Slipped close date',
    count(*) filter (where close_date_slippage_days > 0),
    round(sum(arr_eur) filter (where close_date_slippage_days > 0)/1000, 0), 'Sales lead', 'red'
    from main_marts.fct_pipeline_health
  union all
  select 'Deals > 90d in stage',
    count(*) filter (where stage_age_days > 90),
    round(sum(arr_eur) filter (where stage_age_days > 90)/1000, 0), 'Sales lead', 'amber'
    from main_marts.fct_pipeline_health
  union all
  select 'No activity ever logged',
    count(*) filter (where last_activity_date is null),
    coalesce(round(sum(arr_eur) filter (where last_activity_date is null)/1000, 0), 0), 'RevOps', 'gray'
    from main_marts.fct_pipeline_health
""").to_dict('records')

asp_by_source = q("""
  select demand_source, count(*) won_deals, round(avg(arr_eur), 0) asp_eur,
         round(sum(arr_eur)/1000, 0) total_keur
  from main_marts.fct_opportunities where is_won group by 1 order by asp_eur desc
""").to_dict('records')

velocity = q("""
  with cleaned as (
    select h.opportunity_id, h.stage_age_days, o.stage as stage
    from main_intermediate.int_pipeline_stage_history h
    join main_marts.fct_opportunities o using (opportunity_id)
    where h.stage_age_days > 0 and o.stage not in ('Closed Won', 'Closed Lost')
  )
  select stage, round(avg(stage_age_days), 1) avg_days, count(distinct opportunity_id) opps
  from cleaned group by 1 order by avg_days desc
""").to_dict('records')

top_stale = q("""
  select account_name, rep_name, market, segment, stage,
         round(arr_eur/1000, 1) arr_keur, days_since_last_activity as days_silent
  from main_marts.fct_pipeline_health where is_stale order by arr_eur desc limit 12
""").to_dict('records')

stale_by_seg = q("""
  select market, segment, count(*) deals, round(sum(arr_eur)/1000, 0) arr_keur
  from main_marts.fct_pipeline_health where is_stale group by 1, 2 order by arr_keur desc
""").to_dict('records')

funnel_row = q("""
  select sum(leads) leads, sum(mqls) mqls, sum(sqls) sqls,
         sum(demos) demos, sum(opps) opps, sum(won) won
  from main_marts.fct_funnel_conversion where event_month >= date '2026-02-01'
""").iloc[0]
funnel = [
    {'stage': 'Leads',  'count': int(funnel_row['leads'])},
    {'stage': 'MQL',    'count': int(funnel_row['mqls'])},
    {'stage': 'SQL',    'count': int(funnel_row['sqls'])},
    {'stage': 'Demo',   'count': int(funnel_row['demos'])},
    {'stage': 'Opp',    'count': int(funnel_row['opps'])},
    {'stage': 'Won',    'count': int(funnel_row['won'])},
]

funnel_by_source = q("""
  select demand_source, segment,
         sum(leads) leads, sum(opps) opps, sum(won) won,
         round(sum(won_arr_eur)/1000, 0) won_keur,
         case when sum(leads) > 0 then round(sum(won)::double/sum(leads)*100, 1) end as lead_to_won
  from main_marts.fct_funnel_conversion
  where event_month >= date '2025-05-01'
  group by 1, 2 order by lead_to_won desc nulls last
""").to_dict('records')

slippage_trend = q("""
  select cast(snapshot_month as varchar) as snapshot_month,
         count(*) filter (where close_date_slippage_days > 0) deals_slipped,
         count(*) total_deals,
         round(sum(arr_at_snapshot) filter (where close_date_slippage_days > 0)/1000, 0) slipped_keur
  from main_intermediate.int_pipeline_stage_history
  where snapshot_month >= date '2025-09-01'
  group by 1 order by 1
""")
slippage_trend['slip_rate'] = (slippage_trend['deals_slipped'] / slippage_trend['total_deals'] * 100).round(1)
slippage_trend = slippage_trend.to_dict('records')

rep_q1 = q("""
  select rep_id, rep_name, sum(closed_won_arr_eur) won, sum(effective_monthly_target_eur) tgt
  from main_marts.fct_rep_attainment where quarter='Q1 2026' group by 1,2
""")
rep_q2 = q("""
  select rep_id, rep_name, market, segment, team, sum(closed_won_arr_eur) won, sum(effective_monthly_target_eur) tgt
  from main_marts.fct_rep_attainment where quarter='Q2 2026' and target_month <= date '2026-05-31' group by 1,2,3,4,5
""")
rep_q1['q1_att'] = (rep_q1['won'] / rep_q1['tgt'].replace(0, None) * 100).fillna(0).round(0).astype(int)
rep_q2['q2_att'] = (rep_q2['won'] / rep_q2['tgt'].replace(0, None) * 100).fillna(0).round(0).astype(int)
rep = rep_q2.merge(rep_q1[['rep_id', 'q1_att']], on='rep_id', how='left').fillna({'q1_att': 0})
rep = rep.sort_values(['q1_att', 'q2_att'], ascending=False)
rep_table = rep[['rep_name','market','segment','team','tgt','won','q1_att','q2_att']].rename(
    columns={'tgt': 'tgt_eur', 'won': 'won_eur'}).to_dict('records')

pipe_by_market = q("""
  select market, segment, count(*) open_deals,
         round(sum(arr_eur)/1000, 0) arr_keur,
         round(sum(weighted_arr_eur)/1000, 0) weighted_keur,
         count(*) filter (where is_stale) stale_deals,
         round(coalesce(sum(arr_eur) filter (where is_stale), 0)/1000, 0) stale_keur
  from main_marts.fct_pipeline_health group by 1, 2 order by arr_keur desc
""").to_dict('records')

drift = q("""
  select 'Accounts — market label drift' as field, count(*) filter (where market_drift) drift_rows, count(*) total
    from main_marts.dim_accounts
  union all select 'Accounts — segment drift', count(*) filter (where segment_drift), count(*) from main_marts.dim_accounts
  union all select 'Accounts — country drift', count(*) filter (where country_drift), count(*) from main_marts.dim_accounts
  union all select 'Opportunities — stage drift', count(*) filter (where stage_drift), count(*) from main_marts.fct_opportunities
  union all select 'Opportunities — demand source drift', count(*) filter (where demand_source_drift), count(*) from main_marts.fct_opportunities
""").to_dict('records')

actions = [
    {'title': 'Manager touch on Wise (J. Patel, €161K, 85d silent)',
     'owner': 'UK Sales Lead', 'value': '€161K at-risk', 'when': 'This week', 'severity': 'red'},
    {'title': 'UK Mid-Market re-engagement sprint (6 stale deals, €296K)',
     'owner': 'UK Sales Lead', 'value': '~€10K recovered', 'when': '45 days', 'severity': 'amber'},
    {'title': 'Automated weekly stale-deal alert (source already in fct_pipeline_health.is_stale)',
     'owner': 'RevOps', 'value': f"+€{hero['recoveryEur']/1000:.0f}K recovered", 'when': '45 days', 'severity': 'amber'},
    {'title': 'Lock CRM picklists on segment / market / demand_source / stage',
     'owner': 'RevOps + Sales Ops', 'value': 'Analyst time + forecast trust', 'when': 'This sprint', 'severity': 'gray'},
    {'title': 'Open Q2 contingency review with Finance — flip RAG to RED',
     'owner': 'CRO', 'value': '€310K target', 'when': 'This week', 'severity': 'red'},
]

cumulative_arr = q("""
  select cast(month as varchar) as month,
         coalesce(new_arr_eur, 0)        as new_arr_eur,
         coalesce(cumulative_arr_eur, 0) as cumulative_arr_eur
  from main_marts.fct_monthly_arr
  where month >= date '2024-01-01' and month <= date '2026-06-01'
  order by month
""").to_dict('records')

DATA = {
    'hero': hero, 'trend': trend, 'pipelineQuality': pipeline_quality,
    'qualityFlags': quality_flags, 'aspBySource': asp_by_source, 'velocity': velocity,
    'topStale': top_stale, 'staleBySegment': stale_by_seg, 'funnel': funnel,
    'funnelBySource': funnel_by_source, 'slippageTrend': slippage_trend,
    'rep': rep_table, 'pipeByMarket': pipe_by_market, 'drift': drift, 'actions': actions,
    'cumulativeArr': cumulative_arr,
}

# ---- Render HTML ----------------------------------------------------------

DATA_JS = json.dumps(clean_nans(DATA), default=str, allow_nan=False)

# Read the JSX app template
TEMPLATE = (ROOT / 'dashboard' / 'app.jsx').read_text()

html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pleo RevOps — Weekly GTM Review</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/prop-types@15/prop-types.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/recharts@2.12.7/umd/Recharts.js"></script>
<script src="https://unpkg.com/@babel/standalone@7.23.0/babel.min.js"></script>
<style>
  /* Pleo Telescope · Inter throughout · cream page background. */
  * {{ box-sizing: border-box; }}
  html, body {{
    margin: 0; padding: 0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #F4EFE8; color: #000000;
    -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
  }}
  h1, h2, h3 {{ margin: 0; }}
  table {{ border-collapse: collapse; }}
  .recharts-cartesian-axis-tick text {{ font-family: 'Inter', sans-serif; }}
  ::selection {{ background: #000000; color: #FFFFFF; }}
</style>
</head>
<body>
<div id="root"></div>
<script>window.DATA = {DATA_JS};</script>
<script type="text/babel" data-presets="react">
{TEMPLATE}
</script>
</body>
</html>
'''

out = ROOT / 'dashboard' / 'index.html'
out.write_text(html)
print(f'Wrote {out} ({len(html):,} bytes)')
