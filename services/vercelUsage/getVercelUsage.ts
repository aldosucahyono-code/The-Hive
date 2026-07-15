// services/vercelUsage/getVercelUsage.ts
//
// Integrasi API RESMI Vercel (permintaan eksplisit pemilik produk, dipilih
// lewat AskUserQuestion: "Sambungkan API resmi Vercel/Supabase" -- BUKAN
// entri manual) -- endpoint `/v1/billing/charges` (format terbuka FOCUS
// v1.3, diumumkan Vercel Feb 2026: https://vercel.com/changelog/access-billing-usage-cost-data-api).
// Mengembalikan data tagihan SUNGGUHAN per hari/service, BUKAN estimasi.
//
// Butuh env var baru di Vercel (pemilik produk sendiri yang harus generate
// + set -- ini kredensial akun sensitif, TIDAK dibuat otomatis dari sini):
// - VERCEL_API_TOKEN (WAJIB): Personal Access Token dari
//   https://vercel.com/account/tokens (scope minimal: Read untuk
//   team/akun yang relevan).
// - VERCEL_TEAM_ID (OPSIONAL): id team (BUKAN slug) -- HANYA relevan kalau
//   project ada di bawah Vercel Team sungguhan. Untuk project di bawah akun
//   PERSONAL (tidak ada menu "Team" di Vercel Settings sama sekali -- kasus
//   THE HIVE), parameter teamId TIDAK disertakan sama sekali di request --
//   API Vercel otomatis pakai scope akun personal dari token-nya sendiri.
//
// Fail-soft: kalau salah satu env var belum diset, atau panggilan API
// gagal (token salah/kadaluarsa/network), fungsi ini mengembalikan
// available:false dengan alasan jujur -- TIDAK PERNAH mengarang angka
// biaya hosting supaya dashboard tetap "terlihat lengkap".

const FOCUS_ENDPOINT = "https://api.vercel.com/v1/billing/charges";

// Baris JSONL sesuai skema FOCUS v1.3 (hanya field yang benar-benar dipakai
// di sini -- lihat dokumentasi lengkap untuk field lain seperti RegionId/
// ServiceCategory yang tidak relevan untuk ringkasan biaya sederhana ini).
type FocusChargeLine = {
  EffectiveCost: number;
  ChargeCategory: "Adjustment" | "Credit" | "Purchase" | "Tax" | "Usage";
  ServiceName: string;
  ChargePeriodStart: string;
};

export type VercelUsageByService = { serviceName: string; costUsd: number };

export type VercelUsageResult =
  | {
      available: true;
      totalCostUsd: number;
      byService: VercelUsageByService[];
      periodStart: string;
      periodEnd: string;
      fetchedAt: string;
    }
  | { available: false; reason: string };

/** Entry point dipanggil getCostDashboard.ts (super-admin). Default periode
 * = 30 hari terakhir sampai sekarang (cukup untuk kebutuhan "kapan harus
 * top up", tidak perlu histori setahun penuh tiap render dashboard). */
export async function getVercelUsage(periodDays = 30): Promise<VercelUsageResult> {
  const token = process.env.VERCEL_API_TOKEN;
  // OPSIONAL -- lihat catatan header file soal akun personal vs Team.
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token) {
    return {
      available: false,
      reason: "VERCEL_API_TOKEN belum diset di Vercel Environment Variables.",
    };
  }

  const to = new Date();
  const from = new Date(to.getTime() - periodDays * 24 * 60 * 60 * 1000);

  try {
    const teamParam = teamId ? `&teamId=${encodeURIComponent(teamId)}` : "";
    const url = `${FOCUS_ENDPOINT}?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}${teamParam}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[vercelUsage] API gagal:", res.status, body.slice(0, 300));
      return { available: false, reason: `Vercel API mengembalikan status ${res.status} -- cek VERCEL_API_TOKEN masih valid.` };
    }

    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.trim());

    const byServiceMap = new Map<string, number>();
    let totalCostUsd = 0;
    for (const line of lines) {
      let charge: FocusChargeLine;
      try {
        charge = JSON.parse(line);
      } catch {
        continue; // baris korup/tidak lengkap -- lewati, jangan gagalkan seluruh laporan
      }
      // Credit/Adjustment bisa negatif (mengurangi biaya) -- tetap
      // dijumlahkan apa adanya (EffectiveCost sudah mencerminkan itu),
      // BUKAN diabaikan, supaya total benar-benar sama dengan tagihan asli.
      const cost = typeof charge.EffectiveCost === "number" ? charge.EffectiveCost : 0;
      totalCostUsd += cost;
      const service = charge.ServiceName || "Lainnya";
      byServiceMap.set(service, (byServiceMap.get(service) || 0) + cost);
    }

    const byService: VercelUsageByService[] = Array.from(byServiceMap.entries())
      .map(([serviceName, costUsd]) => ({ serviceName, costUsd }))
      .sort((a, b) => b.costUsd - a.costUsd);

    return {
      available: true,
      totalCostUsd,
      byService,
      periodStart: from.toISOString(),
      periodEnd: to.toISOString(),
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[vercelUsage] exception:", err);
    return { available: false, reason: "Gagal menghubungi Vercel API (jaringan/timeout)." };
  }
}
