// services/nurture/buildNurtureMessage.ts
//
// Menyusun isi email dorongan personal bulanan lewat Claude (pola sama
// dengan services/reports/generateFinalReport.ts: @anthropic-ai/sdk,
// model "claude-sonnet-5", ANTHROPIC_API_KEY). TIDAK pakai web_search --
// ini bukan riset, murni menyusun kata-kata dari data yang sudah ada
// (tantangan/harapan/jenis usaha dari wizard).
//
// Permintaan pemilik produk: "kata-kata bijak perpaduan antara: hidup,
// cinta, keluarga dan bisnis sesuai kesulitan dan harapan yang mereka
// masukan di chat wizard... setiap pelanggan juga mendapatkan email push...
// yang isi kata-katanya juga berbeda, mengikuti perkembangan usaha
// mereka... intinya mengajak mereka aktif akses the hive, bercerita
// usahanya sampai dimana."

import Anthropic from "@anthropic-ai/sdk";

export type NurturePersona = {
  namaBisnis: string;
  jenisBisnis: string;
  jenisAnalisis: string; // "baru" | lainnya (existing)
  tantangan: string;
  target: string;
  nama: string;
};

const SYSTEM_PROMPT = `Kamu menulis email personal singkat untuk pemilik UMKM Indonesia, atas nama THE HIVE (konsultan bisnis AI).

Gaya tulisan: hangat, jujur, seperti sahabat yang juga paham bisnis -- BUKAN bahasa marketing/jualan, BUKAN template motivasi generik. Padukan secara halus tema hidup, cinta/keluarga, dan bisnis -- tunjukkan bahwa kesulitan bisnis mereka juga bagian dari perjalanan hidup mereka yang lebih besar (keluarga yang mereka perjuangkan, mimpi yang mereka jaga), tanpa berlebihan atau menye-menye.

Aturan keras:
- Bahasa Indonesia, sapaan "kamu", panjang 100-160 kata.
- WAJIB menyinggung tantangan dan harapan spesifik yang diberikan -- jangan generik.
- JANGAN mengarang klaim/statistik/janji hasil bisnis apapun.
- Akhiri dengan ajakan LEMBUT (bukan mendesak) untuk buka THE HIVE dan cerita sudah sampai mana usahanya -- bukan ajakan membeli/upgrade paket.
- JANGAN pakai bullet point, JANGAN pakai subjek email di dalam teks, JANGAN tanda tangan formal berlebihan -- cukup "-- THE HIVE" di baris terakhir.
- Keluarkan HANYA teks email polos (bukan HTML, bukan markdown, bukan JSON).`;

function buildUserPrompt(p: NurturePersona): string {
  const stage = p.jenisAnalisis === "baru" ? "baru mau memulai usaha" : "sudah menjalankan usahanya";
  return `Nama pemilik: ${p.nama || "pemilik usaha"}
Nama usaha: ${p.namaBisnis || "usahanya"}
Jenis usaha: ${p.jenisBisnis || "usaha kecil"}
Tahap: ${stage}
Tantangan yang mereka sebutkan: ${p.tantangan || "belum spesifik"}
Harapan/target yang mereka sebutkan: ${p.target || "belum spesifik"}

Tulis satu email personal untuk orang ini sesuai aturan di atas.`;
}

export async function buildNurtureMessage(persona: NurturePersona): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("buildNurtureMessage: ANTHROPIC_API_KEY belum diset.");
    return null;
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(persona) }],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("")
      .trim();
    return text || null;
  } catch (err) {
    console.error("buildNurtureMessage: gagal memanggil Claude:", err);
    return null;
  }
}
