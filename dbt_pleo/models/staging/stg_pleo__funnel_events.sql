{{ config(materialized='view') }}

select
    cast(event_id              as varchar) as event_id,
    {{ parse_date('event_month') }}        as event_month,
    cast(account_id            as varchar) as account_id,
    cast(rep_id                as varchar) as rep_id,
    cast(event_type            as varchar) as event_type,
    cast(demand_source_raw     as varchar) as demand_source_raw,
    cast(demand_source_clean   as varchar) as demand_source_clean,
    cast(segment               as varchar) as segment,
    cast(market                as varchar) as market,
    cast(arr_eur               as double)  as arr_eur
from {{ ref('raw_funnel_events') }}
