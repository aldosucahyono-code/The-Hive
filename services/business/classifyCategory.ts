// services/business/classifyCategory.ts
//
// The Hive Platinum Workspace — Fase 1 (diskusi desain Claude+GPT 18-19 Jul
// 2026): "mengenali kategori bisnis pengguna secara otomatis". Riset
// sebelum ini menemukan business_profiles TIDAK punya taksonomi industri —
// kolom `industry` cuma teks bebas dari Chat Wizard ("Coffee Shop,
// Kontraktor, Retail..."), tidak divalidasi.
//
// Pendekatan yang dipilih (dari 3 opsi yang didiskusikan — dropdown manual,
// keyword-matching, AI classification): AI membaca konteks bisnis yang
// SUDAH ADA (lewat Business Memory, sumber kebenaran yang sama dipakai
// Chat/Decision/Action Plan Engine — BUKAN query baru) dan mengklasifikasi
// ke taksonomi tetap. TIDAK menambah pertanyaan baru di wizard onboarding.
// Klasifikasi hanya jalan SEKALI (saat business_category masih null) —
// hasilnya disimpan permanen di business_profiles.business_category,
// dengan jalur koreksi manual (setBusinessCategory di bawah) kalau AI
// meleset. Karena hanya jalan sekali per bisnis, TIDAK perlu rate limit
// terpisah (self-limiting oleh kondisi "masih null").

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import type { ServiceResult } from "./create.js";
import { BUSINESS_CATEGORY_KEYS, isValidBusinessCategory, type BusinessCategoryKey } from "./businessCategories.js";
import { getBusinessMemory } from "../memory/getBusinessMemory.js";
import { logClaudeUsage, extractUsage } from "../costTracking/logUsage.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkOwnership(businessProfileId: string, userId: string): Promise<{ id: string; business_category: string | null } | null> {
  const { data, error } = await supabase
    .from("business_profiles")
    .select("id, user_id, business_category")
    .eq("id", businessProfileId)
    .single();
  if (error || !data || data.user_id !== userId) return null;
  return { id: data.id, business_category: data.business_category };
}

function classifyPrompt(businessName: string, industry: string | null, goals: string | null, challenges: string | null): string {
  return `Kamu mengklasifikasi bisnis ke SATU kategori dari daftar tetap berikut, berdasarkan konteks yang diberikan.

Daftar kategori (pakai persis salah satu key ini): ${BUSINESS_CATEGORY_KEYS.join(", ")}

Konteks bisnis:
- Nama: ${businessName}
- Bidang usaha (isian bebas dari pemilik): ${industry || "(tidak diisi)"}
- Target/harapan: ${goals || "(tidak diisi)"}
- Tantangan: ${challenges || "(tidak diisi)"}

Kalau konteks benar-benar tidak cukup untuk menentukan kategori spesifik, pilih "lainnya" — JANGAN menebak asal.

Balas HANYA JSON valid, tanpa markdown, format persis:
{"category": "salah_satu_key_di_atas"}`;
}

/** Get-or-classify: kalau business_category sudah ada, kembalikan langsung
 * (tidak panggil AI lagi). Kalau masih null, klasifikasi sekali lalu
 * simpan. */
export async function getBusinessCategory(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }

  const business = await checkOwnership(businessProfileId, userId);
  if (!business) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  if (isValidBusinessCategory(business.business_category)) {
    return { status: 200, body: { category: business.business_category, source: "cached" } };
  }

  const memory = await getBusinessMemory(businessProfileId);
  if (!memory) {
    return { status: 500, body: { error: "Gagal memuat konteks bisnis." } };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { status: 500, body: { error: "ANTHROPIC_API_KEY belum diset di Vercel." } };
  }

  let category: BusinessCategoryKey = "lainnya";
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: classifyPrompt(memory.profile.businessName, memory.profile.industry, memory.goals, memory.mainChallenges),
        },
      ],
    });

    const usage = extractUsage(response);
    void logClaudeUsage({ businessProfileId, action: "classify_category", model: "claude-sonnet-5", inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, webSearches: usage.webSearches });

    const rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("");
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (isValidBusinessCategory(parsed?.category)) category = parsed.category;
    }
  } catch (err) {
    console.error("classifyCategory: gagal memanggil Claude:", err);
    // Kalau klasifikasi gagal, JANGAN gagalkan seluruh Workspace Home --
    // simpan "lainnya" sebagai fallback jujur (bukan diam-diam null lagi,
    // supaya tidak retry panggilan AI berulang tiap kali Home dibuka).
  }

  const { error: updateError } = await supabase
    .from("business_profiles")
    .update({ business_category: category })
    .eq("id", businessProfileId);

  if (updateError) {
    console.error("classifyCategory: gagal menyimpan business_category:", updateError);
    return { status: 200, body: { category, source: "unsaved" } };
  }

  return { status: 200, body: { category, source: "classified" } };
}

/** Override manual — dipakai tombol "Ubah kategori" di UI kalau hasil AI
 * meleset. Tidak memanggil AI sama sekali, murni tulis nilai yang dipilih
 * user dari daftar tetap. */
export async function setBusinessCategory(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  const category = payload.category;

  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }
  if (!isValidBusinessCategory(category)) {
    return { status: 400, body: { error: "category tidak valid" } };
  }

  const business = await checkOwnership(businessProfileId, userId);
  if (!business) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  const { error } = await supabase.from("business_profiles").update({ business_category: category }).eq("id", businessProfileId);
  if (error) {
    console.error("setBusinessCategory error:", error);
    return { status: 500, body: { error: "Gagal menyimpan kategori." } };
  }

  return { status: 200, body: { category } };
}
