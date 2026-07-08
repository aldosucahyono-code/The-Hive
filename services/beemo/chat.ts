// services/beemo/chat.ts
//
// Business logic untuk action "chat" di router /api/beemo. Chat Beemo
// adalah fitur berbayar (PRO 7 hari, PLATINUM 30 hari) — gating tier
// dicek di sini, bukan cuma di frontend, supaya tidak bisa dilewati.
//
// Konteks percakapan: nama/jenis/tahap bisnis + ringkasan analisa terakhir
// (kalau ada), supaya Beemo tidak menjawab generik. Riwayat percakapan
// SEMENTARA belum disimpan ke database (beemo_logs/beemo_memory) — itu
// menyusul di Tahap 3 (AI Engine) saat AI Memory benar-benar dibangun.
// Untuk sekarang, histori chat hidup di sisi frontend selama sesi berjalan.

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import type { ServiceResult } from "../business/create";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const SYSTEM_PROMPT_ID = `Kamu adalah Beemo, mentor bisnis THE HIVE. Kamu BUKAN chatbot generik — kamu konsultan bisnis pribadi yang hangat, optimis, dan mendukung, tidak pernah menghakimi.

Gaya bicara:
- Bahasa Indonesia sederhana, seperti bicara dengan teman yang paham bisnis.
- Hindari jargon teknis/korporat yang berlebihan.
- Jawaban ringkas dan actionable, bukan esai panjang.
- Selalu berpihak pada pemilik bisnis, bantu mereka mengambil keputusan.

Kamu punya konteks bisnis pelanggan di bawah ini — gunakan itu supaya jawabanmu spesifik, bukan generik.`;

const SYSTEM_PROMPT_EN = `You are Beemo, THE HIVE's business mentor. You are NOT a generic chatbot — you're a warm, optimistic, supportive personal business consultant who never judges.

Tone:
- Simple, everyday language, like talking to a friend who understands business.
- Avoid excessive technical/corporate jargon.
- Keep answers concise and actionable, not long essays.
- Always be on the business owner's side, help them make decisions.

You have the customer's business context below — use it so your answers are specific, not generic.`;

type ChatMessage = { role: "user" | "assistant"; content: string };

function buildContextBlock(
  business: { business_name: string; industry: string | null; business_stage: string },
  preview: Record<string, unknown> | null,
  lang: "id" | "en"
): string {
  const lines: string[] = [];
  if (lang === "id") {
    lines.push(`Nama bisnis: ${business.business_name}`);
    if (business.industry) lines.push(`Jenis bisnis: ${business.industry}`);
    lines.push(`Tahap bisnis: ${business.business_stage}`);
    if (preview?.summary) lines.push(`Ringkasan analisa terakhir: ${preview.summary}`);
    if (preview?.businessHealthScore) lines.push(`Business Score terakhir: ${preview.businessHealthScore}/100`);
  } else {
    lines.push(`Business name: ${business.business_name}`);
    if (business.industry) lines.push(`Industry: ${business.industry}`);
    lines.push(`Business stage: ${business.business_stage}`);
    if (preview?.summary) lines.push(`Latest analysis summary: ${preview.summary}`);
    if (preview?.businessHealthScore) lines.push(`Latest Business Score: ${preview.businessHealthScore}/100`);
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
    .select("id, user_id, business_name, industry, business_stage")
    .eq("id", businessProfileId)
    .single();

  if (bpError || !business || business.user_id !== userId) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("tier, status")
    .eq("business_profile_id", businessProfileId)
    .eq("status", "active")
    .maybeSingle();

  const tier = subscription?.tier || "free";
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

  const { data: latestAnalysis } = await supabase
    .from("analyses")
    .select("ai_output")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { status: 500, body: { error: "ANTHROPIC_API_KEY belum diset di Vercel." } };
  }

  const contextBlock = buildContextBlock(business, latestAnalysis?.ai_output || null, lang);
  const systemPrompt = `${lang === "en" ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ID}\n\n${contextBlock}`;

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
      max_tokens: 800,
      system: systemPrompt,
      messages: trimmedMessages,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const reply = textBlock && "text" in textBlock ? textBlock.text : "";

    return { status: 200, body: { reply } };
  } catch (error) {
    console.error("services/beemo/chat error:", error);
    return {
      status: 500,
      body: { error: lang === "en" ? "Beemo failed to respond. Please try again." : "Beemo gagal merespons. Coba lagi." },
    };
  }
}
