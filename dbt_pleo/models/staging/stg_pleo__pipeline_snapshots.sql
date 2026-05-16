{{ config(materialized='view') }}

select
    {{ parse_date('snapshot_month') }}              as snapshot_month,
    cast(opportunity_id            as varchar)      as opportunity_id,
    cast(stage_at_snapshot         as varchar)      as stage_at_snapshot,
    cast(arr_at_snapshot           as double)       as arr_at_snapshot,
    cast(forecast_cat_at_snapshot  as varchar)      as forecast_cat_at_snapshot,
    {{ parse_date('close_date_at_snapshot') }}      as close_date_at_snapshot,
    cast(stage_age_days            as integer)      as stage_age_days,
    {{ parse_date('next_step_date') }}              as next_step_date,
    cast(owner_id                  as varchar)      as owner_id
from {{ ref('raw_pipeline_snapshots') }}
