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

const Table = ({ headers, rows, formatters, totals, dense }) => {
  const cellPad = dense ? '8px 10px' : '12px 20px';
  const headPad = dense ? '10px 10px' : '14px 20px';
  const fontSz  = dense ? 12 : 14;
  return (
    <div className="tbl-scroll">
    <div style={{ background: T.card, minWidth: dense ? 320 : 480, borderRadius: 14, overflow: 'hidden' }}>
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

  // Each card acts as the legend for the bar below — big number on top,
  // a one-line role description below. Pipeline and Target carry the
  // narrative subtitles (% vs target, gap), the others stay quiet.
  const cards = [
    { label: 'Actuals',   value: actuals,
      sub: 'Closed-won so far', subAccent: false },
    { label: 'Commit',    value: commit,
      sub: '+ Committed weighted', subAccent: false },
    { label: 'Best case', value: bestCase,
      sub: '+ Best case weighted', subAccent: false },
    { label: 'Pipeline',  value: pipeline,
      sub: `${pctVsTarget}% of target`, subAccent: 'pink' },
    { label: 'Target',    value: target,
      sub: gapK > 0 ? `Gap €${gapK}K to close` : 'Ceiling clears target',
      subAccent: 'white' },
  ];

  return (
    <section style={{ background: T.black, color: '#FFFFFF', padding: '24px 12px 24px' }}>
      <div style={{ width: '100%' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between',
                      alignItems: 'flex-end', flexWrap: 'wrap', gap: 24, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: T.fontXSmall, color: 'rgba(255,255,255,0.55)',
                          textTransform: 'uppercase', letterSpacing: '0.14em',
                          fontWeight: T.fontWeightRegular, marginBottom: 8 }}>
              Weekly GTM Review · {h.asOf}
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

        {/* ── Forecast cards · the legend for the bar below ─────────────────
            Five equal-width cards: Actuals · Commit · Best · Pipeline · Target.
            On narrow viewports `auto-fit` wraps them onto multiple rows while
            preserving order, so the story still reads left-to-right. */}
        <div style={{ display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: 16, marginBottom: 16 }}>
          {cards.map((k, i) => {
            const subColor =
              k.subAccent === 'pink'  ? T.pleoPink500 :
              k.subAccent === 'white' ? '#FFFFFF'     :
              'rgba(255,255,255,0.55)';
            return (
              <div key={i}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)',
                              textTransform: 'uppercase', letterSpacing: '0.12em',
                              fontWeight: T.fontWeightRegular, marginBottom: 8 }}>
                  {k.label}
                </div>
                <div style={{ ...numStyle, fontSize: T.font3XLarge, color: '#FFFFFF',
                              fontWeight: T.fontWeightMedium, lineHeight: 1.05,
                              letterSpacing: '-0.02em' }}>
                  {fmtEur(k.value)}
                </div>
                <div style={{ fontSize: 11, color: subColor,
                              marginTop: 6, lineHeight: 1.4,
                              fontWeight: k.subAccent ? T.fontWeightMedium : T.fontWeightRegular }}>
                  {k.sub}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Minimal stacked bar · target = full bar width ─────────────────
            Background track is a faint white tint, so the unfilled remainder
            visually IS the gap to target. Coloured segments are proportional
            to each forecast level's contribution (pink gets paler the further
            we move from booked revenue). A dashed marker on the right edge
            reinforces that 100% width = Target. */}
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'relative', height: 10, borderRadius: 5,
                        background: 'rgba(255,255,255,0.08)',
                        overflow: 'hidden', display: 'flex' }}>
            {actuals > 0 && (
              <div title={`Actuals: ${fmtEur(actuals)}`}
                   style={{ width: `${w(actuals)}%`, background: T.pleoPink500 }} />
            )}
            <div title={`+ Commit: ${fmtEur(f.committedWeighted)}`}
                 style={{ width: `${w(f.committedWeighted)}%`, background: T.pleoPink400 }} />
            <div title={`+ Best case: ${fmtEur(f.bestCaseWeighted)}`}
                 style={{ width: `${w(f.bestCaseWeighted)}%`, background: T.pleoPink300 }} />
            <div title={`+ Pipeline: ${fmtEur(f.pipelineWeighted)}`}
                 style={{ width: `${w(f.pipelineWeighted)}%`, background: T.pleoPink200 }} />
          </div>
          {/* Target marker — a 1px dashed line at the right edge of the bar */}
          <div style={{ position: 'absolute', right: 0, top: -3, bottom: -3,
                        borderRight: '1px dashed rgba(255,255,255,0.6)',
                        pointerEvents: 'none' }} />
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

function ArrTrendChart({ data, compact }) {
  const [chart,  setChart]  = useState('line');
  const [period, setPeriod] = useState('quarter');
  const [offset, setOffset] = useState(0);

  // Reset offset to 0 when switching periods so navigation always starts at "now".
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
      {chart === 'line' ? (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={linePts.points} margin={{ top: 6, right: 10, left: -10, bottom: 0 }}>
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
            {/* Comparison series first (drawn underneath), then the current
                period on top in Pleo pink so the eye lands on "us". */}
            {linePts.labels.sameLY && (
              <Line dataKey="sameLY" name={linePts.labels.sameLY} stroke={T.black}
                    strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls={false} />
            )}
            <Line dataKey="prior"   name={linePts.labels.prior}   stroke={T.textMuted}
                  strokeWidth={2}   dot={false} connectNulls={false} />
            <Line dataKey="current" name={linePts.labels.current} stroke={T.pleoPink500}
                  strokeWidth={3}   dot={false} connectNulls={false} />
            {isCurrent && period !== 'year' && (
              <ReferenceLine x={Math.round((AS_OF - range.start) / 86400000) + 1}
                             stroke={T.textMuted} strokeDasharray="4 4" />
            )}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={T.chartGrid} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: T.textMuted }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `€${Math.round(v/1000)}K`}
                   tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => `€${Math.round(v/1000).toLocaleString()}K`}
                     contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem} />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={legendBlackFmt} />
            <Bar dataKey="target"  name="Target"  fill={T.hairline}    radius={[3,3,0,0]} />
            <Bar dataKey="actuals" name="Actuals" fill={T.pleoPink500} radius={[3,3,0,0]} />
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
        <BarChart data={rows} margin={{ top: 20, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={T.chartGrid} />
          <XAxis dataKey="demand_source" tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false}
                 tickFormatter={(v) => compact ? v.replace(' Outbound', ' OB').replace('Partnerships', 'Partner') : v} />
          <YAxis tickFormatter={(v) => `€${v}K`} tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
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
  const rows = data.staleBySegment.slice(0, n).map(r => ({ ...r, label: `${r.market} · ${r.segment}` }));
  return (
    <Card style={{ padding: compact ? 10 : 16 }}>
      <ResponsiveContainer width="100%" height={compact ? 220 : 320}>
        <BarChart layout="vertical" data={rows} margin={{ top: 8, right: 50, left: compact ? 70 : 100, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke={T.chartGrid} />
          <XAxis type="number" tickFormatter={(v) => `€${v}K`} tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <YAxis dataKey="label" type="category" tick={{ fontSize: 10, fill: T.textSec }} width={compact ? 70 : 100} axisLine={false} tickLine={false} />
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

function SlippageTrendChart({ data, compact }) {
  // Show only YYYY-MM from the date string in compact mode.
  const trend = compact
    ? data.slippageTrend.map(r => ({ ...r, snapshot_month: (r.snapshot_month || '').substring(0, 7) }))
    : data.slippageTrend;
  return (
    <Card style={{ padding: compact ? 10 : 16 }}>
      <ResponsiveContainer width="100%" height={compact ? 220 : 260}>
        <ComposedChart data={trend} margin={{ top: 8, right: 20, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={T.chartGrid} />
          <XAxis dataKey="snapshot_month" tick={{ fontSize: 9, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" tickFormatter={(v) => `€${v}K`} tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem} />
          <Legend wrapperStyle={{ fontSize: 11 }} formatter={legendBlackFmt} />
          <Bar  yAxisId="left"  dataKey="slipped_keur" name="Slipped ARR" fill={T.hairline} radius={[3,3,0,0]} />
          <Line yAxisId="right" dataKey="slip_rate"   name="Slip rate %" stroke={T.black} strokeWidth={2} dot={{ r: 2.5, fill: T.black }} />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}

// --- Performance tabbed table --------------------------------------------

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

  // Each activity type gets a different shade of grey + the won-style pink for
  // the "Demo" type, which is the highest-intent activity.
  const TYPES = [
    { key: 'Email',    fill: '#DDDDDD' },
    { key: 'Call',     fill: '#BBBBBB' },
    { key: 'LinkedIn', fill: '#999999' },
    { key: 'Meeting',  fill: '#555555' },
    { key: 'Demo',     fill: T.pleoPink500 },
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
  const dimKey = tab === 'byRegion' ? 'market' : 'rep_id';
  const rowsMap = new Map();
  for (const r of attainmentInRange) {
    const key = r[dimKey];
    if (!key) continue;
    if (!rowsMap.has(key)) {
      rowsMap.set(key, {
        name:    tab === 'byRep' ? r.rep_name : key,
        subline: tab === 'byRep' ? `${r.market} · ${r.segment}` : '',
        rep_id:  tab === 'byRep' ? r.rep_id : null,
        actuals: 0, target: 0, weighted: 0,
      });
    }
    const e = rowsMap.get(key);
    e.actuals += r.actuals;
    e.target  += r.target;
  }
  for (const p of pipeInRange) {
    const key = tab === 'byRegion' ? p.market : p.rep_id;
    if (!key || !rowsMap.has(key)) continue;
    rowsMap.get(key).weighted += p.weighted;
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
      market: r.market, segment: r.segment, actuals: 0, target: 0, weighted: 0,
    });
    const e = childCellsMap.get(k);
    e.actuals += r.actuals;
    e.target  += r.target;
  }
  for (const p of pipeInRange) {
    if (!p.market || !p.segment) continue;
    const k = `${p.market}__${p.segment}`;
    if (childCellsMap.has(k)) childCellsMap.get(k).weighted += p.weighted;
  }
  const childCells = Array.from(childCellsMap.values());

  const visible = [];
  rows.forEach(r => {
    visible.push({ ...r, kind: 'parent' });
    if (isExpandable && expanded.has(r.name)) {
      childCells
        .filter(p => p[parentKey] === r.name)
        .forEach(p => visible.push({
          name:     p[childKey],
          actuals:  p.actuals, target: p.target, weighted: p.weighted,
          kind:     'child',
        }));
    }
  });

  // Totals row — sum the parent rows.
  const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
  const totActual = sum('actuals'), totTarget = sum('target'), totWeighted = sum('weighted');
  const totals = {
    name:    'Total',
    subline: '',
    actuals: totActual, target: totTarget, weighted: totWeighted,
    pct_actuals:  totTarget > 0 ? totActual   / totTarget * 100 : null,
    pct_weighted: totTarget > 0 ? totWeighted / totTarget * 100 : null,
  };

  // For "By Rep" we drop the subline column in compact mode so the 6 cols fit.
  const includeSubline = tab === 'byRep' && !compact;
  const headers = [
    { key: 'name', label: meta.nameCol, bold: true },
    ...(includeSubline ? [{ key: 'subline', label: 'Market · Segment', muted: true }] : []),
    { key: 'actuals',      label: compact ? 'Act.'      : 'Actuals',       align: 'right', numeric: true },
    { key: 'target',       label: compact ? 'Tgt'       : 'Target',        align: 'right', numeric: true },
    { key: 'pct_actuals',  label: compact ? '%'         : '% vs target',   align: 'right' },
    { key: 'weighted',     label: compact ? 'Wtd pipe'  : 'Weighted pipe', align: 'right', numeric: true },
    { key: 'pct_weighted', label: compact ? '%'         : '% vs target',   align: 'right' },
  ];

  const enriched = visible.map(r => ({
    ...r,
    pct_actuals:  r.target > 0 ? r.actuals  / r.target * 100 : null,
    pct_weighted: r.target > 0 ? r.weighted / r.target * 100 : null,
  }));

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
    <div>
      {/* Top control row: tab strip + period pills + prev/next nav */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center',
                    gap: 8, marginBottom: 12 }}>
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

        {/* Period pills + navigation — same pattern as the ARR chart */}
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
          name:         fmtName,
          actuals:      fmtRowEur,
          target:       fmtRowEur,
          weighted:     fmtRowEur,
          pct_actuals:  fmtPctCell,
          pct_weighted: fmtPctCell,
        }}
      />
    </div>
  );
}

// --- Main app -------------------------------------------------------------

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

          {/* ── 1 — ARR vs Target ─────────────────────────────────────────── */}
          <Column>
            <ColumnHeader
              tag="ARR VS TARGET"
              title="Where we are vs the historical pace"
              caption="Cumulative new ARR closed, day-by-day, compared against Q1 2026 (last Q) and Q2 2025 (same Q LY)."
            />
            <PaceInsights data={data} />

            {/* Forecast levels — Commit ≤ Best ≤ Pipeline ≤ Target */}
            <div>
              <SectionH meta="Cumulative · Commit ≤ Best ≤ Pipeline">Forecast vs target</SectionH>
              <ForecastRow data={data} />
            </div>

            <ArrTrendChart data={data} compact />

            <div>
              <SectionH meta="Actuals · Target · Weighted pipe">Performance</SectionH>
              <PerformanceTabs data={data} compact />
            </div>

            <div>
              <SectionH meta="No-churn assumption · supporting context">Cumulative ARR book</SectionH>
              <FindingBox>
                Ending book today is{' '}
                <strong style={{ color: T.black, ...numStyle }}>€{Math.round(lastCum / 1000).toLocaleString()}K</strong>{' '}
                assuming no churn. Supporting context — attainment above is the flow metric.
              </FindingBox>
              <CumulativeArrChart data={data} compact />
            </div>
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

            <div>
              <SectionH meta="Trail 12 months · funnel events">Marketing funnel</SectionH>
              <MarketingFunnel data={data} compact />
            </div>

            <div>
              <SectionH meta="All-time · 129 opps">Deal outcomes</SectionH>
              <OutcomeSplit data={data} />
              <FindingBox>
                <strong style={{ color: T.black }}>50% of deals are lost</strong> and 26% are silently stale.
                Combined leakage is the biggest single drag on attainment.
              </FindingBox>
            </div>

            {/* ASP bar chart dropped — the per-source numbers live inside the
                pivot table below (Won ARR column), and the headline insight
                stands fine as a one-line callout. */}
            <FindingBox>
              <strong style={{ color: T.black }}>Partnerships and Marketing punch above their weight on deal size</strong>{' '}
              — ASP €93K and €68K vs €32K for SDR / AE Outbound. Drilldown in the table below.
            </FindingBox>

            <div>
              <SectionH meta="Trail 12 months · click to expand">By demand source × segment</SectionH>
              <FunnelSourcePivot data={data} />
            </div>
          </Column>

          {/* ── 4 — Activity ──────────────────────────────────────────────── */}
          <Column>
            <ColumnHeader
              tag="ACTIVITY"
              title="Are AEs and SDRs actually working the deals?"
              caption="Weekly activity volume by type, plus the per-rep activity count for the last 4 weeks."
            />

            <div>
              <SectionH meta="Trail 12 weeks · stacked by type">Activity volume</SectionH>
              <ActivityWeeklyChart data={data} compact />
            </div>

            <div>
              <SectionH meta="Last 4 weeks · per rep">Activity by rep</SectionH>
              <ActivityByRep data={data} />
              <FindingBox>
                {(() => {
                  const z = data.activity.perRep.filter(r => r.activities === 0).length;
                  return (
                    <>
                      <strong style={{ color: T.black }}>{z} of {data.activity.perRep.length} reps have logged zero activities</strong>{' '}
                      in the past 4 weeks — the likely root cause of the stale concentration in Pipeline Quality.
                    </>
                  );
                })()}
              </FindingBox>
            </div>
          </Column>
        </div>

        {/* ===== Appendix · Monday actions =================================== */}
        <SectionBanner
          tag="APPENDIX · RECOMMENDATIONS"
          title="Monday actions"
          caption="Specific, owned, time-bound."
        />
        {/* Pink Pleo-style cards. Each card is one action — bold title up top,
            severity pill, owner / value / when metadata at the bottom. */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 12,
        }}>
          {data.actions.map((a, i) => {
            // Tint depth reflects urgency; pleo pink across the board.
            const tint = a.severity === 'red'  ? T.pleoPink400
                       : a.severity === 'amber' ? T.pleoPink200
                                                 : T.pleoPink100;
            return (
              <div key={i} style={{
                background: tint, borderRadius: 18, padding: '20px 22px',
                display: 'flex', flexDirection: 'column', gap: 14,
                minHeight: 168,
              }}>
                <Pill kind={a.severity === 'red' ? 'negative' : 'neutral'}>
                  {a.severity === 'red' ? 'Urgent' : a.severity === 'amber' ? 'This sprint' : 'Process'}
                </Pill>
                <div style={{ fontSize: 18, color: T.black, fontWeight: T.fontWeightSemibold,
                              lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                  {a.title}
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ ...numStyle, fontSize: T.fontMedium, fontWeight: T.fontWeightSemibold, color: T.black }}>
                    {a.value}
                  </div>
                  <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>
                    {a.owner} · {a.when}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

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
