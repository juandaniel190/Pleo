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

Pleo's official Telescope typeface is **Switzer** (served via [Fontshare](https://api.fontshare.com)).
Telescope type-scale tokens:

| Token | Value |
|---|---|
| fontXSmall | 10px |
| fontSmall | 12px |
| fontMedium | 14px |
| fontLarge | 16px |
| fontXLarge | 18px |
| font2XLarge | 20px |
| font3XLarge | 24px |
| font4XLarge | 32px |
| font5XLarge | 48px |

Weights: Regular 400 · Medium 500 · Semibold 600 · Bold 700
Line heights: 1.4 (lineHeight1) · 1.6 (lineHeight2) · 1.7 (lineHeight3)

Dashboard uses:
- Hero H1: font5XLarge (48px), Bold
- Section titles / KPI values: font4XLarge (32px), Semibold/Bold
- Body / table cells: fontMedium (14px), Regular
- Labels / uppercase tags: fontXSmall (10px) or fontSmall (12px)
- Numerals (KPI cards): tabular-nums for alignment

## Usage rules in the dashboard

- Hero (CRO tier) on black (`shade900`) background, white text, accent yellow for the headline number
- Tier 2 (detail) on off-white (`shade100`), body text in `shade700`
- KPI status pills: positive=`green500`, warning=`yellow500`, negative=`pink500` (soft, not alarming)
- Loud red (`red700`) reserved for the single most urgent action item only
