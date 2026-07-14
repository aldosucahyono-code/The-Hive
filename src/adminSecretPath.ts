// src/adminSecretPath.ts
//
// Path rahasia halaman admin, sisi FRONTEND. HARUS SAMA PERSIS dengan
// services/admin/adminSecretPath.ts (backend) -- lihat komentar di file itu
// untuk penjelasan lengkap kenapa dua file terpisah, dan kenapa path ini
// sendirian TIDAK cukup sebagai proteksi (bundle JS publik bisa dibaca
// siapapun -- proteksi sebenarnya ada di alur email+PIN, lihat AdminPage.tsx).
export const ADMIN_SECRET_PATH = "p6k9cyiqf09xvr0ldjmnqd";
