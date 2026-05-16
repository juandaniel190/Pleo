{{ config(materialized='table') }}

/*
  fct_rep_attainment
  ------------------
  Rep × month closed-won ARR vs ramp-adjusted target. Includes quarter rollups
  via window functions so the dashboard can show QTD attainment without
  re-aggregating client-side.
*/

with targets as (
    select
        rep_id,
        target_month,
        target_year,
        quarter,
        rep_name,
        market,
        segment,
        team,
        ramp_factor,
        effective_monthly_target_eur
    from {{ ref('int_rep_quota_ramped') }}
),

won as (
    select
        rep_id,
        cast(date_trunc('month', close_date) as date) as won_month,
        sum(arr_eur)                                  as closed_won_arr_eur,
        count(*)                                      as closed_won_deals
    from {{ ref('int_opportunities_enriched') }}
    where is_won
    group by 1, 2
)

select
    t.rep_id,
    t.rep_name,
    t.market,
    t.segment,
    t.team,
    t.target_month,
    t.target_year,
    t.quarter,
    t.ramp_factor,
    t.effective_monthly_target_eur,
    coalesce(w.closed_won_arr_eur, 0) as closed_won_arr_eur,
    coalesce(w.closed_won_deals, 0)   as closed_won_deals,
    case
        when t.effective_monthly_target_eur is null or t.effective_monthly_target_eur = 0 then null
        else coalesce(w.closed_won_arr_eur, 0) / t.effective_monthly_target_eur
    end as monthly_attainment_pct,

    -- QTD attainment (cumulative within the quarter)
    sum(coalesce(w.closed_won_arr_eur, 0)) over (
        partition by t.rep_id, t.quarter
        order by t.target_month
        rows between unbounded preceding and current row
    ) as qtd_closed_won_arr_eur,

    sum(t.effective_monthly_target_eur) over (
        partition by t.rep_id, t.quarter
        order by t.target_month
        rows between unbounded preceding and current row
    ) as qtd_target_eur
from targets t
left join won w on w.rep_id = t.rep_id and w.won_month = t.target_month
