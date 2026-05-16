{{ config(materialized='view') }}

/*
  int_activity_outcomes_filled
  ----------------------------
  Replaces missing outcomes with 'Unknown'. The is_outcome_known flag lets the
  marts include these rows in activity volume but exclude them from outcome
  ratios. Null opportunity_id values are preserved (legitimate pre-opp outreach).
*/

select
    activity_id,
    activity_date,
    rep_id,
    account_id,
    opportunity_id,
    activity_type,
    coalesce(outcome, 'Unknown') as outcome,
    (outcome is not null)        as is_outcome_known,
    (opportunity_id is null)     as is_pre_opp_activity,
    notes
from {{ ref('stg_pleo__activity_data') }}
