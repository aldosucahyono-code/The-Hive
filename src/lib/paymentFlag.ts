// src/lib/paymentFlag.ts
//
// Beta Launch (Midtrans Production belum diverifikasi/aktif): satu flag
// sederhana untuk mematikan sementara alur pembayaran nyata (Midtrans
// Snap) tanpa mengubah kode apapun -- lihat PaymentPage.tsx & UpgradeModal.tsx
// (keduanya cek PAYMENT_ENABLED sebelum memanggil /api/create-transaction),
// dan BetaEarlyAccessCard.tsx (ditampilkan sebagai gantinya).
//
// FAIL-SAFE by design (opt-in, bukan opt-out): sebelumnya flag ini default
// AKTIF kecuali di-set persis "false" -- artinya kalau env var lupa di-set
// di Vercel (atau di-set tapi belum redeploy, karena Vite meng-inline env
// saat BUILD TIME bukan runtime), payment Midtrans SUNGGUHAN tetap aktif
// tanpa disadari. Insiden nyata: 19 Jul 2026, tombol upgrade production
// memicu POST /api/create-transaction sungguhan (bukan Early Access) --
// root cause: VITE_PAYMENT_ENABLED tidak/belum ter-set ke "true" secara
// eksplisit di Vercel Production. Diaudit bersama GPT, sepakat prinsip
// "gagal dalam keadaan aman (fail safe) lebih baik daripada berhasil
// melakukan sesuatu yang belum seharusnya terjadi (fail dangerous)" --
// khususnya untuk fitur yang menyentuh uang & Midtrans Production.
//
// Cara AKTIFKAN payment sungguhan (hard launch): set
// VITE_PAYMENT_ENABLED=true (persis, huruf kecil) di Vercel Environment
// Variables untuk scope Production, lalu WAJIB redeploy (build baru --
// env Vite di-bake saat build, bukan dibaca saat runtime). Checklist hard
// launch: (1) set VITE_PAYMENT_ENABLED=true, (2) redeploy Production,
// (3) tes alur upgrade live sebelum umumkan ke user.
// Kalau env var tidak di-set sama sekali, atau typo, atau lupa redeploy --
// default-nya sekarang AMAN: Early Access, bukan payment nyata.
export const PAYMENT_ENABLED = import.meta.env.VITE_PAYMENT_ENABLED === "true";
