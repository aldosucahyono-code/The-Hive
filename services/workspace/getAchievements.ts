// services/workspace/getAchievements.ts
//
// Membaca status Achievement untuk sebuah business_profile. Memanggil
// evaluateAchievements() SEKALI dulu (trigger point #2 di
// ACHIEVEMENT-ENGINE-PROPOSAL.md §3) supaya achievement berbasis waktu murni
// (member_since_days) tertangkap begitu Growth tab dibuka, lalu membaca
// daftar achievement yang sudah terbuka (termasuk yang baru saja terbuka
// dari pemanggilan evaluate barusan).

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { evaluateAchievements } from "../business/evaluateAchievements.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type AchievementDefinitionJoin = {
  code: string;
  category: string;
  difficulty: string;
  title_id: string;
  title_en: string;
  short_description_id: string;
  short_description_en: string;
};

type UnlockedRow = {
  unlocked_at: string;
  achievement_definitions: AchievementDefinitionJoin | AchievementDefinitionJoin[] | null;
};

export async function getAchievements(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }

  const { data: business, error: bpError } = await supabase
    .from("business_profiles")
    .select("id, user_id")
    .eq("id", businessProfileId)
    .single();

  if (bpError || !business || business.user_id !== userId) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  let nextMilestone = null;
  try {
    const result = await evaluateAchievements(businessProfileId, "getAchievements");
    nextMilestone = result.nextMilestone;
  } catch (err) {
    console.error("getAchievements: evaluateAchievements error:", err);
  }

  const { data: unlockedRows, error } = await supabase
    .from("business_achievements")
    .select(
      "unlocked_at, achievement_definitions(code, category, difficulty, title_id, title_en, short_description_id, short_description_en)"
    )
    .eq("business_profile_id", businessProfileId)
    .order("unlocked_at", { ascending: false });

  if (error) {
    console.error("services/workspace/getAchievements error:", error);
    return { status: 500, body: { error: "Gagal memuat achievement" } };
  }

  const unlocked = ((unlockedRows as UnlockedRow[] | null) || [])
    .map((row) => {
      const def = Array.isArray(row.achievement_definitions) ? row.achievement_definitions[0] : row.achievement_definitions;
      if (!def) return null;
      return {
        code: def.code,
        category: def.category,
        difficulty: def.difficulty,
        titleId: def.title_id,
        titleEn: def.title_en,
        descriptionId: def.short_description_id,
        descriptionEn: def.short_description_en,
        unlockedAt: row.unlocked_at,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return { status: 200, body: { unlocked, nextMilestone } };
}
