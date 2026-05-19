// Pleo RevOps dashboard — React + Recharts, rendered at runtime via Babel.
//
// Design intent (per Daniel's direction):
//   - Pleo Telescope palette (no Finstatement / monochrome).
//   - Light cream surface, white cards on a grey panel.
//   - Neue Haas Grotesk Display. Numbers use tabular-nums.
//   - Pleo brand pastels (yellow / green / pink / purple) appear ONLY on
//     specific data callouts (status pills, the won funnel bar, the hero
//     headline number). Everything else is black / grey / white.
//   - Less colour overall; the eye should land on the numbers that matter.
//
// Layout (per Daniel's sketch — single page, ~25% viewport header + scroll):
//   1. Header (dark, compact) — AI insight + 4 KPI tiles
//   2. ARR vs Target — three-line cumulative pace chart + insights column
//   3. Pipeline quality — tiles, AI insight, slip-rate, stale, funnel, ASP
//   4. Performance — tabbed table (Region / Segment / Rep) + cumulative ARR

const { useState, useMemo, useEffect } = React;

function useBreakpoint() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  // isCompact = below the threshold where the 3-column hero row stops fitting
  return { isMobile: w < 768, isNarrow: w < 480, isCompact: w < 1024 };
}

if (typeof Recharts === 'undefined') {
  document.getElementById('root').innerHTML =
    '<div style="padding:40px;font-family:sans-serif;color:#c00"><strong>Error:</strong> Recharts CDN failed to load. Serve via HTTP, not file://.<br><code>python3 -m http.server 8000</code></div>';
  throw new Error('Recharts not loaded');
}

const {
  BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, Cell, LabelList, ReferenceLine,
  Sankey, Rectangle, Layer
} = Recharts;

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#c00' }}>
        <strong>Render error:</strong> {this.state.error.message}
        <pre style={{ marginTop: 12, fontSize: 12 }}>{this.state.error.stack}</pre>
      </div>
    );
    return this.props.children;
  }
}

// --- Design tokens (Pleo Telescope) ---------------------------------------

const T = {
  bg:         '#FAFAFA',
  panel:      '#F5F5F5',
  card:       '#FFFFFF',
  hairline:   '#ECECEC',
  black:      '#000000',
  textSec:    '#333333',
  textMuted:  '#737373',
  positive:   '#2c8354',
  negative:   '#e91c1c',
  // Pleo brand pastels — Telescope tokens. Pink is our secondary colour so
  // we keep multiple official shades on hand and pick them deliberately.
  pleoGreen:    '#ace3bd',  // green500
  pleoPurple:   '#a69ae3',  // purple500
  pleoYellow:   '#fcea88',  // yellow500 (kept for reference, not used)
  pleoPink:     '#f39ca8',  // alias for pink500
  pleoPink100:  '#fff5f6',  // softest wash (column background)
  pleoPink200:  '#ffebed',  // soft tint (gray-severity card)
  pleoPink300:  '#ffdee2',  // light tint (amber card)
  pleoPink400:  '#ffc8d0',  // mid (red action card · current period card)
  pleoPink500:  '#f39ca8',  // main accent (hero callout, AI border, chart current)
  pleoPink700:  '#cb727f',  // deeper, used very rarely
  // Pleo Telescope · the rest of the brand palette. Sourced from
  // `design/pleo_brand.md` / `design/pleo_theme.css`. Pink stays the main
  // brand colour; these complementary tones differentiate the forecast bar
  // segments without inventing a new ramp.
  pleoBlue:     '#4588e3',  // info / blue700 — for Upside (sits outside bar)
  pleoBlueSoft: '#d2e3f9',  // soft tint companion (not currently used)
  chartGrid:  '#ECECEC',
  fontXSmall:   10, fontSmall: 12, fontMedium: 14, fontLarge: 16,
  fontXLarge:   18, font2XLarge: 20, font3XLarge: 24, font4XLarge: 32, font5XLarge: 48,
  fontWeightRegular: 400, fontWeightMedium: 500, fontWeightSemibold: 600, fontWeightBold: 700,
  lineHeight1: 1.4, lineHeight2: 1.6, lineHeight3: 1.7,
  font: '"Neue Haas Grotesk Display", system-ui, "Helvetica Neue", Arial, sans-serif',
};

const numStyle = { fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' };

// Sparkle-style mark used next to every "AI ·" label so the source is obvious.
const AiIcon = ({ size = 12, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: 4 }}>
    <path d="M12 2 L13.4 9 L20 10.5 L13.4 12 L12 19 L10.6 12 L4 10.5 L10.6 9 Z"
          fill={color} />
    <path d="M19 14.5 L19.6 16.7 L21.8 17.3 L19.6 17.9 L19 20.1 L18.4 17.9 L16.2 17.3 L18.4 16.7 Z"
          fill={color} opacity="0.55" />
  </svg>
);

const fmtEur = (n) => {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) >= 1000) return '€' + Math.round(n / 1000).toLocaleString() + 'K';
  return '€' + Math.round(n).toLocaleString();
};
const fmtPct = (n) => n == null || isNaN(n) ? '—' : `${Math.round(n)}%`;

// --- Primitives -----------------------------------------------------------

const Pill = ({ kind, children }) => {
  const colours = { positive: T.positive, negative: T.negative, neutral: T.textMuted };
  const c = colours[kind || 'neutral'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: T.fontSmall, fontWeight: T.fontWeightRegular, color: c, ...numStyle,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c, display: 'inline-block' }} />
      {children}
    </span>
  );
};

const KpiCard = ({ label, value, sub, emphasised, dense }) => (
  // `dense` shrinks the tile so 4 of them fit in a single narrow column.
  <div style={{ background: T.card, borderRadius: dense ? 10 : 12,
                padding: dense ? '8px 10px 8px' : '14px 16px' }}>
    <div style={{ fontSize: dense ? 9 : T.fontXSmall, color: T.textMuted,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  fontWeight: T.fontWeightRegular,
                  marginBottom: dense ? 4 : 10 }}>{label}</div>
    <div style={{ ...numStyle,
                  fontSize: dense ? T.fontLarge : T.font3XLarge,
                  fontWeight: emphasised ? T.fontWeightSemibold : T.fontWeightMedium,
                  color: T.black, lineHeight: T.lineHeight1, letterSpacing: '-0.02em' }}>{value}</div>
    {sub && <div style={{ fontSize: dense ? 10 : 12, color: T.textMuted,
                          marginTop: dense ? 3 : 6, lineHeight: 1.4 }}>{sub}</div>}
  </div>
);

const SectionBanner = ({ tag, title, caption, who }) => (
  <div style={{ marginTop: 56, marginBottom: 24 }}>
    <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase',
                  letterSpacing: '0.14em', fontWeight: T.fontWeightRegular, marginBottom: 8 }}>{tag}</div>
    <h2 className="sec-title" style={{ margin: 0, fontSize: T.font4XLarge, fontWeight: T.fontWeightRegular,
                 color: T.black, letterSpacing: '-0.02em', lineHeight: T.lineHeight1 }}>{title}</h2>
    {caption && (
      <div style={{ fontSize: T.fontMedium, color: T.textSec, marginTop: 10, lineHeight: T.lineHeight2, maxWidth: 760 }}>
        {caption}
      </div>
    )}
    {who && (
      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 12,
                    textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Audience · {who}
      </div>
    )}
  </div>
);

const SectionH = ({ children, meta }) => (
  <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase',
                letterSpacing: '0.12em', fontWeight: T.fontWeightRegular, marginTop: 32, marginBottom: 14 }}>
    {children}
    {meta && <span style={{ marginLeft: 10, color: T.textMuted, opacity: 0.7,
                            textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>{meta}</span>}
  </div>
);

const FindingBox = ({ children }) => (
  <div style={{
    padding: '14px 0 14px 20px', margin: '16px 0 4px',
    borderLeft: `2px solid ${T.hairline}`,
    fontSize: T.fontMedium, lineHeight: T.lineHeight2, color: T.textSec,
  }}>{children}</div>
);

const Card = ({ children, style }) => (
  <div style={{ background: T.card, borderRadius: 12, padding: 12, ...style }}>{children}</div>
);

const Table = ({ headers, rows, formatters, totals, dense, minWidth }) => {
  const cellPad = dense ? '8px 10px' : '12px 20px';
  const headPad = dense ? '10px 10px' : '14px 20px';
  const fontSz  = dense ? 12 : 14;
  return (
    <div className="tbl-scroll">
    <div style={{ background: T.card, minWidth: minWidth ?? (dense ? 320 : 480), borderRadius: 14, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fontSz }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{
                textAlign: h.align || 'left', padding: headPad,
                fontSize: dense ? 9 : T.fontXSmall, color: T.textMuted,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                fontWeight: T.fontWeightRegular,
                borderBottom: `1px solid ${T.hairline}`,
              }}>{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {headers.map((h, j) => {
                const v = r[h.key];
                const cell = formatters && formatters[h.key] ? formatters[h.key](v, r) : v;
                return (
                  <td key={j} style={{
                    padding: cellPad, textAlign: h.align || 'left',
                    color: h.muted ? T.textMuted : T.textSec,
                    fontWeight: h.bold ? 600 : 400,
                    borderTop: i > 0 ? `1px solid ${T.hairline}` : 'none',
                    ...(h.numeric ? numStyle : {}),
                  }}>{cell}</td>
                );
              })}
            </tr>
          ))}
          {totals && (
            <tr>
              {headers.map((h, j) => {
                const v = totals[h.key];
                const cell = formatters && formatters[h.key] ? formatters[h.key](v, totals) : v;
                return (
                  <td key={j} style={{
                    padding: headPad, textAlign: h.align || 'left',
                    color: T.black, fontWeight: T.fontWeightSemibold,
                    borderTop: `2px solid ${T.black}`,
                    ...(h.numeric ? numStyle : {}),
                  }}>{cell}</td>
                );
              })}
            </tr>
          )}
        </tbody>
      </table>
    </div>
    </div>
  );
};

// --- Hero (≤ ~25vh) -------------------------------------------------------

function HeroSection({ data }) {
  const h = data.hero;
  const f = data.forecast;

  // Cumulative forecast levels — Commit ≤ Best ≤ Pipeline ≤ Target.
  const target   = h.q2Target;
  const actuals  = f.closedWon;
  const commit   = actuals  + f.committedWeighted;
  const bestCase = commit   + f.bestCaseWeighted;
  const pipeline = bestCase + f.pipelineWeighted;

  // Use display-rounded (K) values to compute the gap so the cards reconcile:
  // if Pipeline shows €255K and Target shows €311K, the gap must show €56K
  // (not €55K, which is what raw subtraction would give due to rounding drift).
  const targetK   = Math.round(target   / 1000);
  const pipelineK = Math.round(pipeline / 1000);
  const gapK      = Math.max(0, targetK - pipelineK);

  // Pipeline as % of target, rounded for display.
  const pctVsTarget = target > 0 ? Math.round(pipeline / target * 100) : 0;

  // Bar segment widths as % of target. Total filled = pctVsTarget; the
  // remainder of the bar's width is the gap (rendered as the unfilled track).
  const w = (v) => Math.max(0, (v / target) * 100);

  // Each KPI is a card with a coloured top stripe — same pattern as the
  // body's Stalled/Slipped/Coverage/ASP KPI tiles. The stripe colour matches
  // the segment's colour in the cumulative bar below, so the cards literally
  // are the bar's legend. All colours are sourced from the Pleo Telescope
  // palette (T tokens); pink stays the main brand colour.
  //
  // Bar segments (left → right, cumulative):
  //   Actuals   → pink   (main brand, most-certain revenue)
  //   Commit    → purple (committed forecast category)
  //   Best case → green  (upside within forecast)
  //   Pipeline  → yellow (least-certain forecast)
  // Target has no segment — it's the right edge of the bar (dashed marker).
  // Upside sits OUTSIDE the bar entirely — it's recovery potential, not
  // booked or forecast revenue.
  const forecastCards = [
    { label: 'Actuals',   value: actuals,  sub: 'Closed-won so far',     stripe: T.pleoPink500 },
    { label: 'Commit',    value: commit,   sub: '+ Committed weighted',  stripe: T.pleoPurple  },
    { label: 'Best case', value: bestCase, sub: '+ Best case weighted',  stripe: T.pleoGreen   },
    // Pipeline carries a secondary metric — pipeline value + achievement %
    // render side-by-side at the same size. Pink (the achievement colour)
    // doubles as the visual anchor for "performance vs target".
    { label: 'Pipeline',  value: pipeline, sub: 'weighted',  stripe: T.pleoYellow,
      secondary: { value: `${pctVsTarget}%`, sub: 'vs target', color: T.pleoPink500 } },
    { label: 'Target',    value: target,
      sub: gapK > 0 ? `Gap €${gapK}K to close` : 'Ceiling clears target',
      stripe: '#FFFFFF', stripeDashed: true, subAccent: 'white' },
  ];
  const upsideCard = {
    label: 'Upside', value: h.recoveryEur,
    sub: 'Stale re-engagement', stripe: T.pleoBlue, subAccent: 'blue',
  };

  // Card renderer — dark-hero variant of the body's KpiCard. Subtle white
  // tint as fill, coloured top stripe acts as the legend swatch. If `secondary`
  // is provided, the card renders two same-size numbers side-by-side (e.g.,
  // Pipeline shows €255K + 82%, each with its own caption underneath).
  const HeroKpi = ({ k }) => {
    const subColor =
      k.subAccent === 'pink'  ? T.pleoPink500 :
      k.subAccent === 'blue'  ? T.pleoBlue    :
      k.subAccent === 'white' ? '#FFFFFF'     :
      'rgba(255,255,255,0.6)';
    const Cell = ({ value, sub, color, subColor }) => (
      <div style={{ minWidth: 0 }}>
        <div style={{ ...numStyle, fontSize: T.font3XLarge, color: color || '#FFFFFF',
                      fontWeight: T.fontWeightMedium, lineHeight: 1.05,
                      letterSpacing: '-0.02em' }}>
          {value}
        </div>
        <div style={{ fontSize: 11, color: subColor,
                      marginTop: 6, lineHeight: 1.4,
                      fontWeight: T.fontWeightRegular }}>
          {sub}
        </div>
      </div>
    );
    return (
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: '14px 16px',
        borderTop: k.stripeDashed
          ? `3px dashed ${k.stripe}`
          : `3px solid ${k.stripe}`,
      }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)',
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                      fontWeight: T.fontWeightRegular, marginBottom: 8 }}>
          {k.label}
        </div>
        {k.secondary ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto',
                        columnGap: 12, alignItems: 'baseline' }}>
            <Cell value={fmtEur(k.value)} sub={k.sub}
                  color="#FFFFFF" subColor="rgba(255,255,255,0.6)" />
            <Cell value={k.secondary.value} sub={k.secondary.sub}
                  color={k.secondary.color} subColor={k.secondary.color} />
          </div>
        ) : (
          <Cell value={fmtEur(k.value)} sub={k.sub}
                color="#FFFFFF" subColor={subColor} />
        )}
      </div>
    );
  };

  return (
    <section className="hero-pad" style={{ background: T.black, color: '#FFFFFF' }}>
      <div className="hero-wrap">

        <div style={{ display: 'flex', justifyContent: 'space-between',
                      alignItems: 'flex-end', flexWrap: 'wrap', gap: 24, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: T.fontXSmall, color: 'rgba(255,255,255,0.55)',
                          textTransform: 'uppercase', letterSpacing: '0.14em',
                          fontWeight: T.fontWeightRegular, marginBottom: 8,
                          display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'baseline' }}>
              <span>Weekly GTM Review · {h.asOf}</span>
              {/* Quarter progress — same numbers as the PaceInsights tile below.
                  Helps frame everything else: "we're at week 7 of the quarter,
                  this is what's been done so far". */}
              <span style={{ color: 'rgba(255,255,255,0.75)' }}>
                Week 7 · 48% · Quarter progress
              </span>
            </div>
            <h1 className="hero-h1" style={{ margin: 0, fontSize: T.font4XLarge,
                         fontWeight: T.fontWeightRegular, letterSpacing: '-0.02em',
                         lineHeight: T.lineHeight1, color: '#FFFFFF' }}>
              Q2 2026 ·{' '}
              <span style={{ ...numStyle, color: T.pleoPink500, fontWeight: T.fontWeightSemibold }}>
                {fmtEur(h.q2Closed)} closed of {fmtEur(h.q2Target)}
              </span>
            </h1>
          </div>

          {/* AI insight summary — short, two lines max */}
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12,
                        padding: '14px 18px', maxWidth: 480, fontSize: T.fontSmall,
                        color: 'rgba(255,255,255,0.85)', lineHeight: T.lineHeight2 }}>
            <span style={{ fontSize: T.fontXSmall, color: T.pleoPink500, textTransform: 'uppercase',
                           letterSpacing: '0.14em', marginRight: 8 }}>
              <AiIcon color={T.pleoPink500} />AI · summary
            </span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)',
                           textTransform: 'uppercase', letterSpacing: '0.1em',
                           marginRight: 8 }}>refreshed weekly</span>
            Even if all weighted pipeline (€{pipelineK}K) lands, we miss target by €{gapK}K.
            Biggest lever this week: re-engage the {h.staleDeals} stale deals ({fmtEur(h.staleArr)})
            — recovery upside +{fmtEur(h.recoveryEur)}.
          </div>
        </div>

        {/* ── Forecast block + Upside, side by side ─────────────────────────
            Two-part layout:
              · Left  (flex 5): 5 forecast cards in a row + cumulative bar
                                that ends flush with the Target card.
              · Right (flex 1): the Upside card alone — visually separated
                                because it's NOT part of the cumulative.
            On narrow viewports the two halves stack. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16,
                      alignItems: 'flex-start' }}>

          {/* Forecast block */}
          <div style={{ flex: '5 1 540px', display: 'flex',
                        flexDirection: 'column', gap: 12, minWidth: 0 }}>
            <div style={{ display: 'grid',
                          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                          gap: 12 }}>
              {forecastCards.map((k, i) => <HeroKpi key={i} k={k} />)}
            </div>

            {/* Cumulative bar.
                  Width: 90% of the forecast block — pulling the bar in by
                  half a card-width on the right shifts its end to roughly
                  the center of the Target card, so the target line sits
                  directly under the Target label.
                  Track: a light grey tint so the unfilled remainder (the
                  gap to target) is clearly visible as a separate volume,
                  not just empty space.
                  Target marker: a thicker, full-height vertical white line
                  with a small cap top and bottom — unmistakably "this is
                  the target". */}
            <div style={{ position: 'relative', width: '90%', paddingTop: 6, paddingBottom: 6 }}>
              <div style={{ position: 'relative', height: 12, borderRadius: 6,
                            background: 'rgba(255,255,255,0.18)',
                            overflow: 'hidden', display: 'flex' }}>
                {actuals > 0 && (
                  <div title={`Actuals: ${fmtEur(actuals)}`}
                       style={{ width: `${w(actuals)}%`, background: T.pleoPink500 }} />
                )}
                <div title={`+ Commit: ${fmtEur(f.committedWeighted)}`}
                     style={{ width: `${w(f.committedWeighted)}%`, background: T.pleoPurple }} />
                <div title={`+ Best case: ${fmtEur(f.bestCaseWeighted)}`}
                     style={{ width: `${w(f.bestCaseWeighted)}%`, background: T.pleoGreen }} />
                <div title={`+ Pipeline: ${fmtEur(f.pipelineWeighted)}`}
                     style={{ width: `${w(f.pipelineWeighted)}%`, background: T.pleoYellow }} />
              </div>
              {/* Target marker — solid white vertical bar extending above
                  and below the track. Caps reinforce that this is a tick. */}
              <div style={{ position: 'absolute', right: -1, top: 0, bottom: 0,
                            width: 3, background: '#FFFFFF', borderRadius: 1.5,
                            pointerEvents: 'none' }} />
            </div>
          </div>

          {/* Upside — single card sitting outside the bar. flex:1 makes it
              roughly the same width as one forecast card on wide viewports. */}
          <div style={{ flex: '1 1 160px', minWidth: 140 }}>
            <HeroKpi k={upsideCard} />
          </div>

        </div>

      </div>
    </section>
  );
}

// --- ARR vs Target — cumulative pace chart -------------------------------

const TooltipBox   = { background: '#000000', border: 'none', borderRadius: 6, fontSize: 12, padding: '8px 10px' };
const TooltipLabel = { color: '#FFF' };
const TooltipItem  = { color: '#FFF' };

// Recharts colours each legend item (swatch + text) with the series colour by
// default, which makes pale series labels unreadable. This formatter keeps the
// swatch colour but forces the label text to always render in black.
const legendBlackFmt = (value) => (
  <span style={{ color: T.black }}>{value}</span>
);

// Four big-number cards showing the cumulative forecast levels for the
// current quarter. Commit ≤ Best Case ≤ Pipeline ≤ Target. The story we
// want the reader to take away is "even the ceiling misses target".
//
// Sits above a single horizontal progress bar that stacks the same numbers
// in a single shape so the gap to target is immediately visible.
function ForecastRow({ data }) {
  const f = data.forecast;
  const target   = data.hero.q2Target;
  const actuals  = f.closedWon;
  const commit   = actuals + f.committedWeighted;
  const bestCase = commit  + f.bestCaseWeighted;
  const pipeline = bestCase + f.pipelineWeighted;
  const gap      = Math.max(0, target - pipeline);

  const Tile = ({ label, value, sub, tone }) => (
    <div style={{
      background: T.card, borderRadius: 10, padding: '14px 16px',
      borderTop: tone ? `3px solid ${tone}` : 'none',
    }}>
      <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase',
                    letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
      <div style={{ ...numStyle, fontSize: T.font3XLarge, color: T.black,
                    fontWeight: T.fontWeightSemibold, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
        {fmtEur(value)}
      </div>
      {sub && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6, lineHeight: 1.35 }}>{sub}</div>}
    </div>
  );

  // Stacked progress bar — same shape as OutcomeSplit. Widths are
  // proportional to each segment's delta so cumulative levels map to the
  // segment boundaries. Light grey "Gap" at the right closes the bar at
  // target, making the shortfall (or overshoot) impossible to miss.
  const Bar = () => (
    <div style={{ background: T.card, borderRadius: 10, padding: '12px 14px',
                  display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase',
                    letterSpacing: '0.08em' }}>
        Forecast vs Target · cumulative
      </div>

      <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden' }}>
        {actuals > 0 && (
          <div title={`Actuals: ${fmtEur(actuals)}`}
               style={{ flex: actuals, background: T.pleoPink500 }} />
        )}
        <div title={`+ Commit: ${fmtEur(f.committedWeighted)} (cumulative ${fmtEur(commit)})`}
             style={{ flex: f.committedWeighted, background: T.pleoPink400 }} />
        <div title={`+ Best Case: ${fmtEur(f.bestCaseWeighted)} (cumulative ${fmtEur(bestCase)})`}
             style={{ flex: f.bestCaseWeighted, background: T.pleoPink300 }} />
        <div title={`+ Pipeline: ${fmtEur(f.pipelineWeighted)} (cumulative ${fmtEur(pipeline)})`}
             style={{ flex: f.pipelineWeighted, background: T.pleoPink200 }} />
        {gap > 0 && (
          <div title={`Gap to target: ${fmtEur(gap)}`}
               style={{ flex: gap, background: T.hairline }} />
        )}
      </div>

      {/* Tick labels under the bar — cumulative value at the right edge
          of each segment. Pipeline (ceiling) is bold; target is bold black. */}
      <div style={{ display: 'flex', fontSize: 10, color: T.textMuted, ...numStyle, lineHeight: 1.2 }}>
        {actuals > 0 && <span style={{ flex: actuals }} />}
        <span style={{ flex: f.committedWeighted, textAlign: 'right', paddingRight: 4 }}>{fmtEur(commit)}</span>
        <span style={{ flex: f.bestCaseWeighted,  textAlign: 'right', paddingRight: 4 }}>{fmtEur(bestCase)}</span>
        <span style={{ flex: f.pipelineWeighted,  textAlign: 'right', paddingRight: 4,
                       color: T.black, fontWeight: T.fontWeightSemibold }}>
          {fmtEur(pipeline)}
        </span>
        {gap > 0 && (
          <span style={{ flex: gap, textAlign: 'right',
                         color: T.black, fontWeight: T.fontWeightSemibold }}>
            ↑ {fmtEur(target)}
          </span>
        )}
      </div>

      {gap > 0 && (
        <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>
          Even the ceiling misses target by{' '}
          <strong style={{ color: T.black }}>{fmtEur(gap)}</strong>.
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        <Tile label="Commit" value={commit}
              sub="Won + Committed · the floor"
              tone={T.textMuted} />
        <Tile label="Best case" value={bestCase}
              sub="Commit + Best Case"
              tone={T.textMuted} />
        <Tile label="Pipeline" value={pipeline}
              sub="Best + Pipeline · ceiling"
              tone={T.pleoPink500} />
        <Tile label="Target" value={target}
              sub={gap > 0 ? `Gap ${fmtEur(gap)} to ceiling` : 'Ceiling clears target'}
              tone={T.black} />
      </div>
      <Bar />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  ArrTrendChart — the headline ARR chart with controls.
//  Modes:
//    chart  in {line, bar}
//    period in {month, quarter, year}   ← quarter is the default
//    offset is the integer step from "current" period (0 = current,
//           -1 = previous, -4 = same Q last year for quarter mode, etc.)
//  Lines view = 3 cumulative series within the selected period (current,
//  prior period, same period last year). Bar view = actuals vs target per
//  sub-period of the selected period (month → weeks, quarter → months,
//  year → quarters).
// ──────────────────────────────────────────────────────────────────────────

const AS_OF = new Date(2026, 4, 14); // analysis as-of: 14 May 2026 (local)

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function parseISODate(s) {
  if (!s) return null;
  const parts = s.substring(0, 10).split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}
function monthLabel(d) { return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`; }
function quarterOf(d) { return Math.floor(d.getMonth() / 3) + 1; }
function quarterLabel(d) { return `Q${quarterOf(d)} ${d.getFullYear()}`; }
function monthEnd(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

// Move the AS_OF date by `offset` units of the chosen period. Returns
// {start, end, label} for the resulting period window.
function getPeriodRange(period, offset) {
  if (period === 'quarter') {
    const qi = AS_OF.getFullYear() * 4 + Math.floor(AS_OF.getMonth() / 3) + offset;
    const y = Math.floor(qi / 4), q = qi - y * 4;
    const start = new Date(y, q * 3, 1);
    const end   = new Date(y, q * 3 + 3, 0);
    return { start, end, label: `Q${q+1} ${y}` };
  }
  if (period === 'month') {
    const mi = AS_OF.getFullYear() * 12 + AS_OF.getMonth() + offset;
    const y = Math.floor(mi / 12), m = mi - y * 12;
    const start = new Date(y, m, 1);
    const end   = new Date(y, m + 1, 0);
    return { start, end, label: monthLabel(start) };
  }
  // year
  const y = AS_OF.getFullYear() + offset;
  return { start: new Date(y, 0, 1), end: new Date(y, 11, 31), label: String(y) };
}

// LY = "same period, last year". For year mode, "prior" already covers LY.
function getSameLYRange(period, offset) {
  if (period === 'quarter') return getPeriodRange('quarter', offset - 4);
  if (period === 'month')   return getPeriodRange('month',   offset - 12);
  return null; // year mode doesn't have a separate LY series
}

// Daily cumulative ARR within [start, end] from raw wins.
function cumulativeDaily(wins, start, end) {
  const days = Math.round((end - start) / 86400000) + 1;
  const out = new Array(days).fill(0);
  for (const w of wins) {
    const wd = parseISODate(w.close_date);
    if (wd < start || wd > end) continue;
    const idx = Math.round((wd - start) / 86400000);
    if (idx >= 0 && idx < days) out[idx] += w.arr_eur;
  }
  for (let i = 1; i < days; i++) out[i] += out[i-1];
  return out;
}

function buildLinePoints({ wins }, period, offset) {
  const cur   = getPeriodRange(period, offset);
  const prior = getPeriodRange(period, offset - 1);
  const ly    = getSameLYRange(period, offset);

  const dCur   = cumulativeDaily(wins, cur.start,   cur.end);
  const dPrior = cumulativeDaily(wins, prior.start, prior.end);
  const dLY    = ly ? cumulativeDaily(wins, ly.start, ly.end) : null;

  // Cap the current series at "today" so the line stops where we are.
  const cutoffDay = (AS_OF >= cur.start && AS_OF <= cur.end)
    ? Math.round((AS_OF - cur.start) / 86400000)
    : (cur.end < AS_OF ? dCur.length - 1 : -1);

  const maxLen = Math.max(dCur.length, dPrior.length, dLY ? dLY.length : 0);
  const points = [];
  for (let i = 0; i < maxLen; i++) {
    points.push({
      day:     i + 1,
      current: i <= cutoffDay && i < dCur.length   ? dCur[i]   : null,
      prior:   i < dPrior.length                   ? dPrior[i] : null,
      sameLY:  dLY && i < dLY.length               ? dLY[i]   : null,
    });
  }
  return { points, labels: { current: cur.label, prior: prior.label, sameLY: ly?.label } };
}

// Sub-period buckets within the selected period (months / weeks / quarters).
function getBuckets(period, range) {
  if (period === 'quarter') {
    // 3 monthly buckets
    return [0,1,2].map(i => {
      const s = new Date(range.start.getFullYear(), range.start.getMonth() + i, 1);
      return { label: MONTH_NAMES[s.getMonth()], start: s, end: monthEnd(s) };
    });
  }
  if (period === 'month') {
    // Weekly buckets (7-day chunks from day 1; final week may be partial)
    const buckets = [];
    let cur = new Date(range.start), n = 1;
    while (cur <= range.end) {
      const e = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 6);
      buckets.push({ label: `W${n}`, start: new Date(cur), end: e > range.end ? new Date(range.end) : e });
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 7);
      n++;
    }
    return buckets;
  }
  // year — 4 quarterly buckets
  return [0,1,2,3].map(i => ({
    label: `Q${i+1}`,
    start: new Date(range.start.getFullYear(), i * 3, 1),
    end:   new Date(range.start.getFullYear(), i * 3 + 3, 0),
  }));
}

function buildBarBuckets({ wins, targets }, period, offset) {
  const range = getPeriodRange(period, offset);
  const buckets = getBuckets(period, range);
  return buckets.map(b => {
    let actuals = 0, target = 0;
    for (const w of wins) {
      const wd = parseISODate(w.close_date);
      if (wd >= b.start && wd <= b.end) actuals += w.arr_eur;
    }
    for (const t of targets) {
      const td = parseISODate(t.month);
      const tdEnd = monthEnd(td);
      // Bucket may be weekly (smaller than a month); pro-rate by overlap.
      const overlapStart = Math.max(td.getTime(),    b.start.getTime());
      const overlapEnd   = Math.min(tdEnd.getTime(), b.end.getTime());
      if (overlapEnd >= overlapStart) {
        const overlapDays = Math.round((overlapEnd - overlapStart) / 86400000) + 1;
        const monthDays   = Math.round((tdEnd - td) / 86400000) + 1;
        target += t.target * (overlapDays / monthDays);
      }
    }
    return { label: b.label, actuals: Math.round(actuals), target: Math.round(target) };
  });
}

// Period-aware tick positions for the line chart's x-axis. The point is to
// label the chart with the same sub-period the user would see in bar mode —
// months for quarter, weeks for month, quarters for year.
function getLineXTicks(period, range) {
  if (period === 'quarter') {
    return [0, 1, 2].map(i => {
      const ms = new Date(range.start.getFullYear(), range.start.getMonth() + i, 1);
      return Math.round((ms - range.start) / 86400000) + 1;
    });
  }
  if (period === 'month') {
    const ticks = [];
    for (let d = 1; d <= 29; d += 7) ticks.push(d);
    return ticks;
  }
  // year
  return [0, 1, 2, 3].map(i => {
    const qs = new Date(range.start.getFullYear(), i * 3, 1);
    return Math.round((qs - range.start) / 86400000) + 1;
  });
}
function getLineXLabel(day, period, range) {
  if (period === 'quarter') {
    for (let i = 0; i < 3; i++) {
      const ms = new Date(range.start.getFullYear(), range.start.getMonth() + i, 1);
      const td = Math.round((ms - range.start) / 86400000) + 1;
      if (day === td) return MONTH_NAMES[ms.getMonth()];
    }
    return '';
  }
  if (period === 'month') {
    return `W${Math.floor((day - 1) / 7) + 1}`;
  }
  // year
  for (let i = 0; i < 4; i++) {
    const qs = new Date(range.start.getFullYear(), i * 3, 1);
    const td = Math.round((qs - range.start) / 86400000) + 1;
    if (day === td) return `Q${i + 1}`;
  }
  return '';
}

// ── Pipeline funnel · gross + weighted ARR per stage ─────────────────────
// Horizontal bars, one row per stage, ordered by sales-pipeline progression
// (Discovery at top → Contracting at bottom). Each row visualizes:
//   - Gross ARR  — light grey background bar
//   - Weighted ARR — pink overlay (same start, shorter length)
// The shape shows how much of "face-value pipeline" actually survives
// probability weighting. Numbers and deal count print to the right.
//
// Filter is shared with ArrTrendChart via `period` / `offset` props.
// Filtering is by close_date: "of the deals scheduled to close in the
// selected period, where do they sit in the funnel?"
const STAGE_ORDER = [
  'Discovery', 'Initial Meeting', 'Qualified', 'Business Validation',
  'Evaluation', 'Negotiation', 'Contracting',
];
function PipelineFunnelChart({ data, period, offset }) {
  const isAll = period === 'all';
  const range = !isAll ? getPeriodRange(period, offset) : null;
  const inRange = (cd) => {
    if (isAll) return true;
    const d = parseISODate(cd);
    return d >= range.start && d <= range.end;
  };

  // Aggregate open pipeline by stage, period-filtered by close_date.
  const filtered = (data.pipelineOpen || []).filter(r => inRange(r.close_date));
  const byStage = new Map();
  for (const r of filtered) {
    if (!byStage.has(r.stage)) byStage.set(r.stage, {
      stage: r.stage, deals: 0, arr: 0, weighted: 0, stuck: 0,
    });
    const e = byStage.get(r.stage);
    e.deals    += 1;
    e.arr      += r.arr      || 0;
    e.weighted += r.weighted || 0;
    if ((r.stage_age_days || 0) > 90) e.stuck += 1;
  }
  // Keep canonical stage order; drop empty stages so the bars don't have gaps.
  const stages = STAGE_ORDER
    .map(s => byStage.get(s))
    .filter(Boolean);
  const maxArr = Math.max(1, ...stages.map(s => s.arr));
  const totalWeighted = stages.reduce((a, s) => a + s.weighted, 0);

  // Highest-weighted stage — used by the one-line finding.
  const top = stages.length
    ? [...stages].sort((a, b) => b.weighted - a.weighted)[0]
    : null;

  return (
    <div>
      <SectionH meta="Open pipeline · current snapshot · grouped by stage">
        Pipeline funnel · gross vs weighted ARR
      </SectionH>
      {stages.length === 0 ? (
        <Card style={{ padding: 14, fontSize: 12, color: T.textMuted }}>
          No open pipeline with close date in this period.
        </Card>
      ) : (
        <Card style={{ padding: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stages.map((s, i) => {
              const grossW    = (s.arr      / maxArr) * 100;
              const weightedW = (s.weighted / maxArr) * 100;
              const grossK    = Math.round(s.arr / 1000);
              const weightedK = Math.round(s.weighted / 1000);
              return (
                <div key={i} style={{ display: 'grid',
                                       gridTemplateColumns: '130px 1fr auto',
                                       gap: 12, alignItems: 'center',
                                       fontSize: 12 }}>
                  {/* Stage label + tiny deals count */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: T.textSec,
                                   fontWeight: T.fontWeightMedium }}>{s.stage}</span>
                    <span style={{ fontSize: 10, color: T.textMuted, ...numStyle }}>
                      {s.deals} {s.deals === 1 ? 'deal' : 'deals'}
                      {s.stuck > 0 && (
                        <span style={{ color: T.negative }}> · {s.stuck} stuck</span>
                      )}
                    </span>
                  </div>

                  {/* Bar — gross (light grey) with weighted overlay (pink) */}
                  <div style={{ position: 'relative', height: 14,
                                background: T.hairline, borderRadius: 7,
                                overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: '0 auto 0 0',
                                  width: `${grossW}%`, background: T.hairline,
                                  // already the track colour; keeps the layer
                                  // explicit if track styling changes later.
                                }} />
                    <div style={{ position: 'absolute', inset: '0 auto 0 0',
                                  width: `${weightedW}%`, background: T.pleoPink500,
                                  borderRadius: 7 }} />
                    {/* Faint outline marking the gross end so users can read
                        it even when weighted is much smaller. */}
                    <div style={{ position: 'absolute',
                                  left: `${grossW}%`, top: 0, bottom: 0,
                                  borderLeft: `1px solid ${T.textMuted}` }} />
                  </div>

                  {/* Numbers — gross / weighted */}
                  <div style={{ ...numStyle, textAlign: 'right',
                                whiteSpace: 'nowrap', fontSize: 11 }}>
                    <span style={{ color: T.textMuted }}>€{grossK}K</span>
                    <span style={{ color: T.textMuted, margin: '0 6px' }}>·</span>
                    <span style={{ color: T.pleoPink700,
                                   fontWeight: T.fontWeightSemibold }}>
                      €{weightedK}K
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend strip — explains the two layers in one line. */}
          <div style={{ marginTop: 14, paddingTop: 10,
                        borderTop: `1px solid ${T.hairline}`,
                        display: 'flex', gap: 16, fontSize: 11,
                        color: T.textMuted, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, background: T.hairline,
                             borderRadius: 2, border: `1px solid ${T.textMuted}` }} />
              Gross ARR
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, background: T.pleoPink500,
                             borderRadius: 2 }} />
              Weighted ARR
            </span>
            <span style={{ marginLeft: 'auto', ...numStyle }}>
              Total weighted: <strong style={{ color: T.black }}>
                €{Math.round(totalWeighted / 1000)}K
              </strong>
            </span>
          </div>
        </Card>
      )}
      {top && (
        <FindingBox>
          <strong style={{ color: T.black }}>{top.stage}</strong> holds the
          biggest weighted bucket — €{Math.round(top.weighted / 1000)}K across{' '}
          {top.deals} {top.deals === 1 ? 'deal' : 'deals'}
          {top.stuck > 0 && <>, {top.stuck} stuck &gt;90 days</>}.
        </FindingBox>
      )}
    </div>
  );
}

function ArrTrendChart({ data, compact,
                         period: periodProp, setPeriod: setPeriodProp,
                         offset: offsetProp, setOffset: setOffsetProp }) {
  // Chart type stays internal — funnel doesn't share this knob.
  const [chart,  setChart]  = useState('line');
  // Period + offset are externally controlled when a parent passes them in
  // (so the pipeline funnel can share the same filter). Fall back to
  // internal state for any other caller.
  const [periodS, setPeriodS] = useState('quarter');
  const [offsetS, setOffsetS] = useState(0);
  const period = periodProp ?? periodS;
  const offset = offsetProp ?? offsetS;
  const setPeriod = setPeriodProp ?? setPeriodS;
  const setOffset = setOffsetProp ?? setOffsetS;

  const setPeriodSafe = (p) => { setPeriod(p); setOffset(0); };

  const range  = getPeriodRange(period, offset);
  const isCurrent = offset === 0;
  const linePts  = useMemo(() => buildLinePoints(data.arrTrend, period, offset), [data, period, offset]);
  const barData  = useMemo(() => buildBarBuckets(data.arrTrend, period, offset), [data, period, offset]);

  // Bounds for prev/next navigation — we have data from 2024-01 onward.
  const minOffset = period === 'quarter' ? -8 : period === 'month' ? -28 : -2;
  const canPrev = offset > minOffset;
  const canNext = offset < 0;

  const PillBtn = ({ active, onClick, children }) => (
    <button onClick={onClick}
      style={{
        border: 'none', cursor: 'pointer', borderRadius: 999,
        padding: '5px 12px', fontSize: 11,
        fontFamily: T.font,
        fontWeight: active ? T.fontWeightSemibold : T.fontWeightRegular,
        background: active ? T.black : 'transparent',
        color:      active ? '#FFF'   : T.textMuted,
        transition: 'all 150ms ease-out',
      }}>{children}</button>
  );
  const Arrow = ({ disabled, onClick, children }) => (
    <button onClick={onClick} disabled={disabled}
      style={{
        border: 'none', background: 'transparent', cursor: disabled ? 'default' : 'pointer',
        color: disabled ? T.hairline : T.textMuted, fontSize: 14,
        width: 24, height: 24, borderRadius: 999, padding: 0,
      }}>{children}</button>
  );

  // The control bar — chart-type pills | period pills | prev/next + label
  const controls = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
                  marginBottom: 8, fontSize: 11 }}>
      <div style={{ display: 'inline-flex', gap: 2, background: T.panel, padding: 2, borderRadius: 999 }}>
        <PillBtn active={chart === 'line'} onClick={() => setChart('line')}>Lines</PillBtn>
        <PillBtn active={chart === 'bar'}  onClick={() => setChart('bar')}>Bars</PillBtn>
      </div>
      <div style={{ display: 'inline-flex', gap: 2, background: T.panel, padding: 2, borderRadius: 999 }}>
        <PillBtn active={period === 'month'}   onClick={() => setPeriodSafe('month')}>Month</PillBtn>
        <PillBtn active={period === 'quarter'} onClick={() => setPeriodSafe('quarter')}>Quarter</PillBtn>
        <PillBtn active={period === 'year'}    onClick={() => setPeriodSafe('year')}>Year</PillBtn>
      </div>
      <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
        <Arrow disabled={!canPrev} onClick={() => canPrev && setOffset(offset - 1)}>‹</Arrow>
        <span style={{ ...numStyle, fontSize: 12, fontWeight: T.fontWeightMedium, color: T.black, minWidth: 64, textAlign: 'center' }}>
          {range.label}
        </span>
        <Arrow disabled={!canNext} onClick={() => canNext && setOffset(offset + 1)}>›</Arrow>
      </div>
    </div>
  );

  const cardPad = compact ? 10 : 16;
  const chartHeight = compact ? 220 : 280;

  return (
    <Card style={{ padding: cardPad }}>
      {controls}
      {chart === 'line' ? (() => {
        // End-point label per series — printing a value at every point on
        // three cumulative lines would be illegible. Find the last non-null
        // index of each series; LabelList renders only at that index.
        const lastIdx = { current: -1, prior: -1, sameLY: -1 };
        linePts.points.forEach((p, i) => {
          if (p.current != null) lastIdx.current = i;
          if (p.prior   != null) lastIdx.prior   = i;
          if (p.sameLY  != null) lastIdx.sameLY  = i;
        });
        const endpointLabel = (key, color) => (props) => {
          if (props.index !== lastIdx[key] || props.value == null) return null;
          return (
            <text x={props.x + 6} y={props.y} dy={4}
                  fill={color} fontSize={11} fontWeight={600}
                  style={{ fontFamily: T.font }}>
              €{Math.round(props.value / 1000)}K
            </text>
          );
        };
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={linePts.points} margin={{ top: 6, right: 36, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={T.chartGrid} />
              <XAxis dataKey="day" type="number" domain={[1, 'dataMax']}
                     ticks={getLineXTicks(period, range)}
                     tickFormatter={(v) => getLineXLabel(v, period, range)}
                     tick={{ fontSize: 10, fill: T.textMuted }}
                     axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `€${Math.round(v/1000)}K`}
                     tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => v == null ? '—' : `€${Math.round(v/1000).toLocaleString()}K`}
                       labelFormatter={(d) => `Day ${d}`}
                       contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={legendBlackFmt} />
              {linePts.labels.sameLY && (
                <Line dataKey="sameLY" name={linePts.labels.sameLY} stroke={T.black}
                      strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls={false}>
                  <LabelList content={endpointLabel('sameLY', T.black)} />
                </Line>
              )}
              <Line dataKey="prior"   name={linePts.labels.prior}   stroke={T.textMuted}
                    strokeWidth={2}   dot={false} connectNulls={false}>
                <LabelList content={endpointLabel('prior', T.textMuted)} />
              </Line>
              <Line dataKey="current" name={linePts.labels.current} stroke={T.pleoPink500}
                    strokeWidth={3}   dot={false} connectNulls={false}>
                <LabelList content={endpointLabel('current', T.pleoPink500)} />
              </Line>
              {isCurrent && period !== 'year' && (
                <ReferenceLine x={Math.round((AS_OF - range.start) / 86400000) + 1}
                               stroke={T.textMuted} strokeDasharray="4 4" />
              )}
            </LineChart>
          </ResponsiveContainer>
        );
      })() : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={barData} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={T.chartGrid} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: T.textMuted }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `€${Math.round(v/1000)}K`}
                   tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => `€${Math.round(v/1000).toLocaleString()}K`}
                     contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem} />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={legendBlackFmt} />
            <Bar dataKey="target"  name="Target"  fill={T.hairline}    radius={[3,3,0,0]}>
              <LabelList dataKey="target"  position="top" fontSize={10} fontWeight={600}
                         fill={T.textMuted} formatter={(v) => v ? `€${Math.round(v/1000)}K` : ''} />
            </Bar>
            <Bar dataKey="actuals" name="Actuals" fill={T.pleoPink500} radius={[3,3,0,0]}>
              <LabelList dataKey="actuals" position="top" fontSize={10} fontWeight={600}
                         fill={T.black} formatter={(v) => v ? `€${Math.round(v/1000)}K` : ''} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

// Legacy chart kept for reference — now unused, but useful if the trend view
// ever needs a fallback.
function ArrPaceChart({ data, compact }) {
  // Quarter targets reference. Q2 2026 line is null past day 44 so it stops "today".
  // `compact` shortens labels for the 3-column layout where space is tight.
  return (
    <Card style={{ padding: compact ? 10 : 16 }}>
      <ResponsiveContainer width="100%" height={compact ? 220 : 300}>
        <LineChart data={data.arrPace} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={T.chartGrid} />
          <XAxis dataKey="day_in_q" type="number" domain={[1, 91]}
                 tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false}
                 ticks={compact ? [1, 44, 91] : [1, 15, 30, 44, 60, 75, 91]}
                 tickFormatter={(v) => v === 44 ? 'Today' : `D${v}`} />
          <YAxis tickFormatter={(v) => `€${Math.round(v/1000)}K`}
                 tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => v == null ? '—' : `€${Math.round(v/1000).toLocaleString()}K`}
                   labelFormatter={(d) => `Day ${d} of quarter`}
                   contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem} />
          <Legend wrapperStyle={{ fontSize: 11 }} formatter={legendBlackFmt} />
          <ReferenceLine x={44} stroke={T.textMuted} strokeDasharray="4 4" />
          {/* All three lines stay clean — no per-point dots. The vertical
              reference line at day 44 ("Today") is enough to anchor the eye. */}
          <Line dataKey="q2_2025" name={compact ? "Q2 2025" : "Q2 2025 (same Q LY)"}
                stroke={T.pleoPurple} strokeWidth={2}   dot={false} connectNulls={false} />
          <Line dataKey="q1_2026" name={compact ? "Q1 2026" : "Q1 2026 (last Q)"}
                stroke={T.textMuted} strokeWidth={2}    dot={false} connectNulls={false} />
          <Line dataKey="q2_2026" name={compact ? "Q2 2026" : "Q2 2026 (current)"}
                stroke={T.black}    strokeWidth={2.5}  dot={false} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

// Quarter progress as a full-width banner above three comparison cards.
// The current-period card (Q2 2026) is tinted Pleo pink to anchor the eye;
// the prior-quarter and same-Q-last-year cards stay neutral white.
function PaceInsights({ data }) {
  const m = Object.fromEntries(data.paceCheckpoints.map(r => [r.quarter, r]));
  const q2_now = m['Q2 2026'];
  const q1_chk = m['Q1 2026'];
  const q2_ly  = m['Q2 2025'];

  const Tile = ({ label, value, sub, tinted }) => (
    <div style={{
      background: tinted ? T.pleoPink300 : T.card,
      borderRadius: 10, padding: '10px 12px',
    }}>
      <div style={{ fontSize: 9, color: T.textMuted, textTransform: 'uppercase',
                    letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ ...numStyle, fontSize: T.fontMedium, color: T.black,
                    fontWeight: T.fontWeightSemibold, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4, lineHeight: 1.35 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Quarter progress, full-width above the cards */}
      <div style={{
        background: T.card, borderRadius: 10, padding: '8px 12px',
        display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 9, color: T.textMuted, textTransform: 'uppercase',
                       letterSpacing: '0.08em' }}>Quarter progress</span>
        <span style={{ ...numStyle, fontSize: T.fontMedium, fontWeight: T.fontWeightSemibold,
                       color: T.black, letterSpacing: '-0.01em' }}>
          Week 7 · 48%
        </span>
        <span style={{ fontSize: 11, color: T.textMuted }}>Day 44 of 91</span>
      </div>

      {/* Three comparison cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        <Tile tinted
              label="Q2 2026 · current"
              value={`${q2_now.deals} deals · ${fmtEur(q2_now.arr)}`}
              sub="At day 44 today" />
        <Tile label="Q1 2026 · same day"
              value={`${q1_chk.deals} deal · ${fmtEur(q1_chk.arr)}`}
              sub="Last quarter" />
        <Tile label="Q2 2025 · same day"
              value={`${q2_ly.deals} deal · ${fmtEur(q2_ly.arr)}`}
              sub="Same Q last year" />
      </div>
    </div>
  );
}

// --- Charts (existing, unchanged styling) --------------------------------

function CumulativeArrChart({ data, compact }) {
  const points = data.cumulativeArr.filter(r => r.month <= '2026-06-01');
  return (
    <Card style={{ padding: compact ? 10 : 16 }}>
      <ResponsiveContainer width="100%" height={compact ? 220 : 300}>
        <ComposedChart data={points} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={T.chartGrid} />
          {/* Quarter-aligned ticks read better than 'YYYY-MM' strings — show
              "Jan 24", "Apr 24", … every 3 months. */}
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false}
                 ticks={points.filter(p => {
                   const m = parseInt((p.month || '').substring(5, 7), 10);
                   return [1, 4, 7, 10].includes(m);
                 }).map(p => p.month)}
                 tickFormatter={(v) => {
                   if (!v) return '';
                   const [y, m] = v.split('-');
                   const months = ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                   return `${months[parseInt(m, 10)]} ${y.slice(2)}`;
                 }} />
          <YAxis yAxisId="left"  tickFormatter={(v) => `€${Math.round(v/1000)}K`} tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `€${Math.round(v/1000)}K`} tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => `€${Math.round(v/1000).toLocaleString()}K`} contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem} />
          <Legend wrapperStyle={{ fontSize: 11 }} formatter={legendBlackFmt} />
          <Bar  yAxisId="left"  dataKey="new_arr_eur"        name={compact ? 'New ARR' : 'New ARR booked'} fill={T.hairline} radius={[3,3,0,0]} />
          <Line yAxisId="right" dataKey="cumulative_arr_eur" name={compact ? 'Cumulative' : 'Cumulative (no churn)'} stroke={T.black} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}

function AspBySource({ data, compact }) {
  const rows = data.aspBySource.map(r => ({ ...r, asp_keur: Math.round(r.asp_eur / 1000) }));
  return (
    <Card style={{ padding: compact ? 10 : 16 }}>
      <ResponsiveContainer width="100%" height={compact ? 200 : 250}>
        {/* Y-axis hidden — the data labels above each bar carry the value,
            so the axis ticks were redundant noise. Left margin pulled in
            now that the axis is gone, giving more room for the bars. */}
        <BarChart data={rows} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={T.chartGrid} />
          <XAxis dataKey="demand_source" tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false}
                 tickFormatter={(v) => compact ? v.replace(' Outbound', ' OB').replace('Partnerships', 'Partner') : v} />
          <YAxis hide />
          <Tooltip formatter={(v) => `€${v}K ASP`} contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem} />
          <Bar dataKey="asp_keur" fill={T.black} radius={[4,4,0,0]}>
            <LabelList dataKey="asp_keur" position="top" formatter={(v) => `€${v}K`} fontSize={10} fontWeight={600} fill={T.black} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function VelocityByStage({ data }) {
  return (
    <Card>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart layout="vertical" data={data.velocity} margin={{ top: 8, right: 50, left: 50, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke={T.chartGrid} />
          <XAxis type="number" tick={{ fontSize: 11, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <YAxis dataKey="stage" type="category" tick={{ fontSize: 11, fill: T.textSec }} width={140} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => `${v} days`} contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem} />
          <Bar dataKey="avg_days" fill={T.black} radius={[0,4,4,0]}>
            <LabelList dataKey="avg_days" position="right" formatter={(v) => `${v}d`} fontSize={11} fontWeight={600} fill={T.black} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function StaleBySegmentChart({ data, compact }) {
  const n = compact ? 6 : 10;
  // Shorter label — "UK · MM" instead of "UK · Mid-Market" — lets the YAxis
  // sit on a tighter width so the chart reclaims the left gutter.
  const seg = (s) => ({
    'Mid-Market': 'MM', 'Enterprise': 'Ent', 'SMB': 'SMB',
  })[s] || s;
  const rows = data.staleBySegment.slice(0, n).map(r => ({
    ...r,
    label: `${r.market} · ${seg(r.segment)}`,
  }));
  return (
    <Card style={{ padding: compact ? 10 : 16 }}>
      <ResponsiveContainer width="100%" height={compact ? 220 : 320}>
        <BarChart layout="vertical" data={rows} margin={{ top: 8, right: 40, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke={T.chartGrid} />
          <XAxis type="number" tickFormatter={(v) => `€${v}K`} tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <YAxis dataKey="label" type="category" tick={{ fontSize: 10, fill: T.textSec }} width={compact ? 56 : 72} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => `€${v}K`} contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem} />
          <Bar dataKey="arr_keur" fill={T.black} radius={[0,4,4,0]}>
            <LabelList dataKey="arr_keur" position="right" formatter={(v) => `€${v}K`} fontSize={10} fontWeight={600} fill={T.black} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ── Marketing funnel · bar chart only (no fake outcome link) ──────────────
// Funnel events live in a different table from opportunities, so we can't
// honestly draw flow from "Demo" to "Won" — the two sources don't share a
// primary key. The marketing story (top-of-funnel leakage) belongs here;
// the deal-outcome story lives in the OutcomeSplit component below.
function MarketingFunnel({ data, compact }) {
  const s = data.sankey;
  const rows = [
    { stage: 'Leads', count: s.leads },
    { stage: 'MQL',   count: s.mqls  },
    { stage: 'SQL',   count: s.sqls  },
    { stage: 'Demo',  count: s.demos },
  ].map((r, i, all) => {
    const prev = i > 0 ? all[i-1].count : null;
    return { ...r, conv: (prev && prev > 0) ? Math.round(r.count / prev * 100) : null };
  });
  return (
    <Card style={{ padding: compact ? 10 : 16 }}>
      <ResponsiveContainer width="100%" height={compact ? 220 : 260}>
        <BarChart data={rows} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={T.chartGrid} />
          <XAxis dataKey="stage" tick={{ fontSize: 11, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem} />
          <Bar dataKey="count" fill={T.black} radius={[4,4,0,0]}>
            <LabelList dataKey="count" position="top" fontSize={11} fontWeight={600} fill={T.black} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ fontSize: 10, color: T.textMuted, marginTop: 10,
                    display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 6 }}>
        {rows.slice(1).map((r, i) => (
          <span key={i}>{rows[i].stage} → {r.stage}: <strong style={{ color: T.black }}>{r.conv}%</strong></span>
        ))}
      </div>
    </Card>
  );
}

// ── Outcome split · how 129 created opps ended up ─────────────────────────
// A single horizontal stacked bar tells the story in one glance: most opps
// lose, a quarter are stale, only ~14% are wins.
function OutcomeSplit({ data }) {
  const s = data.sankey;
  const total = s.won + s.lost + s.active + s.stale;
  const items = [
    { key: 'Won',           value: s.won,    fill: T.pleoPink500 },
    { key: 'Lost',          value: s.lost,   fill: T.textMuted   },
    { key: 'Open · Stale',  value: s.stale,  fill: T.negative    },
    { key: 'Open · Active', value: s.active, fill: T.pleoPink300 },
  ];
  return (
    <div style={{
      background: T.card, borderRadius: 12, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase',
                    letterSpacing: '0.08em' }}>
        Deal outcomes · all-time · {total} opps created
      </div>
      <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden' }}>
        {items.map((it, i) => (
          <div key={i} title={`${it.key}: ${it.value} (${Math.round(it.value/total*100)}%)`}
               style={{ flex: it.value, background: it.fill }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 4 }}>
        {items.map((it, i) => (
          <div key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10,
                          color: T.textMuted, letterSpacing: '0.04em', marginBottom: 2 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: it.fill }} />
              {it.key}
            </div>
            <div style={{ ...numStyle, fontSize: T.fontLarge, fontWeight: T.fontWeightSemibold,
                          color: T.black, letterSpacing: '-0.01em', lineHeight: 1.1 }}>
              {it.value}
            </div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>
              {Math.round(it.value/total*100)}% of total
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Marketing Funnel & Deal Outcomes · filterable, side-by-side ────────────
// One component, two charts, one shared period selector. The funnel chart
// sums monthly lead/MQL/SQL/Demo events in the selected period; the outcomes
// chart counts opps created in the same period and the outcomes they ended
// up at (Won / Lost / Open Active / Open Stale).
//
// Outcomes render as a vertical stacked column with cards stacked to the
// right — same numbers as the previous horizontal version, but the side-
// by-side layout makes the call-out cards easier to scan.
function MarketingAndOutcomes({ data, compact }) {
  const [period, setPeriod] = useState('quarter');
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState(new Set()); // demand-source pivot
  const isAll = period === 'all';
  const setPeriodSafe = (p) => {
    setPeriod(p); setOffset(0); setExpanded(new Set());
  };
  const toggleSource = (name) => {
    const next = new Set(expanded);
    next.has(name) ? next.delete(name) : next.add(name);
    setExpanded(next);
  };

  // ── Funnel + outcomes aggregation (shared filter state) ─────────────────
  const range = !isAll ? getPeriodRange(period, offset) : null;
  const inRange = (mstr) => {
    if (isAll) return true;
    const md = parseISODate(mstr);
    return md >= range.start && md <= range.end;
  };
  const monthly = data.sankeyMonthly || [];
  const filtered = monthly.filter(r => inRange(r.month));
  const sum = (k) => filtered.reduce((a, r) => a + (r[k] || 0), 0);
  const s = {
    leads: sum('leads'), mqls: sum('mqls'), sqls: sum('sqls'), demos: sum('demos'),
    won:   sum('won'),   lost: sum('lost'),
    active: sum('active'), stale: sum('stale'),
  };

  // ── Source × segment aggregation (same filter) ──────────────────────────
  // Sum per (source, segment) over the rows in the period, then aggregate
  // parents from their children so totals are consistent.
  //
  // IMPORTANT: leads / opps come from the funnel-events fact, but Won /
  // Won ARR come from fct_opportunities (data.oppsWonMonthly). The two
  // facts drift in the synthetic dataset — funnel.won records "win events"
  // that don't always have a matching row in fct_opportunities. Reading
  // wins from the opp fact reconciles this column with the hero, the
  // Performance table, and the pace chart.
  const sourceMonthly = data.funnelBySourceMonthly || [];
  const sourceFiltered = sourceMonthly.filter(r => inRange(r.month));
  const childMap = new Map(); // key = source|segment
  for (const r of sourceFiltered) {
    const k = `${r.demand_source}__${r.segment}`;
    if (!childMap.has(k)) childMap.set(k, {
      demand_source: r.demand_source, segment: r.segment,
      leads: 0, opps: 0, won: 0, won_arr_eur: 0,
    });
    const e = childMap.get(k);
    e.leads += r.leads || 0;
    e.opps  += r.opps  || 0;
    // funnel.won / funnel.won_arr_eur intentionally NOT accumulated here
  }

  // Overlay reconciled wins from fct_opportunities for the same period.
  // Creates missing (source, segment) keys if a win exists with no
  // corresponding funnel-event row.
  const oppsMonthly = data.oppsWonMonthly || [];
  const oppsFiltered = oppsMonthly.filter(r => inRange(r.month));
  for (const r of oppsFiltered) {
    const k = `${r.demand_source}__${r.segment}`;
    if (!childMap.has(k)) childMap.set(k, {
      demand_source: r.demand_source, segment: r.segment,
      leads: 0, opps: 0, won: 0, won_arr_eur: 0,
    });
    const e = childMap.get(k);
    e.won         += r.won || 0;
    e.won_arr_eur += r.won_arr_eur || 0;
  }
  const bySource = {};
  for (const c of childMap.values()) {
    (bySource[c.demand_source] = bySource[c.demand_source] || []).push(c);
  }
  const sourceParents = Object.entries(bySource).map(([source, children]) => {
    const psum = (k) => children.reduce((a, r) => a + (r[k] || 0), 0);
    const leads = psum('leads'), won = psum('won');
    return {
      name:        source,
      segment:     '—',
      leads, opps: psum('opps'), won,
      won_keur:    Math.round(psum('won_arr_eur') / 1000),
      lead_to_won: leads > 0 ? Math.round(won / leads * 1000) / 10 : null,
      kind:        'parent',
      children:    children.map(c => ({
        ...c,
        won_keur:    Math.round((c.won_arr_eur || 0) / 1000),
        lead_to_won: c.leads > 0 ? Math.round(c.won / c.leads * 1000) / 10 : null,
      })),
    };
  });
  sourceParents.sort((a, b) => (b.lead_to_won ?? -1) - (a.lead_to_won ?? -1));
  const sourceVisible = [];
  for (const p of sourceParents) {
    sourceVisible.push(p);
    if (expanded.has(p.name)) {
      for (const c of p.children) sourceVisible.push({ ...c, kind: 'child' });
    }
  }
  const bestSource = sourceParents.find(p => p.lead_to_won != null);

  // Period bounds — same idea as PerformanceTabs.
  const minOffset = period === 'quarter' ? -8 : period === 'month' ? -28 : -2;
  const canPrev = !isAll && offset > minOffset;
  const canNext = !isAll && offset < 0;

  const PillBtn = ({ active, onClick, children }) => (
    <button onClick={onClick}
      style={{
        border: 'none', cursor: 'pointer', borderRadius: 999,
        padding: compact ? '5px 12px' : '6px 14px', fontSize: 11,
        fontFamily: T.font,
        fontWeight: active ? T.fontWeightSemibold : T.fontWeightRegular,
        background: active ? T.black : 'transparent',
        color:      active ? '#FFF'   : T.textMuted,
        transition: 'all 150ms ease-out',
      }}>{children}</button>
  );
  const Arrow = ({ disabled, onClick, children }) => (
    <button onClick={onClick} disabled={disabled}
      style={{
        border: 'none', background: 'transparent',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? T.hairline : T.textMuted, fontSize: 14,
        width: 24, height: 24, borderRadius: 999, padding: 0,
      }}>{children}</button>
  );

  // ── Funnel bar chart ─────────────────────────────────────────────────────
  const funnelRows = [
    { stage: 'Leads', count: s.leads },
    { stage: 'MQL',   count: s.mqls  },
    { stage: 'SQL',   count: s.sqls  },
    { stage: 'Demo',  count: s.demos },
  ].map((r, i, all) => {
    const prev = i > 0 ? all[i-1].count : null;
    return { ...r, conv: (prev && prev > 0) ? Math.round(r.count / prev * 100) : null };
  });

  // ── Outcomes vertical bar ────────────────────────────────────────────────
  // Pleo brand palette only. Order = bottom → top in the bar, which matches
  // the natural funnel: Won (the goal, bottom) up to Lost (the final state).
  const outcomes = [
    { key: 'Won',    value: s.won,    fill: T.pleoPink500 },
    { key: 'Active', value: s.active, fill: T.pleoGreen   },
    { key: 'Stale',  value: s.stale,  fill: T.pleoYellow  },
    { key: 'Lost',   value: s.lost,   fill: T.pleoPurple  },
  ];
  const totalOpps = outcomes.reduce((a, o) => a + o.value, 0);

  const periodLabel = isAll ? 'All time' : range.label;

  return (
    // White surface wraps the whole section: filter toolbar at the top,
    // hairline divider, then the three sub-sections (funnel · outcomes ·
    // source × segment table). All three respond to the same filter.
    <div style={{ background: T.card, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center',
                    gap: 8, padding: '10px 12px',
                    borderBottom: `1px solid ${T.hairline}` }}>
        <div style={{ display: 'inline-flex', gap: 2, background: T.panel,
                      padding: 2, borderRadius: 999 }}>
          <PillBtn active={period === 'month'}   onClick={() => setPeriodSafe('month')}>Month</PillBtn>
          <PillBtn active={period === 'quarter'} onClick={() => setPeriodSafe('quarter')}>Quarter</PillBtn>
          <PillBtn active={period === 'year'}    onClick={() => setPeriodSafe('year')}>Year</PillBtn>
          <PillBtn active={period === 'all'}     onClick={() => setPeriodSafe('all')}>All time</PillBtn>
        </div>
        <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          <Arrow disabled={!canPrev} onClick={() => canPrev && setOffset(offset - 1)}>‹</Arrow>
          <span style={{ ...numStyle, fontSize: 12, fontWeight: T.fontWeightMedium,
                         color: T.black, minWidth: 80, textAlign: 'center' }}>
            {periodLabel}
          </span>
          <Arrow disabled={!canNext} onClick={() => canNext && setOffset(offset + 1)}>›</Arrow>
        </div>
      </div>

      <div style={{ padding: 12 }}>
      {/* Side-by-side charts. Auto-fit so they stack on narrow viewports. */}
      <div style={{ display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: 12 }}>

        {/* ── Marketing funnel ──────────────────────────────────────────── */}
        <div>
          <SectionH meta="Funnel events">Marketing funnel</SectionH>
          <Card style={{ padding: 10 }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={funnelRows} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={T.chartGrid} />
                <XAxis dataKey="stage" tick={{ fontSize: 11, fill: T.textMuted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem} />
                <Bar dataKey="count" fill={T.black} radius={[4,4,0,0]}>
                  <LabelList dataKey="count" position="top" fontSize={11} fontWeight={600} fill={T.black} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 10,
                          display: 'flex', justifyContent: 'space-around',
                          flexWrap: 'wrap', gap: 6 }}>
              {funnelRows.slice(1).map((r, i) => (
                <span key={i}>{funnelRows[i].stage} → {r.stage}: <strong style={{ color: T.black }}>{r.conv == null ? '—' : `${r.conv}%`}</strong></span>
              ))}
            </div>
          </Card>
          <FindingBox>
            {s.leads === 0 ? (
              <>No funnel events in this period.</>
            ) : (
              <>
                Top-of-funnel volume: <strong style={{ color: T.black }}>{s.leads.toLocaleString()} leads</strong>{' '}
                → {s.demos.toLocaleString()} demos.
                {' '}Biggest leak between{' '}
                {(() => {
                  const drops = funnelRows.slice(1)
                    .map((r, i) => ({ pair: `${funnelRows[i].stage} → ${r.stage}`, conv: r.conv ?? 100 }))
                    .filter(d => d.conv != null);
                  if (!drops.length) return 'stages';
                  const min = drops.reduce((a, b) => b.conv < a.conv ? b : a);
                  return <strong style={{ color: T.black }}>{min.pair}</strong>;
                })()}.
              </>
            )}
          </FindingBox>
        </div>

        {/* ── Outcomes vertical bar + side cards ────────────────────────── */}
        <div>
          <SectionH meta={`${totalOpps} opps created`}>Deal outcomes</SectionH>
          <Card style={{ padding: 14 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'stretch',
                          minHeight: 220 }}>
              {/* Vertical stacked column — same data as the previous horizontal
                  bar, just rotated. Bottom = Won (the goal), top = Lost. */}
              <div style={{
                width: 48,
                display: 'flex', flexDirection: 'column-reverse',
                background: T.panel, borderRadius: 8, overflow: 'hidden',
              }}>
                {outcomes.map((o, i) => (
                  <div key={i}
                       title={`${o.key}: ${o.value} (${totalOpps > 0 ? Math.round(o.value/totalOpps*100) : 0}%)`}
                       style={{ flex: o.value || 0.001, background: o.fill,
                                minHeight: o.value > 0 ? 2 : 0 }} />
                ))}
              </div>
              {/* Cards stacked beside the bar — rendered top-down in REVERSE
                  outcomes order so each card sits next to its bar band:
                  Lost (top) · Stale · Active · Won (bottom). */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
                            justifyContent: 'space-between', gap: 6 }}>
                {[...outcomes].reverse().map((o, i) => {
                  const pct = totalOpps > 0 ? Math.round(o.value/totalOpps*100) : 0;
                  return (
                    <div key={i} style={{
                      background: T.panel, borderRadius: 8, padding: '8px 10px',
                      display: 'grid', gridTemplateColumns: 'auto 1fr auto',
                      gap: 10, alignItems: 'center',
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: o.fill }} />
                      <span style={{ fontSize: 11, color: T.textSec,
                                     fontWeight: T.fontWeightMedium }}>{o.key}</span>
                      <span style={{ ...numStyle, fontSize: 13, color: T.black,
                                     fontWeight: T.fontWeightSemibold }}>
                        {o.value} · {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
          <FindingBox>
            {totalOpps === 0 ? (
              <>No opportunities created in this period.</>
            ) : (
              <>
                <strong style={{ color: T.black }}>
                  {Math.round((s.lost / totalOpps) * 100)}% of deals are lost
                </strong>{' '}and{' '}
                {Math.round((s.stale / totalOpps) * 100)}% are silently stale.
                Combined leakage is the biggest single drag on attainment.
              </>
            )}
          </FindingBox>
        </div>

      </div>

      {/* ── 3rd section: By demand source × segment ──────────────────────────
          Same period filter as the two charts above. Click a source row to
          expand its segments. One insight below names the highest-converting
          source for the selected period. */}
      <div style={{ marginTop: 16 }}>
        <SectionH meta="Click a source to expand by segment">By demand source × segment</SectionH>
        <Table
          dense
          headers={[
            { key: 'name',  label: 'Source / Segment' },
            { key: 'leads', label: 'Leads', align: 'right', numeric: true },
            { key: 'opps',  label: 'Opps',  align: 'right', numeric: true },
            { key: 'won',   label: 'Won',   align: 'right', numeric: true, bold: true },
            { key: 'won_keur',    label: 'Won ARR', align: 'right', numeric: true },
            { key: 'lead_to_won', label: 'L→W',     align: 'right' },
          ]}
          rows={sourceVisible}
          formatters={{
            name: (v, r) => {
              if (r.kind === 'child') return (
                <span style={{ paddingLeft: 16, color: T.textMuted, fontWeight: T.fontWeightRegular }}>
                  ↳ {r.segment}
                </span>
              );
              const open = expanded.has(v);
              return (
                <button onClick={() => toggleSource(v)}
                  style={{
                    border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
                    fontFamily: T.font, fontSize: 'inherit', color: T.black,
                    fontWeight: T.fontWeightSemibold,
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                  <span style={{ display: 'inline-block', width: 10, color: T.textMuted, fontSize: 10 }}>
                    {open ? '▾' : '▸'}
                  </span>
                  {v}
                </button>
              );
            },
            won_keur:    (v) => v ? `€${v}K` : '—',
            lead_to_won: (v) =>
              v == null ? '—' :
              <Pill kind={v >= 20 ? 'positive' : v >= 10 ? 'neutral' : 'negative'}>{v}%</Pill>,
          }}
        />
        <FindingBox>
          {sourceParents.length === 0 || !bestSource ? (
            <>No funnel events in this period.</>
          ) : (
            <>
              <strong style={{ color: T.black }}>{bestSource.name}</strong> leads the period on
              conversion — <strong style={{ color: T.black }}>{bestSource.lead_to_won}%</strong>{' '}
              lead-to-won — driving €{bestSource.won_keur}K closed-won ARR from{' '}
              {bestSource.leads.toLocaleString()} leads.
            </>
          )}
        </FindingBox>
      </div>
      </div>
    </div>
  );
}

// Legacy Sankey kept for reference but unused — the Demo→Opps link was
// dishonest (different data sources, different time windows).
function FunnelSankey({ data, compact }) {
  const s = data.sankey;
  const oppTotal = s.won + s.lost + s.active + s.stale;
  const nodes = [
    { name: `Leads (${s.leads})` },     // 0
    { name: `MQL (${s.mqls})` },         // 1
    { name: `SQL (${s.sqls})` },         // 2
    { name: `Demo (${s.demos})` },       // 3
    { name: `Opps (${oppTotal})` },     // 4
    { name: `Won (${s.won})` },          // 5
    { name: `Lost (${s.lost})` },        // 6
    { name: `Open · Active (${s.active})` },  // 7
    { name: `Open · Stale (${s.stale})` },    // 8
  ];
  const links = [
    { source: 0, target: 1, value: s.mqls },
    { source: 1, target: 2, value: s.sqls },
    { source: 2, target: 3, value: s.demos },
    { source: 3, target: 4, value: oppTotal },
    { source: 4, target: 5, value: s.won },
    { source: 4, target: 6, value: s.lost },
    { source: 4, target: 7, value: s.active },
    { source: 4, target: 8, value: s.stale },
  ].filter(l => l.value > 0);

  // Per-node fill colour: pink for "Won", soft pink for the active opps,
  // a darker grey for "Stale" to signal the risk, and quiet grey elsewhere.
  const nodeColour = (i) => {
    if (i === 5) return T.pleoPink500;   // Won
    if (i === 7) return T.pleoPink300;   // Active
    if (i === 8) return T.negative;      // Stale (red)
    if (i === 6) return T.textMuted;     // Lost (grey)
    return T.black;                       // funnel stages
  };

  const SankeyNode = (props) => {
    const { x, y, width, height, index, payload } = props;
    return (
      <Layer key={`n${index}`}>
        <Rectangle x={x} y={y} width={width} height={height} fill={nodeColour(index)}
                   fillOpacity={index <= 4 ? 0.9 : 1} />
        <text x={index < nodes.length / 2 ? x + width + 6 : x - 6}
              y={y + height / 2}
              textAnchor={index < nodes.length / 2 ? 'start' : 'end'}
              dominantBaseline="middle"
              style={{ fontFamily: T.font, fontSize: 11, fill: T.black,
                       fontWeight: T.fontWeightMedium }}>
          {payload.name}
        </text>
      </Layer>
    );
  };

  // Stage conversion text strip — same numbers as the old funnel chart had
  // underneath. Useful context next to the visual story.
  const conv = (a, b) => a > 0 ? Math.round(b / a * 100) : null;
  const drops = [
    ['Leads → MQL', conv(s.leads, s.mqls)],
    ['MQL → SQL',   conv(s.mqls, s.sqls)],
    ['SQL → Demo',  conv(s.sqls, s.demos)],
    ['Opps → Won',  conv(oppTotal, s.won)],
  ];

  return (
    <Card style={{ padding: compact ? 10 : 16 }}>
      <ResponsiveContainer width="100%" height={compact ? 280 : 340}>
        <Sankey data={{ nodes, links }} nodeWidth={8} nodePadding={18}
                node={<SankeyNode />}
                link={{ stroke: T.hairline, strokeOpacity: 0.4, fill: T.hairline, fillOpacity: 0.35 }}
                margin={{ top: 6, right: 110, left: 6, bottom: 6 }}>
          <Tooltip contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem} />
        </Sankey>
      </ResponsiveContainer>
      <div style={{ fontSize: 10, color: T.textMuted, marginTop: 8,
                    display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 6 }}>
        {drops.map(([label, val], i) => (
          <span key={i}>{label}: <strong style={{ color: T.black }}>{val == null ? '—' : `${val}%`}</strong></span>
        ))}
      </div>
    </Card>
  );
}

function FunnelChart({ data, compact }) {
  const rows = data.funnel.map((r, i) => {
    const prev = i > 0 ? data.funnel[i - 1].count : null;
    const conv = (prev && prev > 0) ? Math.round(r.count / prev * 100) : null;
    return { ...r, conv };
  });
  return (
    <Card style={{ padding: compact ? 10 : 16 }}>
      <ResponsiveContainer width="100%" height={compact ? 220 : 260}>
        <BarChart data={rows} margin={{ top: 20, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={T.chartGrid} />
          <XAxis dataKey="stage" tick={{ fontSize: 11, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem} />
          <Bar dataKey="count" radius={[4,4,0,0]}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.stage === 'Won' ? T.pleoGreen : T.black} />
            ))}
            <LabelList dataKey="count" position="top" fontSize={10} fontWeight={600} fill={T.black} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ fontSize: 10, color: T.textMuted, marginTop: 10,
                    display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 6 }}>
        {rows.slice(1).map((r, i) => (
          <span key={i}>{rows[i].stage}→{r.stage}: <strong style={{ color: T.black }}>{r.conv}%</strong></span>
        ))}
      </div>
    </Card>
  );
}

// Pipeline-quality chart pair, tabbed so two related cuts share one slot.
// Tab 1 (default): the existing Slippage-rate + Stale-concentration grid.
// Tab 2: Velocity (minimal table) + ASP (existing bar chart). Velocity is
// presented as a table because the data is short and dense, and Velocity by
// Stage is best read as numbers — the avg-days values and stuck-deal counts
// matter more than the shape.
function PipelineQualityCharts({ data }) {
  const [tab, setTab] = useState('slip');
  const tabs = [
    { key: 'slip', label: 'Slippage & Stale'  },
    { key: 'vel',  label: 'Velocity & ASP' },
  ];
  const TabBtn = ({ k, children }) => (
    <button onClick={() => setTab(k)}
      style={{
        border: 'none', cursor: 'pointer', borderRadius: 999,
        padding: '6px 14px', fontSize: 12, fontFamily: T.font,
        fontWeight: tab === k ? T.fontWeightSemibold : T.fontWeightRegular,
        background: tab === k ? T.black : 'transparent',
        color:      tab === k ? '#FFF'   : T.textMuted,
        transition: 'all 150ms ease-out',
      }}>{children}</button>
  );

  // Velocity table — sorted desc by avg_days so the worst stage tops the list.
  const velocityRows = [...(data.velocity || [])]
    .sort((a, b) => (b.avg_days || 0) - (a.avg_days || 0));

  return (
    // Tab strip + content share one white surface — full-width toolbar at
    // the top, hairline divider, content below. Filters now read as part of
    // the chart card instead of floating on the panel above it.
    <div style={{ background: T.card, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center',
                    padding: '10px 12px',
                    borderBottom: `1px solid ${T.hairline}` }}>
        <div style={{ display: 'inline-flex', gap: 2, background: T.panel,
                      padding: 2, borderRadius: 999 }}>
          {tabs.map(t => <TabBtn key={t.key} k={t.key}>{t.label}</TabBtn>)}
        </div>
      </div>

      <div style={{ padding: 12 }}>
      {tab === 'slip' && (
        <div style={{ display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: 12 }}>
          <div>
            <SectionH meta="Last 9 months">Slippage rate</SectionH>
            <SlippageTrendChart data={data} compact />
            <FindingBox>
              Slip rate has gone from <strong style={{ color: T.black }}>0% to 19%</strong> in four months.
            </FindingBox>
          </div>

          <div>
            <SectionH meta="Top 6 cells">Stale concentration</SectionH>
            <StaleBySegmentChart data={data} compact />
            <FindingBox>
              UK + NL Mid-Market = <strong style={{ color: T.black }}>37% of all stale ARR</strong>.
            </FindingBox>
          </div>
        </div>
      )}

      {tab === 'vel' && (
        <div style={{ display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: 12 }}>
          <div>
            <SectionH meta="Open opps · avg days in current stage">Velocity</SectionH>
            {/* Minimal table — just stage, avg days, open deal count.
                minWidth=0 lets it shrink to fit narrow columns; the
                inner table still distributes its 3 columns evenly. */}
            <Table
              dense
              minWidth={0}
              headers={[
                { key: 'stage',    label: 'Stage',  bold: true },
                { key: 'avg_days', label: 'Avg days', align: 'right', numeric: true },
                { key: 'opps',     label: 'Open',     align: 'right', numeric: true },
              ]}
              rows={velocityRows}
              formatters={{
                avg_days: (v) => v == null ? '—' : `${Math.round(v)}d`,
              }}
            />
            <FindingBox>
              Initial Meeting and Qualified stages average <strong style={{ color: T.black }}>80+ days</strong>{' '}
              — many open deals have already spent their entire allotted cycle in one early stage.
            </FindingBox>
          </div>

          <div>
            <SectionH meta="Closed-won · all-time">ASP by demand source</SectionH>
            <AspBySource data={data} compact />
            <FindingBox>
              <strong style={{ color: T.black }}>Partnerships and Marketing</strong>{' '}
              produce 2–3× larger contracts (€93K and €68K vs €32K for SDR / AE Outbound).
            </FindingBox>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function SlippageTrendChart({ data, compact }) {
  // Show only YYYY-MM from the date string in compact mode.
  const trend = compact
    ? data.slippageTrend.map(r => ({ ...r, snapshot_month: (r.snapshot_month || '').substring(0, 7) }))
    : data.slippageTrend;
  return (
    <Card style={{ padding: compact ? 10 : 16 }}>
      <ResponsiveContainer width="100%" height={compact ? 220 : 260}>
        <ComposedChart data={trend} margin={{ top: 16, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={T.chartGrid} />
          <XAxis dataKey="snapshot_month" tick={{ fontSize: 9, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" tickFormatter={(v) => `€${v}K`} tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
          {/* Right axis is hidden — slip-rate values are shown as inline data
              labels above each line point so the chart reads cleaner. */}
          <YAxis yAxisId="right" orientation="right" hide />
          <Tooltip contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem} />
          <Legend wrapperStyle={{ fontSize: 11 }} formatter={legendBlackFmt} />
          <Bar  yAxisId="left"  dataKey="slipped_keur" name="Slipped ARR" fill={T.hairline} radius={[3,3,0,0]} />
          <Line yAxisId="right" dataKey="slip_rate"   name="Slip rate %" stroke={T.black} strokeWidth={2} dot={{ r: 2.5, fill: T.black }}>
            <LabelList dataKey="slip_rate" position="top" formatter={(v) => `${Math.round(v)}%`}
                       fontSize={10} fontWeight={600} fill={T.black} />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}

// --- Performance tabbed table --------------------------------------------

// ── ActivitySection · weekly stacked + per-rep, with shared filter ─────────
// Wraps both activity charts so a single period selector (Month / Quarter /
// Year / All time + prev/next) controls them simultaneously. Aggregates the
// raw (week × rep × type) rows in `data.activityRaw` into the two views.
function ActivitySection({ data }) {
  const [period, setPeriod] = useState('quarter');
  const [offset, setOffset] = useState(0);
  const isAll = period === 'all';
  const setPeriodSafe = (p) => { setPeriod(p); setOffset(0); };

  const range = !isAll ? getPeriodRange(period, offset) : null;
  const minOffset = period === 'quarter' ? -8 : period === 'month' ? -28 : -2;
  const canPrev = !isAll && offset > minOffset;
  const canNext = !isAll && offset < 0;

  const raw = data.activityRaw || [];
  const inRange = (wstr) => {
    if (isAll) return true;
    const wd = parseISODate(wstr);
    return wd >= range.start && wd <= range.end;
  };
  const filtered = raw.filter(r => inRange(r.week));

  // Weekly stacked: pivot (week × type) → wide rows {week, Email, Call, ...}
  const weeklyMap = new Map();
  for (const r of filtered) {
    if (!weeklyMap.has(r.week)) weeklyMap.set(r.week, { week: r.week });
    const w = weeklyMap.get(r.week);
    w[r.type] = (w[r.type] || 0) + r.cnt;
  }
  const weekly = Array.from(weeklyMap.values())
                      .sort((a, b) => a.week.localeCompare(b.week));

  // Per-rep aggregation. Keep every rep so reps with zero activity in the
  // period still appear (so the "zero-activity reps" insight stays honest).
  const repMap = new Map();
  for (const r of raw) {
    if (!repMap.has(r.rep_id)) repMap.set(r.rep_id, {
      rep_id: r.rep_id, rep_name: r.rep_name, activities: 0,
    });
  }
  for (const r of filtered) {
    if (!repMap.has(r.rep_id)) repMap.set(r.rep_id, {
      rep_id: r.rep_id, rep_name: r.rep_name, activities: 0,
    });
    repMap.get(r.rep_id).activities += r.cnt;
  }
  const perRep = Array.from(repMap.values())
                      .sort((a, b) => a.activities - b.activities ||
                                       a.rep_name.localeCompare(b.rep_name));
  const zeros = perRep.filter(r => r.activities === 0).length;
  const periodLabel = isAll ? 'All time' : range.label;

  const TYPES = [
    { key: 'Email',    fill: T.pleoBlueSoft },
    { key: 'Call',     fill: T.pleoYellow   },
    { key: 'LinkedIn', fill: T.pleoPurple   },
    { key: 'Meeting',  fill: T.pleoGreen    },
    { key: 'Demo',     fill: T.pleoPink500  },
  ];

  const PillBtn = ({ active, onClick, children }) => (
    <button onClick={onClick}
      style={{
        border: 'none', cursor: 'pointer', borderRadius: 999,
        padding: '5px 12px', fontSize: 11, fontFamily: T.font,
        fontWeight: active ? T.fontWeightSemibold : T.fontWeightRegular,
        background: active ? T.black : 'transparent',
        color:      active ? '#FFF'   : T.textMuted,
        transition: 'all 150ms ease-out',
      }}>{children}</button>
  );
  const Arrow = ({ disabled, onClick, children }) => (
    <button onClick={onClick} disabled={disabled}
      style={{
        border: 'none', background: 'transparent',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? T.hairline : T.textMuted, fontSize: 14,
        width: 24, height: 24, borderRadius: 999, padding: 0,
      }}>{children}</button>
  );

  const max = Math.max(1, ...perRep.map(r => r.activities));

  return (
    <div style={{ background: T.card, borderRadius: 12, overflow: 'hidden' }}>
      {/* Shared filter toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center',
                    gap: 8, padding: '10px 12px',
                    borderBottom: `1px solid ${T.hairline}` }}>
        <div style={{ display: 'inline-flex', gap: 2, background: T.panel,
                      padding: 2, borderRadius: 999 }}>
          <PillBtn active={period === 'month'}   onClick={() => setPeriodSafe('month')}>Month</PillBtn>
          <PillBtn active={period === 'quarter'} onClick={() => setPeriodSafe('quarter')}>Quarter</PillBtn>
          <PillBtn active={period === 'year'}    onClick={() => setPeriodSafe('year')}>Year</PillBtn>
          <PillBtn active={period === 'all'}     onClick={() => setPeriodSafe('all')}>All time</PillBtn>
        </div>
        <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          <Arrow disabled={!canPrev} onClick={() => canPrev && setOffset(offset - 1)}>‹</Arrow>
          <span style={{ ...numStyle, fontSize: 12, fontWeight: T.fontWeightMedium,
                         color: T.black, minWidth: 80, textAlign: 'center' }}>
            {periodLabel}
          </span>
          <Arrow disabled={!canNext} onClick={() => canNext && setOffset(offset + 1)}>›</Arrow>
        </div>
      </div>

      <div style={{ padding: 12 }}>
        {/* Volume chart — X-axis shows one tick per calendar month using
            month-name labels (e.g., "May 26"), same pattern as the historical
            pace chart. Removes the dense "MM-DD" wall of dates. */}
        {(() => {
          const MONTHS = ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          const monthTicks = [];
          const seen = new Set();
          for (const w of weekly) {
            const yyyymm = (w.week || '').substring(0, 7);
            if (seen.has(yyyymm)) continue;
            seen.add(yyyymm);
            monthTicks.push(w.week);
          }
          const tickFmt = (v) => {
            if (!v) return '';
            const [y, m] = v.split('-');
            return `${MONTHS[parseInt(m, 10)]} ${y.slice(2)}`;
          };
          return (
            <>
              <SectionH meta="Stacked by activity type">Activity volume</SectionH>
              <div style={{ background: T.card }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={weekly} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={T.chartGrid} />
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: T.textMuted }}
                           axisLine={false} tickLine={false}
                           ticks={monthTicks} tickFormatter={tickFmt} />
                    <YAxis tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem}
                             labelFormatter={(v) => {
                               const [y, m, d] = (v || '').split('-');
                               return `${MONTHS[parseInt(m, 10)]} ${parseInt(d, 10)}, ${y}`;
                             }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} formatter={legendBlackFmt} />
                    {TYPES.map(t => (
                      <Bar key={t.key} dataKey={t.key} stackId="a" fill={t.fill} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          );
        })()}

        {/* Per-rep — same horizontal bars as before, but filtered + sorted */}
        <SectionH meta={`${perRep.length} reps · ${zeros} with zero activity`}>Activity by rep</SectionH>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {perRep.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
              <span style={{ width: 100, color: T.textSec, whiteSpace: 'nowrap',
                             overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.rep_name}
              </span>
              <div style={{ flex: 1, height: 6, background: T.hairline,
                            borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${(r.activities / max) * 100}%`, height: '100%',
                  background: r.activities === 0 ? T.negative
                            : r.activities < 2  ? T.pleoPink400
                            : T.black,
                }} />
              </div>
              <span style={{ ...numStyle, width: 32, textAlign: 'right',
                             color: T.black, fontWeight: T.fontWeightMedium }}>
                {r.activities}
              </span>
            </div>
          ))}
        </div>

        <FindingBox>
          <strong style={{ color: T.black }}>
            {zeros} of {perRep.length} reps logged zero activities
          </strong>{' '}in this period — strongly correlates with the stale-pipeline concentration in Pipeline Quality.
        </FindingBox>
      </div>
    </div>
  );
}

// ── Activity volume — weekly stacked + per-rep last 4w ─────────────────────
function ActivityWeeklyChart({ data, compact }) {
  // Pivot the long-format weekly rows into wide form keyed by activity type.
  const rows = [];
  const byWeek = new Map();
  for (const r of data.activity.weekly) {
    if (!byWeek.has(r.week)) byWeek.set(r.week, { week: r.week });
    byWeek.get(r.week)[r.type] = r.cnt;
  }
  for (const [, v] of byWeek) rows.push(v);
  rows.sort((a, b) => a.week.localeCompare(b.week));

  // Pleo brand palette. Pink reserved for Demos (highest-intent activity);
  // other touch types use the remaining brand colours so each band reads
  // distinctly in the stack.
  const TYPES = [
    { key: 'Email',    fill: T.pleoBlueSoft },
    { key: 'Call',     fill: T.pleoYellow   },
    { key: 'LinkedIn', fill: T.pleoPurple   },
    { key: 'Meeting',  fill: T.pleoGreen    },
    { key: 'Demo',     fill: T.pleoPink500  },
  ];

  return (
    <Card style={{ padding: compact ? 10 : 16 }}>
      <ResponsiveContainer width="100%" height={compact ? 220 : 260}>
        <BarChart data={rows} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={T.chartGrid} />
          <XAxis dataKey="week" tick={{ fontSize: 9, fill: T.textMuted }} axisLine={false} tickLine={false}
                 tickFormatter={(v) => (v || '').substring(5)} interval={1} />
          <YAxis tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem} />
          <Legend wrapperStyle={{ fontSize: 10 }} formatter={legendBlackFmt} />
          {TYPES.map(t => (
            <Bar key={t.key} dataKey={t.key} stackId="a" fill={t.fill} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function ActivityByRep({ data }) {
  const rows = data.activity.perRep;
  const zeros = rows.filter(r => r.activities === 0).length;
  const max = Math.max(1, ...rows.map(r => r.activities));
  return (
    <div style={{
      background: T.card, borderRadius: 12, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>
        Last 4 weeks · {rows.length} reps · {zeros} with zero activity
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
          <span style={{ width: 100, color: T.textSec, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {r.rep_name}
          </span>
          <div style={{ flex: 1, height: 6, background: T.hairline, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${(r.activities / max) * 100}%`, height: '100%',
              background: r.activities === 0 ? T.negative : (r.activities < 2 ? T.pleoPink400 : T.black),
            }} />
          </div>
          <span style={{ ...numStyle, width: 24, textAlign: 'right',
                         color: r.activities === 0 ? T.negative : T.black,
                         fontWeight: T.fontWeightMedium }}>{r.activities}</span>
        </div>
      ))}
    </div>
  );
}

// Funnel pivot — demand source parents expand to their segment children.
// Parents are derived in JS from the per-(source,segment) rows so totals stay
// consistent (sum-of-rows lead_to_won = total won / total leads, not avg %).
function FunnelSourcePivot({ data }) {
  const [expanded, setExpanded] = useState(new Set());
  const toggle = (name) => {
    const next = new Set(expanded);
    next.has(name) ? next.delete(name) : next.add(name);
    setExpanded(next);
  };

  // Group children by demand_source.
  const bySource = {};
  for (const r of data.funnelBySource) {
    (bySource[r.demand_source] = bySource[r.demand_source] || []).push(r);
  }
  // Build parent rows by summing children.
  const parents = Object.entries(bySource).map(([source, children]) => {
    const sum = (k) => children.reduce((a, r) => a + (r[k] || 0), 0);
    const leads = sum('leads'), won = sum('won');
    return {
      name:        source,
      segment:     '—',
      leads, opps: sum('opps'), won,
      won_keur:    sum('won_keur'),
      lead_to_won: leads > 0 ? Math.round(won / leads * 1000) / 10 : null,
      kind: 'parent',
      children,
    };
  });
  parents.sort((a, b) => (b.lead_to_won ?? -1) - (a.lead_to_won ?? -1));

  const visible = [];
  for (const p of parents) {
    visible.push(p);
    if (expanded.has(p.name)) {
      for (const c of p.children) visible.push({ ...c, kind: 'child' });
    }
  }

  const fmtName = (v, r) => {
    if (r.kind === 'child') {
      return (
        <span style={{ paddingLeft: 16, color: T.textMuted, fontWeight: T.fontWeightRegular }}>
          ↳ {r.segment}
        </span>
      );
    }
    const open = expanded.has(v);
    return (
      <button onClick={() => toggle(v)}
        style={{
          border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
          fontFamily: T.font, fontSize: 'inherit', color: T.black,
          fontWeight: T.fontWeightSemibold,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
        <span style={{ display: 'inline-block', width: 10, color: T.textMuted, fontSize: 10 }}>
          {open ? '▾' : '▸'}
        </span>
        {v}
      </button>
    );
  };

  return (
    <Table
      dense
      headers={[
        { key: 'name',  label: 'Source / Segment' },
        { key: 'leads', label: 'Leads', align: 'right', numeric: true },
        { key: 'opps',  label: 'Opps',  align: 'right', numeric: true },
        { key: 'won',   label: 'Won',   align: 'right', numeric: true, bold: true },
        { key: 'won_keur',    label: 'Won ARR', align: 'right', numeric: true },
        { key: 'lead_to_won', label: 'L→W',     align: 'right' },
      ]}
      rows={visible}
      formatters={{
        name:     fmtName,
        won_keur: (v) => v ? `€${Math.round(v)}K` : '—',
        lead_to_won: (v, r) => {
          // Hide the % pill when the sample size is too small to be meaningful
          // — synthetic data + tiny N leads to absurd ratios (80% off 5 leads).
          if (v == null) return '—';
          if ((r.leads || 0) < 5) return <span style={{ color: T.textMuted, fontSize: 11 }}>n={r.leads}</span>;
          return <Pill kind={v >= 20 ? 'positive' : v >= 10 ? 'neutral' : 'negative'}>{v}%</Pill>;
        },
      }}
    />
  );
}

function PerformanceTabs({ data, compact }) {
  const [tab, setTab]       = useState('byRegion');
  const [period, setPeriod] = useState('quarter');
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState(new Set()); // names of expanded parent rows

  // Switching tabs / period resets expansion.
  const setTabSafe    = (k) => { setTab(k);    setExpanded(new Set()); };
  const setPeriodSafe = (p) => { setPeriod(p); setOffset(0); setExpanded(new Set()); };
  const toggle = (name) => {
    const next = new Set(expanded);
    next.has(name) ? next.delete(name) : next.add(name);
    setExpanded(next);
  };

  // Segment tab removed — Region row expansion already drills into segments,
  // so a top-level Segment view is redundant.
  const tabs = [
    { key: 'byRegion', label: 'Region', nameCol: 'Region' },
    { key: 'byRep',    label: 'Rep',    nameCol: 'Rep'    },
  ];
  const meta  = tabs.find(t => t.key === tab);
  const range = getPeriodRange(period, offset);

  // Aggregate rep_attainment rows whose target_month falls in the period.
  // For weighted pipe we sum open opps whose close_date falls in the period.
  const attainmentInRange = useMemo(
    () => data.repAttainment.filter(r => {
      const td = parseISODate(r.month);
      return td >= range.start && td <= range.end;
    }),
    [data, period, offset]
  );
  const pipeInRange = useMemo(
    () => data.pipelineOpen.filter(r => {
      const cd = parseISODate(r.close_date);
      return cd >= range.start && cd <= range.end;
    }),
    [data, period, offset]
  );

  // Group attainment by tab dimension. For Rep we also need market/segment.
  // Weighted pipeline is split by forecast_category (Committed / Best Case /
  // Pipeline) so the table mirrors the hero's cumulative stack:
  //   bestCase column = actuals + committed + best_case   (cumulative through Best)
  //   pipeline column = actuals + committed + best + pipe (cumulative — total)
  // Upside is the recovery potential from STALE open deals scheduled to close
  // in the same period: stale_arr × 0.15 × winRate. Stale by rep is included
  // because `is_stale` now flows through from fct_pipeline_health.
  const dimKey = tab === 'byRegion' ? 'market' : 'rep_id';
  const winRate = (data.hero.winRatePct || 0) / 100;
  const rowsMap = new Map();
  for (const r of attainmentInRange) {
    const key = r[dimKey];
    if (!key) continue;
    if (!rowsMap.has(key)) {
      rowsMap.set(key, {
        name:    tab === 'byRep' ? r.rep_name : key,
        subline: tab === 'byRep' ? `${r.market} · ${r.segment}` : '',
        rep_id:  tab === 'byRep' ? r.rep_id : null,
        actuals: 0, target: 0,
        committed_w: 0, best_w: 0, pipeline_w: 0, stale_arr: 0,
      });
    }
    const e = rowsMap.get(key);
    e.actuals += r.actuals;
    e.target  += r.target;
  }
  for (const p of pipeInRange) {
    const key = tab === 'byRegion' ? p.market : p.rep_id;
    if (!key || !rowsMap.has(key)) continue;
    const e = rowsMap.get(key);
    const cat = p.forecast_category;
    if      (cat === 'Committed') e.committed_w += p.weighted;
    else if (cat === 'Best Case') e.best_w      += p.weighted;
    else if (cat === 'Pipeline')  e.pipeline_w  += p.weighted;
    if (p.is_stale) e.stale_arr += p.arr;
  }
  const rows = Array.from(rowsMap.values()).sort((a, b) => b.target - a.target);

  // ── Expansion children: cross-tab cells when filtered to the same period
  const isExpandable = tab === 'byRegion';
  const parentKey = 'market';
  const childKey  = 'segment';

  // Build child cells (market × segment) from raw data, filtered to period.
  const childCellsMap = new Map();
  for (const r of attainmentInRange) {
    if (!r.market || !r.segment) continue;
    const k = `${r.market}__${r.segment}`;
    if (!childCellsMap.has(k)) childCellsMap.set(k, {
      market: r.market, segment: r.segment,
      actuals: 0, target: 0,
      committed_w: 0, best_w: 0, pipeline_w: 0, stale_arr: 0,
    });
    const e = childCellsMap.get(k);
    e.actuals += r.actuals;
    e.target  += r.target;
  }
  for (const p of pipeInRange) {
    if (!p.market || !p.segment) continue;
    const k = `${p.market}__${p.segment}`;
    if (!childCellsMap.has(k)) continue;
    const e = childCellsMap.get(k);
    const cat = p.forecast_category;
    if      (cat === 'Committed') e.committed_w += p.weighted;
    else if (cat === 'Best Case') e.best_w      += p.weighted;
    else if (cat === 'Pipeline')  e.pipeline_w  += p.weighted;
    if (p.is_stale) e.stale_arr += p.arr;
  }
  const childCells = Array.from(childCellsMap.values());

  const visible = [];
  rows.forEach(r => {
    visible.push({ ...r, kind: 'parent' });
    if (isExpandable && expanded.has(r.name)) {
      childCells
        .filter(p => p[parentKey] === r.name)
        .forEach(p => visible.push({
          name:        p[childKey],
          actuals:     p.actuals, target: p.target,
          committed_w: p.committed_w, best_w: p.best_w,
          pipeline_w:  p.pipeline_w,  stale_arr: p.stale_arr,
          kind:        'child',
        }));
    }
  });

  // Totals row — sum the parent rows.
  const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
  const totActual    = sum('actuals'),    totTarget = sum('target');
  const totCommitted = sum('committed_w'), totBest  = sum('best_w');
  const totPipeline  = sum('pipeline_w'),  totStale = sum('stale_arr');
  const totBestCum     = totActual + totCommitted + totBest;
  const totPipelineCum = totBestCum + totPipeline;
  const totals = {
    name:      'Total',
    subline:   '',
    actuals:   totActual,
    target:    totTarget,
    best_case: totBestCum,
    pipeline:  totPipelineCum,
    pct_pipe:  totTarget > 0 ? totPipelineCum / totTarget * 100 : null,
    upside:    totStale * 0.15 * winRate,
  };

  // Columns match the hero card order — Actuals · Best · Pipeline · % · Target.
  // Upside is appended last when it has a non-zero contribution somewhere in
  // the table; otherwise it's dropped so we don't show a column of em-dashes.
  const includeSubline = tab === 'byRep' && !compact;
  const hasUpside = rows.some(r => (r.stale_arr || 0) > 0);
  const headers = [
    { key: 'name', label: meta.nameCol, bold: true },
    ...(includeSubline ? [{ key: 'subline', label: 'Market · Segment', muted: true }] : []),
    { key: 'actuals',    label: compact ? 'Act.'  : 'Actuals',        align: 'right', numeric: true },
    { key: 'best_case',  label: compact ? 'Best'  : 'Best case',      align: 'right', numeric: true },
    { key: 'pipeline',   label: compact ? 'Pipe'  : 'Pipeline',       align: 'right', numeric: true },
    { key: 'pct_pipe',   label: compact ? '%'     : '% vs target',    align: 'right' },
    { key: 'target',     label: compact ? 'Tgt'   : 'Target',         align: 'right', numeric: true },
    ...(hasUpside ? [
      { key: 'upside',   label: compact ? 'Up.'   : 'Upside',         align: 'right', numeric: true },
    ] : []),
  ];

  // Enrich each row with the cumulative levels + achievement % + upside.
  const enriched = visible.map(r => {
    const bestCum     = (r.actuals || 0) + (r.committed_w || 0) + (r.best_w || 0);
    const pipelineCum = bestCum + (r.pipeline_w || 0);
    return {
      ...r,
      best_case: bestCum,
      pipeline:  pipelineCum,
      pct_pipe:  r.target > 0 ? pipelineCum / r.target * 100 : null,
      upside:    (r.stale_arr || 0) * 0.15 * winRate,
    };
  });

  // Period navigation bounds — match the chart so we don't run off the data.
  const minOffset = period === 'quarter' ? -8 : period === 'month' ? -28 : -2;
  const canPrev = offset > minOffset;
  const canNext = offset < 0;
  const PillBtn = ({ active, onClick, children }) => (
    <button onClick={onClick}
      style={{
        border: 'none', cursor: 'pointer', borderRadius: 999,
        padding: '5px 12px', fontSize: 11,
        fontFamily: T.font,
        fontWeight: active ? T.fontWeightSemibold : T.fontWeightRegular,
        background: active ? T.black : 'transparent',
        color:      active ? '#FFF'   : T.textMuted,
        transition: 'all 150ms ease-out',
      }}>{children}</button>
  );
  const Arrow = ({ disabled, onClick, children }) => (
    <button onClick={onClick} disabled={disabled}
      style={{
        border: 'none', background: 'transparent', cursor: disabled ? 'default' : 'pointer',
        color: disabled ? T.hairline : T.textMuted, fontSize: 14,
        width: 24, height: 24, borderRadius: 999, padding: 0,
      }}>{children}</button>
  );

  const fmtRowEur = (v) => v == null ? '—' : fmtEur(v);
  const fmtPctCell = (v) => {
    if (v == null) return '—';
    const kind = v >= 100 ? 'positive' : v >= 50 ? 'neutral' : 'negative';
    return <Pill kind={kind}>{Math.round(v)}%</Pill>;
  };

  // The "name" column renders parents as clickable expand toggles when the
  // tab is expandable; child rows are indented and tinted to make the
  // hierarchy obvious.
  const fmtName = (v, r) => {
    if (r.kind === 'child') {
      return (
        <span style={{ paddingLeft: 16, color: T.textMuted, fontWeight: T.fontWeightRegular }}>
          ↳ {v}
        </span>
      );
    }
    if (isExpandable) {
      const open = expanded.has(v);
      return (
        <button onClick={() => toggle(v)}
          style={{
            border: 'none', background: 'transparent', padding: 0,
            cursor: 'pointer', fontFamily: T.font,
            fontWeight: T.fontWeightSemibold, fontSize: 'inherit', color: T.black,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
          <span style={{ display: 'inline-block', width: 10, color: T.textMuted, fontSize: 10 }}>
            {open ? '▾' : '▸'}
          </span>
          {v}
        </button>
      );
    }
    return v;
  };

  return (
    // Toolbar + table share one white surface. The toolbar header strip
    // sits at the top of the card with a hairline divider underneath; the
    // table fills the body. This makes the filter controls feel attached
    // to the data they steer, instead of floating above it on the panel.
    <div style={{ background: T.card, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center',
                    gap: 8, padding: '10px 12px',
                    borderBottom: `1px solid ${T.hairline}` }}>
        <div style={{ display: 'inline-flex', gap: 4, background: T.panel,
                      padding: 3, borderRadius: 999 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTabSafe(t.key)}
              style={{
                border: 'none', cursor: 'pointer', borderRadius: 999,
                padding: compact ? '6px 12px' : '8px 16px',
                fontSize: compact ? 12 : 13,
                fontFamily: T.font,
                fontWeight: tab === t.key ? T.fontWeightSemibold : T.fontWeightRegular,
                background: tab === t.key ? T.black : 'transparent',
                color:      tab === t.key ? '#FFF'   : T.textMuted,
                transition: 'all 150ms ease-out',
              }}>{t.label}</button>
          ))}
        </div>

        <div style={{ display: 'inline-flex', gap: 2, background: T.panel,
                      padding: 2, borderRadius: 999 }}>
          <PillBtn active={period === 'month'}   onClick={() => setPeriodSafe('month')}>Month</PillBtn>
          <PillBtn active={period === 'quarter'} onClick={() => setPeriodSafe('quarter')}>Quarter</PillBtn>
          <PillBtn active={period === 'year'}    onClick={() => setPeriodSafe('year')}>Year</PillBtn>
        </div>
        <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          <Arrow disabled={!canPrev} onClick={() => canPrev && setOffset(offset - 1)}>‹</Arrow>
          <span style={{ ...numStyle, fontSize: 12, fontWeight: T.fontWeightMedium, color: T.black,
                         minWidth: 64, textAlign: 'center' }}>
            {range.label}
          </span>
          <Arrow disabled={!canNext} onClick={() => canNext && setOffset(offset + 1)}>›</Arrow>
        </div>
      </div>

      <Table
        headers={headers}
        rows={enriched}
        totals={totals}
        dense={compact}
        formatters={{
          name:      fmtName,
          actuals:   fmtRowEur,
          best_case: fmtRowEur,
          pipeline:  fmtRowEur,
          target:    fmtRowEur,
          pct_pipe:  fmtPctCell,
          upside:    fmtRowEur,
        }}
      />
    </div>
  );
}

// --- Main app -------------------------------------------------------------

// Historical pace + Pipeline funnel — single shared period filter. The
// pace chart owns the toolbar UI (it already renders the period/offset
// pills inside its card); the funnel reads the same state so changing
// period in one place updates both.
function HistoricalAndPipelineFunnel({ data }) {
  const [period, setPeriod] = useState('quarter');
  const [offset, setOffset] = useState(0);
  return (
    <div>
      <SectionH meta="Cumulative ARR · current Q vs last Q vs same Q LY">
        Where we are vs the historical pace
      </SectionH>
      <PaceInsights data={data} />
      {/* Breathing room between the insight cards and the chart. */}
      <div style={{ marginTop: 16 }}>
        <ArrTrendChart data={data} compact
                       period={period} setPeriod={setPeriod}
                       offset={offset} setOffset={setOffset} />
      </div>
      {/* Pipeline funnel re-aggregates by the same period selector above —
          shows the open pipeline scheduled to close in the chosen window. */}
      <div style={{ marginTop: 16 }}>
        <PipelineFunnelChart data={data} period={period} offset={offset} />
      </div>
    </div>
  );
}

function App() {
  const data = window.DATA;
  const h = data.hero;
  const cumPoints = (data.cumulativeArr || []).filter(r => r.cumulative_arr_eur > 0);
  const lastCum = cumPoints.length ? cumPoints[cumPoints.length - 1].cumulative_arr_eur : 0;
  const { isMobile, isCompact } = useBreakpoint();

  // 2×2 grid of equal panels. Collapses to a single column on narrow viewports.
  const gridCols = isCompact ? '1fr' : '1fr 1fr';

  // Column-internal "section header" — smaller than the page-level SectionBanner,
  // since each column has its own title.
  const ColumnHeader = ({ tag, title, caption }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase',
                    letterSpacing: '0.14em', fontWeight: T.fontWeightRegular, marginBottom: 6 }}>{tag}</div>
      <h3 style={{ margin: 0, fontSize: T.font2XLarge, fontWeight: T.fontWeightMedium,
                   color: T.black, letterSpacing: '-0.02em', lineHeight: T.lineHeight1 }}>{title}</h3>
      {caption && (
        <div style={{ fontSize: T.fontSmall, color: T.textSec, marginTop: 8, lineHeight: T.lineHeight2 }}>
          {caption}
        </div>
      )}
    </div>
  );

  // Column wrapper — each column is now a tinted panel so the user can see
  // at a glance that everything inside belongs to one topic. Inner cards stay
  // white, so the tonal shift (page → panel → card) does the grouping.
  // `bg` lets a column override the default panel grey (used for the middle
  // Pipeline Quality column to give it a soft pink wash).
  const Column = ({ children, bg }) => (
    <div style={{
      background: bg || T.panel, borderRadius: 14, padding: '12px 10px',
      display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0,
    }}>
      {children}
    </div>
  );

  return (
    <div style={{ background: T.bg, color: T.black, minHeight: '100vh' }}>
      <HeroSection data={data} />

      <div className="body-wrap">

        {/* ===== 2×2 grid of equal sections ================================== */}
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12, marginTop: 16 }}>

          {/* ── 1 — Performance ───────────────────────────────────────────────
              Performance leads the column: it answers "who's hitting target?"
              with actuals, target and weighted pipeline split by region /
              segment / rep — the most actionable cut of the data. Historical
              pace and the cumulative book are supporting context below. */}
          <Column>
            <ColumnHeader
              tag="PERFORMANCE"
              title="Who's hitting target — and who's not"
              caption="Q2 actuals against ramp-adjusted target, plus the weighted pipeline still in play, split by region, segment and rep."
            />
            <PerformanceTabs data={data} compact />

            <HistoricalAndPipelineFunnel data={data} />

            {/* Cumulative ARR section removed — it duplicated the attainment
                story above with a no-churn assumption and added clutter
                without changing any decision. */}
          </Column>

          {/* ── Column 2 — Pipeline Quality ──────────────────────────────── */}
          <Column>
            <ColumnHeader
              tag="PIPELINE QUALITY"
              title="Where revenue leaks before the funnel ends"
              caption="Stalled, slipped, velocity and ASP — plus where to act first."
            />

            {/* 4 KPI tiles in a single row (dense). Velocity dropped — the
                synthetic dataset returns an implausible 2-day median which
                would just confuse the reader. Coverage takes its slot. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              <KpiCard dense emphasised label="Stalled"
                       value={`${data.pipelineQuality.stalledDeals}`}
                       sub={`${fmtEur(data.pipelineQuality.stalledArr)} · 30d+`} />
              <KpiCard dense label="Slipped"
                       value={`${data.pipelineQuality.slippedDeals}`}
                       sub={`${fmtEur(data.pipelineQuality.slippedArr)} moved`} />
              <KpiCard dense label="Coverage"
                       value={`${Math.round((data.hero.q2PipeWeighted / data.hero.q2Target) * 100)}%`}
                       sub="Weighted ÷ Q2 target" />
              <KpiCard dense label="ASP"
                       value={fmtEur(data.pipelineQuality.aspEur)}
                       sub="avg won size" />
            </div>

            {/* AI insight — Where to focus first */}
            <div style={{ background: T.card, borderRadius: 12, padding: '10px 12px',
                          borderLeft: `3px solid ${T.pleoPink500}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                            fontSize: 10, color: T.pleoPink500, textTransform: 'uppercase',
                            letterSpacing: '0.14em', marginBottom: 4 }}>
                <span><AiIcon color={T.pleoPink500} />AI · where to focus first</span>
                <span style={{ fontSize: 9, color: T.textMuted, letterSpacing: '0.1em' }}>refreshed weekly</span>
              </div>
              <div style={{ fontSize: 13, color: T.textSec, lineHeight: T.lineHeight2 }}>
                <strong style={{ color: T.black }}>Wise (J. Patel, €161K, 85d silent)</strong> — manager touch this week.
                Then a <strong style={{ color: T.black }}>UK Mid-Market sprint</strong> on 6 deals worth €296K.
              </div>
            </div>

            {/* Two cuts on pipeline quality, tabbed: Slippage & Stale (left
                tab) vs Velocity & ASP (right tab). Velocity slots in as a
                minimal table so we surface the data without adding clutter. */}
            <PipelineQualityCharts data={data} />

            <div>
              <SectionH meta="Open pipeline · current snapshot">Top stale deals · call list</SectionH>
              <Table
                dense
                headers={[
                  { key: 'account_name',   label: 'Account',          bold: true },
                  { key: 'rep_name',       label: 'Rep',              muted: true },
                  { key: 'market_segment', label: 'Market · Segment', muted: true },
                  { key: 'stage',          label: 'Stage',            muted: true },
                  { key: 'arr_keur',       label: 'ARR',   align: 'right', numeric: true, bold: true },
                  { key: 'days_silent',    label: 'Days',  align: 'right' },
                ]}
                rows={data.topStale.map(r => ({ ...r, market_segment: `${r.market} · ${r.segment}` }))}
                formatters={{
                  arr_keur:    (v) => `€${v}K`,
                  days_silent: (v) => <Pill kind={v >= 60 ? 'negative' : 'neutral'}>{v}d</Pill>,
                }}
              />
            </div>
          </Column>

          {/* ── 3 — Funnel Conversion ─────────────────────────────────────── */}
          <Column>
            <ColumnHeader
              tag="FUNNEL CONVERSION"
              title="Marketing funnel + deal outcomes"
              caption="Top: lead → demo from funnel events (trail 12M). Bottom: how the 129 opportunities created since 2024 ended up."
            />

            {/* Funnel + outcomes share a row and a period filter. Insights
                live inside the component, below each chart. */}
            {/* Funnel + outcomes + source×segment now share one period
                filter. Stand-alone FunnelSourcePivot / ASP callout removed —
                the pivot lives inside MarketingAndOutcomes and one insight
                per chart is already rendered there. */}
            <MarketingAndOutcomes data={data} compact />
          </Column>

          {/* ── 4 — Activity ──────────────────────────────────────────────── */}
          <Column>
            <ColumnHeader
              tag="ACTIVITY"
              title="Are AEs and SDRs actually working the deals?"
              caption="Weekly activity volume by type, plus the per-rep activity count for the last 4 weeks."
            />

            {/* Both activity charts share one filter (Month / Quarter / Year
                / All time + prev-next) inside the same white card. */}
            <ActivitySection data={data} />
          </Column>
        </div>

        {/* ===== Appendix · Monday actions =================================== */}
        <SectionBanner
          tag="APPENDIX · RECOMMENDATIONS"
          title="Monday actions"
          caption="Specific, owned, time-bound."
        />
        {/* Kanban layout — three columns of cards grouped by the action's
            time horizon (`when`). The card visual is unchanged (pink-tinted
            squares with severity pill, title, value, owner). Each column is
            its own panel with a header band so the board reads as a project-
            management view rather than a flat list. */}
        {(() => {
          // Group actions by their `when` value; order columns explicitly so
          // "This week" sits on the left (most urgent) and the longest horizon
          // sits on the right.
          const COLUMNS = [
            { key: 'This week',  title: 'This week',  sub: 'Urgent · do it now' },
            { key: 'This sprint', title: 'This sprint', sub: 'In current sprint' },
            { key: '45 days',    title: 'In progress', sub: 'Multi-week initiatives' },
          ];
          const buckets = Object.fromEntries(COLUMNS.map(c => [c.key, []]));
          const other = [];
          for (const a of data.actions) {
            if (buckets[a.when]) buckets[a.when].push(a);
            else other.push(a);
          }
          if (other.length) buckets['45 days'].push(...other);

          return (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 12,
              alignItems: 'start',
            }}>
              {COLUMNS.map(col => (
                <div key={col.key} style={{
                  background: T.panel, borderRadius: 14, padding: 12,
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  {/* Column header — title + count + one-line description */}
                  <div style={{ display: 'flex', alignItems: 'baseline',
                                gap: 8, padding: '0 4px 8px',
                                borderBottom: `1px solid ${T.hairline}` }}>
                    <span style={{ fontSize: 12, color: T.black,
                                   fontWeight: T.fontWeightSemibold,
                                   letterSpacing: '-0.01em' }}>{col.title}</span>
                    <span style={{ fontSize: 11, color: T.textMuted,
                                   ...numStyle }}>{buckets[col.key].length}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10,
                                   color: T.textMuted, textTransform: 'uppercase',
                                   letterSpacing: '0.08em' }}>{col.sub}</span>
                  </div>

                  {/* Action cards — unchanged design, just grouped by column */}
                  {buckets[col.key].length === 0 ? (
                    <div style={{ fontSize: 12, color: T.textMuted,
                                  padding: '12px 4px', fontStyle: 'italic' }}>
                      No actions in this lane.
                    </div>
                  ) : buckets[col.key].map((a, i) => {
                    const tint = a.severity === 'red'  ? T.pleoPink400
                               : a.severity === 'amber' ? T.pleoPink200
                                                         : T.pleoPink100;
                    return (
                      <div key={i} style={{
                        background: tint, borderRadius: 14, padding: '16px 18px',
                        display: 'flex', flexDirection: 'column', gap: 12,
                      }}>
                        <Pill kind={a.severity === 'red' ? 'negative' : 'neutral'}>
                          {a.severity === 'red' ? 'Urgent' : a.severity === 'amber' ? 'This sprint' : 'Process'}
                        </Pill>
                        <div style={{ fontSize: 15, color: T.black,
                                      fontWeight: T.fontWeightSemibold,
                                      lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                          {a.title}
                        </div>
                        <div style={{ marginTop: 'auto', display: 'flex',
                                      flexDirection: 'column', gap: 4 }}>
                          <div style={{ ...numStyle, fontSize: T.fontMedium,
                                        fontWeight: T.fontWeightSemibold, color: T.black }}>
                            {a.value}
                          </div>
                          <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>
                            {a.owner} · {a.when}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Picklist hygiene table dropped — the same point already lives inside
            the Monday-actions recommendation, no need to duplicate. */}

        <footer style={{
          marginTop: 64, paddingTop: 24, borderTop: `1px solid ${T.hairline}`,
          fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em'
        }}>
          Daniel Amezquita · dbt + DuckDB-WASM + React · {h.asOf}
        </footer>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary><App /></ErrorBoundary>
);
