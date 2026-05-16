{{ config(materialized='view') }}

-- Pure staging. The OPP-127 duplicate is preserved here; deduplication happens
-- in int_opportunities_deduped. parse_date and parse_percent handle the messy
-- source formats.

select
    cast(opportunity_id          as varchar)   as opportunity_id,
    cast(account_id              as varchar)   as account_id,
    cast(owner_id                as varchar)   as owner_id,
    cast(stage_raw               as varchar)   as stage_raw,
    cast(stage_clean             as varchar)   as stage_clean,
    cast(arr_eur                 as double)    as arr_eur,
    cast(demand_source_raw       as varchar)   as demand_source_raw,
    cast(demand_source_clean     as varchar)   as demand_source_clean,
    {{ parse_date('close_date') }}             as close_date,
    {{ parse_date('created_date') }}           as created_date,
    cast(forecast_category       as varchar)   as forecast_category,
    {{ parse_percent('close_probability_pct') }} as close_probability_pct,
    cast(closed_lost_reason      as varchar)   as closed_lost_reason,
    cast(sales_cycle_days        as integer)   as sales_cycle_days,
    {{ parse_timestamp('created_at') }}        as created_at
from {{ ref('raw_opportunities') }}
