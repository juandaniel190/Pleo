# Pleo Brand — Working Reference

Source: [Pleo Telescope Design System — Color foundations](https://telescope.pleo.io/foundations/color/color.overview/)

This is the palette I'm using to style the dashboard and any chart output. It's pulled directly from Pleo's published design tokens.

## Primary palette

| Role | Token | Hex |
|---|---|---|
| Black (primary text / hero background) | `shade900` | `#000000` |
| Off-white (page background) | `shade100` | `#fafafa` |
| Hairline grey | `shade300` | `#ececec` |
| Body text | `shade700` | `#333333` |
| Muted text | `shade600` | `#737373` |

## Accent palette (pastels — same family used in the brief's header blocks)

| Role | Token | Hex |
|---|---|---|
| Yellow (Data / Highlight) | `yellow500` | `#fcea88` |
| Green (Build / Positive) | `green500` | `#ace3bd` |
| Purple (Automate / Brand) | `purple500` | `#a69ae3` |
| Pink (Present / Warning-quiet) | `pink500` | `#f39ca8` |

## Status colors (used sparingly in the dashboard)

| Role | Token | Hex |
|---|---|---|
| Positive (above target) | `green800` | `#2c8354` |
| Negative (at-risk / behind) | `red700` | `#e91c1c` |
| Warning (slipping) | `yellow800` | `#dbbd1a` |
| Info / link | `blue700` | `#4588e3` |
| Purple loud (brand accent) | `purple800` | `#5442b3` |

## Typography

Pleo's marketing typography uses a sans-serif (Inter family is closest free equivalent). Dashboard uses:
- Headings: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`, weight 600–700
- Body: same family, weight 400
- Numerals (KPI cards): tabular-nums for alignment

## Usage rules in the dashboard

- Hero (CRO tier) on black (`shade900`) background, white text, accent yellow for the headline number
- Tier 2 (detail) on off-white (`shade100`), body text in `shade700`
- KPI status pills: positive=`green500`, warning=`yellow500`, negative=`pink500` (soft, not alarming)
- Loud red (`red700`) reserved for the single most urgent action item only
