import { TierTheme, LINE, MIST, GREY, INK, FONT_STACK } from "./theme.js";

/**
 * One stylesheet, parameterized by tier theme. Content pages are always
 * light/readable (per the design guideline: only the cover is dark) —
 * `theme.accent` is what changes the header tag color, the KPI card
 * top-border, and callout accents between Pro (green) and Platinum
 * (gold).
 */
export function baseStyles(theme: TierTheme): string {
  return `
  @page {
    size: A4;
    margin: 30mm 22mm 20mm 22mm;
  }
  * { box-sizing: border-box; }
  body {
    font-family: ${FONT_STACK};
    color: ${INK};
    font-size: 10.5pt;
    line-height: 1.5;
    margin: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .hive-watermark {
    position: fixed;
    top: 45%;
    left: 10%;
    font-size: 64pt;
    font-weight: 700;
    color: ${INK};
    opacity: 0.045;
    transform: rotate(-38deg);
    z-index: -1;
    white-space: nowrap;
  }

  .hive-page { page-break-after: always; position: relative; min-height: 235mm; }
  .hive-page:last-child { page-break-after: auto; }

  .hive-eyebrow { font-size: 9pt; font-weight: 700; letter-spacing: 0.06em; margin-bottom: 4px; }
  .hive-title { font-size: 18pt; font-weight: 700; margin: 2px 0 10px 0; line-height: 1.25; }
  .hive-hr { border: none; border-top: 1px solid ${LINE}; margin: 0 0 14px 0; }

  h2.hive-h2 { font-size: 12.5pt; font-weight: 700; margin: 14px 0 6px 0; }
  p.hive-body { margin: 0 0 8px 0; }

  /* KPI cards ---------------------------------------------------- */
  .hive-kpi-row { display: flex; gap: 8px; margin: 0 0 12px 0; }
  .hive-kpi-card {
    flex: 1;
    border: 0.75pt solid ${LINE};
    border-top: 2.5pt solid;
    border-radius: 2px;
    text-align: center;
    padding: 10px 4px;
    min-width: 0;
  }
  .hive-kpi-value { font-weight: 700; line-height: 1.2; word-break: normal; overflow-wrap: break-word; }
  .hive-kpi-label { font-size: 7.3pt; color: ${GREY}; margin-top: 4px; letter-spacing: 0.02em; }

  /* Callout boxes -------------------------------------------------- */
  .hive-callout { border: 0.6pt solid ${LINE}; margin-bottom: 10px; }
  .hive-callout-label { color: white; font-weight: 700; font-size: 8.5pt; padding: 6px 10px; letter-spacing: 0.03em; }
  .hive-callout-body { padding: 10px 12px; font-size: 10pt; }

  /* Decision + confidence ------------------------------------------ */
  .hive-decision-row { display: flex; gap: 14px; align-items: flex-start; margin-top: 6px; }
  .hive-decision-badge { width: 130px; flex: none; text-align: center; padding: 8px 6px; color: white; }
  .hive-decision-tag { font-size: 7pt; font-weight: 700; }
  .hive-decision-value { font-size: 15pt; font-weight: 700; margin-top: 2px; }
  .hive-confidence { flex: 1; padding-top: 2px; }
  .hive-confidence-tag { font-size: 7.5pt; font-weight: 700; color: ${GREY}; margin-bottom: 4px; }
  .hive-confidence-track { background: ${LINE}; height: 6px; border-radius: 3px; overflow: hidden; }
  .hive-confidence-fill { height: 100%; }
  .hive-confidence-basis { font-size: 8.5pt; font-style: italic; color: ${GREY}; margin-top: 4px; }

  /* SWOT matrix ------------------------------------------------------ */
  .hive-swot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .hive-swot-quad { border: 0.6pt solid ${LINE}; }
  .hive-swot-tag { color: white; font-weight: 700; font-size: 8.5pt; padding: 5px 8px; }
  .hive-swot-list { margin: 0; padding: 8px 20px; font-size: 9.5pt; }
  .hive-swot-list li { margin-bottom: 5px; }

  /* Tables ------------------------------------------------------------ */
  table.hive-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9.3pt; }
  table.hive-table th { background: ${INK}; color: white; text-align: left; padding: 7px 8px; font-size: 8.6pt; }
  table.hive-table td { padding: 7px 8px; border-bottom: 0.5pt solid ${LINE}; vertical-align: top; }
  table.hive-table tr:nth-child(even) td { background: ${MIST}; }

  .hive-visual { margin: 6px 0 12px 0; text-align: center; }
  .hive-visual svg { max-width: 100%; height: auto; }
  `;
}
