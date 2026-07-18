// src/lib/paymentFlag.ts
//
// Beta Launch (Midtrans Production belum diverifikasi/aktif): satu flag
// sederhana untuk mematikan sementara alur pembayaran nyata (Midtrans
// Snap) tanpa mengubah kode apapun -- lihat PaymentPage.tsx & UpgradeModal.tsx
// (keduanya cek PAYMENT_ENABLED sebelum memanggil /api/create-transaction),
// dan BetaEarlyAccessCard.tsx (ditampilkan sebagai gantinya).
//
// Cara nonaktifkan: set VITE_PAYMENT_ENABLED=false di Vercel Environment
// Variables lalu redeploy.
// Cara aktifkan lagi saat Midtrans Production sudah siap (hard launch):
// hapus variabel itu (atau set ke "true") lalu redeploy -- TIDAK ada kode
// yang perlu diubah.
export const PAYMENT_ENABLED = import.meta.env.VITE_PAYMENT_ENABLED !== "false";
