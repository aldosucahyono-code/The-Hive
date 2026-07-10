// services/beemo/chat.ts
//
// Business logic untuk action "chat" di router /api/beemo. Chat Beemo
// adalah fitur berbayar (PRO 7 hari, PLATINUM 30 hari) — gating tier
// dicek di sini, bukan cuma di frontend, supaya tidak bisa dilewati.
//
// Master Product Directive (Business Memory, Fase 1): Chat Beemo TIDAK lagi
// hanya membaca nama/jenis/tahap bisnis + skor terakhir. Sekarang membaca
// getBusinessMemory() — satu konteks gabungan dari Discovery/Business
// Engine/Journey/Achievement/Business Update/fakta yang sudah disetujui —
// SEBELUM menjawab, persis alur "Chat membaca Business Memory → ... → baru
// menjawab" di directive. Beemo juga boleh mengusulkan fakta baru ke
// Business Memory kalau menemukan info penting (lihat parseMemoryProposal
// di bawah) — TAPI fakta itu baru dianggap benar setelah pemilik bisnis
// menyetujuinya lewat action "reviewMemoryFact" (data honesty: AI tidak
// pernah menulis Business Memory secara langsung tanpa persetujuan).
//
// Riwayat percakapan SEMENTARA belum disimpan ke database (beemo_logs) —
// itu menyusul di Tahap AI Engine berikutnya saat AI Memory percakapan
// benar-benar dibangun. Untuk sekarang, histori chat hidup di sisi frontend
// selama sesi berjalan.

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import type { ServiceResult } from "../business/create.js";
import { getActiveMembership } from "../membership/getActiveMembership.js";
import { getBusinessMemory, type BusinessMemoryContext } from "../memory/getBusinessMemory.js";
import { proposeMemoryFact } from "../memory/proposeMemoryFact.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Multi-Role Mentor (directive PO: "kamu harus bisa menjadi semua peranan
// (HRD, Akuntan, Marketing, Sales, Ops, Legal, dll) untuk menjawab seluruh
// keresahan/tantangan users dan memberikan solusi yang tepat" — indikator:
// "kalau aku jadi users, kira-kira saya sudah puas belum ya"). Beemo TIDAK
// punya satu system prompt per fungsi (itu akan menduplikasi konteks bisnis
// N kali) — satu prompt yang menginstruksikan Beemo mengambil peran yang
// PALING relevan dengan topik pertanyaan, plus akses web search sungguhan
// (bukan cuma "mengarang percaya diri") untuk hal yang butuh data
// terkini/spesifik seperti syarat izin usaha, tarif pajak, prosedur BPJS,
// dll — supaya jawabannya benar-benar hasil riset, bukan template generik.
//
// Tier Usage Quota (directive PO: "isi didalamnya benar-benar harus berbeda
// jauh... users benar benar merasa perbedaanya"): peran GANDA sekaligus
// (multi-role synthesis) jadi kedalaman EKSKLUSIF PLATINUM — PRO tetap dapat
// jawaban jujur & actionable (bukan jawaban rusak/dibatasi kualitasnya),
// tapi dari SATU peran paling relevan saja, dengan 1x kesempatan riset per
// jawaban (lihat CHAT_SEARCH_MAX_USES). Baseline kejujuran (JANGAN LEMPAR
// TANGAN) SAMA untuk kedua tier — yang beda kedalaman, bukan kejujuran.
const ROLE_BLOCK_PLATINUM_ID = `PERAN GANDA (WAJIB): Kamu adalah satu-satunya "tim" yang dimiliki pemilik usaha ini — sesuaikan peranmu dengan topik pertanyaan, seolah kamu benar-benar Akuntan (pajak, laporan keuangan, break even), HRD (rekrutmen, kontrak kerja, gaji, BPJS Ketenagakerjaan/Kesehatan), Legal (izin usaha, NIB, STPW untuk franchise, kontrak, regulasi daerah), Marketing & Sales (strategi, ide konten, funnel penjualan), atau Operasional (SOP, supply chain, manajemen stok) — SEKALIGUS, tergantung apa yang ditanyakan. Kalau topiknya menyentuh lebih dari satu bidang, sintesiskan sudut pandang beberapa peran itu jadi satu jawaban utuh — ini yang membedakan kamu dari jawaban satu-sudut-pandang biasa.`;

const ROLE_BLOCK_PRO_ID = `PERAN: Pilih SATU peran yang paling relevan dengan pertanyaan ini — Akuntan (pajak, laporan keuangan, break even), HRD (rekrutmen, kontrak kerja, gaji, BPJS), Legal (izin usaha, NIB, kontrak, regulasi daerah), Marketing & Sales (strategi, ide konten, funnel penjualan), atau Operasional (SOP, supply chain, manajemen stok) — lalu jawab fokus dari sudut pandang itu saja. Jangan mencoba menjawab semua sudut sekaligus — lebih baik satu sudut yang tajam dan actionable daripada banyak sudut yang dangkal.`;

const ROLE_BLOCK_PLATINUM_EN = `MULTI-ROLE (REQUIRED): You are the only "team" this business owner has — adapt your role to match the topic of the question, acting as their Accountant (taxes, financial statements, break-even), HR (hiring, employment contracts, payroll, social/health insurance), Legal (business permits, business ID numbers, franchise registration, contracts, local regulations), Marketing & Sales (strategy, content ideas, sales funnels), or Operations (SOPs, supply chain, inventory management) — ALL AT ONCE, depending on what's asked. If the topic touches more than one area, synthesize those perspectives into one complete answer — that's what sets you apart from a single-angle answer.`;

const ROLE_BLOCK_PRO_EN = `ROLE: Pick the ONE role most relevant to this question — Accountant (taxes, financial statements, break-even), HR (hiring, contracts, payroll, insurance), Legal (business permits, IDs, contracts, local regulations), Marketing & Sales (strategy, content ideas, sales funnels), or Operations (SOPs, supply chain, inventory) — then answer focused from that single angle only. Don't try to cover every angle at once — one sharp, actionable angle beats several shallow ones.`;

const SHARED_RESEARCH_BLOCK_ID = `RISET SUNGGUHAN (WAJIB): Kalau pertanyaan menyentuh hal yang butuh data terkini/spesifik/bisa berubah (syarat izin usaha, tarif pajak UMKM terbaru, prosedur BPJS, ketentuan pemerintah daerah, dll), CARI DULU lewat web search sebelum menjawab — jangan menjawab dari ingatan lama kalau ada cara memverifikasinya. Kalau kamu mencari, langsung berikan hasilnya secara natural (tidak perlu bilang "saya akan mencari..." ke pengguna, langsung ke jawaban).

JANGAN LEMPAR TANGAN: Dilarang menjawab hanya dengan "konsultasikan dengan ahli/profesional" sebagai jawaban akhir — itu bukan solusi. Berikan LANGKAH KONKRET dulu (ke mana harus pergi, hubungi siapa/instansi apa, dokumen apa yang perlu disiapkan, perkiraan biaya/waktu kalau memang bisa diketahui). Sarankan verifikasi ke notaris/konsultan profesional HANYA untuk langkah yang memang secara hukum butuh tanda tangan/sertifikasi resmi (mis. akta notaris) — bukan sebagai jawaban default untuk menghindari pertanyaan yang sebenarnya bisa kamu bantu.

Indikator keberhasilanmu: kalau pemilik usaha ini membaca jawabanmu, apakah dia merasa benar-benar dibantu (langkah jelas, relevan, jujur) — bukan cuma dapat jawaban template yang terdengar pintar tapi tidak bisa dieksekusi.`;

const SHARED_RESEARCH_BLOCK_EN = `ACTUAL RESEARCH (REQUIRED): If the question touches something that needs current/specific/changeable data (business permit requirements, current small-business tax rates, insurance procedures, local government regulations, etc.), SEARCH FIRST before answering — don't answer from old memory when you can verify it. When you search, go straight to giving the result naturally (no need to tell the user "I'll search for..." — just answer).

DON'T PASS THE BUCK: Never answer with only "consult a professional" as your final answer — that's not a solution. Give a CONCRETE STEP first (where to go, who/which agency to contact, what documents to prepare, rough cost/time if knowable). Only suggest verifying with a notary/professional for steps that legally require an official signature/certification (e.g. a notarized deed) — not as a default answer to dodge a question you could actually help with.

Your success indicator: if this business owner reads your answer, do they feel genuinely helped (clear, relevant, honest steps) — not just handed a smart-sounding template they can't actually act on.`;

function roleBlockFor(tier: "pro" | "platinum", lang: "id" | "en"): string {
  if (lang === "en") return tier === "platinum" ? ROLE_BLOCK_PLATINUM_EN : ROLE_BLOCK_PRO_EN;
  return tier === "platinum" ? ROLE_BLOCK_PLATINUM_ID : ROLE_BLOCK_PRO_ID;
}

// Kuota & kedalaman per tier — SATU-SATUNYA tempat angka ini didefinisikan
// (jangan hardcode ulang di tempat lain). Chat: PRO 40 pesan/periode akses,
// PLATINUM 200. Riset per jawaban: PRO 1x pencarian, PLATINUM 3x (diturunkan
// dari 5x saat audit biaya Juli 2026 — di kuota 200 pesan/bulan, 5x riset per
// pesan bisa membuat margin PLATINUM negatif di skenario pemakaian maksimal
// terus-menerus di harga early bird Rp349.000/bulan. 3x tetap jauh di atas
// PRO, bedanya masih terasa nyata, tapi ongkos skenario terburuk turun cukup
// besar).
const CHAT_QUOTA: Record<"pro" | "platinum", number> = { pro: 40, platinum: 200 };
const CHAT_SEARCH_MAX_USES: Record<"pro" | "platinum", number> = { pro: 1, platinum: 3 };

function systemPromptId(tier: "pro" | "platinum"): string {
  return `Kamu adalah Beemo, mentor bisnis THE HIVE. Kamu BUKAN chatbot generik — kamu konsultan bisnis pribadi yang hangat, optimis, dan mendukung, tidak pernah menghakimi.

Gaya bicara:
- Bahasa Indonesia sederhana, seperti bicara dengan teman yang paham bisnis. Target pembaca adalah pemilik usaha, BUKAN analis bisnis — hindari istilah seperti "market position", "strength/weakness", "opportunity" mentah, ganti dengan bahasa sehari-hari (mis. "posisi bisnismu di area ini", "yang sudah jadi kelebihanmu", "yang masih bisa ditingkatkan").
- Hindari jargon teknis/korporat yang berlebihan.
- Jawaban ringkas dan actionable, bukan esai panjang.
- Selalu berpihak pada pemilik bisnis, bantu mereka mengambil keputusan.

${roleBlockFor(tier, "id")}

${SHARED_RESEARCH_BLOCK_ID}

Setiap kali kamu menjawab pertanyaan yang berkaitan dengan kondisi/keputusan bisnis (bukan basa-basi), ikuti pola ini secara berurutan (boleh luwes dalam kalimat, tidak perlu label eksplisit, tapi urutan isinya harus ada):
1. Apa yang terjadi (ringkas kondisi/fakta yang relevan dari konteks bisnis di bawah)
2. Mengapa hal ini penting buat bisnisnya
3. Yang sebaiknya dilakukan
4. Langkah pertama yang bisa dilakukan HARI INI (satu langkah kecil dan konkret, bukan daftar panjang)

Kamu punya konteks bisnis pelanggan di bawah ini (Business Memory) — gunakan itu supaya jawabanmu spesifik, bukan generik. Kalau data tidak ada di konteks, jangan mengarang — akui saja belum ada datanya. (Ini berlaku untuk data PRIBADI bisnis pelanggan — angka keuangan/omset/pelanggan mereka. Untuk fakta UMUM yang bisa diverifikasi lewat pencarian, seperti aturan pemerintah, ikuti aturan RISET SUNGGUHAN di atas.)

Kalau dalam percakapan ini kamu menemukan SATU info penting baru yang layak diingat platform ke depannya (mis. target pasar berubah, status legalitas berubah, ada masalah besar baru) — dan HANYA kalau itu benar-benar penting, bukan basa-basi — akhiri jawabanmu dengan SATU baris terpisah persis format ini (baris ini akan disembunyikan dari pengguna, jangan jelaskan formatnya ke pengguna):
[INGAT: kunci_singkat = nilai singkat]`;
}

function systemPromptEn(tier: "pro" | "platinum"): string {
  return `You are Beemo, THE HIVE's business mentor. You are NOT a generic chatbot — you're a warm, optimistic, supportive personal business consultant who never judges.

Tone:
- Simple, everyday language, like talking to a friend who understands business. Your reader is a business owner, NOT a business analyst — avoid raw terms like "market position", "strength/weakness", "opportunity", use everyday phrasing instead (e.g. "your position in this area", "what's already your strength", "what can still be improved").
- Avoid excessive technical/corporate jargon.
- Keep answers concise and actionable, not long essays.
- Always be on the business owner's side, help them make decisions.

${roleBlockFor(tier, "en")}

${SHARED_RESEARCH_BLOCK_EN}

Whenever you answer a question related to the business's condition or a decision (not small talk), follow this pattern in order (you can phrase it naturally, no need for explicit labels, but the content order must be there):
1. What's happening (summarize the relevant facts/condition from the context below)
2. Why this matters for their business
3. What they should do
4. The first step they can take TODAY (one small, concrete step, not a long list)

You have the customer's business context below (Business Memory) — use it so your answers are specific, not generic. If data isn't in the context, don't make it up — just acknowledge it isn't available yet. (This applies to the customer's PRIVATE business data — their revenue/customer numbers. For general, verifiable facts like government rules, follow the ACTUAL RESEARCH rule above.)

If during this conversation you find ONE important new fact worth the platform remembering going forward (e.g. target market changed, legal status changed, a major new problem) — and ONLY if it's genuinely important, not small talk — end your reply with ONE separate line in exactly this format (this line will be hidden from the user, don't explain the format to the user):
[REMEMBER: short_key = short value]`;
}

type ChatMessage = { role: "user" | "assistant"; content: string };

// Business Discovery & Dual Workspace directive: Chat Beemo membaca
// businessType dari Business Context (SATU FIELD, SATU STATUS) dan
// menyesuaikan PERAN mentornya — bukan dua system prompt terpisah/dua
// implementasi Chat, hanya satu baris peran yang disisipkan ke prompt yang
// sama sebelum Business Memory dibaca.
function mentorRoleLine(businessType: "start" | "grow", lang: "id" | "en"): string {
  if (lang === "en") {
    return businessType === "start"
      ? "This customer has NOT opened their business yet — you are their mentor for OPENING a new business (readiness, location, suppliers, regulations, partnership/franchise, soft & grand opening). Do not talk about \"business health\" as if it's already running."
      : "This customer already has a running business — you are their mentor for GROWING it (performance, targets, competitors, opportunities, day-to-day decisions).";
  }
  return businessType === "start"
    ? "Pelanggan ini BELUM membuka usahanya — kamu adalah mentornya untuk MEMBUKA usaha baru (kesiapan, lokasi, supplier, regulasi, kemitraan/franchise, soft & grand opening). Jangan membahas \"kesehatan bisnis\" seolah usahanya sudah berjalan."
    : "Pelanggan ini sudah punya usaha yang berjalan — kamu adalah mentornya untuk MENGEMBANGKAN usaha itu (performa, target, kompetitor, peluang, keputusan sehari-hari).";
}

const MEMORY_MARKER_REGEX = /\n?\[(?:INGAT|REMEMBER):\s*([a-zA-Z0-9_]+)\s*=\s*(.+?)\]\s*$/;

/** Menarik baris "[INGAT: key = value]"/"[REMEMBER: key = value]" dari
 * ujung balasan Beemo (kalau ada), lalu mengembalikan teks balasan yang
 * sudah bersih (tanpa baris itu) plus fakta yang diusulkan (kalau ada).
 * Ini bukan tool-calling API resmi Claude — sengaja pakai marker teks
 * sederhana dulu (v1) supaya tidak menambah kompleksitas orkestrasi baru
 * di luar scope Business Memory Fase 1. */
function parseMemoryProposal(reply: string): { cleanReply: string; factKey: string | null; factValue: string | null } {
  const match = reply.match(MEMORY_MARKER_REGEX);
  if (!match) {
    return { cleanReply: reply, factKey: null, factValue: null };
  }
  const cleanReply = reply.replace(MEMORY_MARKER_REGEX, "").trimEnd();
  return { cleanReply, factKey: match[1], factValue: match[2].trim() };
}

// Exported supaya Decision Engine (services/decision/proposeDecision.ts)
// bisa reuse persis blok konteks yang sama — TIDAK menulis ulang logic
// merangkai Business Context di tempat kedua.
export function buildContextBlock(memory: BusinessMemoryContext, lang: "id" | "en"): string {
  const lines: string[] = [];
  const L = lang === "id";

  lines.push(`${L ? "Nama bisnis" : "Business name"}: ${memory.profile.businessName}`);
  if (memory.profile.industry) lines.push(`${L ? "Jenis bisnis" : "Industry"}: ${memory.profile.industry}`);
  if (memory.profile.location) lines.push(`${L ? "Lokasi" : "Location"}: ${memory.profile.location}`);
  lines.push(`${L ? "Tahap bisnis" : "Business stage"}: ${memory.profile.businessStage}`);
  if (memory.stageDetail) lines.push(`${L ? "Tahap rinci saat ini" : "Current detailed stage"}: ${memory.stageDetail}`);
  lines.push(
    `${L ? "Jenis perjalanan" : "Journey type"}: ${
      memory.profile.businessType === "start" ? (L ? "Membuka usaha baru" : "Opening a new business") : (L ? "Mengembangkan usaha berjalan" : "Growing a running business")
    }`
  );
  lines.push(`${L ? "Paket" : "Plan"}: ${memory.membership.tier.toUpperCase()}`);
  if (memory.goals) lines.push(`${L ? "Harapan pelanggan" : "Customer's goals"}: ${memory.goals}`);
  if (memory.mainChallenges) lines.push(`${L ? "Kekhawatiran/tantangan utama" : "Main challenges/worries"}: ${memory.mainChallenges}`);

  if (memory.baseline) {
    if (memory.baseline.summary) lines.push(`${L ? "Ringkasan analisa awal (baseline)" : "Baseline analysis summary"}: ${memory.baseline.summary}`);
    if (memory.baseline.businessHealthScore != null) lines.push(`${L ? "Business Score baseline" : "Baseline Business Score"}: ${memory.baseline.businessHealthScore}/100`);
  }

  if (memory.latestAnalysis && memory.latestAnalysis.createdAt !== memory.baseline?.createdAt) {
    if (memory.latestAnalysis.summary) lines.push(`${L ? "Ringkasan analisa terakhir" : "Latest analysis summary"}: ${memory.latestAnalysis.summary}`);
    if (memory.latestAnalysis.businessHealthScore != null) lines.push(`${L ? "Business Score terakhir" : "Latest Business Score"}: ${memory.latestAnalysis.businessHealthScore}/100`);
  }

  if (memory.journey) {
    lines.push(
      L
        ? `Journey: skor ${memory.journey.baselineScore} → ${memory.journey.currentScore} (${memory.journey.delta >= 0 ? "+" : ""}${memory.journey.delta})`
        : `Journey: score ${memory.journey.baselineScore} → ${memory.journey.currentScore} (${memory.journey.delta >= 0 ? "+" : ""}${memory.journey.delta})`
    );
  }

  if (memory.recentUpdates.length > 0) {
    lines.push(L ? "Business Update terbaru:" : "Recent Business Updates:");
    memory.recentUpdates.slice(0, 3).forEach((u) => {
      const tag = u.category && u.severity ? ` [${u.category}/${u.severity}]` : "";
      lines.push(`- ${u.createdAt.slice(0, 10)}${tag}: ${u.content.slice(0, 200)}`);
    });
  }

  // Business Update Engine: klasifikasi update TERAKHIR (kategori+severity
  // yang sudah dihitung services/updateEngine/classify.ts saat disimpan) —
  // supaya Beemo langsung tahu "ada apa" tanpa harus menebak dari teks bebas.
  if (memory.latestUpdateInsight) {
    lines.push(
      L
        ? `Klasifikasi update terakhir: kategori ${memory.latestUpdateInsight.category}, tingkat perhatian ${memory.latestUpdateInsight.severity}.`
        : `Latest update classification: category ${memory.latestUpdateInsight.category}, attention level ${memory.latestUpdateInsight.severity}.`
    );
  }

  if (memory.achievementsUnlockedCount > 0) {
    lines.push(
      L
        ? `Achievement terbuka: ${memory.achievementsUnlockedCount}${memory.latestAchievementTitle ? ` (terbaru: ${memory.latestAchievementTitle})` : ""}`
        : `Achievements unlocked: ${memory.achievementsUnlockedCount}${memory.latestAchievementTitle ? ` (latest: ${memory.latestAchievementTitle})` : ""}`
    );
  }

  if (memory.approvedFacts.length > 0) {
    lines.push(L ? "Fakta lain yang sudah dikonfirmasi pemilik bisnis:" : "Other facts confirmed by the owner:");
    memory.approvedFacts.forEach((f) => {
      lines.push(`- ${f.factKey}: ${JSON.stringify(f.factValue)}`);
    });
  }

  // Master Product Directive Fase 2: Chat harus membaca Business Memory ->
  // Business Engine -> Competitor -> Workspace, baru menjawab. Ringkasan
  // kompetitor di sini datang dari Competitor Engine (lewat snapshot yang
  // sudah dirangkai getBusinessMemory), bukan dihitung ulang di sini.
  if (memory.competitorSummary) {
    const cs = memory.competitorSummary;
    const sourceLabel =
      cs.dataSource === "mock"
        ? L
          ? " (data contoh/simulasi, bukan data pasar nyata)"
          : " (sample/simulated data, not real market data)"
        : "";
    lines.push(
      L
        ? `Analisis kompetitor: ${cs.totalCompetitorsFound} kompetitor ditemukan di sekitar lokasi, posisi pasar "${cs.marketPosition}"${sourceLabel}. ${cs.marketPositionReason}`
        : `Competitor analysis: ${cs.totalCompetitorsFound} competitors found nearby, market position "${cs.marketPosition}"${sourceLabel}. ${cs.marketPositionReason}`
    );
  }

  // Decision Memory: keputusan besar yang pernah diajukan pemilik bisnis ke
  // Decision Engine — supaya Chat/Recommendation tahu keputusan yang sudah
  // diambil, bukan mengulang saran yang sama atau kontradiktif.
  if (memory.recentDecisions.length > 0) {
    lines.push(L ? "Keputusan besar yang pernah diajukan:" : "Major decisions raised before:");
    memory.recentDecisions.forEach((d) => {
      lines.push(
        `- ${d.createdAt.slice(0, 10)} [${d.status}]: "${d.question.slice(0, 150)}"${d.conclusion ? ` — ${L ? "kesimpulan" : "conclusion"}: ${d.conclusion.slice(0, 200)}` : ""}`
      );
    });
  }

  return lines.join("\n");
}

export async function chatWithBeemo(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  const messages = payload.messages as ChatMessage[] | undefined;
  const lang: "id" | "en" = payload.lang === "en" ? "en" : "id";

  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return { status: 400, body: { error: "messages wajib diisi" } };
  }

  const { data: business, error: bpError } = await supabase
    .from("business_profiles")
    .select("id, user_id")
    .eq("id", businessProfileId)
    .single();

  if (bpError || !business || business.user_id !== userId) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  const membership = await getActiveMembership(businessProfileId);

  const tier = membership.tier;
  if (tier === "free") {
    return {
      status: 403,
      body: {
        error:
          lang === "en"
            ? "Chat Beemo is available for PRO/PLATINUM customers."
            : "Chat Beemo tersedia untuk pelanggan PRO/PLATINUM.",
      },
    };
  }

  // Tier Usage Quota: kuota pesan per periode akses (lihat CHAT_QUOTA di
  // atas) — dicek SEBELUM memanggil Claude supaya tidak menghabiskan biaya
  // API untuk request yang toh akan ditolak. quotaLimit dipakai lagi di
  // body respons sukses (di bawah) supaya frontend bisa menampilkan sisa
  // kuota tanpa request terpisah.
  const quotaLimit = CHAT_QUOTA[tier];
  if (membership.chatMessageCount >= quotaLimit) {
    return {
      status: 403,
      body: {
        error:
          lang === "en"
            ? `You've used all ${quotaLimit} Chat Beemo messages for this access period.${tier === "pro" ? " Upgrade to PLATINUM for a much larger quota and deeper research per answer." : ""}`
            : `Kuota ${quotaLimit} pesan Chat Beemo untuk periode akses ini sudah habis.${tier === "pro" ? " Upgrade ke PLATINUM untuk kuota jauh lebih besar dan riset lebih dalam per jawaban." : ""}`,
        quotaExceeded: true,
        tier,
        quotaLimit,
      },
    };
  }

  const memory = await getBusinessMemory(businessProfileId);
  if (!memory) {
    return { status: 500, body: { error: lang === "en" ? "Failed to load business context." : "Gagal memuat konteks bisnis." } };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { status: 500, body: { error: "ANTHROPIC_API_KEY belum diset di Vercel." } };
  }

  const contextBlock = buildContextBlock(memory, lang);
  const roleLine = mentorRoleLine(memory.profile.businessType, lang);
  const basePrompt = lang === "en" ? systemPromptEn(tier) : systemPromptId(tier);
  const systemPrompt = `${basePrompt}\n\n${roleLine}\n\n${contextBlock}`;

  // Batasi histori yang dikirim (20 pesan terakhir, tiap pesan maks 4000
  // karakter) supaya tidak membengkak tanpa kendali.
  const trimmedMessages = messages.slice(-20).map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: String(m.content || "").slice(0, 4000),
  }));

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      // Dinaikkan dari 800 — riset sungguhan (web search) butuh ruang lebih
      // untuk merangkai jawaban lengkap, bukan cuma jawaban template pendek.
      max_tokens: 1500,
      system: systemPrompt,
      messages: trimmedMessages,
      // Riset Sungguhan (directive PO): Beemo boleh mencari data
      // terkini/spesifik (regulasi, pajak, prosedur) alih-alih menjawab dari
      // ingatan lama semata. max_uses membatasi biaya per balasan DAN jadi
      // salah satu diferensiasi tier (PRO 1x, PLATINUM 5x — lihat
      // CHAT_SEARCH_MAX_USES).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK
      // terpasang (@anthropic-ai/sdk 0.32.1) lebih tua dari saat Anthropic
      // merilis web search tool, jadi definisi TypeScript-nya belum kenal
      // tipe ini — API REST-nya sendiri tetap menerima bentuk ini apa
      // adanya. Upgrade versi SDK sengaja TIDAK dilakukan di sini supaya
      // tidak berisiko ke seluruh pemanggilan Anthropic lain yang sudah
      // berjalan stabil.
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: CHAT_SEARCH_MAX_USES[tier] }] as any,
    });

    // Konkatenasi SEMUA blok teks (bukan cuma yang pertama) — saat Beemo
    // mencari dulu, jawabannya bisa terpecah jadi beberapa blok teks yang
    // disisipi hasil pencarian di antaranya (lihat dokumentasi Web Search
    // Tool Anthropic), bukan satu blok utuh seperti sebelum ada web search.
    const rawReply = response.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("");

    const { cleanReply, factKey, factValue } = parseMemoryProposal(rawReply);

    if (factKey && factValue) {
      // Fire-and-forget secara logis (tidak memblokir balasan ke pengguna),
      // tapi tetap di-await supaya error-nya masuk log server, bukan
      // menghilang diam-diam. Kegagalan di sini TIDAK menggagalkan balasan
      // chat — mengusulkan fakta adalah bonus, bukan syarat chat berhasil.
      try {
        await proposeMemoryFact({
          businessProfileId,
          factKey,
          factValue,
          source: "chat",
          rawContext: rawReply.slice(0, 1000),
        });
      } catch (err) {
        console.error("chatWithBeemo: proposeMemoryFact error:", err);
      }
    }

    // Tier Usage Quota: naikkan counter SETELAH balasan berhasil (bukan di
    // awal) — supaya request yang gagal di tengah jalan (error Claude,
    // dsb.) tidak ikut memotong kuota pelanggan secara tidak adil. Gagal
    // increment TIDAK menggagalkan balasan chat — ini housekeeping, bukan
    // syarat chat berhasil (sama prinsipnya dengan proposeMemoryFact di atas).
    let newCount = membership.chatMessageCount;
    if (membership.subscriptionId) {
      newCount = membership.chatMessageCount + 1;
      const { error: quotaError } = await supabase
        .from("subscriptions")
        .update({ chat_message_count: newCount })
        .eq("id", membership.subscriptionId);
      if (quotaError) {
        console.error("chatWithBeemo: gagal update chat_message_count:", quotaError);
      }
    }

    return {
      status: 200,
      body: {
        reply: cleanReply,
        factProposed: Boolean(factKey),
        tier,
        chatMessageCount: newCount,
        quotaLimit,
      },
    };
  } catch (error) {
    console.error("services/beemo/chat error:", error);
    return {
      status: 500,
      body: { error: lang === "en" ? "Beemo failed to respond. Please try again." : "Beemo gagal merespons. Coba lagi." },
    };
  }
}
