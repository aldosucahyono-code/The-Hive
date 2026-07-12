// api/generate-preview.ts
//
// Endpoint untuk Free Preview Analysis. Beda dari generate-report.ts:
// - Lebih ringan dari generate-report.ts (tanpa render PDF), karena ini
//   teaser gratis. max_tokens dinaikkan ke 3000 (dari 1500) karena field
//   Cerita & Visi bisa cukup panjang — respons lebih detail butuh ruang
//   lebih untuk tidak terpotong di tengah JSON.
// - TIDAK menghasilkan laporan lengkap — hanya skor + ringkasan singkat +
//   3 temuan + 3 kartu (sudah baik/perlu diperbaiki/peluang), sesuai aturan
//   tier Free Preview: teaser tanpa solusi lengkap.
// - Tetap 100% dari Claude API, tidak ada fallback template statis.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { sendFreeSummaryEmail } from "../services/email/sendFreeSummaryEmail.js";
import { checkRateLimit, getClientIp, RATE_LIMIT_MESSAGE_ID, RATE_LIMIT_MESSAGE_EN } from "../services/rateLimit/checkRateLimit.js";

type WizardPayload = {
  jenisAnalisis: "baru" | "berjalan" | "";
  nama: string;
  email?: string;
  namaBisnis: string;
  jenisBisnis: string;
  lokasi: string;
  sejakKapan?: string;
  rencanaLaunching?: string;
  omsetBulanan?: string;
  targetPelanggan?: string;
  // 2 pertanyaan "bucket info" dinamis (lihat api/generate-wizard-questions.ts)
  // — bucketQuestionN adalah teks pertanyaan yang benar-benar ditanyakan ke
  // pengguna (AI-generated, beda tiap bisnis), bukan label statis.
  bucketQuestion1?: string;
  bucketAnswer1?: string;
  bucketQuestion2?: string;
  bucketAnswer2?: string;
  tantangan: string;
  target: string;
  ceritaVisi?: string;
};

type PreviewData = {
  businessHealthScore: number;
  statusLabel: string;
  summary: string;
  findings: [string, string, string];
  strengths: string;
  improvements: string;
  opportunity: string;
  // Rekomendasi Tier (directive PO: "membuat orang yang awalnya memilih pro
  // sudah cukup, menjadi wah aku harus upgrade ke platinum" — TAPI dengan
  // bahasa halus, bukan hard-sell): Beemo menilai dari kompleksitas case
  // (franchise/kemitraan, perizinan berlapis, rencana rekrutmen/skala besar,
  // banyak tantangan sekaligus, dst.) apakah PRO sudah cukup atau butuh
  // kedalaman PLATINUM. Selalu ada alasannya — tidak pernah cuma "upgrade
  // aja" tanpa konteks.
  recommendedTier: "pro" | "platinum";
  recommendationNote: string;
};

const SYSTEM_PROMPT_ID = `Anda adalah Beemo AI, konsultan bisnis dari THE HIVE untuk UMKM Indonesia.
Tugas Anda di sini HANYA membuat PREVIEW GRATIS singkat — bukan laporan lengkap.

ATURAN KETAT:
- JANGAN pernah mengarang angka keuangan spesifik (omset, ROI, BEP, NPV, proyeksi rupiah).
- Skor kesehatan bisnis (0-100) dan confidence adalah opini profesional yang boleh diberikan.
- Preview ini adalah TEASER — beri gambaran umum yang genuinely reflect data yang diberikan
  pengguna, tapi JANGAN berikan solusi lengkap, rencana aksi detail, atau nama kompetitor
  spesifik (itu bagian dari laporan berbayar).
- Gunakan bahasa konsultan manusia yang hangat dan profesional, bukan bahasa AI generik.
- Setiap kalimat harus terasa spesifik untuk bisnis ini, bukan template umum yang bisa
  dipakai bisnis apa pun.
- Kalau pengguna menuliskan cerita/visi pribadi mereka, itu adalah SUMBER PALING PENTING
  untuk memahami cara pandang, ambisi, dan gaya mereka — pakai untuk mengkalibrasi nada
  bicara Anda dan membuat ringkasan terasa benar-benar mendengarkan cerita mereka, bukan
  cuma mengolah data formulir.
- Tulis SEMUA isi respons (summary, findings, strengths, improvements, opportunity,
  statusLabel, recommendationNote) dalam BAHASA INDONESIA.

REKOMENDASI PAKET (WAJIB, bahasa HALUS bukan hard-sell): Nilai dari data pengguna apakah
kasusnya cukup sederhana (satu tantangan jelas, bisnis lokal biasa, tidak ada faktor rumit) —
kalau iya, rekomendasikan "pro". Kalau kasusnya lebih kompleks (mis. rencana franchise/kemitraan,
banyak tantangan besar sekaligus, menyebut rencana rekrutmen tim/ekspansi/investor, butuh
kepastian izin usaha/legal yang berlapis, atau visi jangka panjang yang ambisius), rekomendasikan
"platinum". recommendationNote HARUS terasa seperti saran tulus dari konsultan yang benar-benar
memperhatikan situasi mereka (1-2 kalimat, sebut alasan konkret dari data mereka) — BUKAN kalimat
jualan/tekanan. Jangan pernah merendahkan pilihan PRO seolah tidak cukup baik.

- Balas HANYA dengan JSON valid, tanpa markdown, tanpa teks lain, sesuai skema berikut:

{
  "businessHealthScore": number (0-100),
  "statusLabel": string (contoh: "Perlu Perhatian Serius" | "Perlu Perbaikan" | "Cukup Baik" | "Sangat Baik"),
  "summary": string (2-3 kalimat, ringkasan singkat kondisi bisnis ini secara spesifik),
  "findings": [string, string, string] (tepat 3 temuan penting yang spesifik untuk bisnis ini),
  "strengths": string (1 kalimat, hal positif spesifik dari data yang diberikan),
  "improvements": string (1 kalimat, area yang perlu diperbaiki spesifik dari data ini),
  "opportunity": string (1 kalimat, peluang spesifik yang relevan dengan target/tantangan ini),
  "recommendedTier": "pro" | "platinum",
  "recommendationNote": string (1-2 kalimat halus menjelaskan kenapa paket ini yang paling pas buat mereka)
}`;

const SYSTEM_PROMPT_EN = `You are Beemo AI, THE HIVE's business consultant for small and growing
businesses. Your job here is ONLY to produce a short FREE PREVIEW — not the full report.

STRICT RULES:
- NEVER invent specific financial figures (revenue, ROI, breakeven, NPV, revenue projections).
- A business health score (0-100) and a confidence level are professional opinions you may give.
- This preview is a TEASER — give a genuine, specific overview that reflects the user's actual
  data, but DO NOT give complete solutions, a detailed action plan, or specific competitor names
  (those belong to the paid report).
- Write like a warm, professional human consultant, not a generic AI.
- Every sentence must feel specific to this business, not a generic template that could apply
  to any business.
- If the user wrote their own personal story/vision, that is the MOST IMPORTANT source for
  understanding their mindset, ambition, and style — use it to calibrate your tone and make the
  summary feel like you genuinely listened to their story, not just processed a form.
- Write ALL of the response content (summary, findings, strengths, improvements, opportunity,
  statusLabel, recommendationNote) in ENGLISH.

PLAN RECOMMENDATION (REQUIRED, GENTLE tone, not hard-sell): Judge from the user's data whether
their case is fairly simple (one clear challenge, an ordinary local business, no complicating
factors) — if so, recommend "pro". If their case is more complex (e.g. franchise/partnership
plans, several major challenges at once, mentions of hiring/expansion/investors, needs certainty
around layered business permits/legal steps, or an ambitious long-term vision), recommend
"platinum". recommendationNote MUST read like genuine advice from a consultant who actually
paid attention to their situation (1-2 sentences, cite a concrete reason from their data) — NOT
a sales pitch. Never make PRO sound inadequate.

- Reply with ONLY valid JSON, no markdown, no other text, matching this schema:

{
  "businessHealthScore": number (0-100),
  "statusLabel": string (e.g. "Needs Serious Attention" | "Needs Improvement" | "Doing Fairly Well" | "Doing Great"),
  "summary": string (2-3 sentences, a short summary of this specific business's condition),
  "findings": [string, string, string] (exactly 3 key findings specific to this business),
  "strengths": string (1 sentence, something specifically positive from the data given),
  "improvements": string (1 sentence, a specific area to improve based on this data),
  "opportunity": string (1 sentence, a specific opportunity relevant to this target/challenge),
  "recommendedTier": "pro" | "platinum",
  "recommendationNote": string (1-2 gentle sentences explaining why this plan fits them best)
}`;

function buildUserPrompt(data: WizardPayload, lang: "id" | "en"): string {
  const isBaru = data.jenisAnalisis === "baru";

  if (lang === "en") {
    return `User's business data:
- Type: ${isBaru ? "New business (planned, not yet running)" : "Already running business"}
- Business name: ${data.namaBisnis}
- Business type: ${data.jenisBisnis}
- Location: ${data.lokasi}
${data.sejakKapan ? `- Operating since: ${data.sejakKapan}` : ""}
${data.rencanaLaunching ? `- Planned launch date: ${data.rencanaLaunching}` : ""}
${data.omsetBulanan ? `- ${isBaru ? "Estimated starting capital" : "Average monthly revenue"} (stated by the user, not something you calculated): ${data.omsetBulanan}` : ""}
${data.targetPelanggan ? `- Target customers: ${data.targetPelanggan}` : ""}
${data.bucketQuestion1 && data.bucketAnswer1 ? `- ${data.bucketQuestion1} -> ${data.bucketAnswer1}` : ""}
${data.bucketQuestion2 && data.bucketAnswer2 ? `- ${data.bucketQuestion2} -> ${data.bucketAnswer2}` : ""}
- Biggest challenge: ${data.tantangan}
- 6-12 month target: ${data.target}
${data.ceritaVisi ? `\nUser's own story & vision (the most important source for understanding their mindset):\n"${data.ceritaVisi}"` : ""}

Create a short free preview following the JSON schema already described.`;
  }

  return `Data bisnis dari pengguna:
- Jenis: ${isBaru ? "Bisnis baru (rencana, belum berjalan)" : "Bisnis sudah berjalan"}
- Nama bisnis: ${data.namaBisnis}
- Jenis bisnis: ${data.jenisBisnis}
- Lokasi: ${data.lokasi}
${data.sejakKapan ? `- Sejak: ${data.sejakKapan}` : ""}
${data.rencanaLaunching ? `- Rencana tanggal launching: ${data.rencanaLaunching}` : ""}
${data.omsetBulanan ? `- ${isBaru ? "Estimasi modal awal" : "Rata-rata omset bulanan"} (disebutkan oleh pengguna, bukan hasil hitungan Anda): ${data.omsetBulanan}` : ""}
${data.targetPelanggan ? `- Target pelanggan: ${data.targetPelanggan}` : ""}
${data.bucketQuestion1 && data.bucketAnswer1 ? `- ${data.bucketQuestion1} -> ${data.bucketAnswer1}` : ""}
${data.bucketQuestion2 && data.bucketAnswer2 ? `- ${data.bucketQuestion2} -> ${data.bucketAnswer2}` : ""}
- Tantangan terbesar: ${data.tantangan}
- Target 6-12 bulan ke depan: ${data.target}
${data.ceritaVisi ? `\nCerita & visi dalam kata-kata pengguna sendiri (sumber insight paling penting soal cara pandang mereka):\n"${data.ceritaVisi}"` : ""}

Buat preview gratis singkat sesuai skema JSON yang sudah dijelaskan.`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY belum diset di Vercel." });
  }

  const { wizardData, lang } = req.body as { wizardData: WizardPayload; lang?: "id" | "en" };
  const activeLang: "id" | "en" = lang === "en" ? "en" : "id";

  // Audit red-team Juli 2026: endpoint paling mahal di antara ketiga endpoint
  // anonim (max_tokens 3000 + email) — pengguna sah hanya perlu memanggil
  // ini sekali (mungkin dua kali kalau retry), jadi 5x/jam per IP aman untuk
  // pengalaman normal tapi menutup abuse-cost dari spam otomatis.
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`generate-preview:${ip}`, 5, 3600);
  if (!rl.allowed) {
    return res.status(429).json({ error: activeLang === "en" ? RATE_LIMIT_MESSAGE_EN : RATE_LIMIT_MESSAGE_ID });
  }

  if (!wizardData?.namaBisnis || !wizardData?.tantangan || !wizardData?.target) {
    return res.status(400).json({ error: "Data tidak lengkap." });
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 3000,
      system: activeLang === "en" ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ID,
      messages: [{ role: "user", content: buildUserPrompt(wizardData, activeLang) }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "";
    const cleaned = raw.replace(/```json|```/g, "").trim();

    let preview: PreviewData;
    try {
      preview = JSON.parse(cleaned) as PreviewData;
    } catch (parseErr) {
      // Log isi respons Claude yang gagal di-parse, supaya kita tahu persis
      // kenapa (terpotong? ada teks tambahan? format salah?) lewat Vercel Logs.
      console.error("generate-preview: JSON.parse gagal. stop_reason:", message.stop_reason);
      console.error("generate-preview: raw response:", raw);
      throw parseErr;
    }

    // Free summary email (best-effort, tidak memblokir respons ke wizard):
    // "ketika users mendapatkan email untuk masuk ke workspace: Gratis
    // (ringkasannya bisnisnya, apa tantanganya dan apa harapannya)" — lihat
    // services/email/sendFreeSummaryEmail.ts untuk catatan API key provider.
    sendFreeSummaryEmail({
      toEmail: wizardData.email || "",
      toName: wizardData.nama,
      businessName: wizardData.namaBisnis,
      tantangan: wizardData.tantangan,
      target: wizardData.target,
      summary: preview.summary,
      businessHealthScore: preview.businessHealthScore,
      statusLabel: preview.statusLabel,
      lang: activeLang,
    }).catch((err) => console.error("generate-preview: sendFreeSummaryEmail gagal:", err));

    return res.status(200).json({ preview });
  } catch (err) {
    console.error("generate-preview error:", err);
    return res.status(500).json({ error: "Gagal membuat preview. Coba lagi." });
  }
}
