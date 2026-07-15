// services/supabaseUsage/getSupabaseUsage.ts
//
// Integrasi API RESMI Supabase Management API (permintaan eksplisit pemilik
// produk, dipilih lewat AskUserQuestion: "Sambungkan API resmi
// Vercel/Supabase" -- BUKAN entri manual). Dua sumber data SUNGGUHAN:
//
// 1. Ukuran database ASLI -- lewat endpoint "Run sql query"
//    (POST /v1/projects/{ref}/database/query/read-only, Management API
//    Reference: https://supabase.com/docs/reference/api/v1-run-a-query),
//    menjalankan `select pg_database_size(current_database())` -- fungsi
//    Postgres bawaan, angka byte SUNGGUHAN, bukan estimasi dari jumlah
//    baris tabel.
// 2. Paket/plan aktif -- lewat endpoint "List project addons"
//    (GET /v1/projects/{ref}/billing/addons) untuk tahu apakah project
//    masih di compute instance Free/Micro atau sudah upgrade.
//
// Butuh DUA env var baru di Vercel (pemilik produk sendiri yang harus
// generate + set -- kredensial akun sensitif, TIDAK dibuat otomatis dari
// sini):
// - SUPABASE_ACCESS_TOKEN: Personal Access Token dari
//   https://supabase.com/dashboard/account/tokens (BEDA dari
//   SUPABASE_SERVICE_ROLE_KEY yang sudah ada -- itu untuk akses data lewat
//   REST/data API, ini untuk akses Management API/pengaturan akun).
// - SUPABASE_PROJECT_REF: id project (20 karakter, terlihat di URL dashboard
//   https://supabase.com/dashboard/project/<ref> atau Settings -> General).
//
// Batas Free Plan DICATAT MANUAL di bawah (BATAS_FREE_TIER) karena
// Management API tidak mengekspos endpoint kuota-lengkap yang stabil untuk
// seluruh kategori (db size/egress/storage) sekaligus -- angka diambil dari
// halaman resmi https://supabase.com/pricing (per Juli 2026: DB 500 MB,
// storage file 1 GB, egress 5 GB, MAU 50.000). WAJIB diperbarui manual
// kalau Supabase mengubah paket Free-nya.
//
// Fail-soft: sama seperti getVercelUsage.ts -- env var belum diset atau
// panggilan API gagal TIDAK PERNAH membuat dashboard mengarang angka,
// cukup available:false dengan alasan jujur.

const MANAGEMENT_API_BASE = "https://api.supabase.com";

// Per https://supabase.com/pricing (dicek Juli 2026) -- lihat catatan di
// atas soal kenapa ini statis, bukan hasil panggilan API.
export const FREE_TIER_LIMITS = {
  dbSizeBytes: 500 * 1024 * 1024, // 500 MB
  fileStorageBytes: 1 * 1024 * 1024 * 1024, // 1 GB
  egressBytes: 5 * 1024 * 1024 * 1024, // 5 GB
  monthlyActiveUsers: 50_000,
};

export type SupabaseUsageResult =
  | {
      available: true;
      dbSizeBytes: number;
      planAddons: Array<{ addonType: string; variant: string | null }>;
      freeTierLimits: typeof FREE_TIER_LIMITS;
      fetchedAt: string;
    }
  | { available: false; reason: string };

async function managementApiFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(`${MANAGEMENT_API_BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/** Entry point dipanggil getCostDashboard.ts (super-admin). */
export async function getSupabaseUsage(): Promise<SupabaseUsageResult> {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!token || !ref) {
    return {
      available: false,
      reason: "SUPABASE_ACCESS_TOKEN dan/atau SUPABASE_PROJECT_REF belum diset di Vercel Environment Variables.",
    };
  }

  try {
    const [sizeRes, addonsRes] = await Promise.all([
      managementApiFetch(`/v1/projects/${ref}/database/query/read-only`, token, {
        method: "POST",
        body: JSON.stringify({ query: "select pg_database_size(current_database()) as bytes;" }),
      }),
      managementApiFetch(`/v1/projects/${ref}/billing/addons`, token),
    ]);

    if (!sizeRes.ok) {
      const body = await sizeRes.text().catch(() => "");
      console.error("[supabaseUsage] query ukuran DB gagal:", sizeRes.status, body.slice(0, 300));
      return { available: false, reason: `Supabase Management API (query ukuran DB) mengembalikan status ${sizeRes.status} -- cek SUPABASE_ACCESS_TOKEN masih valid.` };
    }
    const sizeRows = (await sizeRes.json()) as Array<{ bytes: number | string }>;
    const dbSizeBytes = Number(sizeRows?.[0]?.bytes ?? 0);

    let planAddons: Array<{ addonType: string; variant: string | null }> = [];
    if (addonsRes.ok) {
      const addonsJson = (await addonsRes.json()) as { selected_addons?: Array<{ type: string; variant?: { identifier?: string } }> };
      planAddons = (addonsJson.selected_addons || []).map((a) => ({ addonType: a.type, variant: a.variant?.identifier ?? null }));
    } else {
      console.error("[supabaseUsage] list addons gagal (non-fatal, lanjut tanpa info plan):", addonsRes.status);
    }

    return {
      available: true,
      dbSizeBytes,
      planAddons,
      freeTierLimits: FREE_TIER_LIMITS,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[supabaseUsage] exception:", err);
    return { available: false, reason: "Gagal menghubungi Supabase Management API (jaringan/timeout)." };
  }
}
