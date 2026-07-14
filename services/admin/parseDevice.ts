// services/admin/parseDevice.ts
//
// Parser User-Agent sederhana berbasis regex (SENGAJA tidak pakai library
// eksternal untuk satu kebutuhan kecil ini -- cukup untuk kebutuhan halaman
// admin: "perangkat/browser apa yang dipakai pelanggan", bukan analitik
// presisi). Dipanggil listCustomers.ts & getCustomerDetail.ts saat
// menampilkan data, BUKAN disimpan sebagai kolom tersendiri -- supaya kalau
// parsingnya diperbaiki nanti, hasil tampilan otomatis ikut lebih akurat
// tanpa perlu migrasi data ulang (raw user_agent tetap disimpan apa adanya
// di profiles.last_user_agent).

export function parseDevice(userAgent: string | null | undefined): string {
  if (!userAgent) return "Tidak diketahui";
  const ua = userAgent;

  let browser = "Browser lain";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\//.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";

  let os = "perangkat lain";
  if (/iPhone/.test(ua)) os = "iPhone";
  else if (/iPad/.test(ua)) os = "iPad";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Macintosh|Mac OS X/.test(ua)) os = "Mac";
  else if (/Linux/.test(ua)) os = "Linux";

  return `${browser} di ${os}`;
}
