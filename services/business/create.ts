// services/business/create.ts
//
// Business logic murni untuk action "create" di router /api/business.
// Tidak menangani auth/HTTP — itu tugas router. Fungsi ini menerima userId
// yang SUDAH diverifikasi oleh router, dan payload mentah dari body request.

import { createClient } from "@supabase/supabase-js";
import { checkBusinessCap } from "./checkBusinessCap.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const VALID_STAGES = ["idea", "starting", "running", "scaling"];
const VALID_BUSINESS_TYPES = ["start", "grow"];

export type ServiceResult = { status: number; body: Record<string, unknown> };

export async function createBusiness(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessName = payload.businessName;
  const industry = payload.industry;
  const businessStage = payload.businessStage;
  const businessType = payload.businessType;

  if (!businessName || typeof businessName !== "string" || !businessName.trim()) {
    return { status: 400, body: { error: "Nama bisnis wajib diisi" } };
  }

  // Batas jumlah usaha per akun (lihat services/business/checkBusinessCap.ts)
  // — pengecekan terakhir di sisi server, jaga-jaga kalau UI (AddBusinessModal)
  // entah bagaimana lolos tanpa cek cap lebih dulu.
  const capResult = await checkBusinessCap(userId);
  if (!capResult.allowed) {
    return {
      status: 403,
      body: {
        error: "Batas jumlah usaha untuk paket kamu saat ini sudah tercapai.",
        capExceeded: true,
        ...capResult,
      },
    };
  }

  const stage = VALID_STAGES.includes(businessStage as string) ? businessStage : "idea";
  // business_type (Business Context — Business Discovery & Dual Workspace
  // directive): "SATU FIELD, SATU STATUS" yang menentukan versi mentor mana
  // yang ditampilkan di seluruh platform. Kalau caller belum kirim eksplisit
  // (jalur lama), turunkan dari stage seperti sebelumnya supaya tidak ada
  // regresi — tapi caller baru (AddBusinessModal, promote-draft) sebaiknya
  // selalu mengirim eksplisit.
  const resolvedType = VALID_BUSINESS_TYPES.includes(businessType as string)
    ? businessType
    : stage === "idea" || stage === "starting"
      ? "start"
      : "grow";

  const { data: businessProfile, error } = await supabase
    .from("business_profiles")
    .insert({
      user_id: userId,
      business_name: businessName.trim(),
      industry: typeof industry === "string" && industry.trim() ? industry.trim() : null,
      business_stage: stage,
      business_type: resolvedType,
    })
    .select("id")
    .single();

  if (error || !businessProfile) {
    console.error("services/business/create error:", error);
    return { status: 500, body: { error: "Gagal membuat business profile" } };
  }

  // Langsung jadikan bisnis ini konteks aktif.
  const { error: prefError } = await supabase
    .from("user_preferences")
    .update({ active_business_profile_id: businessProfile.id })
    .eq("user_id", userId);

  if (prefError) {
    console.error("services/business/create active context error:", prefError);
    // Tidak fatal — business profile tetap berhasil dibuat.
  }

  return { status: 200, body: { businessProfileId: businessProfile.id } };
}
