// services/admin/setSubscriptionTier.ts
//
// Business logic untuk action "adminSetSubscriptionTier" -- audit
// pra-soft-launch (19 Jul 2026), jawaban user "Semuanya" untuk field yang
// bisa diedit admin termasuk "Tier langganan... untuk kasus support/
// komplain" (override manual tanpa lewat pembayaran Midtrans).
//
// Meniru PERSIS pola yang sudah dipakai api/notification-handler.ts saat
// pembayaran settlement (satu-satunya tempat lain yang menulis ke
// `subscriptions`) supaya tidak ada dua definisi berbeda soal "bagaimana
// cara mengaktifkan tier": expire dulu baris 'active' yang ada (constraint
// DB: hanya boleh SATU baris 'active' per business_profile_id), baru insert
// baris baru kalau tier bukan 'free'. Turun ke 'free' cukup expire tanpa
// insert baris baru -- getActiveMembership.ts sudah fallback ke 'free' kalau
// tidak ada baris 'active'.
//
// SENGAJA dibatasi super_admin saja + dicatat lengkap di audit log (siapa,
// dari tier apa ke tier apa, kapan) -- ini bisa dipakai untuk "memberi"
// langganan gratis, jadi harus paling gampang dilacak dari semua aksi admin.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { requireAdminSession } from "./auth/requireAdminSession.js";
import { logAdminAction } from "./auditLog.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const VALID_TIERS = ["free", "pro", "platinum"];
// Sama dengan ACCESS_DURATION_DAYS di api/notification-handler.ts (30 hari
// untuk kedua tier berbayar, konsisten dengan billing bulanan).
const DURATION_DAYS = 30;

export async function adminSetSubscriptionTier(
  adminToken: string | undefined,
  payload: Record<string, unknown>,
  ip: string,
  userAgent: string
): Promise<ServiceResult> {
  const session = await requireAdminSession(adminToken);
  if (!session) {
    return { status: 403, body: { error: "Sesi admin tidak valid atau sudah kedaluwarsa. Silakan login ulang." } };
  }
  if (session.role !== "super_admin") {
    return { status: 403, body: { error: "Hanya super admin yang boleh mengubah tier langganan." } };
  }

  const businessProfileId = payload.businessProfileId;
  const tier = payload.tier;
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }
  if (typeof tier !== "string" || !VALID_TIERS.includes(tier)) {
    return { status: 400, body: { error: "tier harus salah satu dari: free, pro, platinum" } };
  }

  const { data: business, error: findError } = await supabase
    .from("business_profiles")
    .select("id, business_name")
    .eq("id", businessProfileId)
    .maybeSingle();
  if (findError || !business) {
    return { status: 404, body: { error: "Bisnis tidak ditemukan." } };
  }

  const { data: currentActive } = await supabase
    .from("subscriptions")
    .select("tier")
    .eq("business_profile_id", businessProfileId)
    .eq("status", "active")
    .maybeSingle();
  const fromTier = currentActive?.tier || "free";

  const { error: expireError } = await supabase
    .from("subscriptions")
    .update({ status: "expired" })
    .eq("business_profile_id", businessProfileId)
    .eq("status", "active");
  if (expireError) {
    console.error("adminSetSubscriptionTier: gagal expire subscription lama:", expireError);
    return { status: 500, body: { error: "Gagal mengubah tier langganan." } };
  }

  if (tier !== "free") {
    const expiresAt = new Date(Date.now() + DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase.from("subscriptions").insert({
      business_profile_id: businessProfileId,
      tier,
      status: "active",
      expires_at: expiresAt,
    });
    if (insertError) {
      console.error("adminSetSubscriptionTier: gagal insert subscription baru:", insertError);
      return { status: 500, body: { error: "Gagal mengubah tier langganan." } };
    }
  }

  await logAdminAction({
    actorEmail: session.email,
    actorRole: session.role,
    action: "adminSetSubscriptionTier",
    target: business.business_name as string,
    detail: { businessProfileId, fromTier, toTier: tier },
    ip,
    userAgent,
  });

  return { status: 200, body: { ok: true, tier } };
}
