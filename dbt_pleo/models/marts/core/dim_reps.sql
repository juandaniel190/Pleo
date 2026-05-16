{{ config(materialized='table') }}

/*
  dim_reps
  --------
  Conformed rep dimension. One row per rep_id with full roster context.
*/

select
    rep_id,
    rep_name,
    case when market = 'UKI' then 'UK' else market end as market,
    segment,
    team,
    ramp_status,
    rep_start_date,
    annual_quota_eur,
    market_change_date,
    prior_market,
    ramp_start_month,
    full_productivity_month,
    notes
from {{ ref('stg_pleo__rep_roster') }}
