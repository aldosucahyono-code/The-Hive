// services/business/goalPackages/generateGooglePresencePackage.ts
//
// The Hive Platinum Workspace — Fase 1, "lapisan eksekusi" (diskusi desain
// Claude+GPT 18-19 Jul 2026). Insight utama dari diskusi itu: strukturkan
// per TUJUAN bisnis ("Perkuat kehadiran bisnis di Google"), bukan per jenis
// output — satu goal_key membuka satu "paket kerja" berisi beberapa materi
// sekaligus. Ini goal_key PERTAMA (dari mungkin banyak nanti), dibangun
// modular sesuai saran GPT: "bangun kategori dulu sebagai fondasi, baru
// tambah kapabilitas satu per satu" — bukan langsung semua kombinasi
// kategori x tujuan sekaligus.
//
// Dibatasi ke kategori 'kuliner' dulu (lihat GOAL_ALLOWED_CATEGORIES) --
// contoh konkret dari brief user (deskripsi Google Business, foto menu/
// interior/dapur, profil GoFood/GrabFood) memang paling pas untuk usaha
// makanan/minuman fisik. Kategori lain menyusul saat goal_key/paket lain
// dibangun -- lihat catatan "Hal yang perlu diwaspadai" dari GPT: JANGAN
// generate materi yang tidak masuk akal untuk kategori tertentu.
//
// Hasil DISIMPAN (business_goal_packages, unique per business+goal) --
// dibuka lagi = baca cache, BUKAN generate ulang (biaya AI nyata, pola sama
// dengan generateActionPlan.ts).
//
// Data honesty: prompt melarang Claude mengarang detail spesifik (alamat,
// nomor telepon, harga) yang tidak ada di konteks -- kalau data belum ada,
// itu masuk sebagai item checklist ("isi nomor WhatsApp bisnismu"), bukan
// dikarang.

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import type { ServiceResult } from "../create.js";
import { checkRateLimit } from "../../rateLimit/checkRateLimit.js";
import { logClaudeUsage, extractUsage } from "../../costTracking/logUsage.js";
import { getBusinessMemory } from "../../memory/getBusinessMemory.js";
import { buildContextBlock } from "../../beemo/chat.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const GOAL_KEY = "google_presence" as const;
// Kategori yang boleh menampilkan/generate paket kerja ini di Fase 1 --
// lihat catatan header file. Tambah kategori lain di sini kalau kontennya
// sudah divalidasi masuk akal untuk kategori itu juga.
export const GOAL_ALLOWED_CATEGORIES = ["kuliner"] as const;

const RATE_LIMIT_PER_DAY = 5;
const DESCRIPTION_MAX_CHARS = 750;
const PHOTO_COUNT = 10;

type PackageContent = {
  description: string;
  photos: Array<{ title: string; angle: string }>;
  checklist: string[];
};

function isValidContent(v: unknown): v is PackageContent {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.description === "string" &&
    Array.isArray(c.photos) &&
    c.photos.every((p) => p && typeof (p as Record<string, unknown>).title === "string" && typeof (p as Record<string, unknown>).angle === "string") &&
    Array.isArray(c.checklist) &&
    c.checklist.every((x) => typeof x === "string")
  );
}

function systemPrompt(lang: "id" | "en"): string {
  if (lang === "en") {
    return `You are Beemo, THE HIVE's business mentor. Build a "Google presence starter package" for this food & beverage business, based on the business context given below.

Produce exactly these three things:
1. "description": a Google Business Profile description, MAXIMUM ${DESCRIPTION_MAX_CHARS} characters, written in a warm and inviting tone, mentioning the business name, what it sells, and what makes it worth visiting -- grounded ONLY in the context given, never invent specific facts (address, phone number, exact prices, awards) that aren't in the context.
2. "photos": exactly ${PHOTO_COUNT} recommended photos to take, each with a short "title" (what to shoot) and "angle" (how to shoot it, e.g. "eye-level, natural light, food filling 2/3 of frame").
3. "checklist": a short list of specific data/info the owner still needs to provide for this package to be complete (e.g. exact address, opening hours, WhatsApp number) -- only include items genuinely missing from the context, don't pad the list.

Reply with ONLY valid JSON, no markdown, no other text, in exactly this format:
{"description": string, "photos": [{"title": string, "angle": string}], "checklist": [string]}`;
  }
  return `Kamu adalah Beemo, mentor bisnis THE HIVE. Susun "paket kerja kehadiran Google" untuk bisnis kuliner ini, berdasarkan konteks bisnis di bawah.

Hasilkan PERSIS tiga hal ini:
1. "description": deskripsi Google Business Profile, MAKSIMAL ${DESCRIPTION_MAX_CHARS} karakter, dengan nada hangat dan mengundang, menyebut nama bisnis, apa yang dijual, dan kenapa layak dikunjungi -- HANYA berdasarkan konteks yang diberikan, JANGAN mengarang fakta spesifik (alamat, nomor telepon, harga persis, penghargaan) yang tidak ada di konteks.
2. "photos": PERSIS ${PHOTO_COUNT} rekomendasi foto yang perlu diambil, masing-masing punya "title" singkat (apa yang difoto) dan "angle" (cara mengambilnya, mis. "sejajar mata, cahaya alami, makanan mengisi 2/3 frame").
3. "checklist": daftar singkat data/info spesifik yang masih perlu diisi pemilik usaha supaya paket ini lengkap (mis. alamat lengkap, jam operasional, nomor WhatsApp) -- hanya masukkan yang benar-benar belum ada di konteks, jangan dipanjang-panjangkan kalau tidak perlu.

Balas HANYA JSON valid, tanpa markdown, tanpa teks lain, format persis:
{"description": string, "photos": [{"title": string, "angle": string}], "checklist": [string]}`;
}

async function fetchOwnedProfile(businessProfileId: string, userId: string): Promise<{ business_category: string | null } | null> {
  const { data, error } = await supabase.from("business_profiles").select("id, user_id, business_category").eq("id", businessProfileId).single();
  if (error || !data || data.user_id !== userId) return null;
  return { business_category: data.business_category };
}

export async function getGooglePresencePackage(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  const lang: "id" | "en" = payload.lang === "en" ? "en" : "id";

  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }
  const ownedProfile = await fetchOwnedProfile(businessProfileId, userId);
  if (!ownedProfile) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  const { data: existing } = await supabase
    .from("business_goal_packages")
    .select("content, generated_at")
    .eq("business_profile_id", businessProfileId)
    .eq("goal_key", GOAL_KEY)
    .maybeSingle();

  if (existing && isValidContent(existing.content)) {
    return { status: 200, body: { ...existing.content, generatedAt: existing.generated_at, source: "cached" } };
  }

  const rl = await checkRateLimit(`goal-package:${businessProfileId}:${GOAL_KEY}`, RATE_LIMIT_PER_DAY, 86400);
  if (!rl.allowed) {
    return {
      status: 429,
      body: { error: lang === "en" ? "You've reached today's limit for generating this package. Try again tomorrow." : "Sudah mencapai batas pembuatan paket ini hari ini. Coba lagi besok." },
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
  const system = `${systemPrompt(lang)}\n\n${contextBlock}`;

  let content: PackageContent | null = null;
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2000,
      system,
      messages: [
        {
          role: "user",
          content: lang === "en" ? "Build the package now, following the JSON schema already described." : "Susun paketnya sekarang, sesuai skema JSON yang sudah dijelaskan.",
        },
      ],
    });

    const usage = extractUsage(response);
    void logClaudeUsage({ businessProfileId, action: "goal_package_google_presence", model: "claude-sonnet-5", inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, webSearches: usage.webSearches });

    const rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("");
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (isValidContent(parsed)) {
        content = {
          description: parsed.description.trim().slice(0, DESCRIPTION_MAX_CHARS),
          photos: parsed.photos.slice(0, PHOTO_COUNT).map((p) => ({ title: String(p.title).trim(), angle: String(p.angle).trim() })),
          checklist: parsed.checklist.slice(0, 10).map((c) => String(c).trim()),
        };
      }
    }
  } catch (err) {
    console.error("generateGooglePresencePackage: gagal memanggil Claude:", err);
  }

  if (!content) {
    return { status: 500, body: { error: lang === "en" ? "Beemo failed to build this package. Please try again." : "Beemo gagal menyusun paket ini. Coba lagi." } };
  }

  const generatedAt = new Date().toISOString();
  const { error: upsertError } = await supabase
    .from("business_goal_packages")
    .upsert(
      { business_profile_id: businessProfileId, goal_key: GOAL_KEY, category: ownedProfile.business_category || "lainnya", content, generated_at: generatedAt },
      { onConflict: "business_profile_id,goal_key" }
    );

  if (upsertError) {
    console.error("generateGooglePresencePackage: gagal menyimpan:", upsertError);
    // Tetap kembalikan hasilnya ke pengguna walau gagal disimpan -- jangan
    // buang hasil AI yang sudah didapat hanya karena insert gagal.
    return { status: 200, body: { ...content, generatedAt, source: "unsaved" } };
  }

  return { status: 200, body: { ...content, generatedAt, source: "generated" } };
}
