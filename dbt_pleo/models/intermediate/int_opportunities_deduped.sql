{{ config(materialized='view') }}

/*
  int_opportunities_deduped
  -------------------------
  Resolves the intentional OPP-127 duplicate.
  Rule: keep the earliest `created_at` (oldest source-system record); drop later.
  Documented in assumptions_log.md.
*/

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
