// services/decision/proposeDecision.ts
//
// Decision Engine (directive "CONTINUE — BUSINESS UPDATE ENGINE", bagian
// Decision Engine: "visi kita adalah AI Business Mentor, bukan AI
// Reporter"). Dipakai saat pemilik usaha mengajukan keputusan besar (mis.
// "saya ingin buka cabang") — Beemo TIDAK menjawab "terserah", tapi
// menyusun: Tujuan -> Risiko -> Peluang -> Data Pendukung -> Rekomendasi ->
// Kesimpulan, SELURUHNYA digrounded ke Business Context yang sama dipakai
// Chat (buildContextBlock, di-reuse dari services/beemo/chat.ts — tidak ada
// logic konteks kedua).
//
// Data honesty: system prompt secara eksplisit melarang Claude mengarang
// angka yang tidak ada di konteks — kalau datanya belum ada, field terkait
// harus bilang jujur "belum ada data untuk ini", bukan mengarang.
//
// Fitur berbayar (sama seperti Chat Beemo — PRO/PLATINUM), gating dicek di
// server, bukan cuma frontend.

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import type { ServiceResult } from "../business/create.js";
import { getActiveMembership } from "../membership/getActiveMembership.js";
import { getBusinessMemory } from "../memory/getBusinessMemory.js";
import { buildContextBlock } from "../beemo/chat.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const SYSTEM_PROMPT_ID = `Kamu adalah Beemo, mentor bisnis THE HIVE, dalam mode Decision Support. Pemilik usaha sedang mempertimbangkan sebuah keputusan besar (mis. buka cabang, ganti supplier, naikkan harga). Tugasmu BUKAN menjawab "terserah" atau memberi opini kosong — susun analisa terstruktur berdasarkan konteks bisnis yang diberikan.

ATURAN KETAT (data honesty):
- Jangan mengarang angka atau fakta yang tidak ada di konteks bisnis di bawah.
- Kalau konteks belum punya data yang relevan untuk suatu bagian, tulis dengan jujur bahwa datanya belum cukup untuk bagian itu — jangan menebak.
- Gunakan bahasa Indonesia sederhana, untuk pemilik usaha, BUKAN istilah analis bisnis.

Balas HANYA dalam format JSON persis seperti ini, tanpa markdown/teks lain:
{
  "goal": "kalimat merangkum tujuan pengguna dari keputusan ini",
  "risk": "risiko nyata yang relevan, berdasarkan konteks bisnis",
  "opportunity": "peluang yang relevan, berdasarkan konteks bisnis",
  "supportingData": ["poin data pendukung 1 dari konteks", "poin data pendukung 2"],
  "recommendation": "rekomendasi konkret, actionable",
  "conclusion": "satu-dua kalimat kesimpulan yang membantu pengguna mengambil keputusan"
}`;

const SYSTEM_PROMPT_EN = `You are Beemo, THE HIVE's business mentor, in Decision Support mode. The business owner is weighing a big decision (e.g. opening a branch, switching suppliers, raising prices). Your job is NOT to say "up to you" or give an empty opinion — build a structured analysis grounded in the business context provided.

STRICT RULES (data honesty):
- Do not invent numbers or facts that aren't in the business context below.
- If the context doesn't have relevant data for a section, honestly say the data isn't sufficient for that part yet — don't guess.
- Use simple, everyday language for a business owner, NOT business-analyst jargon.

Reply ONLY in this exact JSON format, no markdown/other text:
{
  "goal": "sentence summarizing the user's goal for this decision",
  "risk": "real relevant risk, based on the business context",
  "opportunity": "relevant opportunity, based on the business context",
  "supportingData": ["supporting data point 1 from context", "supporting data point 2"],
  "recommendation": "concrete, actionable recommendation",
  "conclusion": "one or two closing sentences to help the user decide"
}`;

type DecisionResult = {
  goal: string;
  risk: string;
  opportunity: string;
  supportingData: string[];
  recommendation: string;
  conclusion: string;
};

export async function proposeDecision(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  const question = payload.question;
  const lang: "id" | "en" = payload.lang === "en" ? "en" : "id";

  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }
  if (!question || typeof question !== "string" || !question.trim()) {
    return {
      status: 400,
      body: { error: lang === "en" ? "Describe the decision you're considering." : "Ceritakan dulu keputusan yang sedang kamu pertimbangkan." },
    };
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
  if (membership.tier === "free") {
    return {
      status: 403,
      body: {
        error:
          lang === "en"
            ? "Decision support is available for PRO/PLATINUM customers."
            : "Bantuan keputusan tersedia untuk pelanggan PRO/PLATINUM.",
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
  const systemPrompt = `${lang === "en" ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ID}\n\n${contextBlock}`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: "user", content: question.trim().slice(0, 2000) }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text : "";
    const cleaned = raw.replace(/```json|```/g, "").trim();

    let result: DecisionResult;
    try {
      result = JSON.parse(cleaned) as DecisionResult;
    } catch (parseErr) {
      console.error("proposeDecision: JSON.parse gagal. stop_reason:", response.stop_reason);
      console.error("proposeDecision: raw response:", raw);
      throw parseErr;
    }

    const { data: saved, error: insertError } = await supabase
      .from("business_decisions")
      .insert({
        business_profile_id: businessProfileId,
        question: question.trim(),
        goal: result.goal || null,
        risk: result.risk || null,
        opportunity: result.opportunity || null,
        supporting_data: result.supportingData || [],
        recommendation: result.recommendation || null,
        conclusion: result.conclusion || null,
      })
      .select("id, question, goal, risk, opportunity, supporting_data, recommendation, conclusion, status, created_at")
      .single();

    if (insertError || !saved) {
      console.error("proposeDecision: gagal menyimpan Decision History:", insertError);
      // Tetap kembalikan hasil analisa ke pengguna meski gagal disimpan ke
      // Decision History — jangan sampai satu masalah penyimpanan
      // menggagalkan bantuan keputusan yang sudah dihasilkan.
      return {
        status: 200,
        body: {
          decision: {
            id: null,
            question: question.trim(),
            goal: result.goal,
            risk: result.risk,
            opportunity: result.opportunity,
            supportingData: result.supportingData,
            recommendation: result.recommendation,
            conclusion: result.conclusion,
            status: "open",
            createdAt: new Date().toISOString(),
          },
        },
      };
    }

    return {
      status: 200,
      body: {
        decision: {
          id: saved.id,
          question: saved.question,
          goal: saved.goal,
          risk: saved.risk,
          opportunity: saved.opportunity,
          supportingData: saved.supporting_data || [],
          recommendation: saved.recommendation,
          conclusion: saved.conclusion,
          status: saved.status,
          createdAt: saved.created_at,
        },
      },
    };
  } catch (error) {
    console.error("services/decision/proposeDecision error:", error);
    return {
      status: 500,
      body: { error: lang === "en" ? "Beemo failed to analyze this decision. Please try again." : "Beemo gagal menganalisa keputusan ini. Coba lagi." },
    };
  }
}
