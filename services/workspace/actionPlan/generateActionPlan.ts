// services/workspace/actionPlan/generateActionPlan.ts
//
// Rencana Aksi Beemo (directive PO Phase 3, "Evaluasi Flow & UX THE HIVE":
// "yang penting ketika user buka workspace, users tau apa saja yang harus
// users lakukan hari ini, besok, lusa dst untuk bisnisnya... jadi kita
// benar2 menjadi mentor untuk users"). Sebelumnya Mission Today
// (services/today/computeSnapshot.ts) murni rule engine untuk HARI INI
// saja -- tidak ada rencana bertanggal ke depan di mana pun platform ini
// (sudah diverifikasi: "Rencana Aksi 30 Hari" di laporan berbayar cuma
// dipakai sekali untuk render PDF lalu datanya dibuang, tidak pernah
// disimpan terstruktur).
//
// Fungsi ini BENAR-BENAR memanggil Beemo AI (bukan template/if-else) untuk
// menyusun rencana 7 hari ke depan, digrounded ke Business Memory yang SAMA
// dipakai Chat/Decision Engine (getBusinessMemory + buildContextBlock, satu
// sumber kebenaran -- lihat services/memory/getBusinessMemory.ts &
// services/beemo/chat.ts) -- BUKAN menulis ulang query konteks sendiri.
//
// Pola generate+simpan (batch_id, rate limit per bisnis) di-reuse persis
// dari services/workspace/leads/generateLeadReferrals.ts.
//
// Data honesty: system prompt melarang Claude mengarang angka spesifik
// (omset/ROI/dst) yang tidak ada di konteks -- aksi harus actionable
// (riset/eksekusi/evaluasi), bukan klaim hasil yang belum terjadi.
//
// Tersedia untuk SEMUA tier (free/pro/platinum) -- ini bagian inti
// pengalaman "mentor", bukan fitur premium seperti Decision Journal.

import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import type { ServiceResult } from "../../business/create.js";
import { checkRateLimit } from "../../rateLimit/checkRateLimit.js";
import { logClaudeUsage, extractUsage } from "../../costTracking/logUsage.js";
import { getBusinessMemory } from "../../memory/getBusinessMemory.js";
import { buildContextBlock } from "../../beemo/chat.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Regenerasi manual ("Susun Ulang Rencana") dibatasi per bisnis, bukan per
// akun -- satu pemanggilan Claude per klik, biaya nyata. 5x/24 jam cukup
// longgar untuk pemakaian wajar (termasuk coba lagi kalau hasil pertama
// kurang pas) tapi menutup kemungkinan spam.
const RATE_LIMIT_PER_DAY = 5;
const PLAN_HORIZON_DAYS = 7;
const MAX_ITEMS = 10;

type PlanItem = { dayOffset?: number; title?: string; description?: string };

function parsePlanJson(raw: string): PlanItem[] {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed?.items)) return parsed.items;
  } catch {
    // lanjut ke percobaan berikutnya
  }
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Respons tidak mengandung objek JSON.");
  const parsed = JSON.parse(jsonMatch[0]);
  return Array.isArray(parsed?.items) ? parsed.items : [];
}

function systemPrompt(lang: "id" | "en", businessType: "start" | "grow"): string {
  const stageRuleId =
    businessType === "start"
      ? `Bisnis ini BELUM BERJALAN (masih tahap persiapan/rencana) -- fokuskan rencana ke langkah PRA-LAUNCHING yang konkret: riset lokasi/target pelanggan, urus izin/legalitas, cari supplier, siapkan produk/harga, promosi pra-launching, dst -- sesuai tantangan & target yang disebutkan pemilik usaha di konteks bisnis.`
      : `Bisnis ini SUDAH BERJALAN -- fokuskan rencana ke langkah OPERASIONAL/PERBAIKAN yang bisa langsung dikerjakan minggu ini: menjawab tantangan yang sedang dihadapi, mendekati target yang disebutkan, evaluasi kondisi terkini, aksi marketing/operasional kecil yang realistis -- sesuai konteks bisnis yang diberikan, BUKAN saran generik yang bisa berlaku untuk bisnis apa pun.`;

  if (lang === "en") {
    const stageRuleEn =
      businessType === "start"
        ? `This business is NOT YET RUNNING (still in the planning/preparation stage) -- focus the plan on concrete PRE-LAUNCH steps: researching location/target customers, handling permits/legal steps, finding suppliers, preparing product/pricing, pre-launch promotion, etc. -- based on the challenges & target the owner mentioned in the business context.`
        : `This business is ALREADY RUNNING -- focus the plan on OPERATIONAL/IMPROVEMENT steps they can act on this week: addressing the challenge they're currently facing, moving toward their stated target, evaluating their current situation, small realistic marketing/operational actions -- grounded in the business context given, NOT generic advice that could apply to any business.`;
    return `You are Beemo, THE HIVE's business mentor. Your job is to build a ${PLAN_HORIZON_DAYS}-day forward ACTION PLAN (day 0 = today, through day ${PLAN_HORIZON_DAYS - 1}) for this specific business, based on the business context given below.

${stageRuleEn}

RULES:
1. Each day (dayOffset 0-${PLAN_HORIZON_DAYS - 1}) gets 0-2 CONCRETE action items the owner can actually act on right away -- NOT abstract advice like "think about a marketing strategy". Actions must be specific to THIS business (use the business name/product/challenge/target from the context) -- not a generic template. Not every day needs an item; skip a day if there's genuinely nothing important for it.
2. Data honesty: do NOT invent specific figures (revenue, ROI, etc.) not present in the context. Actions can be about research/execution/evaluation, but must never claim a result that hasn't actually happened.
3. Total across all ${PLAN_HORIZON_DAYS} days: maximum ${MAX_ITEMS} items.
4. "title": short (max ~8 words). "description": one sentence explaining why/how.
5. Reply with ONLY valid JSON, no markdown, no other text, in exactly this format:
{"items": [{"dayOffset": number, "title": string, "description": string}]}`;
  }

  return `Kamu adalah Beemo, mentor bisnis THE HIVE. Tugasmu menyusun RENCANA AKSI ${PLAN_HORIZON_DAYS} hari ke depan (hari ke-0 = hari ini, sampai hari ke-${PLAN_HORIZON_DAYS - 1}) untuk bisnis spesifik ini, berdasarkan konteks bisnis di bawah.

${stageRuleId}

ATURAN:
1. Setiap hari (dayOffset 0-${PLAN_HORIZON_DAYS - 1}) punya 0-2 item aksi KONKRET yang bisa langsung dikerjakan pemilik usaha -- BUKAN saran abstrak seperti "pikirkan strategi pemasaran". Aksi harus spesifik untuk bisnis INI (pakai nama bisnis/produk/tantangan/target dari konteks) -- bukan template umum. Tidak perlu setiap hari ada isinya, lewati hari yang memang tidak ada yang penting.
2. Data honesty: JANGAN mengarang angka spesifik (omset, ROI, dst) yang tidak ada di konteks. Aksi boleh soal riset/eksekusi/evaluasi, tapi jangan pernah mengklaim hasil yang belum terjadi.
3. Total untuk seluruh ${PLAN_HORIZON_DAYS} hari: maksimal ${MAX_ITEMS} item.
4. "title" singkat (maksimal ~8 kata). "description" satu kalimat penjelasan kenapa/caranya.
5. Balas HANYA JSON valid, tanpa markdown, tanpa teks lain, format persis:
{"items": [{"dayOffset": number, "title": string, "description": string}]}`;
}

export async function generateActionPlan(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
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

  const rl = await checkRateLimit(`action-plan:${businessProfileId}`, RATE_LIMIT_PER_DAY, 86400);
  if (!rl.allowed) {
    return {
      status: 429,
      body: {
        error:
          lang === "en"
            ? "You've reached today's limit for rebuilding the plan. Try again tomorrow."
            : "Sudah mencapai batas penyusunan ulang rencana hari ini. Coba lagi besok.",
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
  const system = `${systemPrompt(lang, memory.profile.businessType)}\n\n${contextBlock}`;

  let items: PlanItem[] = [];
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1500,
      system,
      messages: [
        {
          role: "user",
          content:
            lang === "en"
              ? `Build the ${PLAN_HORIZON_DAYS}-day action plan now, following the JSON schema already described.`
              : `Susun rencana aksi ${PLAN_HORIZON_DAYS} hari ke depan sekarang, sesuai skema JSON yang sudah dijelaskan.`,
        },
      ],
    });

    // Biaya AI sungguhan (Juli 2026, "tidak boleh ada data palsu") — fire
    // and forget, tidak menunda respons ke pengguna kalau lambat/gagal.
    const usage = extractUsage(response);
    void logClaudeUsage({ businessProfileId, action: "action_plan", model: "claude-sonnet-5", inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, webSearches: usage.webSearches });

    const rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("");
    items = parsePlanJson(rawText).slice(0, MAX_ITEMS);
  } catch (err) {
    console.error("generateActionPlan: gagal memanggil Claude:", err);
    return {
      status: 500,
      body: { error: lang === "en" ? "Beemo failed to build your plan. Please try again." : "Beemo gagal menyusun rencana. Coba lagi." },
    };
  }

  // Saring & validasi setiap item -- jangan simpan baris yang cacat (day
  // offset di luar rentang, title kosong) kalau model kebetulan meleset
  // dari skema, daripada gagal total.
  const validItems = items
    .map((it) => ({
      dayOffset: typeof it.dayOffset === "number" ? Math.max(0, Math.min(PLAN_HORIZON_DAYS - 1, Math.round(it.dayOffset))) : null,
      title: typeof it.title === "string" ? it.title.trim().slice(0, 200) : "",
      description: typeof it.description === "string" ? it.description.trim().slice(0, 500) : null,
    }))
    .filter((it) => it.dayOffset !== null && it.title.length > 0);

  if (validItems.length === 0) {
    return { status: 200, body: { items: [] } };
  }

  const batchId = randomUUID();
  const generatedAt = new Date().toISOString();
  const rows = validItems.map((it) => ({
    business_profile_id: businessProfileId,
    batch_id: batchId,
    day_offset: it.dayOffset as number,
    title: it.title,
    description: it.description,
    generated_at: generatedAt,
  }));

  // Regenerasi TIDAK menghapus batch lama (pola sama dengan
  // business_lead_recommendations) -- pelanggan tidak pernah kehilangan
  // data begitu saja. listActionPlan.ts hanya menampilkan batch dengan
  // generated_at terbaru.
  const { data: inserted, error: insertError } = await supabase
    .from("business_action_plan_items")
    .insert(rows)
    .select("id, batch_id, day_offset, title, description, completed, completed_at, generated_at");

  if (insertError) {
    console.error("generateActionPlan insert error:", insertError);
    return { status: 500, body: { error: lang === "en" ? "Failed to save the plan." : "Gagal menyimpan rencana." } };
  }

  return { status: 200, body: { items: (inserted || []).sort((a, b) => a.day_offset - b.day_offset) } };
}
