// services/socialMedia/summaryGenerator.ts
//
// Ringkasan AI di atas data medsos kompetitor ASLI (username+followers
// saja) — SATU aturan mutlak dari pemilik produk, dikutip lengkap di sini
// supaya tidak hilang konteksnya kalau file ini diedit lagi nanti:
//
// "lanjutkan, tapi tampilannya kita buat secara sederhana, jangan sampai
// melanggar terms of service, jadi mungkin hanya username dan followers
// saja, lalu kita buat ringkasan perkembangan usaha tersebut.. khusus
// untuk bisnis baru kemitraan, jangan sampai membuat presepsi yang
// merugikan si pemilik merk, kalau memang hasilnya baik tulis baik dan
// recomendasikan (sesuai trend market) tapi kalau ternyata bisnis kurang
// baik, sampaikan dengan kata kata yang halus dan tidak merugikan pemilik
// usaha. kita hanya merekomendasikan user untuk review bisnis lain atau
// disarankan untuk users cek dan ricek kembali."
//
// Artinya:
// - Trend positif -> boleh dinyatakan LANGSUNG dan direkomendasikan
//   (selaras tren pasar).
// - Trend kurang baik -> TIDAK PERNAH ditulis sebagai vonis negatif
//   tentang bisnis/kompetitor tsb. Dibingkai sebagai ajakan untuk pengguna
//   "cek ulang/bandingkan dengan bisnis lain" — bukan celaan.
// - Berlaku EKSTRA ketat untuk bisnis kemitraan/franchise, karena reputasi
//   PEMILIK MEREK ikut dipertaruhkan, bukan cuma satu cabang/kompetitor.

import Anthropic from "@anthropic-ai/sdk";
import type { SocialMediaLiveRecord } from "./types.js";

const SYSTEM_PROMPT_ID = `Kamu adalah Beemo, asisten AI THE HIVE. Tugasmu: tulis SATU paragraf pendek (maksimal 4 kalimat) ringkasan perkembangan kehadiran media sosial kompetitor, berdasarkan HANYA data username Instagram + jumlah follower yang diberikan. JANGAN mengarang data yang tidak diberikan (jangan sebut engagement, jumlah post, isi konten — data itu TIDAK tersedia).

ATURAN NADA (WAJIB, tidak bisa ditawar):
- Kalau datanya menunjukkan tren positif/kompetitif (follower cukup besar/berkembang), tulis LANGSUNG secara positif dan berikan rekomendasi yang selaras tren pasar.
- Kalau datanya menunjukkan follower kompetitor kecil/kurang menonjol, JANGAN PERNAH menulis vonis negatif tentang bisnis kompetitor tsb (mis. "bisnis ini kurang bagus/gagal"). Bingkai secara halus sebagai ajakan ke pengguna untuk "cek ulang/bandingkan dengan bisnis lain di sekitarmu" — bukan penilaian buruk terhadap kompetitor.
- Ini berlaku LEBIH KETAT LAGI kalau nama kompetitor terindikasi bisnis kemitraan/franchise — reputasi pemilik merek ikut dipertaruhkan, jangan pernah membuat kesan merugikan pemilik merek.
- Jangan gunakan kata-kata yang menghakimi ("jelek", "gagal", "tidak laku", dst).
- Tulis dalam Bahasa Indonesia, nada suportif dan membangun, seperti konsultan bisnis yang berhati-hati.

Balas HANYA teks ringkasannya, tanpa markdown, tanpa awalan seperti "Ringkasan:".`;

const SYSTEM_PROMPT_EN = `You are Beemo, THE HIVE's AI assistant. Task: write ONE short paragraph (max 4 sentences) summarizing competitor social media presence, based ONLY on the given Instagram username + follower count data. DO NOT invent data that wasn't given (don't mention engagement, post count, or content — that data is NOT available).

TONE RULES (mandatory, non-negotiable):
- If the data shows a positive/competitive trend (follower counts are sizable/growing), state it directly and give a recommendation aligned with the market trend.
- If the data shows small/unremarkable competitor follower counts, NEVER write a negative verdict about that competitor's business (e.g. "this business isn't doing well/is failing"). Frame it gently as an invitation for the user to "double-check/compare with other businesses nearby" — not a negative judgment of the competitor.
- This applies EVEN MORE STRICTLY if the competitor name suggests a franchise/partnership business — the brand owner's reputation is also at stake, never create an impression that harms the brand owner.
- Do not use judgmental words ("bad", "failing", "unpopular", etc).
- Write in a supportive, constructive tone, like a careful business consultant.

Reply with ONLY the summary text, no markdown, no preamble like "Summary:".`;

/** Kalau tidak ada satupun akun ditemukan, TIDAK memanggil Claude sama
 * sekali (hemat biaya) — caller (getSocialMediaAnalysis.ts) menampilkan
 * EmptyState seperti biasa tanpa ringkasan. */
export async function generateLiveSummary(
  records: SocialMediaLiveRecord[],
  businessName: string,
  lang: "id" | "en"
): Promise<string | null> {
  if (records.length === 0) return null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null; // fail-soft — UI tetap tampilkan daftar username+follower tanpa ringkasan AI

  const dataLines = records
    .map((r) => `- @${r.username} (${r.competitorName}): ${r.followers.toLocaleString(lang === "id" ? "id-ID" : "en-US")} follower`)
    .join("\n");
  const userPrompt =
    lang === "id"
      ? `Bisnis pengguna: ${businessName}\n\nData kompetitor yang ditemukan:\n${dataLines}`
      : `User's business: ${businessName}\n\nCompetitor data found:\n${dataLines}`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 300,
      system: lang === "id" ? SYSTEM_PROMPT_ID : SYSTEM_PROMPT_EN,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("")
      .trim();
    return text || null;
  } catch (err) {
    console.error("[socialMedia] generateLiveSummary gagal:", err);
    return null; // fail-soft — sama seperti di atas, jangan gagalkan seluruh request hanya karena ringkasan AI gagal
  }
}
