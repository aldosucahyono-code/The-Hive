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
// masukan di chat wizard... intinya mengajak mereka aktif akses the hive,
// bercerita usahanya sampai dimana" -- lalu diperhalus lagi (Juli 2026):
// "sudah keren, cuma terlalu panjang dan buat lebih emosional/menyentuh
// pelanggan" -- panjang dipangkas jadi 60-90 kata, dan prompt secara
// eksplisit diminta menyentuh perasaan lebih dalam (bukan sekadar
// menyinggung tema, tapi benar-benar terasa personal/mengharukan kalau
// memang relevan dengan tantangan mereka).

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

Gaya tulisan: hangat, jujur, seperti sahabat dekat yang paham betul perjuangan mereka -- BUKAN bahasa marketing/jualan, BUKAN template motivasi generik. Padukan secara nyata tema hidup, cinta/keluarga, dan bisnis -- tunjukkan bahwa kesulitan bisnis mereka adalah bagian dari perjuangan hidup yang lebih besar: keluarga yang mereka perjuangkan, waktu yang mereka korbankan, mimpi yang mereka jaga diam-diam. SENTUH PERASAAN SECARA NYATA -- boleh menyayat/mengharukan kalau memang pas dengan tantangan mereka (lelah, khawatir, kangen waktu untuk orang terkasih, takut gagal, dst), tapi tetap jujur dan spesifik untuk orang ini -- JANGAN klise, JANGAN berlebihan sampai terasa dibuat-buat.

Aturan keras:
- Bahasa Indonesia, sapaan "kamu", panjang 60-90 kata SAJA -- singkat, padat, setiap kalimat harus kena, tidak ada kalimat basa-basi.
- WAJIB menyinggung tantangan dan harapan spesifik yang diberikan -- jangan generik.
- JANGAN mengarang klaim/statistik/janji hasil bisnis apapun.
- Akhiri dengan SATU kalimat ajakan LEMBUT untuk buka THE HIVE dan cerita sudah sampai mana usahanya -- bukan ajakan membeli/upgrade paket.
- JANGAN bullet point, JANGAN subjek email di dalam teks, JANGAN tanda tangan formal -- cukup "-- THE HIVE" di baris terakhir.
- Maksimal 2 paragraf pendek -- ini email singkat yang menyentuh, bukan esai.
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
      max_tokens: 400,
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
