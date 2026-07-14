// services/admin/adminSecretPath.ts
//
// SATU-SATUNYA tempat path rahasia halaman admin didefinisikan di sisi
// BACKEND. HARUS SAMA PERSIS dengan konstanta di src/adminSecretPath.ts
// (frontend) -- sengaja dua file terpisah (bukan satu file diimpor lintas
// frontend/backend) supaya build Vite (frontend) dan build Vercel
// Functions (backend, esbuild terpisah per file api/*.ts) tidak perlu
// saling bergantung pada struktur folder satu sama lain.
//
// Path ini BUKAN rahasia yang benar-benar melindungi apapun sendirian --
// siapapun yang mengunduh bundle JS publik (unavoidable untuk SPA) bisa
// menemukan string ini kalau mereka mencari. Perlindungan SEBENARNYA ada
// di 2 lapis berikutnya: akses ke inbox email admin + PIN 6 digit (lihat
// migrations/2026-07-15c_admin_security.sql). Path acak ini cuma lapis
// pertama yang murah -- menyaring scanner/bot otomatis yang menebak-nebak
// path umum ("/admin", "/wp-admin", dst), BUKAN benteng utama.
//
// Kalau perlu diganti nanti (mis. dicurigai bocor/di-share tanpa sengaja):
// ganti nilai di SINI dan di src/adminSecretPath.ts SECARA BERSAMAAN, lalu
// deploy ulang.
export const ADMIN_SECRET_PATH = "p6k9cyiqf09xvr0ldjmnqd";
