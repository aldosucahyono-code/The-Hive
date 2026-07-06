// api/generate-preview.ts
//
// Endpoint untuk Free Preview Analysis. Beda dari generate-report.ts:
// - Jauh lebih ringan (max_tokens kecil, tanpa PDF), karena ini teaser gratis.
// - TIDAK menghasilkan laporan lengkap — hanya skor + ringkasan singkat +
//   3 temuan + 3 kartu (sudah baik/perlu diperbaiki/peluang), sesuai aturan
//   tier Free Preview: teaser tanpa solusi lengkap.
// - Tetap 100% dari Claude API, tidak ada fallback template statis.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

type WizardPayload = {
  jenisAnalisis: "baru" | "berjalan" | "";
  nama: string;
  namaBisnis: string;
  jenisBisnis: string;
  lokasi: string;
  sejakKapan?: string;
  omsetBulanan?: string;
  targetPelanggan?: string;
  tantangan: string;
  target: string;
};

type PreviewData = {
  businessHealthScore: number;
  statusLabel: string;
  summary: string;
  findings: [string, string, string];
  strengths: string;
  improvements: string;
  opportunity: string;
};

const SYSTEM_PROMPT = `Anda adalah Beemo AI, konsultan bisnis dari THE HIVE untuk UMKM Indonesia.
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
- Balas HANYA dengan JSON valid, tanpa markdown, tanpa teks lain, sesuai skema berikut:

{
  "businessHealthScore": number (0-100),
  "statusLabel": string (contoh: "Perlu Perhatian Serius" | "Perlu Perbaikan" | "Cukup Baik" | "Sangat Baik"),
  "summary": string (2-3 kalimat, ringkasan singkat kondisi bisnis ini secara spesifik),
  "findings": [string, string, string] (tepat 3 temuan penting yang spesifik untuk bisnis ini),
  "strengths": string (1 kalimat, hal positif spesifik dari data yang diberikan),
  "improvements": string (1 kalimat, area yang perlu diperbaiki spesifik dari data ini),
  "opportunity": string (1 kalimat, peluang spesifik yang relevan dengan target/tantangan ini)
}`;

function buildUserPrompt(data: WizardPayload): string {
  const isBaru = data.jenisAnalisis === "baru";
  return `Data bisnis dari pengguna:
- Jenis: ${isBaru ? "Bisnis baru (rencana, belum berjalan)" : "Bisnis sudah berjalan"}
- Nama bisnis: ${data.namaBisnis}
- Jenis bisnis: ${data.jenisBisnis}
- Lokasi: ${data.lokasi}
${data.sejakKapan ? `- Sejak: ${data.sejakKapan}` : ""}
${data.omsetBulanan ? `- ${isBaru ? "Estimasi modal awal" : "Rata-rata omset bulanan"} (disebutkan oleh pengguna, bukan hasil hitungan Anda): ${data.omsetBulanan}` : ""}
${data.targetPelanggan ? `- Target pelanggan: ${data.targetPelanggan}` : ""}
- Tantangan terbesar: ${data.tantangan}
- Target 6-12 bulan ke depan: ${data.target}

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

  const { wizardData } = req.body as { wizardData: WizardPayload };
  if (!wizardData?.namaBisnis || !wizardData?.tantangan || !wizardData?.target) {
    return res.status(400).json({ error: "Data tidak lengkap." });
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(wizardData) }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const preview = JSON.parse(cleaned) as PreviewData;

    return res.status(200).json({ preview });
  } catch (err) {
    console.error("generate-preview error:", err);
    return res.status(500).json({ error: "Gagal membuat preview. Coba lagi." });
  }
}
