import type { ReportData } from "./types.js";
import { PRO_GREEN, PRO_GREEN_LIGHT, NAVY, NAVY_LIGHT, NAVY_BAND, PLAT_GOLD, GREY, FONT_STACK } from "./theme.js";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function hexLogoSvg(fill: string, dot: string, size = 30): string {
  // Same hexagon geometry used throughout the brand (header, KPI dots).
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <polygon points="25,6 75,6 100,50 75,94 25,94 0,50" fill="${fill}"/>
    <circle cx="50" cy="50" r="16" fill="${dot}"/>
  </svg>`;
}

function statChip(value: string, label: string, accent: string, bg: string, valueColor: string): string {
  return `
  <div style="flex:1; background:${bg}; border-top:2px solid ${accent}; text-align:center; padding:12px 4px;">
    <div style="font-size:19px; font-weight:700; color:${valueColor};">${esc(value)}</div>
    <div style="font-size:7.5px; color:${GREY}; margin-top:4px; letter-spacing:0.03em;">${esc(label.toUpperCase())}</div>
  </div>`;
}

function metaRow(labelA: string, valueA: string, labelB: string, valueB: string, muted: string, ink: string, line: string): string {
  return `
  <tr style="border-bottom:0.5px solid ${line};">
    <td style="padding:7px 10px 7px 0; font-size:8px; color:${muted}; width:80px;">${esc(labelA)}</td>
    <td style="padding:7px 14px 7px 0; font-size:9.5px; font-weight:700; color:${ink};">${valueA}</td>
    <td style="padding:7px 10px 7px 0; font-size:8px; color:${muted}; width:85px;">${esc(labelB)}</td>
    <td style="padding:7px 0; font-size:9.5px; font-weight:700; color:${ink};">${valueB}</td>
  </tr>`;
}

export function renderCoverHtml(data: ReportData, totalPages: number, readingTimeMin: number): string {
  const dark = data.tier === "platinum";
  const accent = dark ? PLAT_GOLD : PRO_GREEN;
  const ink = dark ? "#FFFFFF" : "#0A0A0B";
  const muted = dark ? "#AEB4D6" : GREY;
  const line = dark ? "#33395E" : "#E5E4E0";
  const bg = dark ? NAVY : "#FFFFFF";
  const chipBg = dark ? NAVY_LIGHT : "#F5F5F3";
  const tierLabel = dark ? "PLATINUM" : "PRO";

  const chips = [
    statChip(String(data.cover.businessScore), "Business Score", accent, chipBg, ink),
    statChip(`${data.cover.confidencePct}%`, "Confidence Level", accent, chipBg, ink),
    statChip(String(totalPages), "Jumlah Halaman", accent, chipBg, ink),
    statChip(`~${readingTimeMin} mnt`, "Estimasi Waktu Baca", accent, chipBg, ink),
  ].join("");

  const meta = `
    <table style="width:100%; border-collapse:collapse; margin-top:14px;">
      ${metaRow("Nomor Report", esc(data.cover.reportNo), "Prepared For", `${esc(data.profile.ownerName)} — ${esc(data.profile.businessName)}`, muted, ink, line)}
      ${metaRow("Tanggal", esc(data.cover.date), "Prepared By", esc(data.cover.preparedBy), muted, ink, line)}
      ${metaRow("Versi", esc(data.cover.version), "Nama Bisnis", esc(data.profile.businessName), muted, ink, line)}
      ${metaRow("Industry", esc(data.cover.industry), "Modal Awal", esc(data.profile.initialCapital), muted, ink, line)}
    </table>`;

  const recBg = dark ? PLAT_GOLD : PRO_GREEN_LIGHT;
  const recInk = dark ? NAVY : "#0A0A0B";

  const darkExtras = dark
    ? `
    <div style="position:fixed; top:0; left:0; width:100%; height:58mm; background:${NAVY_BAND}; z-index:0;"></div>
    <svg style="position:fixed; right:-40px; bottom:20mm; z-index:0;" width="260" height="260" viewBox="0 0 100 100">
      <polygon points="25,6 75,6 100,50 75,94 25,94 0,50" fill="none" stroke="#1E2445" stroke-width="1.2"/>
    </svg>`
    : "";

  return `<!DOCTYPE html>
  <html><head><meta charset="utf-8"/>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin:0; font-family:${FONT_STACK}; background:${bg}; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .frame { position:absolute; top:9mm; left:9mm; right:9mm; bottom:9mm; ${dark ? `border:0.9pt solid ${PLAT_GOLD};` : ""} }
    .content { position:relative; z-index:1; padding: 24mm 22mm; }
  </style></head>
  <body>
    ${darkExtras}
    <div class="frame"></div>
    <div class="content">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:2px;">
        ${hexLogoSvg(dark ? "#0A0A0B" : "#0A0A0B", dark ? PLAT_GOLD : PRO_GREEN, 26)}
        <div>
          <div style="font-size:14px; font-weight:700; color:${ink};">THE HIVE</div>
          <div style="font-size:8.5px; color:${muted};">Supported by Beemo AI</div>
        </div>
        <div style="margin-left:auto; text-align:right;">
          <div style="font-size:9px; font-weight:700; color:${accent};">Paket ${tierLabel}</div>
          <div style="font-size:8px; color:${muted};">Dokumen Rahasia — Laporan Analisis Bisnis</div>
        </div>
      </div>
      <hr style="border:none; border-top:0.6px solid ${line}; margin:10px 0 26px 0;"/>

      <h1 style="font-size:24px; margin:0 0 4px 0; color:${ink};">Laporan Analisis Bisnis</h1>
      <div style="font-size:9px; font-weight:700; color:${accent}; margin-bottom:2px;">Paket ${tierLabel === "PLATINUM" ? "Platinum" : "Pro"} — ${esc(data.price)}</div>
      <div style="font-size:8.5px; color:${muted}; margin-bottom:16px;">${esc(data.tagline)}</div>

      <div style="display:flex; gap:8px; border:0.6px solid ${line};">${chips}</div>

      <div style="${dark ? `background:${NAVY_LIGHT}; border:0.6px solid ${PLAT_GOLD}; border-radius:6px; padding:0 14px;` : ""}">
        ${meta}

        <div style="background:${recBg}; padding:12px 14px; margin-top:16px;">
          <div style="font-size:7.6px; font-weight:700; color:${recInk};">EXECUTIVE RECOMMENDATION</div>
          <div style="font-size:11px; font-weight:700; color:${recInk}; margin-top:4px; line-height:1.4;">${esc(data.cover.executiveRecommendation)}</div>
        </div>

        <div style="margin-top:14px; padding-bottom:16px;">
          <div style="font-size:7.6px; font-weight:700; color:${muted};">BUSINESS SNAPSHOT</div>
          <p style="font-size:9px; color:${ink}; line-height:1.5; margin:4px 0 0 0;">${esc(data.cover.snapshot)}</p>
        </div>
      </div>
    </div>
  </body></html>`;
}
