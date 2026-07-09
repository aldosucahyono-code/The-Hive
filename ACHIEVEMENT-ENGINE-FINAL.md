# Achievement Engine — Final Documentation (Tahap 2.4)

Status: **PRODUCTION READY.** Dokumen ini adalah referensi permanen untuk Achievement Engine THE HIVE — bukan proposal, tapi dokumentasi resmi dari apa yang benar-benar berjalan di production, setelah melalui Final Audit.

Riwayat: `ACHIEVEMENT-ENGINE-PROPOSAL.md` (v1 → v3) adalah dokumen perancangan yang dipakai selama pembangunan fitur ini — masih disimpan sebagai arsip sejarah keputusan, tapi sudah tidak lagi menjadi sumber kebenaran. Dokumen ini (`ACHIEVEMENT-ENGINE-FINAL.md`) menggantikannya sebagai referensi yang dipakai ke depan.

---

## 1. Tujuan

Achievement bukan gamifikasi. Achievement adalah **bentuk apresiasi atas perkembangan bisnis pelanggan** yang sudah tercatat di Business Engine — supaya konsistensi kecil yang pelanggan lakukan (mengisi Business Update, menaikkan Business Health, bertahan menggunakan platform) terasa dilihat dan dihargai. Tidak ada XP, Level, Coin, atau Poin — dan tidak akan pernah ada.

---

## 2. Struktur Database

Tiga file migrasi, dijalankan berurutan oleh Product Owner sendiri di Supabase (Claude tidak pernah mengeksekusi migrasi terhadap database):

1. `migrations/2026-07-09_achievement_engine.sql` — membuat tabel `achievement_definitions` (katalog) dan `business_achievements` (data pelanggan), plus seed 10 achievement awal.
2. `migrations/2026-07-09_achievement_engine_refinements.sql` — menambah kolom `business_value_id/en`, `priority`, `recommended_action_key` ke `achievement_definitions`.
3. `migrations/2026-07-09_achievement_engine_rls.sql` — mengaktifkan Row Level Security pada kedua tabel (ditemukan sebagai celah keamanan saat Final Audit — lihat §8).

### `achievement_definitions` (katalog — data referensi)

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid, PK | |
| `code` | text, unique | slug stabil, dipakai di kode |
| `category` | text + check | `business_growth`, `business_consistency`, `business_health`, `sales`, `finance`, `customer`, `marketing`, `brand`, `operations`, `milestone`, `future` |
| `difficulty` | text + check | `bronze`, `silver`, `gold`, `platinum` — bukan gamifikasi, sekadar penanda tingkatan |
| `priority` | text + check, default `normal` | `critical`, `important`, `normal`, `motivational` — dipakai untuk memilih Next Milestone |
| `title_id`, `title_en` | text | |
| `short_description_id`, `short_description_en` | text | |
| `long_description_id`, `long_description_en` | text, nullable | belum dipakai UI manapun |
| `business_value_id`, `business_value_en` | text, nullable | alasan bisnis kenapa achievement ini penting — **ditampilkan di kartu Achievement** |
| `celebration_message_id/en`, `coach_message_id/en`, `recommendation_key`, `recommended_action_key` | text, nullable | metadata siap-AI — data statis, belum dibaca AI Engine manapun (lihat §7) |
| `condition_type`, `condition_config` | text + check, jsonb | lihat §3 |
| `sort_order`, `is_active`, `is_hidden` | int, boolean | |

### `business_achievements` (data pelanggan)

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid, PK | |
| `business_profile_id` | uuid, FK → `business_profiles.id` | |
| `achievement_definition_id` | uuid, FK → `achievement_definitions.id` | |
| `unlocked_at`, `unlocked_by`, `progress_value`, `trigger_source`, `notes` | | `unlocked_by: manual` disiapkan untuk Super Admin nanti, belum dipakai |
| — | UNIQUE(`business_profile_id`, `achievement_definition_id`) | satu achievement hanya bisa unlock sekali per business |

Index: `idx_business_achievements_business_profile` pada `business_profile_id` (mendukung query utama: "achievement milik business ini").

**Future Architecture, dicatat tidak dibangun:** achievement yang bisa diraih berulang (mis. "30/90/365 hari konsisten") akan lewat tabel history terpisah, bukan mengubah `business_achievements`. Tabel `business_achievements` saat ini juga belum punya index pada `achievement_definition_id` sendiri — tidak masalah untuk pola akses hari ini (semua query di-scope per business_profile_id), tapi kalau nanti dashboard analitik Super Admin butuh `GROUP BY achievement_definition_id` lintas semua business, index tambahan itu perlu ditambahkan saat itu (additive, satu baris SQL, bukan sekarang).

---

## 3. Cara Kerja Evaluator — `evaluateAchievements()`

Prinsip: **membaca dan membandingkan, tidak pernah menghitung skor/metric baru**, tidak pernah memanggil AI, tidak pernah menebak.

### `condition_type` yang didukung

| condition_type | Sumber baca |
|---|---|
| `business_updates_count` | jumlah baris `business_updates` |
| `business_updates_streak_weeks` | baris mingguan berurutan di `progress_snapshots` |
| `business_health_score` | rata-rata skor 6 dimensi terbaru di `business_health` |
| `sales_score`/`finance_score`/`customer_score`/`marketing_score`/`operations_score`/`brand_score` | skor dimensi terbaru di `business_health` |
| `journey_growth` | baseline (baris pertama) vs latest `progress_snapshots` |
| `period_growth` | previous (baris kedua-dari-akhir) vs latest `progress_snapshots` |
| `member_since_days` | `business_profiles.created_at` |

`target_completion`, `manual`, `future` — planned, `is_hidden = true`, belum dievaluasi (lihat Lampiran A di proposal untuk `target_completion`).

### Urutan yang tidak boleh dibalik

```
Business Update → Business Health → Progress Engine → Achievement Engine
```

### Trigger point

1. Akhir `submitBusinessUpdate` (setelah `recalculateProgress`).
2. Awal `getAchievements` (saat Growth tab dibuka) — menangkap `member_since_days` yang bisa jadi benar tanpa Business Update baru.

Keduanya memanggil fungsi evaluator yang sama persis dan idempoten (dijaga `UNIQUE` constraint).

### Next Milestone (priority-aware)

Untuk achievement yang **belum** terbuka, dihitung `remainingRatio = (threshold - currentValue) / threshold`. Dipilih satu kandidat dengan `priority` tertinggi dulu (`critical` > `important` > `normal` > `motivational`), `remainingRatio` sebagai tie-breaker di dalam priority yang sama — bukan sekadar yang paling dekat secara angka.

Respons `NextMilestone` membawa `remaining` (sisa absolut, dibulatkan) dan `unitId`/`unitEn` (label satuan per `condition_type`, mis. "poin"/"%"/"hari"/"Business Update") supaya Workspace bisa menampilkan kalimat konkret: *"🎯 Tinggal 4 poin lagi untuk membuka Business Health di Atas 80."*

### Performa (hasil Final Audit — lihat §8)

Evaluasi satu business memeriksa hingga 9 definisi achievement aktif per pemanggilan. Query `business_health` (per dimensi) dan `progress_snapshots` (baseline/latest/previous) di-cache SEKALI per pemanggilan `evaluateAchievements()` lewat `healthCache`/`snapshotCache`, dan seluruhnya memakai `LIMIT 1`/`range()` — tidak ada query yang menarik seluruh histori tabel. Ini memastikan waktu evaluasi tidak bertambah lambat seiring bertambahnya jumlah Business Update (bertahun-tahun ke depan), hanya proporsional terhadap jumlah achievement definition aktif (yang bertambah sangat lambat/sengaja, bukan setiap minggu).

---

## 4. Tampilan di Workspace — Growth Tab

Achievement **bukan** menu baru — bagian dari tab Growth, urutan tetap:

```
1. Journey Progress
2. Period Progress
3. Business Timeline    — gabungan Business Update + momen Achievement terbuka, diurutkan kronologis
4. Achievements         — kartu: judul, deskripsi, business value (kalimat lebih personal), tier, tanggal unlock
5. Next Milestone       — satu kalimat konkret "tinggal X Y lagi"
```

Semua data pada kelima bagian ini berasal LANGSUNG dari respons `getProgress`/`getHealthTrend`/`listUpdates`/`getAchievements` — tidak ada perhitungan skor/metrik baru di React. Logika di komponen (`deltaLabel`, `deltaColor`, format tanggal) murni presentasi (tanda +/-, warna, format lokal), bukan logika bisnis.

Notifikasi unlock: toast kecil dismissible di pojok kanan bawah saat achievement baru terbuka (dari `newlyUnlocked` di respons `submitUpdate`), memakai `celebration_message_*` (fallback ke judul kalau kosong).

Gaya tampilan: kartu sederhana, elegan, profesional — tanpa badge berwarna per-tier, tanpa progress bar, tanpa XP/level/coin.

---

## 5. Bilingual

Seluruh teks statis (judul section, empty state, toast, template Next Milestone, label difficulty) melalui `translations.ts` (`id`/`en`) via `t.workspace.*`. Seluruh teks dinamis (judul/deskripsi/business value achievement, konten Business Update) berasal dari kolom `_id`/`_en` di database, dipilih lewat `lang === "id" ? ... : ...` di komponen. Tidak ada teks hardcoded satu bahasa yang tersisa di jalur Achievement Engine (dicek ulang saat Final Audit, lihat §8).

---

## 6. Integrasi AI Engine (masa depan, belum dibangun)

Kontrak yang harus dipegang nanti: AI Engine **membaca** `business_achievements` (join `achievement_definitions` untuk `celebration_message_*`/`coach_message_*`/`recommendation_key`/`business_value_*`/`recommended_action_key`/`priority`) sebagai konteks — tidak pernah menghitung ulang, tidak pernah memutuskan achievement apa yang terbuka. Semua kolom AI-ready ini sudah ada di skema sekarang; tidak ada migrasi tambahan yang dibutuhkan saat AI Engine mulai dibangun.

---

## 7. Kesiapan untuk Role Masa Depan

- Semua tabel di-scope lewat `business_profile_id`, konsisten dengan Business Engine.
- Tidak ada teks Achievement yang hardcoded di React — semua dibaca dari `achievement_definitions` lewat `getAchievements`. Super Admin Platform nanti bisa mengelola katalog (aktif/nonaktif, urutan, teks, business value) tanpa deploy kode baru.
- `unlocked_by: 'manual'` sudah disiapkan untuk Super Admin memberi achievement khusus.
- Analitik (jumlah/persentase pelanggan per achievement) bisa dihitung dari data yang sudah ada tanpa tabel baru:
  ```sql
  select achievement_definition_id, count(*) as unlock_count
  from business_achievements
  group by achievement_definition_id;
  ```
  Belum ada dashboard-nya — dicatat sebagai kesiapan struktural.

---

## 8. Final Audit — Ringkasan Temuan & Perbaikan

Audit dilakukan setelah Achievement Engine berjalan di production (diverifikasi lewat live test sungguhan: submit Business Update nyata, konfirmasi achievement ter-unlock, toast muncul, Timeline/Achievements/Next Milestone tampil benar).

| # | Area | Temuan | Tindakan |
|---|---|---|---|
| 1 | SQL Migration | `CREATE POLICY` di migrasi RLS tidak idempoten (standar Postgres tidak punya `IF NOT EXISTS` untuk policy) — beda dengan migrasi lain yang semuanya idempoten | Ditambahkan `DROP POLICY IF EXISTS` sebelum tiap `CREATE POLICY`. Tidak mengubah efek policy yang sudah aktif. |
| 1 | SQL Migration | RLS awalnya tidak aktif di `achievement_definitions`/`business_achievements`, berbeda dari seluruh tabel lain di skema (~20 tabel + RLS) — celah keamanan nyata (anon key bisa akses langsung lewat REST API Supabase) | Migrasi RLS baru ditulis & dijalankan: RLS aktif, policy SELECT-only scoped ke pemilik/authenticated. `service_role` tetap bypass RLS, backend tidak terpengaruh. |
| 2 | Service Layer | Diperiksa: `evaluateAchievements()` satu-satunya tempat logika unlock. `getAchievements()` hanya memanggilnya lalu membaca tabel — tidak ada logika evaluasi terduplikasi di tempat lain. | Tidak ada perubahan, sudah sesuai. |
| 3 | Performance | `getLatestOverallHealth()` menarik SELURUH histori `business_health` tanpa limit; checker `journey_growth`/`period_growth` menarik SELURUH histori `progress_snapshots` tanpa limit — keduanya tumbuh terus seiring bertambahnya Business Update, dan beberapa achievement men-query tabel yang sama berulang kali dalam satu evaluasi | Direfaktor: query dimensi/snapshot memakai `LIMIT 1`/`range()` (bounded), di-cache per pemanggilan (`healthCache`/`snapshotCache`) sehingga achievement yang berbagi sumber data tidak query berulang. Hasil evaluasi identik, hanya cara membacanya lebih efisien. |
| 4 | Workspace | Diperiksa seluruh render Growth tab: semua angka berasal dari respons API, tidak ada skor/metrik baru dihitung di React. | Tidak ada perubahan, sudah sesuai. |
| 5 | Translation | Diperiksa `GrowthPanel`/`GrowthTimeline`/toast: semua teks lewat `t.workspace.*` atau field bilingual dari database. | Tidak ada teks hardcoded ditemukan. |
| 6 | Timeline | `listUpdates` sudah dibatasi 20 baris terbaru; achievement dibatasi alami oleh ukuran katalog (~9, bertambah lambat). `GrowthTimeline` menerima data sebagai props dan menggabung/mengurutkan — struktur ini siap ditambah "load more" tanpa perlu menulis ulang logika gabung/urut. Belum diimplementasikan (belum dibutuhkan). | Dicatat sebagai kesiapan struktural, tidak ada perubahan kode sekarang. |
| 7 | AI Readiness | Diperiksa seluruh repo: satu-satunya pemanggilan Claude API ada di `services/beemo/chat.ts` (Chat Beemo, fitur terpisah yang sudah lama ada) — tidak ada kode AI Engine yang menyentuh Achievement Engine. Semua metadata AI-ready adalah data statis, belum dibaca kode manapun. | Tidak ada perubahan, sudah sesuai. |
| — | Presentasi | Feedback Product Owner setelah live test: kartu Achievement & Next Milestone terasa flat/teknis | `business_value_*` (sudah ada di DB sejak migrasi refinements) kini ditampilkan di kartu Achievement; Next Milestone kini memakai kalimat konkret ("Tinggal N X lagi") alih-alih judul polos. |

---

## 9. Definition of Done

- ✅ Migration tervalidasi (dijalankan sukses di production, idempotency diperbaiki)
- ✅ Service tervalidasi (evaluator tunggal, tidak ada duplikasi, query dioptimasi)
- ✅ Workspace tervalidasi (data 100% dari Business Engine, terverifikasi lewat live test)
- ✅ Type-check bersih (frontend `tsconfig.app.json` + backend strict standalone check)
- ✅ Tidak ada duplicate logic
- ✅ Tidak ada placeholder (Growth tab menampilkan empty state jujur, bukan "coming soon")
- ✅ Tidak ada technical debt yang diketahui (temuan performa & keamanan pada Final Audit sudah diperbaiki, bukan dibiarkan)
- ✅ Dokumentasi final selesai (dokumen ini)

**Achievement Engine (Tahap 2.4) dinyatakan Production Ready.**

*Di luar cakupan dokumen ini, sengaja ditunda (bukan dilupakan): Structured Goal/`business_goals` (Lampiran A di proposal lama), achievement `target_completion` & Login Rutin, repeatable-achievement history table, dashboard analitik Super Admin, integrasi AI Engine. Semua akan diajukan sebagai unit kerja terpisah saat gilirannya tiba sesuai roadmap.*
