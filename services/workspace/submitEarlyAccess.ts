// services/workspace/submitEarlyAccess.ts
//
// Beta Launch (Midtrans Production belum aktif): mencatat minat pelanggan
// yang klik Upgrade Pro/Platinum saat pembayaran nyata dinonaktifkan --
// lihat migrations/2026-07-19_early_access.sql dan
// src/components/BetaEarlyAccessCard.tsx. Insert-only, tidak pernah baca
// balik dari sini (belum ada UI admin untuk itu -- lihat tabel langsung
// lewat Supabase Table Editor kalau perlu).

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const VALID_PACKAGES = new Set(["pro", "platinum"]);
const VALID_SOURCES = new Set(["wizard_preview", "workspace_upgrade"]);

async function checkOwnership(businessProfileId: string, userId: string): Promise<boolean> {
  const { data: business, error } = await supabase
    .from("business_profiles")
    .select("id, user_id")
    .eq("id", businessProfileId)
    .single();
  return !error && !!business && business.user_id === userId;
}

export async function submitEarlyAccess(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const name = payload.name;
  const email = payload.email;
  const whatsapp = payload.whatsapp;
  const pkg = payload.package;
  const source = payload.source;
  const businessProfileId = payload.businessProfileId;

  if (!name || typeof name !== "string" || !name.trim()) {
    return { status: 400, body: { error: "Nama wajib diisi" } };
  }
  if (!email || typeof email !== "string" || !email.trim()) {
    return { status: 400, body: { error: "Email wajib diisi" } };
  }
  if (typeof pkg !== "string" || !VALID_PACKAGES.has(pkg)) {
    return { status: 400, body: { error: "Paket harus 'pro' atau 'platinum'" } };
  }
  if (typeof source !== "string" || !VALID_SOURCES.has(source)) {
    return { status: 400, body: { error: "source tidak valid" } };
  }
  if (whatsapp !== undefined && whatsapp !== null && typeof whatsapp !== "string") {
    return { status: 400, body: { error: "whatsapp tidak valid" } };
  }

  // businessProfileId opsional secara skema tabel, tapi kalau dikirim,
  // pastikan benar milik akun yang sedang login -- jangan sampai baris
  // early_access bisa ditautkan ke bisnis milik orang lain.
  if (businessProfileId !== undefined && businessProfileId !== null) {
    if (typeof businessProfileId !== "string" || !(await checkOwnership(businessProfileId, userId))) {
      return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
    }
  }

  const { error } = await supabase.from("early_access").insert({
    user_id: userId,
    business_profile_id: businessProfileId || null,
    name: name.trim(),
    email: email.trim(),
    whatsapp: typeof whatsapp === "string" && whatsapp.trim() ? whatsapp.trim() : null,
    package: pkg,
    source,
  });

  if (error) {
    console.error("services/workspace/submitEarlyAccess error:", error);
    return { status: 500, body: { error: "Gagal menyimpan data. Coba lagi sebentar lagi." } };
  }

  return { status: 200, body: { submitted: true } };
}
