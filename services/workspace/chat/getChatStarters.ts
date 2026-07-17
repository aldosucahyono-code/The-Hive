// services/workspace/chat/getChatStarters.ts
//
// Starter pertanyaan Chat Beemo yang dipikirkan AI (Phase 5, "Chat Beemo
// Experience", directive PO tambahan: "personalisasi penuh via AI... reuse
// pola yang sama dengan Rencana Aksi"). Sebelumnya 3 starter di
// ChatBeemoPanel.tsx statis (t.workspace.chatSuggestion1/2/3, cuma
// dibedakan bisnis baru/berjalan) -- sekarang benar-benar dipikirkan Beemo
// dari Business Memory bisnis ini (nama/tantangan/target/produk), pola
// generate+cache yang sama dengan services/workspace/actionPlan/
// generateActionPlan.ts.
//
// Beda dari Rencana Aksi: SATU baris per bisnis (upsert, bukan batch
// riwayat) -- stakes jauh lebih kecil (starter cuma pelengkap UI, bukan
// rencana kerja), jadi auto-refresh berdasarkan staleness (>14 hari) TANPA
// tombol regenerate manual.

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import type { ServiceResult } from "../../business/create.js";
import { checkRateLimit } from "../../rateLimit/checkRateLimit.js";
import { logClaudeUsage, extractUsage } from "../../costTracking/logUsage.js";
import { getBusinessMemory } from "../../memory/getBusinessMemory.js";
import { buildContextBlock } from "../../beemo/chat.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1000; // 14 hari
// Guard tambahan murni jaga-jaga (race condition beberapa tab dibuka
// bersamaan) -- staleness check di atas sudah membatasi ke maksimal 1x/14
// hari secara wajar, ini cuma lapisan aman kedua.
const RATE_LIMIT_PER_DAY = 3;

function systemPrompt(lang: "id" | "en", businessType: "start" | "grow"): string {
  const stageRuleId =
    businessType === "start"
      ? `Bisnis ini BELUM BERJALAN (masih tahap persiapan/rencana) -- pertanyaan harus relevan untuk pemilik yang sedang bersiap buka usaha.`
      : `Bisnis ini SUDAH BERJALAN -- pertanyaan harus relevan untuk pemilik yang sedang menjalankan usaha sehari-hari.`;
  const stageRuleEn =
    businessType === "start"
      ? `This business is NOT YET RUNNING (still preparing to launch) -- questions must fit an owner who's getting ready to open.`
      : `This business is ALREADY RUNNING -- questions must fit an owner managing day-to-day operations.`;

  // Audit Juli 2026 (ChatGPT Critical #2 + QA langsung: "Beemo masih
  // terlalu pasif, saya ingin Beemo mencari user" -- Chat Beemo sebelumnya
  // cuma menunggu, empty state-nya cuma judul generik + pertanyaan yang
  // harus DIKLIK pengguna). Ditambahkan SATU field baru "opening" -- kalimat
  // pembuka dari SUDUT PANDANG BEEMO SENDIRI (bukan lagi contoh pertanyaan
  // dari sudut pandang pemilik usaha), seolah Beemo sudah lihat bisnis ini
  // dan punya sesuatu untuk disampaikan duluan -- ditampilkan sebagai bubble
  // chat pertama, SEBELUM pengguna mengetik apa pun. Reuse SATU pemanggilan
  // Claude yang sama dengan starter pertanyaan (bukan panggilan/biaya baru
  // terpisah) -- konsisten dengan kehati-hatian biaya AI yang sudah
  // dipegang di seluruh Chat Beemo.
  if (lang === "en") {
    return `You are Beemo, THE HIVE's business mentor. You need to write two things for the empty state of the chat (shown before the owner has typed anything):

1. An OPENING LINE from YOUR OWN voice (Beemo speaking), as if you already looked at this business and have something specific to say -- a short observation, nudge, or question about their actual situation. This should feel like YOU reaching out first, not waiting to be asked.
2. Exactly 3 short SAMPLE QUESTIONS the owner could tap to start a conversation with you.

${stageRuleEn}

RULES:
1. The opening line is Beemo speaking TO the owner (e.g. "I noticed [specific challenge] is still open -- want to tackle it together?") -- warm, direct, one or two short sentences, no jargon.
2. The 3 sample questions are written IN THE OWNER'S VOICE, first person, as if THEY are asking you (e.g. "How can I find my first customers for [business]?").
3. Everything must be SPECIFIC to this business -- reference their actual challenge, target, product, or business name from the context below. Do NOT write anything generic enough to apply to any business.
4. Reply with ONLY valid JSON, no markdown, no other text, in exactly this format:
{"opening": string, "starters": [string, string, string]}`;
  }

  return `Kamu adalah Beemo, mentor bisnis THE HIVE. Kamu perlu menulis dua hal untuk empty state chat (ditampilkan sebelum pemilik usaha mengetik apa pun):

1. KALIMAT PEMBUKA dari SUDUT PANDANG KAMU SENDIRI (Beemo bicara), seolah kamu sudah lihat bisnis ini dan punya sesuatu yang spesifik untuk disampaikan -- pengamatan singkat, dorongan, atau pertanyaan tentang situasi nyata mereka. Ini harus terasa seperti KAMU yang menyapa duluan, bukan menunggu ditanya.
2. TEPAT 3 CONTOH PERTANYAAN singkat yang bisa langsung diklik pemilik usaha untuk mulai ngobrol denganmu.

${stageRuleId}

ATURAN:
1. Kalimat pembuka adalah Beemo bicara KE pemilik usaha (mis. "Saya lihat [tantangan spesifik] masih belum terselesaikan -- mau kita bahas bareng?") -- hangat, langsung, satu-dua kalimat pendek, tanpa jargon.
2. Tiga contoh pertanyaan ditulis dari SUDUT PANDANG PEMILIK USAHA, orang pertama, seolah MEREKA yang bertanya ke kamu (mis. "Bagaimana cara saya cari pelanggan pertama untuk [nama bisnis]?").
3. Semuanya harus SPESIFIK untuk bisnis ini -- sebut tantangan, target, produk, atau nama bisnis asli dari konteks di bawah. JANGAN tulis apa pun yang cukup generik untuk berlaku ke bisnis manapun.
4. Balas HANYA JSON valid, tanpa markdown, tanpa teks lain, format persis:
{"opening": string, "starters": [string, string, string]}`;
}

type StartersPayload = { opening: string | null; starters: string[] };

// Round 2 GAPTEK review (kolaborasi GPT, difilter user 17 Juli 2026): GPT
// mengusulkan "Conversation Preview" penuh (mockup dialog bertahap) untuk
// kartu terkunci Free -- kami TOLAK itu, kepanjangan/kebanyakan fitur untuk
// nilai tambah yang tidak pasti. Yang kami AMBIL dari idenya cuma inti yang
// benar-benar murah: pertanyaan contoh ditulis dari TEMPLATE + data bisnis
// yang SUDAH ADA sejak wizard onboarding (nama bisnis, tantangan utama dari
// Business Discovery/Update terbaru) -- BUKAN AI, BUKAN cache starter. Jadi
// SETIAP bisnis Free (bahkan yang baru daftar hari ini) selalu dapat contoh
// yang terasa personal, tanpa nambah panggilan Claude sama sekali. Kalau
// tantangan belum pernah diisi (jarang, wizard selalu menanyakan ini),
// fallback ke 2 pertanyaan generik tanpa nama bisnis -- tetap jujur, tidak
// mengarang data yang tidak ada.
//
// Round 3 audit (live QA + GPT, 17 Juli 2026) -- BUG P1 ditemukan: versi awal
// menyisipkan `mainChallenges` mentah ke tengah kalimat ("Bagaimana cara
// mengatasi <tantangan> di <bisnis>?"). Tantangan yang berasal dari isian
// bebas pengguna (Business Update) sering berupa KALIMAT PANJANG, bukan
// frasa pendek -- hasilnya kalimat rancu/run-on yang membuat user mengira
// "AI-nya aneh", padahal ini cuma template string, bukan AI. Diperbaiki
// sesuai saran GPT: tantangan TIDAK PERNAH disisipkan di tengah kalimat lagi,
// selalu ditampilkan apa adanya sebagai kutipan diikuti tag pertanyaan
// pendek yang FIXED -- jadi aman untuk tantangan sepanjang apapun.
function buildTemplatePreview(
  businessName: string,
  mainChallenges: string | null,
  lang: "id" | "en"
): string[] {
  if (mainChallenges && mainChallenges.trim().length > 0) {
    const raw = mainChallenges.trim();
    const truncated = raw.length > 100 ? `${raw.slice(0, 100).trim()}…` : raw;
    return lang === "en"
      ? [
          `"${truncated}" — want to work through this with Beemo?`,
          `What's the most important next step for ${businessName} this week?`,
        ]
      : [
          `"${truncated}" — mau dibahas bareng Beemo?`,
          `Apa langkah paling penting untuk ${businessName} minggu ini?`,
        ];
  }
  return lang === "en"
    ? ["How can I increase my sales?", "What strategy fits my business best?"]
    : ["Bagaimana cara meningkatkan penjualan saya?", "Strategi apa yang cocok untuk bisnis saya?"];
}

function parseStartersJson(raw: string): StartersPayload {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const extract = (parsed: unknown): StartersPayload | null => {
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as { starters?: unknown; opening?: unknown };
    if (!Array.isArray(obj.starters)) return null;
    return { opening: typeof obj.opening === "string" ? obj.opening : null, starters: obj.starters as string[] };
  };
  try {
    const result = extract(JSON.parse(cleaned));
    if (result) return result;
  } catch {
    // lanjut ke percobaan berikutnya
  }
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Respons tidak mengandung objek JSON.");
  const result = extract(JSON.parse(jsonMatch[0]));
  return result || { opening: null, starters: [] };
}

// Bentuk yang disimpan di kolom jsonb `starters` (business_chat_starters).
// TIDAK perlu migrasi baru -- kolomnya sudah jsonb bebas skema. Baris LAMA
// (sebelum audit Juli 2026 ini) berbentuk array string polos, baris BARU
// berbentuk objek {opening, starters}. normalizeStoredStarters menangani
// dua bentuk itu supaya baris lama yang belum sempat regenerate (staleness
// 14 hari) tidak error, cuma tampil tanpa opening line sampai regenerate
// berikutnya.
function normalizeStoredStarters(stored: unknown): StartersPayload {
  if (Array.isArray(stored)) return { opening: null, starters: stored as string[] };
  if (stored && typeof stored === "object") {
    const obj = stored as { opening?: unknown; starters?: unknown };
    return {
      opening: typeof obj.opening === "string" ? obj.opening : null,
      starters: Array.isArray(obj.starters) ? (obj.starters as string[]) : [],
    };
  }
  return { opening: null, starters: [] };
}

async function generateAndSave(businessProfileId: string, lang: "id" | "en"): Promise<StartersPayload | null> {
  const memory = await getBusinessMemory(businessProfileId);
  if (!memory) return null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const contextBlock = buildContextBlock(memory, lang);
  const system = `${systemPrompt(lang, memory.profile.businessType)}\n\n${contextBlock}`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 500,
      system,
      messages: [
        {
          role: "user",
          content: lang === "en" ? "Write the 3 sample questions now, following the JSON schema already described." : "Tulis 3 contoh pertanyaan sekarang, sesuai skema JSON yang sudah dijelaskan.",
        },
      ],
    });

    const usage = extractUsage(response);
    void logClaudeUsage({ businessProfileId, action: "chat_starters", model: "claude-sonnet-5", inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, webSearches: usage.webSearches });

    const rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("");
    const parsed = parseStartersJson(rawText);
    const starters = parsed.starters
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim().slice(0, 200))
      .slice(0, 3);
    const opening = parsed.opening && parsed.opening.trim().length > 0 ? parsed.opening.trim().slice(0, 400) : null;

    if (starters.length === 0 && !opening) return null;

    const payload: StartersPayload = { opening, starters };
    const { error } = await supabase
      .from("business_chat_starters")
      .upsert(
        { business_profile_id: businessProfileId, starters: payload, generated_at: new Date().toISOString() },
        { onConflict: "business_profile_id" }
      );
    if (error) {
      console.error("getChatStarters: gagal menyimpan starters:", error);
    }

    return payload;
  } catch (err) {
    console.error("getChatStarters: gagal memanggil Claude:", err);
    return null;
  }
}

export async function getChatStarters(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  const lang: "id" | "en" = payload.lang === "en" ? "en" : "id";
  // Round 2 GAPTEK review (kolaborasi GPT, difilter user 17 Juli 2026):
  // dipakai Free-tier ChatBeemoPanel untuk menampilkan 1-2 contoh
  // pertanyaan personal di kartu terkunci (biar "terkunci" terasa seperti
  // diundang, bukan ditolak) TANPA memicu generate AI baru -- Free tier
  // tidak boleh menambah biaya AI. readOnly = true berarti: baca cache
  // kalau ada (walau basi), JANGAN pernah panggil Claude atau tulis DB.
  const readOnly = payload.readOnly === true;

  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }

  const { data: business, error: bpError } = await supabase
    .from("business_profiles")
    .select("id, user_id")
    .eq("id", businessProfileId)
    .maybeSingle();

  if (bpError || !business || business.user_id !== userId) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  const { data: existing } = await supabase
    .from("business_chat_starters")
    .select("starters, generated_at")
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();

  if (readOnly) {
    if (existing) {
      const normalized = normalizeStoredStarters(existing.starters);
      if (normalized.starters.length > 0) {
        return { status: 200, body: { opening: normalized.opening, starters: normalized.starters } };
      }
    }
    // Belum ada cache starter AI sama sekali (kasus paling umum untuk Free
    // tier baru) -- bangun 2 contoh dari TEMPLATE + data bisnis yang sudah
    // ada, BUKAN generate AI baru (lihat buildTemplatePreview di atas).
    const memory = await getBusinessMemory(businessProfileId);
    if (!memory) return { status: 200, body: { opening: null, starters: [] } };
    const templateStarters = buildTemplatePreview(memory.profile.businessName, memory.mainChallenges, lang);
    return { status: 200, body: { opening: null, starters: templateStarters } };
  }

  const isStale = !existing || Date.now() - new Date(existing.generated_at).getTime() > STALE_AFTER_MS;

  if (existing && !isStale) {
    const normalized = normalizeStoredStarters(existing.starters);
    return { status: 200, body: { opening: normalized.opening, starters: normalized.starters } };
  }

  const rl = await checkRateLimit(`chat-starters:${businessProfileId}`, RATE_LIMIT_PER_DAY, 86400);
  if (!rl.allowed) {
    // Fail-open ke starter lama kalau masih ada (lebih baik starter agak
    // basi daripada tidak ada sama sekali), atau array kosong kalau memang
    // belum pernah ada -- ChatBeemoPanel.tsx fallback ke starter statis
    // lama saat array kosong.
    const normalized = existing ? normalizeStoredStarters(existing.starters) : { opening: null, starters: [] };
    return { status: 200, body: { opening: normalized.opening, starters: normalized.starters } };
  }

  const fresh = await generateAndSave(businessProfileId, lang);
  if (fresh) {
    return { status: 200, body: { opening: fresh.opening, starters: fresh.starters } };
  }

  // Generate gagal -- fallback ke starter lama (kalau ada, walau basi)
  // daripada gagal total; ChatBeemoPanel.tsx fallback ke statis kalau kosong.
  const normalized = existing ? normalizeStoredStarters(existing.starters) : { opening: null, starters: [] };
  return { status: 200, body: { opening: normalized.opening, starters: normalized.starters } };
}
