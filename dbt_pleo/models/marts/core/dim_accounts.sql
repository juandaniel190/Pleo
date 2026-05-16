{{ config(materialized='table') }}

/*
  dim_accounts
  ------------
  Conformed account dimension. The canonical market / segment / country come
  from int_accounts_standardized; drift flags are passed through so the
  dashboard can quantify the CRM data-quality gap.
*/

select
    account_id,
    account_name,
    market,
    segment,
    country,
    industry,
    employee_count,
    created_date,
    -- Quality flags
    country_drift,
    market_drift,
    segment_drift,
    -- Raw / Pleo-cleaned values, for traceability
    pleo_country,
    pleo_market,
    pleo_segment,
    country_raw,
    region_raw,
    segment_raw
from {{ ref('int_accounts_standardized') }}
