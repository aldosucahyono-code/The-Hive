// api/generate-report.ts
//
// Alur: data wizard pelanggan -> Claude (mengisi kata-kata sesuai rules di
// reportPrompt.ts) -> divalidasi -> report-engine (renderPdf.ts) merender
// jadi PDF sungguhan -> dikirim balik sebagai file.
//
// CATATAN PENTING (baca sebelum deploy):
// report-engine pakai Playwright (butuh Chromium) untuk merender PDF.
// Chromium penuh TIDAK cocok di Vercel serverless function biasa karena
// ukurannya. Sebelum endpoint ini benar-benar dipakai di production, ganti
// import "playwright" di api/_report-engine/renderPdf.ts menjadi kombinasi
// "playwright-core" + "@sparticuz/chromium" (dioptimalkan untuk serverless),
// ATAU jalankan proses render ini sebagai service terpisah (Railway/Render/
// Fly.io) dan panggil endpoint tersebut dari sini. Ini keputusan
// infrastruktur, bukan bagian yang saya putuskan sepihak.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "../report-engine/reportPrompt";
import { renderReportPdf } from "../report-engine/renderPdf";
import type { ReportData, Tier } from "../report-engine/types";

type WizardPayload = {
  jenisAnalisis: "baru" | "berjalan" | "";
  nama: string;
  email: string;
  namaBisnis: string;
  jenisBisnis: string;
  profesi?: string;
  lokasi: string;
  sejakKapan?: string;
  rencanaLaunching?: string;
  omsetBulanan?: string; // dipakai juga untuk "Estimasi Modal Awal" pada bisnis baru
  targetPelanggan?: string;
  tantangan: string;
  target: string;
  ceritaVisi?: string;
};

// Skema dikirim sebagai teks ke Claude supaya tahu persis nama field & tipe
// yang harus diisi — tanpa ini, hasil JSON-nya bisa meleset dari yang
// dibutuhkan report-engine untuk merender.
const SCHEMA_DESCRIPTION = `Skema JSON yang harus diisi (field wajib semua, kecuali ditandai opsional):
{
  "sections": [
    {
      "eyebrow": string,           // nama bagian, huruf kapital, mis. "MARKET INTELLIGENCE"
      "title": string,             // judul menarik, bukan cuma nama bagian
      "kpis": [{ "value": string, "label": string }, ...],  // 3-4 item
      "insight": string,
      "visual": null OR salah satu dari:
        { "type": "radar", "labels": string[], "values": number[] } |
        { "type": "bar", "labels": string[], "values": number[] } |
        { "type": "pie", "labels": string[], "values": number[] } |
        { "type": "matrix", "variant": "risk"|"priority", "xLabel": string, "yLabel": string, "points": [{ "label": string, "x": number, "y": number }, ...] } |
        { "type": "timeline", "milestones": [{ "period": string, "title": string }, ...] } |
        { "type": "swot", "data": { "kekuatan": string[], "kelemahan": string[], "peluang": string[], "ancaman": string[] } },
      "impact": string,
      "recommendation": string,
      "decision": "GO" | "WAIT" | "PIVOT" | "STOP",
      "confidencePct": number,
      "confidenceBasis": string,
      "extraHtml": string (opsional, HTML sederhana pakai class "hive-table" untuk tabel tambahan)
    }
  ],
  "executiveSummary": null ATAU (WAJIB untuk platinum) {
    "businessScore": number, "overallDecision": "GO"|"WAIT"|"PIVOT"|"STOP", "confidencePct": number,
    "nextCheckpoint": string, "summary": string,
    "decisionMap": [{ "chapter": string, "decision": "GO"|"WAIT"|"PIVOT"|"STOP", "reason": string }, ...],
    "thisWeek": string
  },
  "ceoRecommendation": null ATAU (WAJIB untuk platinum) [{ "title": string, "text": string }, ...] (5 item),
  "appendix": null ATAU (WAJIB untuk platinum) {
    "references": [{ "topic": string, "source": string }, ...],
    "glossary": [{ "term": string, "meaning": string }, ...],
    "confidenceMatrix": [{ "section": string, "source": string, "confidencePct": number }, ...],
    "dataNeeded": string[],
    "aiNotes": string
  },
  "coverBusinessScore": number,       // skor kesehatan bisnis keseluruhan, 0-100
  "coverConfidencePct": number,       // confidence keseluruhan, rata-rata dari semua bagian
  "coverExecutiveRecommendation": string,  // 1 kalimat rekomendasi utama
  "coverSnapshot": string             // 2-3 kalimat gambaran bisnis untuk cover
}`;

function buildUserPrompt(data: WizardPayload, tier: Tier): string {
  const isBaru = data.jenisAnalisis === "baru";
  return `Data dari pengguna:
- Jenis: ${isBaru ? "Bisnis baru (rencana, belum berjalan)" : "Bisnis sudah berjalan"}
- Nama pemilik: ${data.nama}
- Nama bisnis: ${data.namaBisnis}
- Jenis bisnis: ${data.jenisBisnis}
- Lokasi: ${data.lokasi}
${data.sejakKapan ? `- Sejak: ${data.sejakKapan}` : ""}
${data.rencanaLaunching ? `- Rencana tanggal launching: ${data.rencanaLaunching}` : ""}
${data.omsetBulanan ? `- ${isBaru ? "Estimasi modal awal" : "Rata-rata omset bulanan"} (disebutkan pengguna sendiri): ${data.omsetBulanan}` : ""}
${data.targetPelanggan ? `- Target pelanggan: ${data.targetPelanggan}` : ""}
- Tantangan terbesar: ${data.tantangan}
- Target 6-12 bulan ke depan: ${data.target}
${data.ceritaVisi ? `\nCerita & visi dalam kata-kata pengguna sendiri (sumber PALING PENTING untuk memahami cara pandang, ambisi, dan gaya bicara mereka — pakai untuk mengkalibrasi nada seluruh laporan, terutama executive summary/ringkasan):\n"${data.ceritaVisi}"` : ""}

${SCHEMA_DESCRIPTION}

Susun laporan paket ${tier.toUpperCase()} sesuai semua aturan di atas berdasarkan data ini.`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY belum diset di Vercel." });
  }

  const { wizardData, tier, lang } = req.body as {
    wizardData: WizardPayload;
    tier: Tier;
    lang?: "id" | "en";
  };
  const activeLang: "id" | "en" = lang === "en" ? "en" : "id";
  if (!wizardData?.namaBisnis || !tier || (tier !== "pro" && tier !== "platinum")) {
    return res.status(400).json({ error: "Data tidak lengkap atau tier tidak valid." });
  }

  try {
    // 1. Claude mengisi kata-kata & struktur analisisnya
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: tier === "platinum" ? 8000 : 4000,
      system: buildSystemPrompt(tier, wizardData.jenisAnalisis, activeLang),
      messages: [{ role: "user", content: buildUserPrompt(wizardData, tier) }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const aiContent = JSON.parse(cleaned);

    // 2. Gabungkan hasil AI dengan data yang memang seharusnya deterministik
    //    (kode), bukan dikarang ulang oleh AI setiap kali — nomor report,
    //    tanggal, harga, dsb.
    const today = new Date();
    const reportData: ReportData = {
      tier,
      price: tier === "pro" ? "Rp99.000" : "Rp299.000",
      tagline:
        tier === "pro"
          ? "AI Business Advisor — solusi praktis, langsung bisa diterapkan"
          : "AI Business Intelligence Consultant — mendukung keputusan strategis",
      profile: {
        ownerName: wizardData.nama,
        businessName: wizardData.namaBisnis,
        businessType: wizardData.jenisBisnis,
        profession: wizardData.profesi || "-",
        location: wizardData.lokasi,
        status: wizardData.jenisAnalisis === "baru" ? "Bisnis Baru" : "Bisnis Berjalan",
        initialCapital: wizardData.omsetBulanan || "-",
      },
      cover: {
        reportNo: `THV-${tier === "pro" ? "PRO" : "PLT"}-${today.toISOString().slice(0, 10).replace(/-/g, "")}`,
        date: today.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
        version: "1.0",
        industry: wizardData.jenisBisnis,
        preparedBy: "Beemo AI — THE HIVE Business Intelligence Engine",
        businessScore: aiContent.coverBusinessScore,
        confidencePct: aiContent.coverConfidencePct,
        executiveRecommendation: aiContent.coverExecutiveRecommendation,
        snapshot: aiContent.coverSnapshot,
      },
      executiveSummary: aiContent.executiveSummary ?? undefined,
      sections: aiContent.sections,
      ceoRecommendation: aiContent.ceoRecommendation ?? undefined,
      appendix: aiContent.appendix ?? undefined,
    };

    // 3. Render jadi PDF sungguhan
    const pdfBuffer = await renderReportPdf(reportData);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="THE-HIVE-${tier.toUpperCase()}-${wizardData.namaBisnis}.pdf"`
    );
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error("generate-report error:", err);
    return res.status(500).json({ error: "Gagal membuat laporan. Coba lagi." });
  }
}
