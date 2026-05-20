{{ config(materialized='view') }}

-- Fills missing outcomes with 'Unknown'; adds is_outcome_known and is_pre_opp_activity flags.

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
