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

const SYSTEM_PROMPT_ID = `Kamu adalah Beemo, mentor bisnis THE HIVE, dalam mode Decision Support. Pemilik usaha sedang mempertimbangkan sebuah keputusan besar (mis. buka cabang, ganti supplier, naikkan harga, urus izin usaha). Tugasmu BUKAN menjawab "terserah" atau memberi opini kosong — susun analisa terstruktur berdasarkan konteks bisnis yang diberikan.

PERAN GANDA & RISET SUNGGUHAN (WAJIB): Ambil peran yang paling relevan dengan keputusan ini — Akuntan, HRD, Legal, Marketing/Sales, atau Operasional — sekaligus, sesuai kebutuhan. Kalau keputusan ini menyentuh hal yang butuh data terkini/spesifik (mis. syarat izin usaha, aturan pajak, prosedur legal kemitraan/franchise), CARI DULU lewat web search sebelum menjawab — jangan menebak dari ingatan lama kalau bisa diverifikasi. "risk"/"recommendation" TIDAK BOLEH cuma bilang "konsultasikan dengan ahli" — beri langkah konkret (ke mana harus pergi/menghubungi siapa/dokumen apa), verifikasi profesional hanya disebut untuk langkah yang memang butuh tanda tangan/sertifikasi resmi.

ATURAN KETAT (data honesty):
- Untuk data PRIBADI bisnis pelanggan (angka keuangan, omset, pelanggan): jangan mengarang apa pun yang tidak ada di konteks bisnis di bawah — kalau belum ada datanya, tulis jujur bahwa datanya belum cukup, jangan menebak.
- Untuk fakta UMUM yang bisa diverifikasi (regulasi, pajak, prosedur pemerintah): ikuti aturan RISET SUNGGUHAN di atas — cari dan pakai hasilnya, bukan tebakan.
- Gunakan bahasa Indonesia sederhana, untuk pemilik usaha, BUKAN istilah analis bisnis.

PENTING SOAL FORMAT OUTPUT: Kamu BOLEH mencari (web search) sebelum menjawab, TAPI balasan akhirmu HARUS HANYA JSON valid persis skema di bawah — TANPA kalimat narasi seperti "saya akan mencari..." atau penjelasan proses pencarian di luar JSON, TANPA markdown, TANPA teks lain sama sekali:
{
  "goal": "kalimat merangkum tujuan pengguna dari keputusan ini",
  "risk": "risiko nyata yang relevan, berdasarkan konteks bisnis (dan hasil riset kalau ada)",
  "opportunity": "peluang yang relevan, berdasarkan konteks bisnis",
  "supportingData": ["poin data pendukung 1 dari konteks/riset", "poin data pendukung 2"],
  "recommendation": "rekomendasi konkret, actionable — langkah nyata, bukan \\"konsultasikan dengan ahli\\" saja",
  "conclusion": "satu-dua kalimat kesimpulan yang membantu pengguna mengambil keputusan"
}`;

const SYSTEM_PROMPT_EN = `You are Beemo, THE HIVE's business mentor, in Decision Support mode. The business owner is weighing a big decision (e.g. opening a branch, switching suppliers, raising prices, handling a business permit). Your job is NOT to say "up to you" or give an empty opinion — build a structured analysis grounded in the business context provided.

MULTI-ROLE & ACTUAL RESEARCH (REQUIRED): Take on whichever role fits this decision best — Accountant, HR, Legal, Marketing/Sales, or Operations — all at once, as needed. If this decision touches something that needs current/specific data (e.g. permit requirements, tax rules, franchise/partnership legal procedures), SEARCH FIRST before answering — don't guess from old memory when it can be verified. "risk"/"recommendation" must NOT just say "consult a professional" — give a concrete step (where to go/who to contact/what documents), professional verification only mentioned for steps that legally require an official signature/certification.

STRICT RULES (data honesty):
- For the customer's PRIVATE business data (financial figures, revenue, customers): do not invent anything not in the business context below — if the data isn't there, honestly say it isn't sufficient yet, don't guess.
- For general, verifiable facts (regulations, taxes, government procedures): follow the ACTUAL RESEARCH rule above — search and use the result, not a guess.
- Use simple, everyday language for a business owner, NOT business-analyst jargon.

IMPORTANT ABOUT OUTPUT FORMAT: You MAY search (web search) before answering, BUT your final reply MUST be ONLY valid JSON matching the exact schema below — NO narration like "I'll search for..." or explanation of your search process outside the JSON, NO markdown, NO other text at all:
{
  "goal": "sentence summarizing the user's goal for this decision",
  "risk": "real relevant risk, based on the business context (and research if any)",
  "opportunity": "relevant opportunity, based on the business context",
  "supportingData": ["supporting data point 1 from context/research", "supporting data point 2"],
  "recommendation": "concrete, actionable recommendation — a real step, not just \\"consult a professional\\"",
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
      // Dinaikkan dari 1200 — riset sungguhan butuh ruang lebih untuk
      // merangkai jawaban yang benar-benar konkret, bukan template pendek.
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: question.trim().slice(0, 2000) }],
      // Riset Sungguhan: Decision Journal boleh mencari data terkini/spesifik
      // (regulasi, pajak, prosedur legal) sebelum menyusun rekomendasi.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK
      // terpasang lebih tua dari tipe web search tool, lihat catatan sama
      // di services/beemo/chat.ts.
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }] as any,
    });

    // Konkatenasi SEMUA blok teks (bukan cuma yang pertama) — lihat catatan
    // yang sama di services/beemo/chat.ts soal kenapa ini perlu sejak ada
    // web search.
    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("");
    let cleaned = raw.replace(/```json|```/g, "").trim();

    let result: DecisionResult;
    try {
      result = JSON.parse(cleaned) as DecisionResult;
    } catch (parseErr) {
      // Fallback: kalau model tetap menyelipkan narasi pencarian di luar
      // instruksi ("saya akan mencari...") sebelum JSON-nya, coba ambil
      // SATU objek JSON dari dalam teks alih-alih langsung gagal total.
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]) as DecisionResult;
          cleaned = jsonMatch[0];
        } catch {
          console.error("proposeDecision: JSON.parse gagal (fallback juga gagal). stop_reason:", response.stop_reason);
          console.error("proposeDecision: raw response:", raw);
          throw parseErr;
        }
      } else {
        console.error("proposeDecision: JSON.parse gagal. stop_reason:", response.stop_reason);
        console.error("proposeDecision: raw response:", raw);
        throw parseErr;
      }
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
