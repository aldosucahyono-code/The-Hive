// api/generate-wizard-questions.ts
//
// Menghasilkan TEPAT 2 pertanyaan tambahan wajib untuk wizard chat landing
// page, disesuaikan secara dinamis dengan nama bisnis & jenis bisnis yang
// disebutkan pengguna (bukan teks statis di kode) — directive PO: "beemo
// benar2 memikirkan pertanyaan apa secara otomatis sesuai dengan brand dan
// jenis bisnis... jangan mutlak dan mengacu saja pada code."
//
// Aturan isi (lihat system prompt di bawah untuk detail lengkap):
// - Bisnis baru: salah satu pertanyaan WAJIB soal franchise/kemitraan vs
//   bangun sendiri (supaya riset reputasi/tren brand bisa dilakukan
//   terpisah saat laporan berbayar disusun, lihat report-engine/reportPrompt.ts).
// - Bisnis berjalan: salah satu pertanyaan WAJIB soal status legalitas/izin
//   usaha, tapi dengan framing sederhana (bukan itemized NIB/sertifikat
//   halal/dsb).
// - Pertanyaan lainnya digali dari riset ringan (web search opsional) soal
//   tantangan umum di industri & brand spesifik ini.
// - Tidak boleh duplikat topik pertanyaan wizard yang sudah ada (nama, email,
//   profesi, nama bisnis, jenis bisnis, lokasi, target pelanggan, rencana
//   launching/sejak kapan, modal awal/omset, tantangan, target, cerita/visi).
// - Kalau topik yang relevan terasa sensitif/pribadi, diganti dengan
//   pertanyaan yang lebih general/aman.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, getClientIp, RATE_LIMIT_MESSAGE_ID, RATE_LIMIT_MESSAGE_EN } from "../services/rateLimit/checkRateLimit.js";
import { logClaudeUsage, extractUsage } from "../services/costTracking/logUsage.js";

type Payload = {
  jenisAnalisis: "baru" | "berjalan";
  namaBisnis: string;
  jenisBisnis: string;
  lang?: "id" | "en";
};

type DynamicQuestion = { question: string; placeholder: string };

// produkJasaExamples (bugfix Juli 2026, "Dunia Pasir/Penyedia Pasir Besi
// Lumajang" masih disodori contoh nasi goreng/kopi): SEBELUM ini, contoh di
// pertanyaan "produk/jasa utama apa" (ChatFlow.tsx) dipetakan dari daftar
// keyword statis di kode (PRODUK_JASA_EXAMPLE_MAP) -- jenis bisnis apa pun
// yang tidak cocok satupun keyword-nya (mis. "penyedia pasir", pertambangan,
// distributor material, dst) selalu jatuh ke contoh default F&B, padahal
// nama & jenis bisnisnya sudah jelas beda sama sekali. Reuse endpoint yang
// SAMA (bukan bikin panggilan API baru) supaya tidak nambah latency --
// endpoint ini SUDAH dipanggil sedini mungkin (begitu namaBisnis+jenisBisnis
// terisi, jauh sebelum pertanyaan produkJasa muncul beberapa langkah
// kemudian), jadi menambah 1 field lagi di respons yang sama tidak menunda
// apa pun. Kalau field ini kosong/API gagal, ChatFlow.tsx tetap fallback ke
// peta keyword statis yang lama -- alur tidak pernah macet.
type DynamicProdukJasaExamples = [string, string];

// --- Mode "validateAnswer" (fitur baru, Juli 2026) -------------------------
// Reuse endpoint ini (bukan file api/ baru) supaya jumlah Vercel Serverless
// Function tidak melebihi batas 12 di plan Hobby — lihat catatan yang sama
// di services/business/promoteDraft.ts. Dipanggil ChatFlow.tsx SETELAH
// validasi sintaks lokal (utils/validation.ts) lolos, untuk field free-text
// yang rawan "tidak nyambung" dengan pertanyaan (directive PO: "jangan
// sampai jawaban user beda dari pertanyaan", termasuk alamat yang kota &
// provinsinya harus selaras).
type ValidateAnswerPayload = {
  mode: "validateAnswer";
  questionText: string;
  answer: string;
  fieldKind: "lokasi" | "freeText";
  lang?: "id" | "en";
};

const VALIDATE_SYSTEM_ID = `Anda adalah validator jawaban wizard bisnis THE HIVE. Tugas Anda HANYA
menilai apakah jawaban pengguna RELEVAN dengan topik pertanyaan yang
diberikan — BUKAN menilai kualitas, kelengkapan, atau kebenaran isi jawaban.

ATURAN:
1. Kalau fieldKind = "lokasi": jawaban harus berupa alamat/lokasi. Kalau
   jawaban menyebut kota/kabupaten/wilayah DAN provinsi, keduanya harus
   benar-benar selaras secara geografi nyata di Indonesia (contoh:
   "Surabaya, Jawa Timur" valid; "Surabaya, Jawa Barat" TIDAK valid karena
   Surabaya berada di Jawa Timur, bukan Jawa Barat; "Papua, Jawa Timur"
   TIDAK valid karena Papua adalah provinsi/pulau sendiri, sama sekali
   bukan bagian dari Jawa Timur — ini kesalahan yang WAJIB ditangkap,
   bukan cuma kesalahan provinsi tetangga). Kalau hanya kota/kabupaten/
   provinsi saja (tanpa kombinasi dua tingkat wilayah) dan nama itu memang
   tempat nyata di Indonesia, tetap valid.
2. Untuk fieldKind = "freeText": jawaban invalid HANYA kalau jelas-jelas
   TIDAK NYAMBUNG dengan topik pertanyaan (contoh: pertanyaan soal posisi/
   peran di bisnis dijawab dengan alamat rumah; pertanyaan soal tantangan
   bisnis dijawab dengan resep masakan yang tidak ada hubungannya).
3. JANGAN terlalu ketat — jawaban singkat tapi tetap on-topic (mis. "belum
   ada" untuk pertanyaan status izin usaha) tetap VALID. Kalau ragu-ragu,
   anggap VALID (manfaatkan keraguan untuk pengguna, bukan untuk menolak).
4. Balas HANYA dengan JSON, tanpa markdown, tanpa teks lain, format persis:
{"valid": true} atau {"valid": false}`;

const VALIDATE_SYSTEM_EN = `You are an answer validator for THE HIVE's business wizard. Your ONLY job is
to judge whether the user's answer is RELEVANT to the topic of the question
given — NOT to judge the quality, completeness, or truthfulness of the answer.

RULES:
1. If fieldKind = "lokasi": the answer should be an address/location. If the
   answer names BOTH a city/regency/region and a province, they must be
   genuinely geographically consistent in Indonesia (e.g. "Surabaya, East
   Java" is valid; "Surabaya, West Java" is NOT valid because Surabaya is
   in East Java, not West Java; "Papua, East Java" is NOT valid because
   Papua is its own province/island, nowhere near East Java — this MUST be
   caught, not just neighboring-province mistakes). If only a single level
   (just a city, or just a province) is given and it's a real place in
   Indonesia, it's still valid.
2. For fieldKind = "freeText": the answer is invalid ONLY if it's clearly
   UNRELATED to the question's topic (e.g. a question about the person's
   role in the business answered with a home address; a question about the
   business's biggest challenge answered with an unrelated recipe).
3. Do NOT be overly strict — a short but on-topic answer (e.g. "not yet" for
   a question about business permit status) is still VALID. When in doubt,
   default to VALID (give the user the benefit of the doubt, don't reject).
4. Reply with ONLY JSON, no markdown, no other text, in exactly this format:
{"valid": true} or {"valid": false}`;

async function handleValidateAnswer(
  payload: ValidateAnswerPayload,
  apiKey: string,
  res: VercelResponse,
  ip: string
) {
  const activeLang: "id" | "en" = payload.lang === "en" ? "en" : "id";
  if (!payload.questionText || !payload.answer || !payload.fieldKind) {
    // Data tidak lengkap — fail-open, jangan menghalangi wizard gara-gara
    // request yang salah bentuk dari frontend.
    return res.status(200).json({ valid: true });
  }

  // Audit red-team Juli 2026: mode ini dipanggil per-field (bisa 8-10x per
  // sesi wizard yang wajar), jadi limitnya lebih longgar dari mode generate
  // pertanyaan di bawah — tapi tetap fail-open ke "valid: true" (bukan 429)
  // supaya pengguna sah yang kebetulan mengisi wizard sangat cepat tidak
  // pernah terblokir menyelesaikan wizard-nya sendiri.
  const rl = await checkRateLimit(`generate-wizard-questions:validate:${ip}`, 40, 3600);
  if (!rl.allowed) {
    return res.status(200).json({ valid: true });
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 20,
      system: activeLang === "en" ? VALIDATE_SYSTEM_EN : VALIDATE_SYSTEM_ID,
      messages: [
        {
          role: "user",
          content:
            activeLang === "en"
              ? `fieldKind: ${payload.fieldKind}\nQuestion: ${payload.questionText}\nAnswer: ${payload.answer}`
              : `fieldKind: ${payload.fieldKind}\nPertanyaan: ${payload.questionText}\nJawaban: ${payload.answer}`,
        },
      ],
    });

    // Biaya AI sungguhan (Juli 2026, "tidak boleh ada data palsu") — fire
    // and forget, tidak menunda validasi ke pengguna kalau lambat/gagal.
    // businessProfileId null: validasi per-field wizard terjadi SEBELUM akun ada.
    const usage = extractUsage(message);
    void logClaudeUsage({ businessProfileId: null, action: "wizard_validate_answer", model: "claude-sonnet-5", inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, webSearches: usage.webSearches });

    const raw = message.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("");
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned) as { valid?: boolean };

    return res.status(200).json({ valid: parsed.valid !== false });
  } catch (err) {
    console.error("generate-wizard-questions validateAnswer error:", err);
    // Fail-open — gangguan AI/parsing tidak boleh menghalangi pengunjung
    // menyelesaikan wizard (sama seperti prinsip check-email.ts).
    return res.status(200).json({ valid: true });
  }
}

const SYSTEM_ID = `Anda adalah Beemo AI, konsultan bisnis THE HIVE. Tugas Anda di sini HANYA
membuat TEPAT 2 pertanyaan tambahan yang wajib ditanyakan ke pengguna di
wizard chat, sebelum analisis bisnis disusun.

PERTANYAAN YANG SUDAH ADA (JANGAN DITANYAKAN ULANG, dengan topik apa pun):
nama pemilik, email, profesi/peran, nama bisnis, jenis bisnis, lokasi, target
pelanggan (bisnis baru), rencana launching (bisnis baru) / sejak kapan
berjalan (bisnis berjalan), estimasi modal awal (bisnis baru) / omset
bulanan (bisnis berjalan), tantangan terbesar, target 6-12 bulan ke depan,
cerita & visi pribadi.

ATURAN 2 PERTANYAAN BARU:
1. Bahasa santai, ngobrol natural, sederhana — BUKAN bahasa formal/korporat/
   jargon bisnis. Maksimal 2 kalimat per pertanyaan.
2. Pertanyaan PERTAMA wajib mengikuti aturan khusus tahap bisnis (baru atau
   berjalan) yang akan dijelaskan di pesan pengguna — ikuti persis.
3. Pertanyaan KEDUA harus benar-benar digali dari pertimbangan Anda soal
   jenis bisnis & nama bisnis spesifik yang diberikan pengguna — pikirkan
   kemungkinan tantangan besar yang sering dialami bisnis semacam ini
   (contoh pola pikir, JANGAN disalin mentah: bisnis F&B sering soal
   konsistensi rasa/pasokan bahan baku; retail fashion sering soal
   manajemen stok musiman; jasa/konsultasi sering soal retensi klien; bisnis
   musiman sering soal strategi di luar musim ramai). Kalau nama bisnis
   terdengar seperti brand/franchise yang sudah dikenal luas, Anda BOLEH
   memakai web search sebentar untuk mengecek reputasi/tren brand tersebut
   dan menjadikannya bahan pertanyaan yang lebih tajam — tapi jangan
   sebutkan hasil riset secara eksplisit ke pengguna, cukup jadikan
   pertanyaannya lebih relevan.
4. Kalau topik yang relevan terasa terlalu sensitif/pribadi (utang pribadi,
   konflik keluarga, kesehatan, dll), GANTI dengan pertanyaan yang lebih
   general dan aman.
5. Setiap pertanyaan harus punya "placeholder" — contoh singkat jawaban
   (gaya "Contoh : ...") supaya pengguna tidak bingung harus jawab apa.
6. SELAIN 2 pertanyaan itu, buat juga "produkJasaExamples": array berisi
   TEPAT 2 contoh produk/jasa UTAMA yang paling mungkin dijual bisnis ini,
   dipikirkan sendiri dari nama & jenis bisnis yang diberikan (bukan
   kategori umum/generik) — dipakai sebagai contoh jawaban di pertanyaan
   LAIN ("produk/jasa utama apa yang kamu jual") supaya terasa nyambung
   dengan bisnis spesifik ini, bukan kategori umum yang tidak nyambung.
   Gaya singkat 2-5 kata per contoh (BUKAN kalimat penuh), sangat spesifik
   ke jenis bisnis & nama bisnis ini (contoh: kalau jenis bisnisnya
   "Penyedia Pasir Besi" dengan nama "Dunia Pasir", contohnya SEHARUSNYA
   seperti "Pasir besi curah per truk"/"Pasir cor bangunan siap kirim" --
   BUKAN "Nasi goreng"/"Kopi susu" yang sama sekali tidak nyambung).
7. SELAIN itu, buat juga "industryReaction": SATU reaksi singkat Beemo
   (maksimal 2 kalimat pendek, gaya mentor santai ngobrol -- BUKAN bahasa
   CS formal) atas jenis bisnis yang baru saja disebutkan pengguna. Ini
   ditampilkan sebagai bubble chat TERPISAH sebelum pertanyaan berikutnya,
   jadi harus terasa seperti Beemo BENAR-BENAR memikirkan bisnis spesifik
   ini -- BUKAN template/kategori umum yang bisa dipakai bisnis apa pun.
   Susunannya WAJIB:
   a. Awali dengan meng-echo balik jenis bisnis PERSIS seperti yang ditulis
      pengguna (mis. kalau pengguna menulis "Jual Parfum", mulai dengan
      "Jual Parfum ya" -- jangan diparafrase/diformalkan).
   b. Satu insight yang SPESIFIK dan nyata soal bisnis jenis ini -- pikirkan
      sendiri dari pengetahuan Anda faktor kunci yang biasanya penting untuk
      kategori bisnis SPESIFIK ini (contoh pola pikir, JANGAN disalin
      mentah: bisnis kuliner soal lokasi & pelanggan balik lagi; bisnis
      kepercayaan/produk personal seperti parfum/kecantikan soal kecocokan &
      loyalitas pelanggan; bisnis jasa teknis soal kepercayaan hasil kerja;
      distributor/supplier bahan baku soal volume & harga bersaing) --
      dirumuskan sendiri sesuai kategori ini, JANGAN generik ("menarik, aku
      mulai kebayang gambaran bisnismu" saja TIDAK CUKUP, itu template).
   c. Tutup dengan SATU kalimat pendek yang beda tergantung tahap bisnis
      (ikuti aturan tahap yang sama seperti pertanyaan 1 di atas): kalau
      bisnis BARU/belum berjalan, tutup dengan versi natural dari "nanti aku
      perhatikan ini pas nyusun rencana buat kamu"; kalau bisnis SUDAH
      BERJALAN, tutup dengan versi natural dari "ini yang bakal aku
      bandingkan dengan kondisi kamu sekarang" -- supaya jelas Beemo tahu
      persis sedang bicara dengan pemilik usaha baru atau usaha berjalan.
   Total tetap terasa seperti didengar sungguhan oleh manusia, bukan
   disambung dari template tetap.
8. Balas HANYA dengan JSON OBJECT valid, tanpa markdown, tanpa teks lain,
   format persis:
{"questions": [{ "question": string, "placeholder": string }, { "question": string, "placeholder": string }], "produkJasaExamples": [string, string], "industryReaction": string}`;

const SYSTEM_EN = `You are Beemo AI, THE HIVE's business consultant. Your only job here is to
create EXACTLY 2 additional mandatory questions for the landing page chat
wizard, before the business analysis is built.

QUESTIONS ALREADY ASKED (DO NOT ask about these topics again):
owner name, email, profession/role, business name, business type, location,
target customers (new business), planned launch date (new business) / how
long it's been running (running business), estimated starting capital (new
business) / monthly revenue (running business), biggest challenge, 6-12
month target, personal story & vision.

RULES FOR THE 2 NEW QUESTIONS:
1. Casual, natural, simple conversational language — NOT formal/corporate/
   jargon-heavy. Max 2 sentences per question.
2. The FIRST question must follow the stage-specific rule (new vs running
   business) that will be explained in the user message — follow it exactly.
3. The SECOND question must genuinely be derived from your own reasoning
   about this specific business type and business name — think about the
   likely major challenges this kind of business tends to face (pattern to
   reason from, don't copy verbatim: F&B businesses often struggle with
   taste/supply consistency; fashion retail often struggles with seasonal
   stock management; services/consulting often struggles with client
   retention; seasonal businesses often struggle with off-season strategy).
   If the business name sounds like a well-known brand/franchise, you MAY
   briefly use web search to check that brand's reputation/trend and use it
   to sharpen the question — but don't state your research findings
   explicitly to the user, just make the question more relevant.
4. If the relevant topic feels too sensitive/personal (personal debt, family
   conflict, health, etc.), REPLACE it with a more general, safe question.
5. Every question needs a "placeholder" — a short example answer (style
   "e.g. ...") so the user isn't confused about what to answer.
6. IN ADDITION to the 2 questions, also produce "produkJasaExamples": an
   array of EXACTLY 2 example main products/services this specific business
   most likely sells, reasoned from the given business name & type (not a
   generic category) — used as the example answer for ANOTHER question
   ("what's your main product/service") so it feels relevant to this
   specific business, not a mismatched generic category. Short style, 2-5
   words per example (NOT a full sentence), very specific to this business
   type & name (e.g. for business type "Iron Sand Supplier" named "Dunia
   Pasir", examples SHOULD look like "Bulk iron sand by truckload"/"Ready-
   to-ship construction sand" -- NOT "Fried rice"/"Milk coffee" which is
   completely unrelated).
7. ALSO produce "industryReaction": ONE short Beemo reaction (max 2 short
   sentences, casual mentor tone -- NOT formal customer-service language) to
   the business type the user just gave. This is shown as a separate chat
   bubble right before the next question, so it must feel like Beemo
   genuinely thought about THIS specific business -- NOT a generic
   template/category that could apply to any business. Required structure:
   a. Open by echoing the business type back EXACTLY as the user wrote it
      (e.g. if the user wrote "Selling Perfume", start with "Selling
      perfume, nice" -- don't paraphrase or formalize it).
   b. One SPECIFIC, real insight about this kind of business -- reason it
      out yourself from your own knowledge of the key factor that usually
      matters for THIS specific category (pattern to reason from, don't
      copy verbatim: food businesses are about location & repeat customers;
      trust/personal-choice products like perfume/beauty are about fit &
      customer loyalty; technical services are about trust in the work
      quality; raw-material suppliers/distributors are about volume &
      competitive pricing) -- reasoned specifically for this category, do
      NOT be generic ("interesting, I'm starting to picture your business"
      alone is NOT enough, that's a template).
   c. Close with ONE short sentence that differs by business stage (follow
      the same stage rule as question 1 above): if the business is NEW/not
      yet running, close with a natural version of "I'll keep this in mind
      when I put your plan together"; if the business is ALREADY RUNNING,
      close with a natural version of "I'll compare this with your current
      situation" -- so it's clear Beemo knows exactly whether it's talking
      to a new or an existing business owner.
   The whole thing must still read like a real person genuinely listening,
   not a template being stitched together.
8. Reply with ONLY a valid JSON OBJECT, no markdown, no other text, in
   exactly this format:
{"questions": [{ "question": string, "placeholder": string }, { "question": string, "placeholder": string }], "produkJasaExamples": [string, string], "industryReaction": string}`;

function buildUserPrompt(data: Payload, lang: "id" | "en"): string {
  const isBaru = data.jenisAnalisis === "baru";

  if (lang === "en") {
    const stageRule = isBaru
      ? `One of the 2 questions MUST ask whether they're planning to build "${data.namaBisnis}" from scratch on their own, or join a franchise/partnership program — mention the business name naturally in the question (reason: if it's a franchise, we need to separately research that brand's reputation/trend).`
      : `One of the 2 questions MUST ask about the current legal/permit status of "${data.namaBisnis}" — but framed SIMPLY: just ask whether their business permits are already complete or if there are specific obstacles. Do NOT list specific permit types (e.g. business registration/halal certificate) in an itemized way.`;
    return `Business data:
- Stage: ${isBaru ? "New business (planned, not yet running)" : "Already running business"}
- Business name: ${data.namaBisnis}
- Business type: ${data.jenisBisnis}

Stage-specific rule for question 1: ${stageRule}

Generate the 2 questions now, following the JSON schema already described.`;
  }

  const stageRule = isBaru
    ? `Salah satu dari 2 pertanyaan WAJIB menanyakan apakah "${data.namaBisnis}" rencananya dibangun sendiri dari nol, atau mengikuti program franchise/kemitraan/waralaba — sebut nama bisnisnya secara natural dalam pertanyaan (alasan: kalau ternyata franchise, kita perlu riset reputasi/tren brand tersebut secara terpisah).`
    : `Salah satu dari 2 pertanyaan WAJIB menanyakan status legalitas/perizinan usaha "${data.namaBisnis}" SEKARANG — tapi framing-nya SEDERHANA: cukup tanya apakah izin usahanya sudah lengkap atau masih ada kendala tertentu. JANGAN sebutkan jenis izin spesifik (mis. NIB/sertifikat halal) secara itemized.`;

  return `Data bisnis:
- Tahap: ${isBaru ? "Bisnis baru (rencana, belum berjalan)" : "Bisnis sudah berjalan"}
- Nama bisnis: ${data.namaBisnis}
- Jenis bisnis: ${data.jenisBisnis}

Aturan khusus tahap ini untuk pertanyaan 1: ${stageRule}

Buat 2 pertanyaan sekarang, sesuai skema JSON yang sudah dijelaskan.`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY belum diset di Vercel." });
  }

  const ip = getClientIp(req);

  if ((req.body as { mode?: string })?.mode === "validateAnswer") {
    return handleValidateAnswer(req.body as ValidateAnswerPayload, apiKey, res, ip);
  }

  const { jenisAnalisis, namaBisnis, jenisBisnis, lang } = req.body as Payload;
  const activeLang: "id" | "en" = lang === "en" ? "en" : "id";

  // Audit red-team Juli 2026: mode ini (generate 2 pertanyaan + web search
  // tool) hanya wajar dipanggil sekali per sesi wizard — 10x/jam per IP
  // cukup untuk beberapa kali percobaan/reload tanpa membuka pintu abuse.
  const rl = await checkRateLimit(`generate-wizard-questions:generate:${ip}`, 10, 3600);
  if (!rl.allowed) {
    return res.status(429).json({ error: activeLang === "en" ? RATE_LIMIT_MESSAGE_EN : RATE_LIMIT_MESSAGE_ID });
  }

  if (!namaBisnis || !jenisBisnis || (jenisAnalisis !== "baru" && jenisAnalisis !== "berjalan")) {
    return res.status(400).json({ error: "Data tidak lengkap." });
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 700,
      system: activeLang === "en" ? SYSTEM_EN : SYSTEM_ID,
      messages: [{ role: "user", content: buildUserPrompt({ jenisAnalisis, namaBisnis, jenisBisnis }, activeLang) }],
      // Riset ringan opsional — cek reputasi/tren brand kalau nama bisnis
      // terdengar seperti franchise/brand yang sudah dikenal (lihat aturan
      // #3 di system prompt). max_uses kecil supaya latency di tengah
      // percakapan tetap wajar.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK
      // terpasang lebih tua dari tipe web search tool, lihat catatan sama
      // di services/beemo/chat.ts.
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }] as any,
    });

    // Biaya AI sungguhan (Juli 2026, "tidak boleh ada data palsu") — fire
    // and forget, tidak menunda respons ke pengguna kalau lambat/gagal.
    // businessProfileId null: pertanyaan wizard terjadi SEBELUM akun ada.
    const usage = extractUsage(message);
    void logClaudeUsage({ businessProfileId: null, action: "wizard_questions", model: "claude-sonnet-5", inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, webSearches: usage.webSearches });

    const raw = message.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("");
    let cleaned = raw.replace(/```json|```/g, "").trim();

    // Bugfix Juli 2026: respons SEKARANG berbentuk objek {questions,
    // produkJasaExamples} (bukan array bare seperti sebelumnya) supaya bisa
    // membawa produkJasaExamples sekaligus tanpa panggilan API terpisah.
    // Tetap terima bentuk array LAMA sebagai fallback kompatibilitas kalau
    // suatu saat model membalas format lama (fail-open, bukan fail 500).
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      const objMatch = cleaned.match(/\{[\s\S]*\}/);
      const arrMatch = cleaned.match(/\[[\s\S]*\]/);
      const match = objMatch || arrMatch;
      if (!match) throw parseErr;
      parsed = JSON.parse(match[0]);
    }

    let questions: DynamicQuestion[];
    let produkJasaExamples: DynamicProdukJasaExamples | null = null;
    // Fitur baru Juli 2026 (directive PO: "kita akan menghadapi ratusan,
    // ribuan, jutaan kategori usaha... Claude adalah Beemo, bukan semuanya
    // template") — reaksi industri (transitionBefore sebelum pertanyaan
    // produkJasa di ChatFlow.tsx) sekarang DIPIKIRKAN Beemo AI sungguhan,
    // bukan cuma cocokkan kata kunci ke peta kategori statis (yang tidak
    // akan pernah menutup semua jenis usaha). String opsional: kalau model
    // tidak mengembalikannya (respons lama/gagal), ChatFlow.tsx tetap
    // fallback ke fungsi keyword yang sudah ada -- alur tidak pernah macet.
    let industryReaction: string | null = null;

    if (Array.isArray(parsed)) {
      questions = parsed as DynamicQuestion[];
    } else {
      const obj = parsed as { questions?: DynamicQuestion[]; produkJasaExamples?: unknown; industryReaction?: unknown };
      questions = Array.isArray(obj.questions) ? obj.questions : [];
      if (
        Array.isArray(obj.produkJasaExamples) &&
        obj.produkJasaExamples.length === 2 &&
        obj.produkJasaExamples.every((ex) => typeof ex === "string" && ex.trim().length > 0)
      ) {
        produkJasaExamples = obj.produkJasaExamples as DynamicProdukJasaExamples;
      }
      if (typeof obj.industryReaction === "string" && obj.industryReaction.trim().length > 0) {
        industryReaction = obj.industryReaction.trim();
      }
    }

    if (!Array.isArray(questions) || questions.length !== 2) {
      throw new Error("Jumlah pertanyaan yang dihasilkan tidak sesuai (harus tepat 2).");
    }

    return res.status(200).json({ questions, produkJasaExamples, industryReaction });
  } catch (err) {
    console.error("generate-wizard-questions error:", err);
    return res.status(500).json({ error: "Gagal membuat pertanyaan tambahan." });
  }
}
