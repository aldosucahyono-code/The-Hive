// services/socialMedia/apifyClient.ts
//
// Generic Apify REST client — satu fungsi generik `runApifyActor` dipakai
// instagramProvider.ts untuk dua actor berbeda (pencarian username +
// pengambilan follower count), supaya tidak ada dua implementasi HTTP
// fetch yang nyaris sama untuk hal yang sama.
//
// Actor ID BISA DI-OVERRIDE lewat env var (bukan di-hardcode keras) karena
// skema exact actor Apify tidak bisa diverifikasi otomatis dari sesi ini
// (halaman actor Apify client-side rendered, fetch mentah hanya dapat
// shell HTML) — default memakai actor publik yang umum dipakai komunitas
// Apify per pengetahuan terakhir, tapi pemilik produk bisa ganti actor ID
// tanpa deploy ulang kode kalau actor default ternyata deprecated/berubah
// skema input/output-nya.
//
// TIMEOUT: setiap panggilan actor dibatasi AbortController milik
// pemanggilnya sendiri (lihat instagramProvider.ts) — seluruh fungsi ini
// dipanggil dari dalam api/workspace.ts yang punya batas keras 60 detik
// (vercel.json maxDuration) untuk SELURUH request, bukan cuma panggilan
// Apify ini saja.

const APIFY_BASE_URL = "https://api.apify.com/v2";

export type ApifyRunOptions = {
  actorId: string;
  input: Record<string, unknown>;
  token: string;
  timeoutMs: number;
};

/** Menjalankan satu Apify actor secara sinkron (run-sync-get-dataset-items)
 * dan mengembalikan dataset item mentah. Melempar Error kalau gagal/timeout
 * /bentuk data tak terduga — caller (instagramProvider.ts) bertanggung
 * jawab menangkapnya dan jatuh ke fallback, TIDAK PERNAH membiarkan error
 * ini bocor sampai ke response API/pengguna. */
export async function runApifyActor<T = Record<string, unknown>>(options: ApifyRunOptions): Promise<T[]> {
  const { actorId, input, token, timeoutMs } = options;
  const url = `${APIFY_BASE_URL}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new Error(`Apify actor ${actorId} gagal (HTTP ${response.status}): ${bodyText.slice(0, 300)}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error(`Apify actor ${actorId} mengembalikan bentuk data tak terduga (bukan array).`);
    }
    return data as T[];
  } finally {
    clearTimeout(timeoutId);
  }
}
