{{ config(materialized='view') }}

select
    cast(target_id                       as varchar) as target_id,
    {{ parse_date('target_month') }}                 as target_month,
    cast(target_year                     as integer) as target_year,
    cast(quarter                         as varchar) as quarter,
    cast(rep_id                          as varchar) as rep_id,
    cast(rep_name                        as varchar) as rep_name,
    cast(region                          as varchar) as region,
    cast(market                          as varchar) as market,
    cast(segment                         as varchar) as segment,
    cast(monthly_arr_target_eur          as double)  as monthly_arr_target_eur,
    cast(ramp_factor                     as double)  as ramp_factor,
    cast(adjusted_monthly_target_eur     as double)  as adjusted_monthly_target_eur
from {{ ref('raw_sales_targets') }}
