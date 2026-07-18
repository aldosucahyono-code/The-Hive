import type { ReportData, DecisionMapRow } from "./types.js";
import { baseStyles } from "./styles.js";
import { THEME, DECISION_COLORS } from "./theme.js";
import { renderIntelligencePage } from "./pageRenderer.js";
import { kpiRow, calloutBox, simpleTable } from "./components.js";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function renderExecutiveSummary(data: ReportData, accent: string): string {
  const es = data.executiveSummary;
  if (!es) return "";

  const rows = es.decisionMap
    .map((r: DecisionMapRow) => {
      const color = DECISION_COLORS[r.decision] ?? "#6B6B6E";
      return [
        esc(r.chapter),
        `<b style="color:${color}">${esc(r.decision)}</b>`,
        esc(r.reason),
      ];
    });

  return `
  <section class="hive-page">
    <div class="hive-eyebrow" style="color:${accent}">EXECUTIVE SUMMARY</div>
    <h1 class="hive-title">Satu Halaman untuk Memahami Seluruh Laporan</h1>
    <hr class="hive-hr"/>
    ${kpiRow(
      [
        { value: `${es.businessScore}/100`, label: "Business Score" },
        { value: es.overallDecision, label: "Keputusan Utama" },
        { value: `${es.confidencePct}%`, label: "Confidence" },
        { value: es.nextCheckpoint, label: "Checkpoint Berikutnya" },
      ],
      accent
    )}
    ${calloutBox("Ringkasan Eksekutif", es.summary, "#0A0A0B")}
    <h2 class="hive-h2">Peta Keputusan per Bab</h2>
    ${simpleTable(["Bab", "Keputusan", "Alasan Singkat"], rows)}
    ${calloutBox("Yang Harus Dikerjakan Minggu Ini", es.thisWeek, "#B87400")}
  </section>`;
}

function renderCeoRecommendation(data: ReportData, accent: string): string {
  if (!data.ceoRecommendation) return "";
  const items = data.ceoRecommendation
    .map(
      (d, i) => `
      <div style="display:flex; gap:12px; margin-bottom:10px;">
        <div style="flex:none; width:30px; height:30px; border-radius:50%; background:#B87400; color:white; display:flex; align-items:center; justify-content:center; font-weight:700;">${i + 1}</div>
        <div><b>${esc(d.title)}</b><br/>${esc(d.text)}</div>
      </div>`
    )
    .join("");
  return `
  <section class="hive-page">
    <div class="hive-eyebrow" style="color:${accent}">CEO RECOMMENDATION</div>
    <h1 class="hive-title">Lima Keputusan Pertama Jika Saya CEO ${esc(data.profile.businessName)}</h1>
    <hr class="hive-hr"/>
    <p class="hive-body">Bukan daftar tugas — ini urutan keputusan yang akan diambil lebih dulu, ditulis dari sudut pandang pemilik bisnis.</p>
    ${items}
  </section>`;
}

function renderAppendix(data: ReportData, accent: string): string {
  const a = data.appendix;
  if (!a) return "";
  return `
  <section class="hive-page">
    <div class="hive-eyebrow" style="color:${accent}">APPENDIX</div>
    <h1 class="hive-title">Referensi, Glosarium, dan Catatan Metodologi</h1>
    <hr class="hive-hr"/>
    <h2 class="hive-h2">1. Daftar Sumber Referensi</h2>
    ${simpleTable(
      ["Topik", "Sumber"],
      a.references.map((r) => [esc(r.topic), esc(r.source)])
    )}
    <h2 class="hive-h2">2. Business Glossary</h2>
    ${simpleTable(
      ["Istilah", "Arti"],
      a.glossary.map((g) => [esc(g.term), esc(g.meaning)])
    )}
    <h2 class="hive-h2">3. Data Confidence Matrix</h2>
    ${simpleTable(
      ["Bagian Analisis", "Sumber Data", "Confidence"],
      a.confidenceMatrix.map((c) => [esc(c.section), esc(c.source), `${c.confidencePct}%`])
    )}
    <h2 class="hive-h2">4. Data yang Dibutuhkan agar Laporan Berikutnya Lebih Akurat</h2>
    <ul>${a.dataNeeded.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
    <h2 class="hive-h2">5. Catatan AI</h2>
    ${calloutBox("Catatan Metodologi", a.aiNotes, "#0A0A0B")}
  </section>`;
}

/** Full content document HTML (everything except the cover, which is
 * rendered and merged separately — see renderPdf.ts). */
export function renderContentHtml(data: ReportData): string {
  const theme = THEME[data.tier];
  const sectionsHtml = data.sections
    .map((s) => renderIntelligencePage(s, theme.accent))
    .join("\n");

  return `<!DOCTYPE html>
  <html><head><meta charset="utf-8"/>
  <style>${baseStyles(theme)}</style>
  </head><body>
    <div class="hive-watermark">CONFIDENTIAL</div>
    ${renderExecutiveSummary(data, theme.accent)}
    ${sectionsHtml}
    ${renderCeoRecommendation(data, theme.accent)}
    ${renderAppendix(data, theme.accent)}
  </body></html>`;
}
