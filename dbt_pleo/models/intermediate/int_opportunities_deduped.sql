{{ config(materialized='view') }}

-- Resolves OPP-127 duplicate; keeps earliest created_at.

with ranked as (
    select
        *,
        row_number() over (
            partition by opportunity_id
            order by created_at asc, created_date asc
        ) as rn
    from {{ ref('stg_pleo__opportunities') }}
)

select * exclude (rn)
from ranked
where rn = 1
