// services/socialMedia/cache.ts
//
// TTL cache di atas tabel social_media_snapshots (lihat migrations/
// 2026-07-12c_social_media_snapshots.sql). Pola identik dengan
// services/competitor/cache/competitorCache.ts — memanggil Apify setiap
// kali tab Kompetitor dibuka itu boros (berbayar per hasil) dan tidak
// perlu, karena akun medsos + follower count kompetitor tidak berubah
// dalam hitungan jam/hari.

import { createClient } from "@supabase/supabase-js";
import type { SocialMediaSnapshot } from "./types.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const TTL_HOURS = 24 * 7; // seminggu — follower count kompetitor tidak berubah drastis harian

export async function getCachedSocialSnapshot(businessProfileId: string): Promise<SocialMediaSnapshot | null> {
  const { data, error } = await supabase
    .from("social_media_snapshots")
    .select("result, expires_at")
    .eq("business_profile_id", businessProfileId)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null; // kadaluarsa — caller akan menjalankan ulang pipeline

  return data.result as SocialMediaSnapshot;
}

export async function saveSocialSnapshot(
  businessProfileId: string,
  provider: "apify" | "mock",
  result: SocialMediaSnapshot
): Promise<void> {
  const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("social_media_snapshots").insert({
    business_profile_id: businessProfileId,
    provider,
    result,
    expires_at: expiresAt,
  });

  if (error) {
    // Cache gagal ditulis bukan alasan menggagalkan seluruh request —
    // pengguna tetap dapat hasil, hanya saja permintaan berikutnya akan
    // menjalankan ulang pipeline (tidak fatal, hanya kurang efisien).
    console.error("[socialMedia] gagal menyimpan snapshot cache:", error);
  }
}
