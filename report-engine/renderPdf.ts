import { chromium as playwrightChromium } from "playwright-core";
import { PDFDocument } from "pdf-lib";
import { ReportData } from "./types.js";
import { renderContentHtml } from "./reportTemplate.js";
import { renderCoverHtml } from "./coverTemplate.js";
import { PLAT_GOLD, PRO_GREEN, PRO_GREEN_LIGHT, GREY } from "./theme.js";

// Infra fix (item 4 dari audit Juli 2026): Chromium PENUH (paket "playwright")
// terlalu besar untuk Vercel serverless function (limit 50MB per function,
// Chromium sendiri >280MB) — dulu import "playwright" langsung di sini
// SECARA TEKNIS akan gagal deploy begitu endpoint ini benar-benar dipanggil
// di Vercel. Sekarang pakai "playwright-core" (~5MB, tanpa browser bundled)
// + "@sparticuz/chromium" (~40MB, build Chromium yang dioptimalkan khusus
// untuk Lambda/Vercel) — total tetap di bawah limit 50MB.
//
// Di LOKAL (npm run dev, testing manual), tetap pakai Chromium biasa yang
// sudah terpasang lewat `npx playwright install chromium` — @sparticuz/chromium
// dibuat khusus untuk lingkungan Lambda/Vercel dan TIDAK jalan di macOS/Windows
// biasa. Deteksi lingkungan lewat env var yang Vercel/AWS Lambda set otomatis
// (VERCEL / AWS_LAMBDA_FUNCTION_NAME) — bukan NODE_ENV, supaya "vercel dev"
// lokal tetap kebaca sebagai lokal.
async function launchChromium() {
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
  if (isServerless) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- import
    // dinamis supaya paket ini TIDAK di-bundle/dituntut ada saat development
    // lokal (developer lokal belum tentu install @sparticuz/chromium).
    const chromiumBinary = (await import("@sparticuz/chromium")).default;
    return playwrightChromium.launch({
      args: chromiumBinary.args,
      executablePath: await chromiumBinary.executablePath(),
      headless: true,
    });
  }
  return playwrightChromium.launch();
}

const A4_MARGIN = { top: "30mm", bottom: "20mm", left: "22mm", right: "22mm" };

function headerTemplate(tierLabel: string, accent: string, hexFill: string): string {
  // Playwright header/footer templates only support inline styles — no
  // access to the main stylesheet — so this stays deliberately minimal.
  return `
  <div style="width:100%; font-family:Helvetica,Arial,sans-serif; font-size:7.5px; color:#0A0A0B;
              padding:0 22mm; display:flex; justify-content:space-between; align-items:center;
              border-bottom:0.5px solid #E5E4E0; padding-bottom:6px; margin-top:10mm;">
    <div style="display:flex; align-items:center; gap:6px;">
      <svg width="14" height="14" viewBox="0 0 100 100">
        <polygon points="25,6 75,6 100,50 75,94 25,94 0,50" fill="#0A0A0B"/>
        <circle cx="50" cy="50" r="18" fill="${hexFill}"/>
      </svg>
      <div>
        <div style="font-size:9px; font-weight:700;">THE HIVE</div>
        <div style="font-size:6.5px; color:#6B6B6E;">Supported by Beemo AI</div>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:7.5px; font-weight:700; color:${accent};">Paket ${tierLabel}</div>
      <div style="font-size:6.5px; color:#6B6B6E;">Dokumen Rahasia — Laporan Analisis Bisnis</div>
    </div>
  </div>`;
}

function footerTemplate(): string {
  return `
  <div style="width:100%; font-family:Helvetica,Arial,sans-serif; font-size:7px; color:#6B6B6E;
              padding:0 22mm; display:flex; justify-content:space-between;
              border-top:0.5px solid #E5E4E0; padding-top:4px; margin-bottom:8mm;">
    <span>THE HIVE — AI Business Partner</span>
    <span>Halaman <span class="pageNumber"></span></span>
    <span>Dibuat oleh Beemo AI</span>
  </div>`;
}

/**
 * Renders a ReportData payload into a final PDF buffer.
 * Two Playwright renders (content, then cover once the real page count
 * is known) merged with pdf-lib — one content render, not two, unlike
 * the original Python prototype's full-document two-pass build.
 */
export async function renderReportPdf(data: ReportData): Promise<Buffer> {
  const browser = await launchChromium();
  try {
    const tierLabel = data.tier === "platinum" ? "PLATINUM" : "PRO";
    const accent = data.tier === "platinum" ? PLAT_GOLD : PRO_GREEN;
    const hexFill = data.tier === "platinum" ? PLAT_GOLD : PRO_GREEN_LIGHT;

    // 1. Render content pages (everything except the cover).
    const contentPage = await browser.newPage();
    await contentPage.setContent(renderContentHtml(data), { waitUntil: "networkidle" });
    const contentPdf = await contentPage.pdf({
      format: "A4",
      printBackground: true,
      margin: A4_MARGIN,
      displayHeaderFooter: true,
      headerTemplate: headerTemplate(tierLabel, accent, hexFill),
      footerTemplate: footerTemplate(),
    });
    await contentPage.close();

    const contentDoc = await PDFDocument.load(contentPdf);
    const contentPageCount = contentDoc.getPageCount();
    const totalPages = contentPageCount + 1; // +1 for the cover
    const readingTimeMin = Math.max(12, totalPages * 2);

    // 2. Render the cover now that the real page count is known — a
    // single extra render, not a full-document rebuild.
    const coverPage = await browser.newPage();
    await coverPage.setContent(renderCoverHtml(data, totalPages, readingTimeMin), {
      waitUntil: "networkidle",
    });
    const coverPdf = await coverPage.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    await coverPage.close();

    // 3. Merge cover + content into the final deliverable.
    const finalDoc = await PDFDocument.create();
    const coverDoc = await PDFDocument.load(coverPdf);
    const [coverPageEmbed] = await finalDoc.copyPages(coverDoc, [0]);
    finalDoc.addPage(coverPageEmbed);
    const contentPages = await finalDoc.copyPages(contentDoc, contentDoc.getPageIndices());
    contentPages.forEach((p) => finalDoc.addPage(p));

    const bytes = await finalDoc.save();
    return Buffer.from(bytes);
  } finally {
    await browser.close();
  }
}
