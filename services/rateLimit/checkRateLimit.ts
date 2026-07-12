// services/rateLimit/checkRateLimit.ts
//
// Audit red-team Juli 2026: SATU-SATUNYA tempat pembatasan laju (rate limit)
// untuk endpoint anonim di api/ (check-email, generate-preview,
// generate-wizard-questions) — sebelumnya tidak ada sama sekali, jadi
// endpoint yang memanggil Claude bisa dipanggil tanpa batas (biaya
// membengkak) dan check-email bisa dipakai untuk enumerasi email.
//
// Disimpan di Supabase (migrations/2026-07-13b_rate_limits.sql), BUKAN
// in-memory — Vercel Serverless Function tidak menjamin instance yang sama
// dipakai request berikutnya, jadi in-memory counter tidak akan pernah
// benar-benar membatasi apa pun di produksi.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type RateLimitResult = { allowed: boolean; count: number; limit: number };

/** bucketKey harus sudah termasuk nama endpoint (mis. "generate-preview")
 * supaya limit tiap endpoint independen satu sama lain. windowSeconds
 * dikirim ke function DB — DIA yang menghitung window, bukan di sini,
 * supaya tidak ada dua definisi "window" yang bisa berbeda-beda. */
export async function checkRateLimit(bucketKey: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("rate_limit_hit", {
    p_bucket_key: bucketKey,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error("services/rateLimit/checkRateLimit error:", error);
    // Fail OPEN, bukan fail closed: kalau infrastruktur rate limit sendiri
    // bermasalah (migration belum jalan, RPC timeout, dst), jangan sampai
    // itu memblokir SEMUA pengguna sah dari fitur inti (wizard/preview).
    // Trade-off sadar: risiko abuse sesaat dianggap lebih baik daripada
    // downtime total pada fitur yang justru jadi pintu masuk pelanggan baru.
    return { allowed: true, count: 0, limit };
  }

  const count = typeof data === "number" ? data : 0;
  return { allowed: count <= limit, count, limit };
}

/** Ambil IP pemanggil dari header yang di-set Vercel (x-forwarded-for).
 * Terima bentuk generik (bukan import VercelRequest di sini) supaya file
 * ini tidak terikat ke satu jenis request object. */
export function getClientIp(req: { headers: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const first = raw?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "unknown";
}

export const RATE_LIMIT_MESSAGE_ID = "Terlalu banyak permintaan dari perangkat ini. Coba lagi beberapa saat lagi.";
export const RATE_LIMIT_MESSAGE_EN = "Too many requests from this device. Please try again shortly.";
