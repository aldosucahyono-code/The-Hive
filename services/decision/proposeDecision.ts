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
import { saveDecisionRecord, DECISION_QUOTA } from "./saveDecisionRecord.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Tier Usage Quota (directive PO: "isi didalamnya benar-benar harus berbeda
// jauh... users benar benar merasa perbedaanya"): sama prinsipnya dengan
// services/beemo/chat.ts — PLATINUM dapat peran ganda simultan + riset lebih
// dalam, PRO dapat satu peran paling relevan + riset lebih terbatas. Kuota
// jumlah keputusan/periode akses (DECISION_QUOTA) sekarang didefinisikan di
// saveDecisionRecord.ts — satu sumber, dipakai juga oleh auto-detect di
// services/beemo/chat.ts.
// Diturunkan 4x -> 3x bersamaan dengan CHAT_SEARCH_MAX_USES (lihat
// services/beemo/chat.ts) — bagian dari audit biaya Juli 2026 supaya margin
// PLATINUM tetap aman di harga early bird Rp349.000/bulan.
const DECISION_SEARCH_MAX_USES: Record<"pro" | "platinum", number> = { pro: 1, platinum: 3 };

const ROLE_RESEARCH_BLOCK_PLATINUM_ID = `PERAN GANDA & RISET SUNGGUHAN (WAJIB): Ambil peran yang paling relevan dengan keputusan ini — Akuntan, HRD, Legal, Marketing/Sales, atau Operasional — SEKALIGUS kalau keputusan ini menyentuh lebih dari satu bidang, sesuai kebutuhan. Kalau keputusan ini menyentuh hal yang butuh data terkini/spesifik (mis. syarat izin usaha, aturan pajak, prosedur legal kemitraan/franchise), CARI DULU lewat web search sebelum menjawab — jangan menebak dari ingatan lama kalau bisa diverifikasi. "risk"/"recommendation" TIDAK BOLEH cuma bilang "konsultasikan dengan ahli" — beri langkah konkret (ke mana harus pergi/menghubungi siapa/dokumen apa), verifikasi profesional hanya disebut untuk langkah yang memang butuh tanda tangan/sertifikasi resmi.`;

const ROLE_RESEARCH_BLOCK_PRO_ID = `PERAN & RISET (WAJIB): Pilih SATU peran yang paling relevan dengan keputusan ini — Akuntan, HRD, Legal, Marketing/Sales, atau Operasional — dan analisa fokus dari sudut itu saja (bukan semua sudut sekaligus). Kamu punya 1x kesempatan riset web untuk fakta paling krusial kalau keputusan ini butuh data terkini/spesifik (izin usaha, pajak, dll) — pakai untuk hal yang paling menentukan. "risk"/"recommendation" TIDAK BOLEH cuma bilang "konsultasikan dengan ahli" — beri langkah konkret.`;

const ROLE_RESEARCH_BLOCK_PLATINUM_EN = `MULTI-ROLE & ACTUAL RESEARCH (REQUIRED): Take on whichever role fits this decision best — Accountant, HR, Legal, Marketing/Sales, or Operations — ALL AT ONCE if this decision touches more than one area, as needed. If this decision touches something that needs current/specific data (e.g. permit requirements, tax rules, franchise/partnership legal procedures), SEARCH FIRST before answering — don't guess from old memory when it can be verified. "risk"/"recommendation" must NOT just say "consult a professional" — give a concrete step (where to go/who to contact/what documents), professional verification only mentioned for steps that legally require an official signature/certification.`;

const ROLE_RESEARCH_BLOCK_PRO_EN = `ROLE & RESEARCH (REQUIRED): Pick the ONE role most relevant to this decision — Accountant, HR, Legal, Marketing/Sales, or Operations — and analyze focused from that single angle only (not every angle at once). You have 1x web search for the single most critical fact if this decision needs current/specific data (permits, taxes, etc.) — use it for what matters most. "risk"/"recommendation" must NOT just say "consult a professional" — give a concrete step.`;

function roleResearchBlockFor(tier: "pro" | "platinum", lang: "id" | "en"): string {
  if (lang === "en") return tier === "platinum" ? ROLE_RESEARCH_BLOCK_PLATINUM_EN : ROLE_RESEARCH_BLOCK_PRO_EN;
  return tier === "platinum" ? ROLE_RESEARCH_BLOCK_PLATINUM_ID : ROLE_RESEARCH_BLOCK_PRO_ID;
}

function systemPromptId(tier: "pro" | "platinum"): string {
  return `Kamu adalah Beemo, mentor bisnis THE HIVE, dalam mode Decision Support. Pemilik usaha sedang mempertimbangkan sebuah keputusan besar (mis. buka cabang, ganti supplier, naikkan harga, urus izin usaha). Tugasmu BUKAN menjawab "terserah" atau memberi opini kosong — susun analisa terstruktur berdasarkan konteks bisnis yang diberikan.

${roleResearchBlockFor(tier, "id")}

ATURAN KETAT (data honesty):
- Untuk data PRIBADI bisnis pelanggan (angka keuangan, omset, pelanggan): jangan mengarang apa pun yang tidak ada di konteks bisnis di bawah — kalau belum ada datanya, tulis jujur bahwa datanya belum cukup, jangan menebak.
- Untuk fakta UMUM yang bisa diverifikasi (regulasi, pajak, prosedur pemerintah): ikuti aturan RISET di atas — cari dan pakai hasilnya, bukan tebakan.
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
}

function systemPromptEn(tier: "pro" | "platinum"): string {
  return `You are Beemo, THE HIVE's business mentor, in Decision Support mode. The business owner is weighing a big decision (e.g. opening a branch, switching suppliers, raising prices, handling a business permit). Your job is NOT to say "up to you" or give an empty opinion — build a structured analysis grounded in the business context provided.

${roleResearchBlockFor(tier, "en")}

STRICT RULES (data honesty):
- For the customer's PRIVATE business data (financial figures, revenue, customers): do not invent anything not in the business context below — if the data isn't there, honestly say it isn't sufficient yet, don't guess.
- For general, verifiable facts (regulations, taxes, government procedures): follow the RESEARCH rule above — search and use the result, not a guess.
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
}

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
  // Audit Juli 2026: Decision Journal dipersempit dari PRO+PLATINUM jadi
  // eksklusif PLATINUM — analisa multi-peran + riset mendalam ini yang
  // paling membedakan Platinum, konsisten dengan gating baru di frontend
  // (Workspace.tsx DecisionJournalList).
  if (membership.tier !== "platinum") {
    return {
      status: 403,
      body: {
        error:
          lang === "en"
            ? "Decision Journal is available exclusively for PLATINUM customers."
            : "Decision Journal tersedia eksklusif untuk pelanggan PLATINUM.",
      },
    };
  }
  const tier = membership.tier;

  // Tier Usage Quota: kuota jumlah keputusan per periode akses (lihat
  // DECISION_QUOTA) — dicek sebelum memanggil Claude, sama alasannya dengan
  // services/beemo/chat.ts (jangan habiskan biaya API untuk request yang
  // toh akan ditolak).
  const quotaLimit = DECISION_QUOTA[tier];
  if (membership.decisionCount >= quotaLimit) {
    return {
      status: 403,
      body: {
        // Audit Juli 2026: sebelumnya ada teks "upgrade ke PLATINUM" di sini
        // untuk tier "pro" — sekarang jadi mustahil (fungsi ini sudah
        // menolak tier selain "platinum" di atas), jadi dihapus alih-alih
        // dibiarkan jadi kode mati yang tidak pernah tercapai.
        error:
          lang === "en"
            ? `You've used all ${quotaLimit} Decision Journal entries for this access period. Your quota will refill once your access period renews.`
            : `Kuota ${quotaLimit} keputusan Decision Journal untuk periode akses ini sudah habis. Kuota akan terisi ulang begitu periode aksesmu diperpanjang.`,
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
  const basePrompt = lang === "en" ? systemPromptEn(tier) : systemPromptId(tier);
  const systemPrompt = `${basePrompt}\n\n${contextBlock}`;

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
      // max_uses dibedakan per tier (PRO 1x, PLATINUM 4x) — lihat
      // DECISION_SEARCH_MAX_USES.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK
      // terpasang lebih tua dari tipe web search tool, lihat catatan sama
      // di services/beemo/chat.ts.
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: DECISION_SEARCH_MAX_USES[tier] }] as any,
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

    const { decision, newCount } = await saveDecisionRecord({
      businessProfileId,
      question: question.trim(),
      goal: result.goal || "",
      risk: result.risk || "",
      opportunity: result.opportunity || "",
      supportingData: result.supportingData || [],
      recommendation: result.recommendation || "",
      conclusion: result.conclusion || "",
      subscriptionId: membership.subscriptionId,
      currentDecisionCount: membership.decisionCount,
    });

    return {
      status: 200,
      body: { decision, tier, decisionCount: newCount, quotaLimit },
    };
  } catch (error) {
    console.error("services/decision/proposeDecision error:", error);
    return {
      status: 500,
      body: { error: lang === "en" ? "Beemo failed to analyze this decision. Please try again." : "Beemo gagal menganalisa keputusan ini. Coba lagi." },
    };
  }
}
