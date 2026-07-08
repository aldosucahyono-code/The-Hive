// services/membership/getActiveMembership.ts
//
// SATU-SATUNYA tempat yang boleh memutuskan "apakah business_profile ini
// sedang benar-benar punya membership aktif, dan tier apa". Baik Workspace
// (lewat action "getMembership" di api/workspace.ts) maupun Chat Beemo
// (services/beemo/chat.ts) WAJIB lewat fungsi ini — jangan query tabel
// `subscriptions` langsung dari tempat lain, supaya definisi "aktif" tidak
// pernah didefinisikan dua kali secara berbeda (itu yang bikin subscription
// yang sudah lewat expires_at tetap dianggap aktif selamanya sebelum ini).
//
// Ke depan, fungsi (atau modul) ini juga jadi titik masuk untuk kebutuhan
// Membership lain: Billing, Renewal, History pembayaran, Upgrade, Downgrade.
// Jangan taruh logika "apakah user berhak akses X" di tempat lain — selalu
// turunkan dari hasil getActiveMembership().

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type MembershipTier = "free" | "pro" | "platinum";

// status "active"  -> sedang berbayar dan expires_at masih di masa depan
// status "expired" -> PERNAH berbayar tapi expires_at sudah lewat (tier sudah
//                     jatuh kembali ke "free" secara fungsional, tapi UI perlu
//                     tahu ini beda dari user yang memang belum pernah upgrade)
// status "free"    -> tidak pernah punya baris subscription berbayar aktif
export type MembershipStatus = "active" | "expired" | "free";

export type Membership = {
  tier: MembershipTier;
  status: MembershipStatus;
  expiresAt: string | null;
};

export async function getActiveMembership(businessProfileId: string): Promise<Membership> {
  const { data: row, error } = await supabase
    .from("subscriptions")
    .select("tier, expires_at")
    .eq("business_profile_id", businessProfileId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getActiveMembership error:", error);
    return { tier: "free", status: "free", expiresAt: null };
  }

  if (!row) {
    return { tier: "free", status: "free", expiresAt: null };
  }

  // Baris "free" bawaan (dibuat otomatis saat business_profile dibuat) tidak
  // punya expires_at — selalu dianggap aktif, tidak pernah "kadaluarsa".
  if (row.tier === "free" || !row.expires_at) {
    return { tier: (row.tier as MembershipTier) || "free", status: "free", expiresAt: null };
  }

  const isExpired = new Date(row.expires_at).getTime() <= Date.now();
  if (isExpired) {
    return { tier: "free", status: "expired", expiresAt: row.expires_at };
  }

  return { tier: row.tier as MembershipTier, status: "active", expiresAt: row.expires_at };
}
