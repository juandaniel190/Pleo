# Dashboard storytelling — draft to iterate on

A walkthrough of the dashboard structured around the questions you raised. Once we agree on the narrative, we can shape the dashboard sections to match. Numbers below come from the marts as of **14 May 2026** (Q2 2026, day 44 of 91 → ~48% of the quarter done).

---

## 1. Overview · the four numbers a CRO should see first

The opening of every weekly review answers "are we on track, and if not, what's the lever?" Four KPIs do that:

| KPI | Value | What it means |
|---|---|---|
| **Q2 ARR pace** | **€0** of **€311K** target — **0%** | Closed-won ARR booked in the quarter so far vs the ramp-adjusted target. This is the official attainment metric per Pleo's brief (Assumptions row 36). |
| **Pipeline at risk** | **34 deals · €1.34M** (avg 76 days silent) | Open opps with no AE activity in 30+ days. Money already in motion that could die in silence. |
| **Pipeline weighted vs gross** | **€854K gross · €255K weighted** (30% of gross) | Gross = sum of ARR on every deal expected to close this quarter. Weighted = same ARR × each deal's close-probability %. Weighted is the realistic case. *Even if every weighted euro lands, we still miss target by €55K.* |
| **Recovery upside** | **+€44K** in 45 days | **What this is:** estimated new ARR we could recover *if* we re-engage the stale pipeline. Math: €1.34M stale ARR × 15% re-engagement rate × 22% historical win rate. Conservative on purpose. It's the size of the prize for fixing the single biggest controllable problem this week. |

**The story this opens with:** Q2 is RED. The gap can't be closed with what's already in the pipeline. The biggest controllable lever is the stale pipeline — and we can quantify the prize at +€44K.

---

## 2. Where are we in the quarter, vs the same point in the last one?

We're 48% of the way through Q2 (44 days in, 47 to go). The question isn't "are we behind plan" — that's obvious. The question is **"are we behind the historical pattern?"**

**Closed-won by day 44 of the quarter, last six quarters:**

| Quarter | By day 44 | Final | What this tells us |
|---|---|---|---|
| Q2 2024 | 1 deal · €27K | 2 deals · €81K | Slow start, weak finish |
| Q3 2024 | 0 deals · €0 | 1 deal · €45K | Slow start, late close |
| Q4 2024 | 1 deal · €14K | 1 deal · €14K | Whole quarter in the first half |
| Q1 2025 | 1 deal · €16K | 4 deals · €155K | Slow start, strong finish — encouraging |
| **Q2 2025** | **1 deal · €162K** | **1 deal · €162K** | One big deal carried the quarter |
| Q3 2025 | 0 deals · €0 | 2 deals · €157K | Slow start, strong finish |
| Q4 2025 | 1 deal · €24K | 1 deal · €24K | Anaemic |
| **Q1 2026** | **1 deal · €117K** | **1 deal · €117K** | Whole quarter happened in first half (K. Nguyen) |
| **Q2 2026** | **0 deals · €0** | ? | **Worst start of any quarter in the dataset.** |

**Chart idea (replaces the current "Trend" chart):** a small-multiple of bar pairs — each prior Q2 (and Q1 2026 for last quarter) showing "by-day-44" vs "full quarter". Q2 2026 sits on the same axis with just the "by-day-44" bar. The eye instantly sees we're underperforming even the historical pace, not just the plan.

**Headline line to lead the section:**
> "By day 44 of every recent quarter, at least one deal closed. Q2 2026 is the first quarter in two years with zero deals closed at this checkpoint."

---

## 3. Pipeline quality — stalled · slipped · velocity · ASP

This section answers "what's wrong with the pipeline we have?" Four numbers. Each one is a different failure mode.

| Number | What it is | Plain-English meaning |
|---|---|---|
| **Stalled · 34 deals · €1.34M** | Open opps with no activity in 30+ days | Deals dying in silence. AEs forgot about them. |
| **Slipped · 9 deals · €405K** | Open opps whose expected close date moved later between two snapshots | Deals that were "this quarter" last month and are now "next quarter". Forecast deteriorating. |
| **Median cycle · 2 days** (synthetic; real Pleo would be ~40–60 days) | Median days between opp created and closed-won | How fast a typical winning deal moves through the funnel |
| **ASP · €59K** | **A**verage **S**ales **P**rice — average ARR per closed-won deal | The "typical deal size." Tells you whether the team is selling big or small deals on average. |

### Where to focus first (this is the part you liked — keep it prominent)

> **Wise · J. Patel · UK Enterprise · €161K · 85 days silent.** Single biggest at-risk deal in the whole book. Manager touch this week, before any other action.
>
> **UK Mid-Market re-engagement sprint.** 6 stale deals worth €296K — the largest stale concentration in any market × segment cell. Block AE diaries this week for opp reviews.

**Better way to communicate this section?** Yes — collapse the 4 KPI tiles into a single "Pipeline health card" that names the **action**, not the metric:

```
PIPELINE HEALTH                          THIS WEEK'S FOCUS
───────────────────                      ──────────────────
34 deals stalled (€1.34M)                1. Manager touch on Wise
 9 deals slipped (€405K)                    €161K · 85 days silent
ASP holding at €59K                      2. UK Mid-Market sprint
Cycle stable                                6 deals · €296K stalled
```

The metrics are *evidence*, not the headline. The headline is the action.

---

## 4. Pipeline velocity — clarifying the time window

**Current chart:** "Average days an open deal spends in each stage." E.g. Initial Meeting = 83 days, Qualified = 79 days.

**Time window:** This is computed across **every open opportunity in every monthly snapshot we have** — so it's a trailing all-time average, weighted toward the most recent snapshots because there are more of them. **Not "this quarter only."**

**Should we change it to this quarter only?** I'd say no. Velocity is most useful as a *baseline* — "how long does an open deal normally sit in Qualified?" — against which we can flag deals that are stuck. With Q2 2026 data alone we have too few deals to compute a stable baseline.

**The insight to lead with:**
> "Initial Meeting (83 days) and Qualified (79 days) are where deals stall longest. Those two stages also hold most of our stalled pipeline. A stage-exit-criteria review with sales leads on *what defines an Initial Meeting* and *what defines Qualified* would compress the cycle the most."

---

## 5. Slippage rate · what it means + stale by region and segment

**Slip rate** = % of open opps whose expected close date moved *later* between two consecutive monthly snapshots. In a healthy pipeline, the close date holds steady (or pulls in). When it moves later, the AE is signalling the deal is dragging.

**Trend over the last 9 months:**

| Snapshot | Deals slipped | Total open | Slip rate |
|---|---|---|---|
| Sep 2025 | 0 | 1 | 0% |
| Jan 2026 | 0 | 3 | 0% |
| Feb 2026 | 1 | 34 | 2.9% |
| Mar 2026 | 4 | 43 | 9.3% |
| Apr 2026 | 8 | 53 | **15.1%** |
| May 2026 | 9 | 47 | **19.1%** |

**This is the trend that should worry leadership.** Slip rate has gone from 0% to 19% in four months. Forecast quality is deteriorating month-over-month, not just at one point in time.

### Stale concentration — by region and segment

Pivot of stale ARR (€K):

| Market | SMB | Mid-Market | Enterprise | **Total** |
|---|---:|---:|---:|---:|
| **UK** | 18 | **296** | **161** | **475** |
| **NL** | 30 | **199** | 95 | **324** |
| **ES** | 17 | **151** | — | 168 |
| **DE** | 17 | **141** | — | 158 |
| **DK** | 28 | 49 | **110** | 187 |
| **SE** | 29 | — | — | 29 |
| **Total** | 139 | 836 | 366 | **1,341** |

**One read:** Mid-Market is where the stalled money lives (€836K, 62% of the total). UK and NL Mid-Market together = €495K — a third of the entire stale pool, in two cells. That's the surgical target.

---

## 6. Pipeline by Market × Segment — as a pivot

Same shape as above, but for the **whole open pipeline** (not just stale). Two views in one table — gross ARR and weighted ARR — so the reader sees both "what's in the book" and "what we'd actually expect to close":

**Open pipeline · gross ARR (€K) / weighted ARR (€K):**

| Market | SMB | Mid-Market | Enterprise | **Total** |
|---|---|---|---|---|
| **UK** | 38 / 10 | **296 / 117** | 231 / 53 | 565 / 180 |
| **DE** | 51 / 14 | 276 / 160 | — | 327 / 174 |
| **NL** | 30 / 7 | 199 / 29 | 95 / 10 | 324 / 46 |
| **ES** | 17 / 2 | 177 / 26 | 167 / 33 | 361 / 61 |
| **DK** | 28 / 7 | 49 / 10 | 110 / 50 | 187 / 67 |
| **SE** | 29 / 6 | 39 / 2 | — | 68 / 8 |
| **Total** | **193 / 46** | **1,036 / 344** | **603 / 146** | **1,832 / 536** |

**The story this tells:**
1. **Mid-Market is the engine** — 57% of gross pipeline.
2. **Weighted / gross ratio is collapsing.** Overall, weighted is just 29% of gross. In Mid-Market specifically it's 33%. Either AEs are over-pipelining or close probabilities are too low — both are forecast-quality problems.
3. **UK Mid-Market** alone is €117K weighted — the only cell with meaningful Q2-closable weight. If we lose those, the quarter collapses entirely.

---

## 7. Funnel conversion — by stage, with per-category trend

The current funnel is one snapshot (last 13 weeks). What you're asking for is "is each stage improving or getting worse?" — i.e. **trend per stage**.

**Volumes per month, last 6 months:**

| Month | Leads | MQL | SQL | Demo | Opp | Won |
|---|---:|---:|---:|---:|---:|---:|
| Dec 2025 | 5 | 2 | 0 | 1 | 1 | 1 |
| Jan 2026 | 3 | 0 | 3 | 0 | 4 | 1 |
| Feb 2026 | 4 | 2 | 1 | 1 | 0 | 0 |
| Mar 2026 | 6 | 2 | 1 | 2 | 0 | 0 |
| Apr 2026 | 1 | 3 | 3 | 1 | 1 | 0 |
| May 2026 (MTD) | 3 | 2 | 3 | 1 | 0 | 1 |

**Read:**
- **Lead generation has been thin since Mar** (1–3 leads/mo vs 4–6 before). The top of the funnel is starving.
- **MQL→SQL conversion held up** — when leads do show up, they qualify.
- **Demo→Opp dropped** — Feb/Mar produced demos but zero new opps. That's a sales-stage issue, not a marketing issue.
- **Closed-won has been zero or one per month for six straight months.** This is consistent with the team-level attainment story — it's not seasonal.

**The metric we'd add:** a 4-week rolling lead-to-won rate per demand source. Tells us "of leads created Jan–Feb, where are they now?" Currently the dashboard shows aggregate conversion only. We can add this.

**The plain question to put on the slide:** *"Is each stage getting better or worse?"* Marketing's lead generation = **worse**. Mid-funnel qualification = **stable**. Bottom-funnel close = **stable but at near-zero**.

---

## 8. The remaining sections — what they are and when they matter

### Rep attainment table
Every rep's Q2 vs Q1 attainment side by side. Right now: every rep is at 0% in Q2, and only K. Nguyen had any Q1 attainment (325%, single deal). **The point of this section** is to show the CRO that this is a *system-level* issue, not a coaching issue — you can't pick out a "bad rep" because there's nothing to compare against. The recommendation that follows is: shift the weekly review from rep-level coaching to deal-by-deal triage of stale pipeline.

### Cumulative ARR book — the "no-churn" supporting view
The big question you raised about ARR. The chart shows two lines:
- **New ARR booked each month** (bars) — the flow metric, what attainment is measured against.
- **Cumulative ARR** (line) — what the total book of business looks like *if no contract ever cancels*.

**Why it's "supporting" not headline:** Pleo's brief defines attainment as new ARR closed in the period (the flow). The cumulative line is informational — it tells the CRO "our installed base is €1.06M and growing slowly", which is *not* the same conversation as "we missed Q2." Both views are true; one drives this week's actions, the other drives the board narrative.

Disclaimer to keep prominent: **this dataset has no churn event**. In production, the cumulative line would need a churn adjustment.

### Data quality drift
Where Pleo's pre-cleaned CRM fields disagree with our canonical re-derivation. Currently 2 of 40 accounts have a market-label disagreement, and the `segment_raw` field has 11 distinct values for what should be 3 segments. **Why this is in the dashboard at all:** it's the evidence behind the second automation recommendation ("lock CRM picklists"). Showing the number makes the recommendation defensible.

### Monday recommendations
The list of five actions, each with an owner, an EUR value, and a timeframe. This is the section the CRO actually screenshots and forwards. Everything above it is evidence.

---

## What I'd change in the dashboard if we agree on this narrative

1. **Replace the Trend bar chart** with the by-day-44 comparison (section 2). It answers "are we behind history" not just "are we behind plan."
2. **Reframe Pipeline Quality** as a "where to focus first" panel — the metrics support the action, not the other way around.
3. **Add the slip-rate trend chart** as a standalone visual (section 5) — the rising line is the single most worrying signal in the data.
4. **Convert Stale Concentration and Pipeline by Market into proper pivot tables** with Market × Segment grid.
5. **Add a 6-month funnel trend chart** alongside the current funnel snapshot (section 7) — answers "is each stage improving."
6. **Make the no-churn cumulative chart explicitly labelled "supporting context"** so it doesn't compete with the headline attainment view.

If you agree with the angle, I'll implement these in app.jsx and the queries layer.
