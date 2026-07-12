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
import { buildSystemPrompt } from "../report-engine/reportPrompt.js";
import { renderReportPdf } from "../report-engine/renderPdf.js";
import type { ReportData, Tier } from "../report-engine/types.js";
import { checkRateLimit, getClientIp, RATE_LIMIT_MESSAGE_ID, RATE_LIMIT_MESSAGE_EN } from "../services/rateLimit/checkRateLimit.js";

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
  // 2 pertanyaan "bucket info" dinamis (lihat api/generate-wizard-questions.ts)
  // — bucketQuestionN adalah teks pertanyaan yang benar-benar ditanyakan ke
  // pengguna (AI-generated, beda tiap bisnis), bukan label statis. Kalau
  // bisnis baru, salah satunya soal franchise/kemitraan vs bangun sendiri —
  // manfaatkan web search di bawah untuk riset reputasi brand kalau relevan.
  bucketQuestion1?: string;
  bucketAnswer1?: string;
  bucketQuestion2?: string;
  bucketAnswer2?: string;
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
${data.bucketQuestion1 && data.bucketAnswer1 ? `- ${data.bucketQuestion1} -> ${data.bucketAnswer1}` : ""}
${data.bucketQuestion2 && data.bucketAnswer2 ? `- ${data.bucketQuestion2} -> ${data.bucketAnswer2}` : ""}
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

  // Audit red-team Juli 2026 (CATATAN PENTING): endpoint ini TIDAK dipanggil
  // dari frontend manapun (sudah digantikan alur wizard -> generate-preview
  // -> promoteDraft -> generateFinalReport.ts yang benar-benar cek
  // pembayaran/membership) — kemungkinan besar kode mati yang masih
  // ter-deploy live sebagai Vercel Function, TANPA cek login maupun
  // pembayaran, dan `tier` di sini 100% dikontrol pemanggil. Artinya siapa
  // pun yang menemukan endpoint ini bisa mendapat PDF paket Platinum LENGKAP
  // secara gratis, sekaligus membebani biaya Claude (sampai 8000 token +
  // 8x web search) dan Playwright per panggilan — tanpa batas. Rate limit
  // di bawah ini HANYA tindakan darurat sementara, BUKAN solusi akhir;
  // keputusan yang tepat (hapus endpoint ini sepenuhnya, atau kalau memang
  // masih dipakai, pasang cek login+pembayaran yang sama seperti
  // generateFinalReport.ts) perlu dikonfirmasi dulu, bukan diputuskan
  // sepihak di sini.
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`generate-report:${ip}`, 3, 3600);
  if (!rl.allowed) {
    return res.status(429).json({ error: activeLang === "en" ? RATE_LIMIT_MESSAGE_EN : RATE_LIMIT_MESSAGE_ID });
  }

  try {
    // 1. Claude mengisi kata-kata & struktur analisisnya
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: tier === "platinum" ? 8000 : 4000,
      system: buildSystemPrompt(tier, wizardData.jenisAnalisis, activeLang),
      messages: [{ role: "user", content: buildUserPrompt(wizardData, tier) }],
      // Riset Sungguhan (directive PO — "kamu harus bisa menjadi semua
      // peranan... untuk menjawab seluruh keresahan/tantangan users"):
      // laporan baseline boleh mencari data faktual terkini (regulasi,
      // syarat izin, prosedur kemitraan/franchise) alih-alih hanya
      // mengandalkan pengetahuan lama model — lihat aturan RISET SUNGGUHAN
      // di report-engine/reportPrompt.ts.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK
      // terpasang lebih tua dari tipe web search tool, lihat catatan sama
      // di services/beemo/chat.ts.
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: tier === "platinum" ? 8 : 4 }] as any,
    });

    // Konkatenasi SEMUA blok teks — kalau Claude mencari dulu, jawabannya
    // bisa terpecah jadi beberapa blok teks yang disisipi hasil pencarian.
    const raw = message.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("");
    let cleaned = raw.replace(/```json|```/g, "").trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- sama
    // seperti sebelumnya (JSON.parse tanpa anotasi = any), dipertahankan
    // supaya properti aiContent.* di bawah tetap bisa dipakai langsung
    // tanpa cast satu-satu (perilaku sudah begini sejak sebelum perubahan ini).
    let aiContent: any;
    try {
      aiContent = JSON.parse(cleaned);
    } catch (parseErr) {
      // Fallback: kalau ada narasi pencarian yang lolos di luar JSON,
      // ambil satu objek JSON dari dalam teks alih-alih gagal total.
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw parseErr;
      cleaned = jsonMatch[0];
      aiContent = JSON.parse(cleaned);
    }

    // 2. Gabungkan hasil AI dengan data yang memang seharusnya deterministik
    //    (kode), bukan dikarang ulang oleh AI setiap kali — nomor report,
    //    tanggal, harga, dsb.
    const today = new Date();
    const reportData: ReportData = {
      tier,
      price: tier === "pro" ? "Rp99.000" : "Rp349.000",
      tagline:
        tier === "pro"
          ? "AI Business Advisor — solusi praktis, langsung bisa diterapkan"
          : "AI Consultant Mendalam — mendukung keputusan strategis",
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
        preparedBy: "Beemo AI — THE HIVE",
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
