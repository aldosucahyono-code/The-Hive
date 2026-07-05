import { IntelligencePage } from "./types";
import { kpiRow, calloutBox, decisionConfidenceRow, swotMatrix, pageIdentity } from "./components";
import { renderChart } from "./svgCharts";

/**
 * Renders exactly one Business Intelligence page. This is the single
 * template every chapter (Executive Intelligence, Market Intelligence,
 * Risk Intelligence, ...) passes through — the thing that guarantees
 * "every page has its own identity but the same trustworthy shape",
 * which was the core ask when this format was locked.
 */
export function renderIntelligencePage(page: IntelligencePage, accent: string): string {
  let visualHtml = "";
  if (page.visual) {
    if (page.visual.type === "swot") {
      visualHtml = `<div class="hive-visual">${swotMatrix(page.visual.data)}</div>`;
    } else {
      visualHtml = `<div class="hive-visual">${renderChart(page.visual)}</div>`;
    }
  }

  const analysisHtml = (page.analysis ?? [])
    .map((p) => `<p class="hive-body">${p}</p>`)
    .join("");

  return `
  <section class="hive-page">
    ${pageIdentity(page.eyebrow, page.title, accent)}
    ${kpiRow(page.kpis, accent)}
    ${calloutBox("Executive Insight", page.insight, "#0A0A0B")}
    ${visualHtml}
    ${analysisHtml}
    ${calloutBox("Business Impact", page.impact, "#3E8E5B")}
    ${calloutBox("AI Recommendation", page.recommendation, "#B87400")}
    ${decisionConfidenceRow(page.decision, page.confidencePct, page.confidenceBasis)}
    ${page.extraHtml ?? ""}
  </section>`;
}
