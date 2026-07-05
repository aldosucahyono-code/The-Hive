/**
 * HTML building blocks. Every Intelligence page is assembled from these
 * — this is the direct equivalent of dashboard_page() / kpi_row() /
 * callout_box() in the validated Python prototype.
 */
import { Kpi, Decision, SwotSpec } from "./types";
import { DECISION_COLORS, GOLD, GREEN, RED, INK, GREY, MIST, LINE, HONEY_DEEP } from "./theme";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * One shared font size for every KPI card in a row, sized to the single
 * longest word across ALL of them. This is the fix for the bug found in
 * QA: sizing each card independently made short values ("GO", "56") look
 * a different weight than long phrases ("Momen Keputusan") in the same
 * row, and could even force a mid-word character break. Never revert to
 * per-card sizing.
 */
function kpiRowFontSize(kpis: Kpi[]): number {
  let longest = 1;
  for (const { value } of kpis) {
    for (const word of String(value).split(/\s+/)) {
      longest = Math.max(longest, word.length);
    }
  }
  if (longest <= 4) return 22;
  if (longest <= 6) return 18;
  if (longest <= 9) return 15;
  if (longest <= 12) return 12;
  return 10.5;
}

export function kpiRow(kpis: Kpi[], accent = GOLD): string {
  const fs = kpiRowFontSize(kpis);
  const cards = kpis
    .map(
      (k) => `
      <div class="hive-kpi-card" style="border-top-color:${accent}">
        <div class="hive-kpi-value" style="font-size:${fs}px">${esc(k.value)}</div>
        <div class="hive-kpi-label">${esc(k.label.toUpperCase())}</div>
      </div>`
    )
    .join("");
  return `<div class="hive-kpi-row">${cards}</div>`;
}

export function calloutBox(label: string, text: string, barColor: string, bg = MIST): string {
  return `
  <div class="hive-callout">
    <div class="hive-callout-label" style="background:${barColor}">${esc(label.toUpperCase())}</div>
    <div class="hive-callout-body" style="background:${bg}">${esc(text)}</div>
  </div>`;
}

export function decisionConfidenceRow(decision: Decision, confidencePct: number, basis: string): string {
  const color = DECISION_COLORS[decision] ?? GREY;
  return `
  <div class="hive-decision-row">
    <div class="hive-decision-badge" style="background:${color}">
      <div class="hive-decision-tag">DECISION</div>
      <div class="hive-decision-value">${esc(decision)}</div>
    </div>
    <div class="hive-confidence">
      <div class="hive-confidence-tag">CONFIDENCE LEVEL — ${confidencePct}%</div>
      <div class="hive-confidence-track">
        <div class="hive-confidence-fill" style="width:${confidencePct}%; background:${HONEY_DEEP}"></div>
      </div>
      <div class="hive-confidence-basis">${esc(basis)}</div>
    </div>
  </div>`;
}

export function swotMatrix(data: SwotSpec): string {
  const quadrant = (label: string, color: string, items: string[]) => `
    <div class="hive-swot-quad">
      <div class="hive-swot-tag" style="background:${color}">${esc(label)}</div>
      <ul class="hive-swot-list">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
    </div>`;
  return `
  <div class="hive-swot-grid">
    ${quadrant("KEKUATAN", GREEN, data.kekuatan)}
    ${quadrant("KELEMAHAN", RED, data.kelemahan)}
    ${quadrant("PELUANG", GOLD, data.peluang)}
    ${quadrant("ANCAMAN", RED, data.ancaman)}
  </div>`;
}

export function pageIdentity(eyebrow: string, title: string, accent: string): string {
  return `
  <div class="hive-eyebrow" style="color:${accent}">${esc(eyebrow.toUpperCase())}</div>
  <h1 class="hive-title">${esc(title)}</h1>
  <hr class="hive-hr" />`;
}

export function simpleTable(headers: string[], rows: string[][]): string {
  const thead = `<tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>`;
  const tbody = rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("");
  return `<table class="hive-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}
