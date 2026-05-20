{{ config(materialized='table') }}

-- Conformed account dimension with canonical market/segment/country and drift flags.

select
    account_id,
    account_name,
    market,
    segment,
    country,
    industry,
    employee_count,
    created_date,
    country_drift,
    market_drift,
    segment_drift,
    pleo_country,
    pleo_market,
    pleo_segment,
    country_raw,
    region_raw,
    segment_raw
from {{ ref('int_accounts_standardized') }}
