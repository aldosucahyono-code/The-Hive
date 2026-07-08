# Audit Quality Gate — THE HIVE
**Tanggal:** 9 Juli 2026
**Lingkup:** Business Flow, Database & API, Workspace, Membership, UX, Responsiveness, Bilingual
**Di luar lingkup (sesuai arahan):** Achievement Engine (2.4), AI Engine (3.x) dan seluruh turunannya (Master Roadmap AI, Mission Today, AI Recommendation, AI Memory) — belum dibangun, dicatat sebagai backlog sesuai roadmap, bukan bug.

Prinsip yang dipakai untuk menilai setiap temuan: *apakah ini membuat THE HIVE jadi Business Operating System yang lebih baik untuk pelanggan?* Kalau ya → prioritas. Kalau tidak → backlog.

---

## 1. Kondisi Saat Ini (yang sudah berjalan baik)

- **Alur inti utuh dan tersambung**: Landing → Wizard → Preview (generate-preview) → simpan draft anonim (save-submission/wizard_drafts) → Login → promote-draft (bikin business_profile + analysis) → create-transaction → Snap → Workspace. Tidak ada mata rantai yang putus di alur ini.
- **Router + services architecture rapi**: 10 file `api/` semuanya dipanggil dari frontend (kecuali `notification-handler.ts` yang memang webhook dari Midtrans, dan `generate-report.ts` yang memang sengaja belum disambung — Tahap B, sudah diketahui). Tidak ada endpoint yatim yang tidak disengaja.
- **Konvensi `.js` extension (ESM gotcha)** diikuti dengan benar di semua file yang dicek, termasuk file baru yang barusan ditambahkan.
- **Gating tier di setiap menu Workspace** (Business Score, Report, Target, Competitor, Growth, Chat Beemo) **sudah 100% sesuai** dengan tabel gating yang disepakati — dicek baris per baris di kode, semua cocok.
- **7 menu Workspace semuanya punya tujuan jelas**, tidak ada menu placeholder tanpa arah. Competitor/Growth sengaja menampilkan pesan transparan (bukan "Segera Hadir") untuk PRO/PLATINUM yang menunggu Tahap B — sesuai filosofi yang disepakati.
- **Nada UX konsisten "konsultan", bukan ERP** — copy Beemo, form Business Update, dan layout Workspace (satu sidebar + satu panel konten, tanpa nested menu berlapis) sudah sesuai visi "ringan, bukan rumit".
- **Layout Workspace sudah mobile-first**: sidebar jadi baris tombol scroll-horizontal di HP (`overflow-x-auto`), grid utama stack otomatis di layar kecil.

## 2. Temuan

### T1 — Subscription tidak pernah otomatis kadaluarsa (P4, Membership)
**Kondisi:** `subscriptions.status` hanya berubah dari `active` ketika ada pembelian BARU (notification-handler meng-expire baris lama sebelum insert baris baru). Tidak ada mekanisme apapun — baik di query frontend (`Workspace.tsx` baris ~650, hanya filter `status = active`) maupun di backend (`services/beemo/chat.ts` juga hanya cek `status`) — yang mengecek apakah `expires_at` sudah lewat. Fungsi `daysLeft()` bahkan di-clamp minimal 0, jadi tidak pernah menunjukkan "kadaluarsa", cuma diam di "0 hari lagi" selamanya.
**Dampak:** **Kritis.** Setelah masa aktif PRO (7 hari) atau PLATINUM (30 hari) habis tanpa pembelian baru, user tetap melihat dan memakai semua fitur berbayar selamanya — tidak pernah otomatis kembali ke Gratis. ini langsung mengikis model bisnis (pelanggan bayar sekali, akses selamanya) dan juga membuat fitur "tombol Perpanjang" yang sudah direncanakan tidak punya titik masuk yang jelas (karena sistem tidak pernah menganggap mereka "sudah habis").
**Rekomendasi:** Tambahkan syarat `expires_at > sekarang` di setiap tempat yang membaca subscription aktif (query Workspace, query beemo/chat.ts), dan ubah `AccessStatusCard`/`daysLeft` supaya menampilkan status "Kadaluarsa" yang jelas alih-alih diam di 0 hari. Idealnya juga ada satu mekanisme ringan (cron/scheduled function) yang benar-benar mengubah `status` jadi `expired` di database, supaya data di tabel `subscriptions` sendiri akurat (berguna nanti untuk laporan churn/renewal).

### T2 — Alur pembayaran pertama (wizard) tidak menunggu konfirmasi webhook (P1, Business Flow)
**Kondisi:** `PaymentPage.tsx` (dipakai user baru yang baru pertama kali bayar lewat wizard) langsung `hardNavigate("workspace")` begitu `onSuccess`/`onPending` dari Snap terpanggil — padahal status pembayaran yang sesungguhnya baru dikonfirmasi lewat webhook `notification-handler` yang berjalan async dan bisa terlambat beberapa detik. Ini berbeda dengan alur upgrade dari dalam Workspace (`UpgradeModal` → `handleUpgraded`) yang barusan kita perbaiki — di situ sudah ada polling 5x + pesan status yang jelas.
**Dampak:** **Kritis** (karena ini terjadi tepat di momen transaksi pertama/paling sensitif — pelanggan baru saja bayar, lalu mendarat di Workspace dan berpotensi melihat "Paket Gratis" tanpa penjelasan apapun). Berisiko tinggi menimbulkan keluhan/ketidakpercayaan di momen konversi paling penting.
**Rekomendasi:** Terapkan pola yang sama seperti di `handleUpgraded` — polling singkat (bisa pakai endpoint `getLatestPayment` yang baru dibuat) sebelum pindah ke Workspace, atau kirim status "baru saja bayar" lewat sessionStorage supaya Workspace langsung menampilkan pesan yang sama (checking/expired/pending) begitu mendarat.

### T3 — Tidak ada file SQL migrasi yang tersimpan di repo (P2, Database)
**Kondisi:** Dokumentasi menyebut 5 file migrasi SQL sudah dijalankan (`the-hive-schema-v2.sql`, dst.) — tapi setelah dicek menyeluruh, tidak ada satupun file `.sql` di repository (bukan soal `.gitignore`, memang tidak pernah disimpan/commit).
**Dampak:** **Kritis** untuk fondasi jangka panjang (bukan bug yang terlihat user, tapi risiko operasional besar). Skema Supabase (~20 tabel + RLS) saat ini hanya ada "di kepala Aldo dan histori chat lama" — kalau perlu bikin ulang project Supabase (disaster recovery, staging environment, onboarding developer lain), tidak ada satupun sumber kebenaran yang bisa dijalankan ulang.
**Rekomendasi:** Ambil dump skema aktual dari Supabase (`supabase db dump` atau export dari dashboard) dan commit ke folder `supabase/migrations/` di repo, atau minimal simpan ulang 5 file SQL yang disebut di dokumentasi. Ini murni pekerjaan housekeeping, tapi penting dilakukan sebelum lanjut ke Business/AI Engine.

### T4 — AuthModal (halaman login) 100% belum bilingual (P7)
**Kondisi:** `AuthModal.tsx` — dipakai SETIAP user (gratis/PRO/PLATINUM) untuk login — sama sekali tidak memakai `useLanguage`/`t.*`. Semua teks hardcoded Bahasa Indonesia ("Aktifkan Workspace", "Cek Email Kamu", "Kirim Link Aktivasi", dst.).
**Dampak:** **Tinggi.** User yang sudah toggle ke EN tetap mendapat modal login 100% Bahasa Indonesia — titik gesekan pertama untuk pengguna berbahasa Inggris.
**Rekomendasi:** Tambahkan `t.authModal.*` ke `translations.ts` (id+en) dan sambungkan di `AuthModal.tsx`, pola yang sama seperti komponen lain.

### T5 — Teks hardcoded lain yang bocor dari sistem bilingual (P7)
- `Navbar.tsx` baris 84: `{user ? "Workspace" : "Aktifkan Workspace"}` — hardcoded ID, padahal Navbar tampil di **setiap halaman**. **Dampak: Sedang.**
- `PreviewReport.tsx` baris 240/266: teks tombol loading `"Menyiapkan..."` hardcoded, seharusnya lewat `t.previewReport.*`. **Dampak: Rendah** (state singkat).
- Banyak ternary `lang === "id" ? "..." : "..."` tersebar langsung di `Workspace.tsx` (label status, judul breakdown dimensi, caption progress) alih-alih lewat kamus terpusat `translations.ts`. Secara fungsi tetap bilingual (dua bahasa ada), tapi menyalahi pola satu-sumber-kebenaran yang didokumentasikan sendiri di file itu — bikin perubahan istilah ke depan harus diburu manual di banyak tempat. **Dampak: Rendah**, lebih ke rapi-rapi kode.
- Komentar di baris atas `translations.ts` menyatakan Hero/Features/Pricing/Footer/Legal "belum diterjemahkan" — ini **sudah tidak benar**, kelima halaman itu sudah lengkap terhubung ke `t.hero.*`, `t.features.*`, dst. Komentar basi ini berisiko menyesatkan pengerjaan berikutnya. **Dampak: Rendah**, housekeeping dokumentasi.

### T6 — Navbar tidak punya pola mobile khusus (P6, Responsiveness)
**Kondisi:** Logo+judul+4 link navigasi+toggle bahasa+tombol CTA semua ada dalam satu baris yang mengandalkan `flex-wrap`, tanpa hamburger menu/collapse untuk layar sempit.
**Dampak:** **Sedang.** Untuk target pengguna UMKM yang lebih sering pakai HP (layar ~360-390px), ini berpotensi pecah jadi beberapa baris yang terlihat berantakan, meski tidak sampai rusak fungsinya.
**Rekomendasi:** Pertimbangkan pola collapse/hamburger sederhana di breakpoint mobile, konsisten dengan pola sidebar Workspace yang sudah bagus.

### T7 — 9 tabel belum dipakai kode — sesuai roadmap, bukan bug
`workspace_state`, `master_roadmaps`, `roadmap_phases`, `roadmap_tasks`, `phase_evaluations`, `beemo_memory`, `beemo_logs`, `beemo_recommendations`, `achievements`, `user_achievements` — nol referensi di kode. Ini cocok dengan roadmap (Achievement Engine & AI Engine belum mulai), **jadi bukan temuan yang perlu diperbaiki**. Catatan kecil: `workspace_state` tidak disebut eksplisit terkait tahap manapun di dokumentasi (beda dengan tabel achievement/roadmap yang jelas terkait Tahap 2.4/3.x) — sebaiknya Aldo klarifikasi dulu tujuan tabel ini biar tidak jadi beban skema yang benar-benar terlupakan.

## 3. Rekomendasi & Prioritas Implementasi
*(diurutkan berdasarkan dampak ke pelanggan, bukan kemudahan coding — sesuai arahan)*

| # | Temuan | Dampak | Kenapa didahulukan |
|---|---|---|---|
| 1 | T1 — Subscription tidak otomatis kadaluarsa | Kritis | Langsung menyentuh model bisnis (pendapatan) — pelanggan bisa pakai fitur berbayar gratis selamanya |
| 2 | T2 — Alur pembayaran pertama tidak menunggu konfirmasi | Kritis | Terjadi di momen konversi paling sensitif (transaksi pertama pelanggan baru) |
| 3 | T3 — Tidak ada file SQL migrasi tersimpan | Kritis (fondasi) | Wajib beres sebelum masuk fase Business Engine/AI Engine penuh — risiko tidak bisa dipulihkan kalau ada masalah di Supabase |
| 4 | T4 — AuthModal belum bilingual | Tinggi | Titik sentuh wajib untuk semua user, termasuk yang pilih EN |
| 5 | T5 — Teks hardcoded lain | Sedang/Rendah | Kecil tapi cepat dibereskan sekalian |
| 6 | T6 — Navbar belum mobile-first | Sedang | Selaras dengan target pengguna HP, tapi tidak menghalangi transaksi |
| — | T7 — 9 tabel belum dipakai | — | Bukan temuan, backlog resmi sesuai roadmap |

## 4. Setelah Ini
Sesuai arahan: setelah audit ini, temuan **Kritis** (T1, T2, T3) sebaiknya langsung dikerjakan sebelum lanjut ke Business Engine/AI Engine, supaya fondasi benar-benar bersih. T1 dan T2 bisa langsung diperbaiki di kode sekarang. T3 perlu konfirmasi Aldo dulu (dari mana sumber SQL yang mau disimpan — dump baru dari Supabase, atau file lama yang mungkin masih ada di komputer).
