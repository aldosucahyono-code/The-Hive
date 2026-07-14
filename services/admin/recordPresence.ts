// services/admin/recordPresence.ts
//
// Audit Juli 2026 ("saya juga ingin tau kapan users online-offline, lokasi,
// dan perangkat apa yang dia pakai"): dipanggil dari api/workspace.ts
// SETELAH auth pelanggan biasa berhasil (bukan untuk action admin* --
// admin punya sesinya sendiri, lihat requireAdminSession.ts), untuk setiap
// action yang dipanggil pelanggan lewat Workspace. Merekam last_seen_at
// (dipakai halaman admin untuk status online/offline), last_ip, dan lokasi
// kasar (kota/negara, lewat lookup IP -- BUKAN alamat presisi, itu memang
// batas teknis IP address) + user agent (perangkat/browser diparse saat
// ditampilkan, lihat parseDevice.ts).
//
// SELALU non-fatal (try/catch membungkus semuanya) -- fungsi ini TIDAK
// PERNAH boleh menggagalkan permintaan pelanggan yang sebenarnya, ini cuma
// data pendamping untuk halaman admin.
//
// DITHROTTLE ke maksimal sekali per menit per pelanggan (baca last_seen_at
// dulu, skip kalau masih < 60 detik) -- Workspace memanggil /api/workspace
// sangat sering (polling notifikasi, dst), tidak perlu nulis ke DB +
// (kadang) panggil API geolokasi eksternal di SETIAP panggilan itu.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const PRESENCE_THROTTLE_MS = 60 * 1000;
const GEO_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function resolveGeo(ip: string): Promise<{ city: string | null; country: string | null } | null> {
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
    // HTTP (bukan HTTPS) di tier gratisnya -- ini panggilan server-ke-server
    // (bukan dari browser pengguna), jadi bukan isu mixed-content.
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city`);
    const json = await res.json();
    if (json.status !== "success") {
      return cached ? { city: cached.city as string | null, country: cached.country as string | null } : null;
    }
    const city = json.city || null;
    const country = json.country || null;
    await supabase.from("ip_geo_cache").upsert({ ip, city, country, resolved_at: new Date().toISOString() });
    return { city, country };
  } catch (err) {
    console.error("recordPresence resolveGeo error (non-fatal):", err);
    return cached ? { city: cached.city as string | null, country: cached.country as string | null } : null;
  }
}

export async function recordPresence(userId: string, ip: string, userAgent: string): Promise<void> {
  try {
    const { data: profile } = await supabase.from("profiles").select("last_seen_at, last_ip").eq("id", userId).maybeSingle();
    if (!profile) return;

    const lastSeenMs = profile.last_seen_at ? new Date(profile.last_seen_at as string).getTime() : 0;
    if (Date.now() - lastSeenMs < PRESENCE_THROTTLE_MS) return;

    const geo = ip ? await resolveGeo(ip) : null;

    await supabase
      .from("profiles")
      .update({
        last_seen_at: new Date().toISOString(),
        last_ip: ip || null,
        last_user_agent: userAgent || null,
        last_geo_city: geo?.city ?? null,
        last_geo_country: geo?.country ?? null,
      })
      .eq("id", userId);
  } catch (err) {
    // Non-fatal secara sengaja -- lihat catatan di atas file ini.
    console.error("recordPresence error (non-fatal):", err);
  }
}
