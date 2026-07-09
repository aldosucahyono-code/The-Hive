# Achievement Engine — Architecture Proposal (Tahap 2.4)

Status: **ARSIP — digantikan oleh `ACHIEVEMENT-ENGINE-FINAL.md`.** Dokumen ini disimpan sebagai riwayat proses perancangan (v1 → v3) dan tidak lagi menjadi sumber kebenaran. Untuk dokumentasi resmi Achievement Engine yang berjalan di production (termasuk hasil Final Audit), lihat `ACHIEVEMENT-ENGINE-FINAL.md`.

Riwayat:
- v1 disetujui secara prinsip.
- v2: kategori lebih granular, difficulty tier, Next Milestone, metadata siap-AI, keputusan eksplisit soal Target Terstruktur & Login Rutin.
- v3 (dokumen ini): setiap achievement punya *business value* eksplisit, `priority` (dipakai mulai sekarang untuk memilih Next Milestone), Growth Timeline sekarang menggabungkan Business Update dan momen Achievement terbuka, metadata AI diperluas dengan `recommended_action_key`, serta catatan eksplisit soal kesiapan Super Admin, Analitik, dan Future Architecture untuk repeatable achievement. Migrasi tambahan: `migrations/2026-07-09_achievement_engine_refinements.sql` (dijalankan setelah migrasi pertama).

---

## 1. Tujuan Achievement

Achievement bukan gamifikasi. Achievement adalah **bentuk apresiasi atas perkembangan bisnis pelanggan** yang sudah tercatat di Business Engine — supaya usaha kecil yang pelanggan lakukan (mengisi Business Update minggu demi minggu, menaikkan Business Health, bertahan menggunakan platform) terasa dilihat dan dihargai, bukan hilang begitu saja di dalam data.

Manfaat bagi pelanggan: validasi bahwa konsistensi mereka punya arti; titik motivasi kecil di momen yang tepat; bahan cerita yang nanti bisa dibacakan AI Engine dengan nada lebih manusiawi tanpa AI perlu menghitung apapun sendiri.

Manfaat bagi THE HIVE: retensi — pelanggan yang merasa progressnya diakui lebih mungkin bertahan dan rutin mengisi Business Update, yang pada gilirannya memperkaya data Business Engine itu sendiri.

---

## 2. Struktur Database (Additive-Only)

Dua tabel baru. Tidak ada `ALTER`, `DROP`, `RENAME`, atau perubahan apapun pada tabel Business Engine yang sudah ada. SQL lengkap ada di `migrations/2026-07-09_achievement_engine.sql` (tabel + seed awal) dan `migrations/2026-07-09_achievement_engine_refinements.sql` (kolom tambahan v3 di bawah + seed data-nya) — keduanya menunggu kamu jalankan sendiri di Supabase, migrasi kedua setelah migrasi pertama (sesuai kesepakatan additive-only kita; migrasi kedua hanya menambah kolom baru ke tabel yang KITA buat sendiri di migrasi pertama, bukan tabel lama).

### `achievement_definitions` (katalog — data referensi, bukan data pelanggan)

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid, PK | |
| `code` | text, unique | slug stabil, mis. `first_update` — dipakai di kode, bukan `id` |
| `category` | enum | `business_growth`, `business_consistency`, `business_health`, `sales`, `finance`, `customer`, `marketing`, `brand`, `operations`, `milestone`, `future` |
| `difficulty` | enum | `bronze`, `silver`, `gold`, `platinum` — bukan untuk gamifikasi, tapi supaya pelanggan melihat ada tingkatan bertahap |
| `title_id`, `title_en` | text | judul bilingual |
| `short_description_id`, `short_description_en` | text | deskripsi singkat, dipakai di kartu |
| `long_description_id`, `long_description_en` | text, nullable | deskripsi lengkap, opsional untuk detail view |
| `celebration_message_id`, `celebration_message_en` | text, nullable | kalimat apresiasi siap-pakai saat achievement baru terbuka (data, bukan AI generatif) |
| `coach_message_id`, `coach_message_en` | text, nullable | kalimat motivasi singkat yang bisa dipakai AI Engine nanti sebagai referensi nada |
| `recommendation_key` | text, nullable | kunci referensi untuk AI Engine nanti menghubungkan achievement ke rekomendasi konten tertentu — belum dipakai sekarang |
| `business_value_id`, `business_value_en` *(v3)* | text, nullable | alasan bisnis mengapa achievement ini penting — bukan sekadar judul/deskripsi, tapi konteks: "kenapa ini berarti bagi bisnis Anda". Belum ditampilkan di Workspace sekarang; disiapkan supaya AI Engine nanti selalu punya sumber motivasi yang konsisten, bukan mengarang alasan sendiri. Contoh: `first_update` → "Anda telah memulai kebiasaan mengevaluasi bisnis secara rutin." |
| `priority` *(v3)* | enum | `critical`, `important`, `normal`, `motivational` — **dipakai mulai sekarang** (lihat §3, Next Milestone) untuk memilih achievement mana yang paling layak ditampilkan sebagai target berikutnya, bukan sekadar yang paling dekat |
| `recommended_action_key` *(v3)* | text, nullable | kunci referensi (bukan teks jadi) untuk AI Engine nanti menghubungkan achievement ke langkah bisnis berikutnya yang disarankan, mis. `health_above_80` → `focus_sales_customer_retention`. Belum dipakai kode manapun sekarang |
| `condition_type` | enum | lihat §3 |
| `condition_config` | jsonb | parameter untuk `condition_type`, mis. `{"threshold": 80}` |
| `sort_order` | int | urutan tampil |
| `is_active` | boolean | definisi yang sedang berjalan (bisa dicek otomatis) |
| `is_hidden` | boolean | definisi yang ada di katalog tapi belum ditampilkan/dievaluasi (dipakai untuk `target_completion`, `manual`, `future` yang statusnya *planned*) |
| `created_at`, `updated_at` | timestamptz | |

### `business_achievements` (data pelanggan — siapa membuka apa, kapan, karena apa)

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid, PK | |
| `business_profile_id` | uuid, FK → `business_profiles.id` | konsisten dengan seluruh tabel Business Engine — Business Profile tetap pusat |
| `achievement_definition_id` | uuid, FK → `achievement_definitions.id` | |
| `unlocked_at` | timestamptz | |
| `unlocked_by` | enum: `system`, `manual` | `system` = otomatis lewat evaluasi; `manual` = disediakan untuk Super Admin Platform nanti (mis. pemberian apresiasi khusus), tidak dipakai sekarang |
| `progress_value` | numeric, nullable | nilai terukur pada saat unlock (mis. skor 82 saat `business_health_score` tembus 80) — jejak audit, bukan input untuk logika apapun |
| `trigger_source` | text, nullable | pemicu evaluasi yang menghasilkan unlock ini, mis. `submitBusinessUpdate` atau `getAchievements` |
| `notes` | text, nullable | catatan bebas, kosong di v1 |
| — | UNIQUE (`business_profile_id`, `achievement_definition_id`) | mencegah unlock ganda |

Tidak ada kolom yang menyimpan skor yang *dihitung ulang* — tabel ini murni mencatat **keputusan** (unlocked, kapan, karena apa), bukan **perhitungan** baru.

### Future Architecture *(v3)* — Repeatable Achievement, belum dibangun

`business_achievements` **tetap** hanya satu baris per achievement (`UNIQUE(business_profile_id, achievement_definition_id)`, tidak diubah). Kalau suatu hari dibutuhkan achievement yang bisa diraih berkali-kali (mis. "30 hari konsisten" → "90 hari" → "365 hari" sebagai milestone berulang, bukan sekadar tingkatan berbeda), implementasinya lewat **tabel history terpisah** (mis. `business_achievement_unlocks_history`), bukan mengubah struktur `business_achievements`. Dicatat sebagai arah masa depan — tidak dibangun sekarang, tidak ada di migrasi v3.

---

## 3. Cara Unlock — Tanpa Logika Baru

Prinsip: evaluator **membaca**, tidak pernah menghitung skor/metric baru. Ia hanya membandingkan angka yang SUDAH ada terhadap ambang batas di `condition_config` — pola yang sama persis dengan `getHealthTrend.ts`.

### `condition_type` (v2 — lebih granular, satu tipe = satu pembaca data spesifik)

| condition_type | Sumber baca | Contoh config | Status |
|---|---|---|---|
| `business_updates_count` | `business_updates` (jumlah baris) | `{"threshold": 1}` → Update Pertama | ✅ implementasi sekarang |
| `business_updates_streak_weeks` | `progress_snapshots` (baris mingguan berurutan tanpa gap) | `{"threshold": 4}` → Konsisten 4 Minggu | ✅ implementasi sekarang |
| `business_health_score` | `business_health`, dimensi `overall` (rata-rata 6 dimensi) | `{"threshold": 80}` | ✅ implementasi sekarang |
| `sales_score` / `finance_score` / `customer_score` / `marketing_score` / `operations_score` / `brand_score` | `business_health`, dimensi spesifik | `{"threshold": 80}` | ✅ implementasi sekarang (satu checker digunakan ulang untuk 6 tipe ini, dibedakan lewat nama dimensi di `condition_type`, bukan lewat config) |
| `journey_growth` | `progress_snapshots` (baseline vs latest, sama seperti `getProgress`) | `{"thresholdPercent": 20}` | ✅ implementasi sekarang |
| `period_growth` | `progress_snapshots` (previous vs latest) | `{"thresholdPercent": 10}` | ✅ implementasi sekarang |
| `member_since_days` | `business_profiles.created_at` | `{"threshold": 30}` | ✅ implementasi sekarang |
| `target_completion` | *(butuh Structured Goal — lihat Lampiran A)* | — | ⏸️ planned, `is_hidden = true` |
| `manual` | *(diberikan manual lewat Super Admin nanti)* | — | ⏸️ planned, `is_hidden = true` |
| `future` | *(reserved, belum ada makna)* | — | ⏸️ planned, `is_hidden = true` |

### Urutan yang tidak boleh dibalik

```
Business Update → Business Health → Progress Engine → Achievement Engine
```

Achievement selalu ada di ujung rantai, tidak pernah di awal atau di tengah.

### Trigger point

1. **Akhir `submitBusinessUpdate`**, setelah `recalculateProgress` — menangkap semua achievement berbasis Business Update/Health/Progress.
2. **Awal `getAchievements`** (dipanggil saat Growth tab dibuka) — menangkap achievement berbasis waktu murni (`member_since_days`) yang bisa jadi benar tanpa Business Update baru. Proyek ini tidak punya cron job (Vercel Hobby), jadi titik baca ini adalah kesempatan paling ringan untuk mengecek tanpa infrastruktur baru. Ini tetap "membaca dan membandingkan" (`business_profiles.created_at` adalah data yang sudah ada), bukan menghitung metric baru.

Kedua titik pemanggilan idempoten (dijaga `UNIQUE` constraint) dan menjalankan fungsi evaluator yang sama persis: `evaluateAchievements(businessProfileId, triggerSource)`.

### Next Milestone *(v3 — priority-aware)*

Setiap evaluasi checker mengembalikan bukan cuma `met: boolean`, tapi juga `currentValue` dan `threshold`. Untuk achievement yang **belum** terbuka, engine menghitung `remainingRatio = (threshold - currentValue) / threshold` untuk semua definisi aktif yang belum unlock.

Sejak v3, pemilihan Next Milestone **tidak lagi murni** berdasarkan `remainingRatio` terkecil. Engine memilih dulu berdasarkan `priority` (`critical` > `important` > `normal` > `motivational`), baru `remainingRatio` sebagai tie-breaker di dalam priority yang sama. Ini sesuai arahan Product Owner: achievement `critical` yang tersisa 10% tetap diutamakan dibanding achievement `normal` yang tersisa 5%, karena secara bisnis lebih layak jadi target berikutnya. Belum ada UI kompleks (progress bar/skor) — struktur data (`priority` di setiap kandidat) sudah siap dipakai algoritma pemilihan maupun AI Engine nanti.

### Respons ke frontend

- `submitBusinessUpdate` menyertakan `newlyUnlocked: [{code, titleId, titleEn, celebrationMessageId, celebrationMessageEn}]` kalau ada achievement baru terbuka saat itu juga — dipakai Workspace untuk notifikasi kecil yang langsung terasa terkait aksi yang baru dilakukan.
- `getAchievements` mengembalikan `{ unlocked: [...achievement + unlockedAt], nextMilestone: {code, titleId, titleEn, currentValue, threshold, remainingRatio, priority} | null }`.

---

## 4. Kategori & Daftar Achievement Awal

| Achievement | category | difficulty | priority *(v3)* | condition_type | Status |
|---|---|---|---|---|---|
| Business Update Pertama | business_growth | bronze | critical | `business_updates_count` (1) | ✅ |
| Konsisten 4 Minggu Berturut-turut | business_consistency | silver | important | `business_updates_streak_weeks` (4) | ✅ |
| Journey Meningkat 20% | business_growth | gold | important | `journey_growth` (20%) | ✅ |
| Momentum Mingguan | business_growth | silver | normal | `period_growth` (10%) | ✅ |
| Business Health di Atas 80 | business_health | gold | critical | `business_health_score` (80) | ✅ |
| Sales Bertumbuh (Sales ≥ 80) | sales | silver | normal | `sales_score` (80) | ✅ |
| Finance Sehat (Finance ≥ 80) | finance | silver | important | `finance_score` (80) | ✅ |
| Pelanggan Bertambah (Customer ≥ 80) | customer | silver | normal | `customer_score` (80) | ✅ |
| 30 Hari Bersama THE HIVE | milestone | bronze | motivational | `member_since_days` (30) | ✅ |
| Target Omzet Tercapai | milestone | platinum | critical | `target_completion` | ⏸️ planned |
| *(reserved untuk marketing/operations/brand — ditambah begitu ada sinyal data untuk dimensi itu, sama seperti catatan di `recalculateHealth.ts`)* | marketing/operations/brand | — | — | `marketing_score` / `operations_score` / `brand_score` | ⏸️ planned, `is_hidden` sampai ada sinyal nyata |

Daftar ini hidup di data (`achievement_definitions`), bukan di kode — menambah achievement baru dengan `condition_type` yang sudah ada tidak butuh deploy, cukup `INSERT` baris baru. `priority` masing-masing ditetapkan berdasarkan seberapa penting achievement itu secara bisnis (mis. Business Update Pertama dan Business Health > 80 = `critical` karena keduanya fondasi; 30 Hari Bersama THE HIVE = `motivational` karena murni apresiasi loyalitas, bukan indikator kesehatan bisnis).

**Login Rutin — keputusan final: ditunda, tidak dibangun sekarang.** Tidak akan ada tabel `session_logs`/`visit_logs` dibuat hanya untuk satu achievement ini. Achievement kategori keterlibatan aplikasi (bukan keterlibatan bisnis) akan dipertimbangkan lagi saat Platform Analytics/Employee Platform benar-benar dibangun, dengan tabel yang memang bermanfaat untuk banyak fitur sekaligus — bukan tabel tunggal untuk satu badge.

---

## 5. Tampilan di Workspace — Struktur Growth (Final)

Achievement **tidak** menjadi menu baru. Ia menjadi bagian dari tab Growth, yang sekarang punya alur bercerita:

```
1. Journey Progress     — perjalanan sejak pertama bergabung
2. Period Progress      — minggu ini vs minggu lalu
3. Business Timeline    — riwayat Business Update + momen Achievement terbuka
4. Achievements         — pencapaian yang sudah diraih
5. Next Milestone       — pencapaian berikutnya yang paling layak (priority-aware)
```

Alur naratifnya: *saya berkembang → saya melihat progres → saya melihat riwayat perjalanan (termasuk momen saya diapresiasi) → saya melihat pencapaian → saya tahu target berikutnya.*

**Business Timeline *(v3)*:** sekarang menggabungkan `business_updates` dan `business_achievements` (unlock event), diurutkan kronologis berdasarkan tanggal, supaya Timeline benar-benar menceritakan perjalanan bisnis pelanggan — bukan cuma daftar Business Update yang terpisah dari momen ia diapresiasi. Murni menggabung & mengurutkan data yang sudah ada (masing-masing dari `getProgress`/`listUpdates` dan `getAchievements`), tidak ada tabel atau perhitungan baru. Kartu Business Update dan kartu Achievement dibedakan lewat gaya visual (border warna netral vs warna primer + ikon 🏆), bukan lewat mekanisme data terpisah.

Gaya tampilan: kartu sederhana, elegan, profesional. Judul, deskripsi singkat, tanggal unlock, label tier (Bronze/Silver/Gold/Platinum) ditulis sebagai teks kecil — bukan ikon berkilau atau badge bergaya game. Next Milestone tampil sebagai satu baris motivasi singkat, bukan progress bar mencolok, mis. "🎯 Tinggal 1 Business Update lagi untuk membuka *Konsisten 4 Minggu Berturut-turut*."

---

## 6. Integrasi AI Engine (masa depan, belum dibangun)

Kontrak yang perlu dipegang nanti: AI Engine **membaca** `business_achievements` (join `achievement_definitions` untuk `celebration_message_*`/`coach_message_*`/`recommendation_key`/`business_value_*`/`recommended_action_key`/`priority`) sebagai bagian dari konteks yang diberikan ke Claude API — bukan menghitung ulang, bukan memutuskan achievement apa yang terbuka.

Contoh: Beemo menyusun narasi laporan, menerima daftar achievement yang terbuka dalam rentang waktu relevan sebagai konteks, lalu menulis kalimat apresiasi berdasarkan `coach_message_id`/`coach_message_en` sebagai referensi nada, memakai `business_value_id`/`business_value_en` supaya alasan "kenapa ini penting" selalu konsisten (bukan dikarang ulang setiap kali), lalu menutup dengan saran langkah berikutnya berdasarkan `recommended_action_key` (mis. `first_update` → "Mulai ukur perkembangan bisnis setiap minggu"; `health_above_80` → "Mulai fokus meningkatkan Sales dan Customer Retention") — seperti contoh yang kamu berikan ("Selamat! Hari ini Anda berhasil membuka Achievement Business Consistency..."). Saat harus memilih achievement mana yang paling layak dibacakan dari beberapa yang terbuka sekaligus, AI Engine bisa memakai `priority` sebagai sinyal urutan, sama seperti Next Milestone. Tidak ada perubahan skema yang dibutuhkan untuk ini nanti — semua kolom AI-ready (termasuk yang baru di v3) sudah disiapkan sejak sekarang di `achievement_definitions`, belum ada satupun yang dipakai kode manapun.

---

## 7. Kesiapan untuk Role Masa Depan (Super Admin, CS, Marketing, Employee Platform)

- Semua tabel di-scope lewat `business_profile_id`, konsisten dengan seluruh Business Engine.
- `achievement_definitions` sebagai katalog terpisah dari kode berarti Super Admin Platform nanti bisa mengelola achievement (aktifkan/nonaktifkan, urutkan, ubah judul/deskripsi/`business_value_*`) lewat panel admin tanpa deploy kode baru.
- **Tidak ada satupun teks Achievement yang hardcoded di React** *(v3, ditegaskan)*: judul, deskripsi, business value, dan seluruh teks lain dibaca dari `achievement_definitions` lewat `getAchievements` — komponen Workspace (`GrowthPanel`, `GrowthTimeline`) hanya merender apa yang dikembalikan API, tidak pernah menyimpan string achievement di kode. Ini sudah berlaku sejak implementasi awal (v2), ditegaskan lagi di sini karena jadi prasyarat langsung Super Admin Platform bisa mengelola achievement tanpa deploy.
- `unlocked_by: 'manual'` sudah disiapkan sekarang supaya Super Admin nanti bisa memberikan achievement khusus tanpa perlu mengubah struktur tabel.
- Tidak ada logika Achievement yang tertanam di komponen UI — semuanya lewat service layer (`services/business/evaluateAchievements.ts`, `services/workspace/getAchievements.ts`), pola yang sama seperti Business Engine, sehingga platform lain nanti bisa memanggil service yang sama.
- Kategori (`marketing`, `operations`, `brand` sudah ada di enum sejak awal) memberi ruang achievement baru begitu dimensi itu punya sinyal data nyata, tanpa perlu migrasi skema lagi.

---

## 8. Kesiapan Analitik *(v3, belum dibangun dashboard-nya)*

Sejak awal, struktur `business_achievements` sudah mendukung analitik platform tanpa tabel tambahan — jumlah dan persentase pelanggan yang meraih tiap achievement bisa dihitung langsung:

```sql
select achievement_definition_id, count(*) as unlock_count
from business_achievements
group by achievement_definition_id;
-- persentase = unlock_count / total business_profiles aktif
```

Belum ada dashboard yang meminta ini sekarang — dicatat sebagai kesiapan struktural untuk Super Admin/Analytics Platform nanti, bukan pekerjaan yang dikerjakan di tahap ini.

---

## 9. Prinsip yang Tidak Berubah — Bukan Gamifikasi

Ditegaskan kembali (Product Owner review v3): Achievement **tidak** memakai XP, Level, Coin, atau Poin, dan tidak akan pernah memakainya. THE HIVE adalah Business Operating System, bukan platform game. Achievement hanyalah bentuk apresiasi atas perkembangan bisnis pelanggan — semua elemen baru di v3 (`priority`, `business_value_*`, `recommended_action_key`) tetap melayani prinsip ini: membuat apresiasi itu lebih bermakna dan lebih siap dibacakan AI dengan konsisten, bukan menambah lapisan gamifikasi.

---

## Lampiran A — Fondasi Structured Goal (Planned, Belum Dibangun)

Keputusan Product Owner: Target pelanggan saat ini (`raw_input.target`, teks bebas) **tetap dipertahankan apa adanya** — ini penting sebagai konteks bagi AI Engine nanti dan tidak boleh dihapus atau diganti. Namun ke depan, THE HIVE butuh **Target Terstruktur** (angka) supaya Business Engine dan AI Engine bisa mengukur pencapaian target secara presisi, tanpa pernah mencoba mem-parsing angka dari kalimat bebas.

Rancangan awal (dokumentasi saja — **tabel ini TIDAK termasuk dalam migrasi Achievement Engine v1**, menunggu giliran implementasi tersendiri):

```
business_goals
  id                uuid PK
  business_profile_id  uuid FK -> business_profiles.id
  goal_type          enum (omzet, pelanggan, repeat_order, transaksi, business_health, waktu/deadline)
  target_value       numeric
  target_unit        text
  deadline           date, nullable
  status             enum (active, achieved, missed, cancelled)
  created_at         timestamptz
  updated_at         timestamptz
```

Business Engine nanti membaca `business_goals` dengan cara yang sama seperti tabel lain (baca dan bandingkan, bukan menghitung ulang) untuk mengisi `target_completion` yang saat ini `is_hidden` di katalog Achievement. Wizard dan alur input tidak berubah sampai modul ini benar-benar mulai dikerjakan sebagai unit kerja terpisah, dengan proposalnya sendiri.

---

## Ringkasan Status

Disetujui untuk implementasi sekarang: §2–§6 (skema termasuk kolom v3, evaluator dengan Next Milestone priority-aware, katalog awal + priority, tampilan Growth dengan Timeline gabungan). Ditunda dengan jelas (bukan dilupakan): `target_completion` (Lampiran A), `manual` (menunggu Super Admin Platform), Login Rutin (menunggu Platform Analytics), repeatable achievement history table (§2, Future Architecture), dashboard analitik (§8, query pattern sudah didokumentasikan). Migrasi SQL: `migrations/2026-07-09_achievement_engine.sql` lalu `migrations/2026-07-09_achievement_engine_refinements.sql`, keduanya dijalankan oleh Product Owner sendiri di Supabase — bukan oleh Claude, dalam urutan tersebut.
