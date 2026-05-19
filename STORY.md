# Pleo Q2 2026 GTM Review — Narrative Guide

> **What this document is.** A plain-language walkthrough of every section in the dashboard, with context for what the number means, why it matters, and how to talk about it in a meeting. Use this to iterate on the story before touching the UI.

---

## 0. The one-sentence framing

**Q2 is six weeks in and the scoreboard reads zero. The problem is not individual reps — every single rep is at 0%. This is a systems failure: stale pipeline, no urgency signals, and close dates slipping month after month. The fix is specific and actionable.**

That sentence should open the conversation. Everything else is evidence.

---

## 1. Overview — where we stand right now

**As of 14 May 2026.** Q2 runs 1 Apr → 30 Jun. That is 91 days. We are 44 days in — **48% through the quarter**.

| What | Number | Plain reading |
|------|--------|---------------|
| Q2 ramp-adjusted target | €310.6K | What the team committed to close by 30 June |
| Q2 closed-won so far | €0 | Nothing booked yet in Q2 |
| Gap to target | –€310.6K | The full target is still open |
| Pipeline scheduled to close in Q2 (gross) | ~€1.34M | All open deals with a Q2 close date |
| Same pipeline, probability-weighted | ~€384K | Expected value using each deal's win probability |
| Even if weighted pipeline lands 100% | miss by ~€73K | Weighted alone is not enough to hit target |

**The first thing to say in any meeting:** we are halfway through the quarter with zero booked. The weighted pipeline *almost* covers the target, but that assumes every deal closes on schedule — and slippage data (see below) shows that is not happening.

---

## 2. ARR vs target — the trend chart

The bar chart shows **quarterly target vs closed-won ARR** from 2024 Q1 through 2026 Q2. Each pair of bars is one quarter: grey = target, black = actual.

**How to read it:** you want the black bar to reach the grey bar. Right now, in recent quarters, black barely registers.

**What the data shows:**
- Q4 2025: closed ~5% of target
- Q1 2026: closed ~24% of target — and almost entirely from one rep (K. Nguyen)
- Q2 2026: 0% with nearly half the quarter gone

**How to say it in a meeting:** *"Three consecutive quarters of material underperformance. Q1's 24% looks better than Q4, but it was one person. Strip K. Nguyen out and the other 15 reps collectively closed zero in Q1. Q2 is confirming that pattern."*

---

## 3. Pipeline at risk — the stalled bucket

**"At risk" means open deals where no AE has logged any activity in 30 or more days.**

| Metric | Value |
|--------|-------|
| Stale deals | 34 |
| ARR at risk | €1.34M |
| Average days since last touch | ~47 days |

This is not a small tail of forgotten deals. €1.34M is nearly **4× the Q2 target**. Most of it will never close if no one acts this week.

**The single most important deal:** Wise, handled by J. Patel, UK Enterprise, €161K, 85 days with zero AE activity. This one alone is worth a manager phone call before the end of this week.

**UK Mid-Market** is the worst cluster: 6 deals, €296K, all stale. One coordinated re-engagement sprint covers the bulk of the problem.

---

## 4. Pipeline: weighted vs gross vs target (the percentages)

Three pipeline numbers get confused constantly. Here is what each one means:

| Term | What it means | Our number |
|------|--------------|------------|
| **Gross pipeline** | Sum of ARR of all open Q2 deals at face value | ~€1.34M |
| **Weighted pipeline** | Gross × each deal's win probability (e.g. a 30%-probability €100K deal counts as €30K) | ~€384K |
| **Target** | What we committed to close | €310.6K |

**Weighted as % of target:** €384K / €310.6K = **~124%**. On paper that looks like enough — but only if:
- Every deal closes on its stated date (they are not — see slippage section)
- Win probabilities are accurate (they may not be after 30+ days of silence)

**Gross as % of target:** €1.34M / €310.6K = **432%**. This is the "good news" number that can be misleading. Gross pipeline coverage of 4× *sounds* healthy. In practice, most of it is stale or overdue.

**The message:** weighted pipeline technically covers the target, but it is fragile. Every slipped deal or stale deal that goes dark reduces the weighted number in real-time.

---

## 5. Recovery upside — what is this number?

**Recovery upside = the estimated ARR we could recover if we re-engage the stale deals this week.**

The math:
- Stale ARR: €1.34M
- Assumed re-engagement rate: 15% (conservative — 15 in 100 stale deals respond and re-enter the funnel)
- Historical win rate on re-engaged deals: ~22% (from all closed deals since 2024)
- Recovery = €1.34M × 15% × 22% = **~€44K**

€44K is not a lot relative to a €310K target — that is intentional. It is a conservative floor. The real value of re-engagement is not the immediate close; it is stopping the pipeline from silently rotting into Q3. If you act now and a deal slips to Q3, you at least control it. If you do nothing, it disappears from the forecast entirely.

**How to say it:** *"We can model €44K in recovery from stale deals alone. That is not the story — the story is that the alternative is losing that pipeline permanently. This is a 'protect Q3' action as much as a 'save Q2' one."*

---

## 6. Are we on track vs the same point last quarter?

**This is the right question. Here is how to frame it:**

Q2 is 48% complete (44 of 91 days, as of May 14). At the same 48% point in Q1 (around February 13), the team had closed approximately the same amount: near zero, with a single late burst from K. Nguyen in mid-March.

**The pattern that emerges:** closes are happening in the final 2–3 weeks of the quarter or not at all. This is classic "hockey stick" behavior — and it is a risk signal, not a recovery signal, because:
- Pipeline that stalls early rarely closes on time
- Reps trained to wait for quarter-end urgency compress the same at-risk deals into a smaller window

**For the dashboard:** a period-over-period comparison chart would show two lines — Q1 and Q2 cumulative closed ARR by day-in-quarter. At day 44 they would both be flat near zero. This would make the point clearly: *we are tracking Q1's pattern exactly, and Q1 ended at 24% attainment.*

> **Note for next iteration:** this chart requires the cumulative ARR data filtered by day-within-quarter. We have the data in `fct_monthly_arr` and `fct_opportunities.close_date`. This is worth building.

---

## 7. Stalled · Slipped · Velocity · ASP — plain definitions

### What is ASP?

**ASP = Average Selling Price.** In our case, it is the average ARR of all closed-won deals, historically.

Our overall ASP (won): around **€32K–€40K** depending on segment. But ASP varies massively by where the deal came from:

| Demand source | ASP |
|---------------|-----|
| Partnership | ~€93K |
| Marketing (inbound) | ~€68K |
| SDR outbound | ~€32K |
| AE outbound | ~€32K |

**Why it matters:** Outbound generates more deals but smaller ones. Inbound and partnerships generate fewer deals but 2–3× the contract value. If we want to hit a €310K target with fewer deals, we need more inbound and partnership coverage — not more SDR volume.

### What is Stalled?

A deal is **stalled** (we call it "stale") when no AE has logged any activity — call, email, meeting, note — in **30 or more days**. 34 deals, €1.34M.

### What is Slipped?

A deal has **slipped** when its **close date was pushed to a later month** between one snapshot and the next. 9 deals, €405K slipped last month.

Slippage is different from stalling. A stalled deal is just sitting there. A slipped deal is one where someone *actively changed* the close date — which means the rep knows it is not closing on the original date. That is the more honest signal.

### What is Velocity?

**Pipeline velocity** measures how long, on average, an open deal has been sitting in its current stage.

From the data:
- Initial Meeting: **~83 days** average
- Qualified: **~79 days** average
- These two stages alone hold the majority of stale deals

**Critical nuance:** this is NOT "how long does it take a deal to move from stage A to stage B historically." It is "how long has the current open pipeline been sitting in each stage right now." Think of it as a measure of how stuck deals are today, not a benchmark for a healthy cycle time.

**The insight:** if the average deal in "Initial Meeting" has been there 83 days, and a healthy sales cycle is 60–90 days total, then many of these deals have already spent their entire allotted time in a single early stage. They are structurally unlikely to close this quarter.

---

## 8. Slippage rate — what is it and why it matters

**Slippage rate = % of open deals, per month, where the close date was moved to a later period.**

The chart shows this rate over the last 9 months alongside the dollar value of slipped deals.

**Why it is a leading indicator:** a rising slip rate means reps are not committing to close dates. It predicts future forecast misses before they happen. If slip rate is 40% one month, expect 40% of the pipeline that was supposed to close that month to roll to next month.

**How to say it:** *"Slippage rate tells us how reliable our close-date discipline is. A high rate means the pipeline is real but the timing isn't. We need both."*

### Stale concentration by region and segment

This chart breaks down the €1.34M stale ARR by **Market × Segment** (e.g., UK · Mid-Market, DACH · Enterprise).

The point: stale deals are not evenly distributed. UK Mid-Market is by far the largest bucket. That means the re-engagement action has a clear geographic and segment owner — it is not a company-wide all-hands, it is a targeted sprint led by the UK Mid-Market sales lead.

---

## 9. Pipeline by Market — the pivot table

This is exactly what the table section shows: **Market × Segment** as rows, with open deals, gross ARR, weighted ARR, stale deals, and stale ARR as columns.

**How to read it:**
- Sort by Gross ARR descending → find where the most money sits
- Compare Weighted ARR to Gross ARR per row → a big gap means low-confidence deals dominate that segment
- Look at Stale ARR as a % of Gross ARR per row → that ratio tells you how healthy each segment's pipeline is

**The pattern you'll see:** UK Mid-Market has the most deals and the most risk. DACH is smaller but may have a healthier (lower stale %) composition.

> **For the dashboard:** adding a "Stale %" column (stale ARR / gross ARR) would make the risk rank immediately visible without any calculation.

---

## 10. By Stage — funnel conversion

**What this section shows:** of all deals that entered the funnel in the trailing 13 weeks, how many made it to each stage?

Leads → MQL → SQL → Demo → Opp → Won

The conversion rates between stages (shown below the chart) tell you where the funnel is leaking.

**What to look for:**
- If Lead → MQL conversion is low: marketing is generating unqualified traffic
- If MQL → SQL conversion is low: SDRs are not qualifying well, or ICP is off
- If Demo → Opp conversion is low: demo quality or product-market fit issue
- If Opp → Won conversion is low: sales process or competitive issue

**Is it increasing?** The current chart is a single-period snapshot (13W trailing). To see trend — whether lead quality or conversion is improving — you would need to compare trailing 13W vs prior 13W. That is the "period over period" view from section 6, applied to funnel stages.

**Lead quality signal:** the funnel-by-source table shows Lead → Won rate by demand source and segment. Partnership deals convert at the highest rate. SDR outbound converts at the lowest. This is not surprising, but the magnitude of the gap tells you where to allocate Sales Dev resources.

---

## 11. Rep attainment — why this is a system signal, not a coaching problem

Every rep is at **0% Q2 attainment**. All of them. Different markets, different segments, different tenures.

When one rep underperforms, that is a coaching or territory problem. When every rep underperforms uniformly, that is a systems problem: the pipeline is not good enough, the process is not working, or the quota model is wrong.

Q1 data shows K. Nguyen at meaningful attainment; every other rep was near zero. One person did not carry the team — one person closed one deal that happened to be large enough to move the quarterly number. The *system* produced one large deal in Q1, not a team of healthy closers.

**How to say it in a meeting:** *"If I saw three reps underperforming, I'd set up coaching calls. When the whole team is at zero, the question is: what is the system doing to them? My answer: they're sitting on stale pipeline with no urgency signal, and no clear exit criteria for moving deals forward."*

---

## 12. Cumulative ARR book

This chart is **supporting context, not headline attainment**. It shows the running total of all closed-won ARR from 2024 to now, assuming zero churn.

**Why it is not the headline:** attainment at Pleo is measured as new ARR closed in the target period — not the running book. The book grows even if we close nothing new (because old deals stay on the books). So a rising cumulative line looks good but does not tell you whether this quarter's team is performing.

**Why it is useful:** it shows the shape of bookings over time — were there months with no closings? Spikes? Seasonal patterns? It is the right context chart for a board-level "how are we growing" conversation, separate from the quarterly attainment conversation.

---

## 13. Data quality — CRM hygiene

The segment field in the raw CRM data has **11 distinct values for what should be 3 canonical segments** (SMB, Mid-Market, Enterprise). Market labels and country fields have similar drift.

**Why this is a revenue problem, not just an admin problem:**
- Bad segment labels mean pipeline reports are wrong — you cannot trust "UK Mid-Market pipeline" if 20% of those deals are mislabeled SMB
- It means every analyst has to reconcile labels before producing a number — recurring waste
- Forecast calls use segment rollups — if the rollups are dirty, the forecast is directionally wrong

**The fix is one sprint:** lock the CRM picklists. Force reps to choose from a fixed list. It is not exciting, but it is the highest-leverage data action in the backlog.

---

## 14. Monday actions — the call list

Five actions, each specific, owned, and time-bound:

| Action | Owner | Value | When |
|--------|-------|-------|------|
| Manager touch on Wise (J. Patel, €161K, 85d silent) | UK Sales Lead | €161K at-risk deal | This week |
| UK Mid-Market re-engagement sprint (6 deals, €296K) | UK Sales Lead | ~€10K recovered ARR | 45 days |
| Automated weekly stale-deal alert | RevOps | +€44K recovered (model) | 45 days |
| Lock CRM picklists on segment / market / source / stage | RevOps + Sales Ops | Analyst time + forecast trust | This sprint |
| Open Q2 contingency review with Finance — flip RAG to RED | CRO | €310K target at risk | This week |

**The framing for the room:** *"We are not here to diagnose — we already know what is wrong. We are here to assign these five actions and leave with names next to each line."*

---

## 15. What to build next on the dashboard

Based on your questions, three additions would make the story much sharper:

1. **Period-over-period close tracker.** A line chart showing cumulative Q2 closed ARR by day-in-quarter, overlaid with Q1. Both lines should be flat near zero through day 44. That visual makes the "we're tracking Q1's pattern" argument in two seconds.

2. **Stale % column in the pipeline-by-market table.** Add `stale_arr / gross_arr` as a color-coded column. Lets the room immediately see which market-segment combos are healthiest and which need intervention.

3. **Funnel trend (trailing 13W vs prior 13W).** Show whether lead volume, MQL conversion, and Opp → Won rate is improving or declining. Right now the funnel is a single snapshot; a simple two-bar comparison per stage would tell you if lead quality is moving.

---

*Data: dbt + DuckDB on Pleo synthetic dataset · As of 14 May 2026 · Author: Daniel Amezquita*
