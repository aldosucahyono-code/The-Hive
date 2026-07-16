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

  if (lang === "en") {
    return `You are Beemo, THE HIVE's business mentor. Your job is to write exactly 3 short SAMPLE QUESTIONS the business owner could tap to start a conversation with you -- shown in the empty state of the chat, before they've typed anything.

${stageRuleEn}

RULES:
1. Write each question IN THE OWNER'S VOICE, first person, as if THEY are asking you (e.g. "How can I find my first customers for [business]?") -- not Beemo talking about them.
2. Each question must be SPECIFIC to this business -- reference their actual challenge, target, product, or business name from the context below. Do NOT write generic questions that could apply to any business (e.g. "How is my business doing?" is too generic unless grounded in something specific from the context).
3. Keep each question short -- one sentence, natural spoken language, no jargon.
4. Reply with ONLY valid JSON, no markdown, no other text, in exactly this format:
{"starters": [string, string, string]}`;
  }

  return `Kamu adalah Beemo, mentor bisnis THE HIVE. Tugasmu menulis TEPAT 3 CONTOH PERTANYAAN singkat yang bisa langsung diklik pemilik usaha untuk mulai ngobrol denganmu -- ditampilkan di empty state chat, sebelum mereka mengetik apa pun.

${stageRuleId}

ATURAN:
1. Tulis tiap pertanyaan dari SUDUT PANDANG PEMILIK USAHA, orang pertama, seolah MEREKA yang bertanya ke kamu (mis. "Bagaimana cara saya cari pelanggan pertama untuk [nama bisnis]?") -- bukan Beemo yang bicara tentang mereka.
2. Setiap pertanyaan harus SPESIFIK untuk bisnis ini -- sebut tantangan, target, produk, atau nama bisnis asli dari konteks di bawah. JANGAN tulis pertanyaan generik yang bisa berlaku untuk bisnis apa pun (mis. "Bagaimana kondisi bisnis saya?" terlalu generik kalau tidak dikaitkan sesuatu yang spesifik dari konteks).
3. Pertanyaan singkat -- satu kalimat, bahasa lisan natural, tanpa jargon.
4. Balas HANYA JSON valid, tanpa markdown, tanpa teks lain, format persis:
{"starters": [string, string, string]}`;
}

function parseStartersJson(raw: string): string[] {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed?.starters)) return parsed.starters;
  } catch {
    // lanjut ke percobaan berikutnya
  }
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Respons tidak mengandung objek JSON.");
  const parsed = JSON.parse(jsonMatch[0]);
  return Array.isArray(parsed?.starters) ? parsed.starters : [];
}

async function generateAndSave(businessProfileId: string, lang: "id" | "en"): Promise<string[] | null> {
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
    const starters = parseStartersJson(rawText)
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim().slice(0, 200))
      .slice(0, 3);

    if (starters.length === 0) return null;

    const { error } = await supabase
      .from("business_chat_starters")
      .upsert(
        { business_profile_id: businessProfileId, starters, generated_at: new Date().toISOString() },
        { onConflict: "business_profile_id" }
      );
    if (error) {
      console.error("getChatStarters: gagal menyimpan starters:", error);
    }

    return starters;
  } catch (err) {
    console.error("getChatStarters: gagal memanggil Claude:", err);
    return null;
  }
}

export async function getChatStarters(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  const lang: "id" | "en" = payload.lang === "en" ? "en" : "id";

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

  const isStale = !existing || Date.now() - new Date(existing.generated_at).getTime() > STALE_AFTER_MS;

  if (existing && !isStale) {
    return { status: 200, body: { starters: existing.starters as string[] } };
  }

  const rl = await checkRateLimit(`chat-starters:${businessProfileId}`, RATE_LIMIT_PER_DAY, 86400);
  if (!rl.allowed) {
    // Fail-open ke starter lama kalau masih ada (lebih baik starter agak
    // basi daripada tidak ada sama sekali), atau array kosong kalau memang
    // belum pernah ada -- ChatBeemoPanel.tsx fallback ke starter statis
    // lama saat array kosong.
    return { status: 200, body: { starters: existing ? (existing.starters as string[]) : [] } };
  }

  const fresh = await generateAndSave(businessProfileId, lang);
  if (fresh) {
    return { status: 200, body: { starters: fresh } };
  }

  // Generate gagal -- fallback ke starter lama (kalau ada, walau basi)
  // daripada gagal total; ChatBeemoPanel.tsx fallback ke statis kalau kosong.
  return { status: 200, body: { starters: existing ? (existing.starters as string[]) : [] } };
}
