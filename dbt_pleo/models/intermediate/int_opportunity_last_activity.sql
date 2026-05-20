{{ config(materialized='view') }}

-- Per-opp last_activity_date and days_since_last_activity (falls back to account-level activity).

{% set analysis_as_of = var('analysis_as_of_date', 'current_date') %}

with last_act_opp as (
    select
        opportunity_id,
        max(activity_date) as last_activity_date
    from {{ ref('int_activity_outcomes_filled') }}
    where opportunity_id is not null
    group by opportunity_id
),

last_act_account as (
    select
        account_id,
        max(activity_date) as last_account_activity_date
    from {{ ref('int_activity_outcomes_filled') }}
    group by account_id
)

select
    o.opportunity_id,
    o.account_id,
    coalesce(la.last_activity_date, laa.last_account_activity_date) as last_activity_date,
    case
        when coalesce(la.last_activity_date, laa.last_account_activity_date) is null then null
        else date_diff('day',
                       coalesce(la.last_activity_date, laa.last_account_activity_date),
                       cast({{ analysis_as_of }} as date))
    end as days_since_last_activity,
    (la.last_activity_date is null) as fell_back_to_account_activity
from {{ ref('int_opportunities_deduped') }} o
left join last_act_opp     la  using (opportunity_id)
left join last_act_account laa on laa.account_id = o.account_id
