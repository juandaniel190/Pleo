{{ config(materialized='view') }}

select
    cast(activity_id      as varchar) as activity_id,
    {{ parse_date('activity_date') }} as activity_date,
    cast(rep_id           as varchar) as rep_id,
    cast(account_id       as varchar) as account_id,
    cast(opportunity_id   as varchar) as opportunity_id,
    cast(activity_type    as varchar) as activity_type,
    cast(outcome          as varchar) as outcome,
    cast(notes            as varchar) as notes
from {{ ref('raw_activity_data') }}
