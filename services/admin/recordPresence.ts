// services/admin/recordPresence.ts
//
// Audit Juli 2026 ("saya juga ingin tau kapan users online-offline, lokasi,
// dan perangkat apa yang dia pakai" + "lokasi dan perangkat harus benar2
// akurat"): dipanggil dari api/workspace.ts SETELAH auth pelanggan biasa
// berhasil (bukan untuk action admin* -- admin punya sesinya sendiri, lihat
// requireAdminSession.ts), untuk setiap action yang dipanggil pelanggan
// lewat Workspace. Merekam last_seen_at (dipakai halaman admin untuk status
// online/offline), last_ip, dan lokasi kasar (kota/negara) + user agent
// (perangkat/browser diparse saat ditampilkan, lihat parseDevice.ts).
//
// SELALU non-fatal (try/catch membungkus semuanya) -- fungsi ini TIDAK
// PERNAH boleh menggagalkan permintaan pelanggan yang sebenarnya, ini cuma
// data pendamping untuk halaman admin.
//
// DITHROTTLE ke maksimal sekali per menit per pelanggan (baca last_seen_at
// dulu, skip kalau masih < 60 detik) -- Workspace memanggil /api/workspace
// sangat sering (polling notifikasi, dst), tidak perlu nulis ke DB +
// (kadang) panggil API geolokasi eksternal di SETIAP panggilan itu.
//
// PERBAIKAN AKURASI (audit Juli 2026):
//   1. Sumber lokasi UTAMA sekarang header geolokasi bawaan Vercel
//      (x-vercel-ip-city/-country, diisi otomatis oleh edge network Vercel
//      untuk SETIAP request produksi -- tidak perlu panggilan API eksternal
//      sama sekali, jadi tidak ada risiko gagal/timeout/rate-limit). ip-api.com
//      HANYA dipakai sebagai fallback kalau header ini kosong (mis. testing
//      lokal, atau proxy lain di depan Vercel).
//   2. BUG DIPERBAIKI: sebelumnya kalau lookup geo gagal/kosong di satu
//      pemanggilan, kolom last_geo_city/last_geo_country ditimpa NULL --
//      menghapus data lokasi yang sebelumnya sudah benar. Sekarang field
//      geo/device HANYA ditulis kalau ada nilai baru yang valid; kalau
//      tidak ada, kolom lama dibiarkan apa adanya (tidak pernah ditimpa
//      kosong oleh kegagalan sesaat).

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const PRESENCE_THROTTLE_MS = 60 * 1000;
const GEO_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Header geolokasi bawaan Vercel -- diisi otomatis oleh edge network Vercel
 * untuk SETIAP request yang lewat produksi (Node.js Serverless Function
 * TERMASUK, bukan cuma Edge Function), berdasarkan IP asli pemanggil.
 * Jauh lebih akurat & instan dibanding lookup API eksternal (ip-api.com) --
 * tidak ada panggilan jaringan tambahan sama sekali. Kosong saat dijalankan
 * di luar infrastruktur Vercel (mis. dev lokal `vercel dev` tanpa proxy
 * edge, atau curl langsung) -- itulah kenapa masih ada fallback ip-api.com
 * di bawah. */
export function extractVercelGeo(headers: Record<string, string | string[] | undefined>): { city: string | null; country: string | null } | null {
  const rawCity = headers["x-vercel-ip-city"];
  const rawCountry = headers["x-vercel-ip-country"];
  const city = Array.isArray(rawCity) ? rawCity[0] : rawCity;
  const country = Array.isArray(rawCountry) ? rawCountry[0] : rawCountry;
  if (!city && !country) return null;
  try {
    return {
      city: city ? decodeURIComponent(city) : null,
      country: country ? decodeURIComponent(country) : null,
    };
  } catch {
    return { city: city || null, country: country || null };
  }
}

async function resolveGeoFallback(ip: string): Promise<{ city: string | null; country: string | null } | null> {
  // IP lokal/privat (dev, localhost, dst) -- lookup tidak ada gunanya.
  if (!ip || ip === "unknown" || ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.") || ip === "::1") {
    return null;
  }

  const { data: cached } = await supabase.from("ip_geo_cache").select("city, country, resolved_at").eq("ip", ip).maybeSingle();
  if (cached && Date.now() - new Date(cached.resolved_at as string).getTime() < GEO_CACHE_TTL_MS) {
    return { city: cached.city as string | null, country: cached.country as string | null };
  }

  try {
    // ip-api.com — layanan geolokasi IP gratis, akurasi level kota/negara.
    // HANYA dipakai sebagai fallback (lihat extractVercelGeo di atas) --
    // panggilan server-ke-server (bukan dari browser pengguna), jadi bukan
    // isu mixed-content meski lewat HTTP di tier gratisnya.
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city`);
    const json = (await res.json()) as { status?: string; city?: string; country?: string };
    if (json.status !== "success") {
      return cached ? { city: cached.city as string | null, country: cached.country as string | null } : null;
    }
    const city = json.city || null;
    const country = json.country || null;
    await supabase.from("ip_geo_cache").upsert({ ip, city, country, resolved_at: new Date().toISOString() });
    return { city, country };
  } catch (err) {
    console.error("recordPresence resolveGeoFallback error (non-fatal):", err);
    return cached ? { city: cached.city as string | null, country: cached.country as string | null } : null;
  }
}

export async function recordPresence(
  userId: string,
  ip: string,
  userAgent: string,
  vercelGeo?: { city: string | null; country: string | null } | null
): Promise<void> {
  try {
    const { data: profile } = await supabase.from("profiles").select("last_seen_at, last_ip").eq("id", userId).maybeSingle();
    if (!profile) return;

    const lastSeenMs = profile.last_seen_at ? new Date(profile.last_seen_at as string).getTime() : 0;
    if (Date.now() - lastSeenMs < PRESENCE_THROTTLE_MS) return;

    // Utamakan header Vercel (instan, tidak ada panggilan jaringan) --
    // fallback ke ip-api.com HANYA kalau header itu kosong.
    const geo = vercelGeo && (vercelGeo.city || vercelGeo.country) ? vercelGeo : ip ? await resolveGeoFallback(ip) : null;

    // Selalu update last_seen_at + last_ip (murni informasi kapan/dari IP
    // mana, tidak ada "kegagalan lookup" yang bisa membuatnya salah).
    // Field geo/device HANYA ditulis kalau ada nilai baru -- lihat catatan
    // "BUG DIPERBAIKI" di atas file ini.
    const updatePayload: Record<string, unknown> = {
      last_seen_at: new Date().toISOString(),
      last_ip: ip || null,
    };
    if (userAgent) updatePayload.last_user_agent = userAgent;
    if (geo?.city) updatePayload.last_geo_city = geo.city;
    if (geo?.country) updatePayload.last_geo_country = geo.country;

    await supabase.from("profiles").update(updatePayload).eq("id", userId);
  } catch (err) {
    // Non-fatal secara sengaja -- lihat catatan di atas file ini.
    console.error("recordPresence error (non-fatal):", err);
  }
}
