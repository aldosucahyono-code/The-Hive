# Ringkasan Perubahan THE HIVE — 17 Juli 2026

Dokumen ini merangkum semua yang dikerjakan dalam sesi ini: latar belakang, detail teknis tiap perubahan, kelebihan, kelemahan, dan status deployment. Ditulis supaya bisa langsung ditempel ke ChatGPT atau dibaca ulang nanti.

## 1. Latar Belakang

Sesi dimulai dari review menyeluruh terhadap THE HIVE dari tiga sumber sekaligus:

1. **Audit UX/Produk dari ChatGPT** (2 dokumen: audit awal + meta-review terhadap audit teknis saya sebelumnya).
2. **Audit saya sendiri** berdasarkan 5 video screen-recording (total ~13.5 menit) yang menunjukkan alur pakai THE HIVE dari sisi user Free, Pro, dan Platinum.
3. **Laporan bug langsung dari kamu**, dua yang paling kritis:
   - Saat user Free mau upgrade, modal upgrade cuma nawarin Platinum — pilihan Pro hilang.
   - Jawaban panjang dari Beemo (chat AI) selalu terpotong, konsisten terjadi di semua tier.

Instruksi kamu eksplisit: bandingkan ketiga sumber ini, jangan asal ikut semua saran ChatGPT, timbang mana yang benar-benar penting buat user — terutama prinsip bilingual, ringan/mudah diakses di banyak device, bahasa sederhana, dan harus tetap berguna buat user yang gaptek sekalipun.

## 2. Apa Saja yang Dikerjakan (8 Item Prioritas)

### A. Bug Fix (2 item — paling kritis, laporan langsung dari user)

**1. Upgrade modal hilang opsi Pro**
- Akar masalah: pola umum di React — event handler di-pass sebagai referensi fungsi mentah (`onClick={openUpgradeModal}`), sehingga saat sampai ke elemen `<button onClick={handler}>` di `WorkspaceDesignSystem.tsx`, objek event DOM (MouseEvent) ikut kepassing sebagai argumen pertama. Fungsi `openUpgradeModal(platinumOnly)` jadi menerima MouseEvent alih-alih boolean, dan MouseEvent dianggap truthy — jadi selalu ke-treat seolah "platinum only".
- Perbaikan: `openUpgradeModal` diperkeras jadi `openUpgradeModal(platinumOnly: unknown = false)` dengan pengecekan eksplisit `platinumOnly === true`, dan 6 titik pemanggilan (Business Score, Target, Competitor, Chat, Settings, Decision Journal) diubah jadi `() => openUpgradeModal()` supaya tidak ada objek event yang nyasar.

**2. Chat Beemo terpotong di jawaban panjang**
- Akar masalah: `max_tokens` di `services/beemo/chat.ts` cuma 1500, dan tidak ada deteksi/pemberitahuan saat jawaban kepotong.
- Perbaikan: `max_tokens` dinaikkan ke 2200, plus deteksi `response.stop_reason === "max_tokens"` — kalau jawaban benar-benar kepotong, sekarang ada catatan otomatis di akhir chat ("Jawaban ini terpotong... minta Beemo lanjutkan").

### B. Peningkatan UX (6 item, dari sintesis 3 sumber)

**3. Beemo sapa duluan saat buka Chat** — sebelumnya chat kosong nunggu user mulai. Sekarang `getChatStarters.ts` juga menghasilkan kalimat pembuka personal dari Beemo (disimpan di kolom jsonb yang sama, tanpa migrasi DB baru), ditampilkan sebagai bubble chat pertama di `ChatBeemoPanel.tsx`.

**4. Tren skor bisnis** — kartu skor di dashboard sekarang menampilkan naik/turun dibanding histori sebelumnya (badge tren), bukan cuma angka statis.

**5. Preview hasil analisis gratis tidak hilang** — sebelumnya kalau user refresh sebelum daftar, hasil preview analisis gratis hilang. Sekarang disimpan ke tabel `wizard_drafts` yang sudah ada (fire-and-forget, tanpa nunggu login), dan dipulihkan otomatis dari `localStorage` + endpoint baru `/api/get-preview-draft` kalau user balik lagi dalam 7 hari.

**6. Decision Journal — empty state diperjelas** — teks kosong yang generik diganti dengan 3 contoh konkret biar user gaptek paham apa fungsinya.

**7. Quick Start onboarding** — user baru sekarang dikasih 4 langkah checklist (skor, update bisnis, chat, kompetitor) yang muncul di tab "Hari Ini", hilang otomatis begitu langkah-langkah itu sudah dikunjungi, bisa di-dismiss manual.

**8. Performance: lazy-loading halaman Workspace** — `Workspace`, `AdminPage`, `PaymentPage`, `ReferralPage` diubah dari static import ke `React.lazy()` + `Suspense`, supaya JS yang di-download di awal lebih kecil (penting buat prinsip "ringan di banyak device"). Catatan: bagian `useMemo`/`useCallback` yang lebih luas SENGAJA tidak dikerjakan karena berisiko tanpa refactor closure props sekalian — lebih baik jujur skip daripada setengah-setengah.

### C. Insiden Deployment (ditemukan & diperbaiki setelah push)

- Setelah 8 item di atas di-push (`bf7551b`), build Vercel **gagal** — bukan soal cache, situsnya memang belum ke-update.
- Akar masalah: key baru `quickStartSteps` yang ditambahkan ke `t.workspace` (untuk item #7) berbentuk objek, sementara 2 tempat lain (`BusinessUpdateModal.tsx`, `Workspace.tsx`) mengambil key dari `t.workspace` secara dinamis dan mengasumsikan hasilnya selalu string → TypeScript error `TS2322`.
- Diperbaiki dengan membatasi tipe supaya cuma menerima key yang nilainya string.
- Ternyata setelah fix di-push, **auto-deploy dari GitHub ke Vercel sempat macet 2x berturut-turut** (bukan soal kode lagi, soal integrasi webhook). Diselesaikan dengan deploy manual pakai Vercel CLI (`npx vercel --prod`) langsung dari komputer kamu — berhasil, status Ready, sudah live di `thehive-bisnis.com`.

## 3. Kelebihan dari Pendekatan Sesi Ini

- **Berbasis bukti, bukan asumsi**: video, source code, dan build log dibaca langsung, bukan cuma percaya laporan/saran mentah-mentah.
- **Hemat biaya**: fitur "Beemo sapa duluan" dan "preview persisten" memakai infrastruktur yang sudah ada (tabel & endpoint lama), bukan bikin API call AI baru — konsisten dengan histori proyek yang sadar biaya.
- **Root cause, bukan tambal gejala**: bug modal upgrade & TS2322 ditelusuri sampai akar penyebabnya (footgun event-handler React, dan type-widening TypeScript), bukan sekadar workaround.
- **Transparan soal batasan**: memoization Workspace.tsx sengaja tidak dikerjakan penuh karena berisiko, dan itu disampaikan apa adanya, bukan diklaim selesai.
- **Ada jalur cadangan saat Vercel bermasalah**: ketemu solusi Vercel CLI sebagai jalur deploy langsung yang tidak bergantung webhook GitHub.

## 4. Kelemahan / Risiko yang Masih Ada

- **Auto-deploy GitHub→Vercel belum tentu pulih sendiri** — deploy terakhir berhasil lewat CLI manual, tapi integrasi Git di pengaturan Vercel belum dicek ulang (disconnect/reconnect). Kalau push berikutnya juga tidak ter-trigger otomatis, perlu langkah manual lagi.
- **`generate-preview.ts` masih punya input teks tanpa batas** (ceritaVisi/tantangan/target dikirim mentah-mentah ke Claude tanpa `.slice()`) — item lama dari audit scale-readiness, belum digarap karena di luar cakupan 8 item sesi ini.
- **Memoization/`useCallback` di Workspace.tsx belum digarap** — cuma lazy-loading yang selesai, potensi render berlebih di komponen besar masih ada.
- **QA end-to-end pasca-fix belum saya lakukan langsung** — saya verifikasi lewat pembacaan kode & build log, tapi belum coba klik-klik manual di situs live sebagai user Free/Pro/Platinum untuk pastikan ke-8 perubahan benar-benar tampil sesuai harapan di production.
- **Ketergantungan pada sandbox yang kadang stale** — selama proses ini saya beberapa kali menemukan tool internal saya menampilkan versi file yang tidak akurat; saya sudah verifikasi ulang lewat cara lain, tapi ini indikasi perlu dobel-cek kalau ada laporan aneh di masa depan.

## 5. Rekomendasi Langkah Berikutnya

1. QA manual singkat di `thehive-bisnis.com` sebagai user Free → Pro → Platinum, khusus cek 8 perubahan di atas.
2. Cek Settings → Git di Vercel dashboard, disconnect → reconnect repo `The-Hive` supaya auto-deploy dari push berikutnya normal lagi (tidak perlu CLI manual terus).
3. Kalau ada waktu: batasi panjang teks bebas di `generate-preview.ts` dan lanjutkan memoization `Workspace.tsx`.

---

**Soal akses langsung**: saya sudah punya akses baca/tulis ke folder proyek ini di komputermu dan bisa membuka Chrome untuk browsing (itu cara saya diagnosis & deploy tadi). Kalau kamu mau saya yang buka ChatGPT dan tempel dokumen ini langsung, saya bisa — tapi saya akan minta konfirmasi kamu dulu sebelum benar-benar mengirim pesan ke akun ChatGPT-mu (itu aturan keamanan standar). Paling praktis: copy isi file ini dan tempel sendiri ke GPT, atau bilang "buka ChatGPT-nya" kalau mau saya bantu langsung.
