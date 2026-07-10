// services/business/checkBusinessCap.ts
//
// Batas jumlah usaha per akun (directive PO): "kalau aldo berlangganan 1
// platinum, maka dia bisa menambahkan 4 jenis usaha lainnya (bisa gratis/pro)
// total di workspace aldo ada 5 usaha. jika aldo berlangganan 1 pro, total 3.
// jika aldo hanya user gratis, total 2." — batas ditentukan oleh TIER
// TERTINGGI yang dimiliki di ANTARA semua usaha aktif user ini (bukan per
// usaha), supaya 1 usaha Platinum "membuka" slot lebih banyak untuk usaha
// lain di akun yang sama.
//
// SATU-SATUNYA tempat yang menghitung cap ini — dipakai oleh
// services/business/create.ts (submit form) dan api/promote-draft.ts (auto-
// promote draft wizard setelah login), plus action "getCap" di api/business.ts
// (dipanggil frontend SEBELUM menampilkan form, supaya user tersaring lebih
// awal daripada mengisi form penuh dulu baru ditolak di akhir).

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type BusinessCapTier = "free" | "pro" | "platinum";

export type BusinessCapResult = {
  count: number;
  cap: number;
  highestTier: BusinessCapTier;
  allowed: boolean;
};

const CAP_BY_TIER: Record<BusinessCapTier, number> = {
  free: 2,
  pro: 3,
  platinum: 5,
};

const TIER_RANK: Record<BusinessCapTier, number> = {
  free: 0,
  pro: 1,
  platinum: 2,
};

export async function checkBusinessCap(userId: string): Promise<BusinessCapResult> {
  const { data: profiles, error: profileError } = await supabase
    .from("business_profiles")
    .select("id")
    .eq("user_id", userId)
    .eq("active", true);

  if (profileError) {
    console.error("checkBusinessCap: gagal ambil business_profiles:", profileError);
    // Fail-open dengan cap paling longgar tidak aman (bisa dieksploitasi),
    // tapi fail-closed total juga bisa mengunci user gara-gara bug jaringan
    // sesaat. Kompromi: anggap cap "free" (paling ketat) supaya tidak pernah
    // membiarkan lebih banyak dari yang seharusnya kalau data tidak terbaca.
    return { count: 0, cap: CAP_BY_TIER.free, highestTier: "free", allowed: true };
  }

  const businessIds = (profiles || []).map((p) => p.id as string);
  const count = businessIds.length;

  let highestTier: BusinessCapTier = "free";

  if (businessIds.length > 0) {
    const { data: subs, error: subError } = await supabase
      .from("subscriptions")
      .select("tier, status, expires_at, business_profile_id")
      .in("business_profile_id", businessIds)
      .eq("status", "active");

    if (subError) {
      console.error("checkBusinessCap: gagal ambil subscriptions:", subError);
    } else {
      const now = Date.now();
      for (const row of subs || []) {
        const tier = row.tier as BusinessCapTier;
        if (tier !== "pro" && tier !== "platinum") continue;
        const isStillActive = !row.expires_at || new Date(row.expires_at as string).getTime() > now;
        if (!isStillActive) continue;
        if (TIER_RANK[tier] > TIER_RANK[highestTier]) highestTier = tier;
      }
    }
  }

  const cap = CAP_BY_TIER[highestTier];
  return { count, cap, highestTier, allowed: count < cap };
}
