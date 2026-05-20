{{ config(materialized='view') }}

select
    cast(account_id        as varchar) as account_id,
    cast(account_name      as varchar) as account_name,
    cast(country           as varchar) as country,
    cast(country_raw       as varchar) as country_raw,
    cast(market            as varchar) as market,
    cast(region_raw        as varchar) as region_raw,
    cast(segment           as varchar) as segment,
    cast(segment_raw       as varchar) as segment_raw,
    cast(industry          as varchar) as industry,
    cast(employee_count    as integer) as employee_count,
    {{ parse_date('created_date') }}   as created_date
from {{ ref('raw_accounts') }}
