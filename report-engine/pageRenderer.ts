import type { IntelligencePage } from "./types.js";
import { kpiRow, calloutBox, decisionConfidenceRow, swotMatrix, pageIdentity, esc, sanitizeExtraHtml } from "./components.js";
import { renderChart } from "./svgCharts.js";

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

  // Audit Juli 2026 (red team): sebelumnya paragraf `analysis` dicetak
  // mentah (tanpa esc()) — beda dengan SEMUA field teks lain di halaman ini
  // (insight/impact/recommendation lewat calloutBox, kpis lewat kpiRow,
  // title/eyebrow lewat pageIdentity — semua sudah esc()). Karena isi
  // `analysis` berasal dari output AI yang konteksnya termasuk teks bebas
  // milik pengguna (nama bisnis, cerita bisnis, Business Update, pertanyaan
  // Decision Journal), tanda "<"/">" di dalamnya bisa dianggap tag HTML oleh
  // Playwright saat merender PDF. Disamakan dengan pola esc() di seluruh
  // report-engine, bukan pengecualian.
  const analysisHtml = (page.analysis ?? [])
    .map((p) => `<p class="hive-body">${esc(p)}</p>`)
    .join("");

  // `extraHtml` SATU-SATUNYA tempat kita sengaja mencetak markup AI apa
  // adanya (tabel "Data Completeness", lihat reportPrompt.ts) — disaring
  // lewat sanitizeExtraHtml() supaya tag berbahaya (script/img/iframe/dst,
  // event handler on*=, javascript:/data: URI) tidak ikut lolos hanya
  // karena model menyimpang dari instruksi "hanya tabel".
  const extraHtml = page.extraHtml ? sanitizeExtraHtml(page.extraHtml) : "";

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
    ${extraHtml}
  </section>`;
}
