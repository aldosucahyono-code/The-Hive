# Achievement Engine — Architecture Proposal (Tahap 2.4)

Status: **DRAFT — menunggu persetujuan Product Owner. Belum ada kode, belum ada tabel yang dibuat.**

Dokumen ini mengikuti prinsip yang sama dengan seluruh Business Engine: deterministik, tidak ada AI, tidak ada tebakan, dan additive-only terhadap database yang sudah ada.

---

## 1. Tujuan Achievement

Achievement bukan gamifikasi. Achievement adalah **bentuk apresiasi atas perkembangan bisnis pelanggan** yang sudah tercatat di Business Engine — supaya usaha kecil yang pelanggan lakukan (mengisi Business Update minggu demi minggu, menaikkan Business Health, bertahan menggunakan platform) terasa dilihat dan dihargai, bukan hilang begitu saja di dalam data.

Manfaat bagi pelanggan:
- Validasi bahwa konsistensi mereka (mengisi update setiap minggu) punya arti, bukan sekadar tugas administratif.
- Titik motivasi kecil di momen yang tepat (baru saja menaikkan Business Health, baru saja konsisten 4 minggu) — mendorong mereka tetap aktif memakai Workspace.
- Bahan cerita yang nanti bisa dibacakan AI Engine dengan nada yang lebih manusiawi ("Kamu berhasil mempertahankan kenaikan 4 minggu berturut-turut"), tanpa AI perlu menghitung apapun sendiri.

Manfaat bagi bisnis THE HIVE: retensi. Pelanggan yang merasa progressnya diakui lebih mungkin bertahan dan rutin mengisi Business Update — yang pada gilirannya membuat seluruh Business Engine (Health, Journey, Period) punya data yang lebih kaya.

---

## 2. Struktur Database (Additive-Only)

Dua tabel baru. Tidak ada `ALTER`, `DROP`, atau perubahan apapun pada tabel yang sudah ada.

### `achievement_definitions` (katalog — data referensi, bukan data pelanggan)

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid, PK | |
| `code` | text, unique | slug stabil, mis. `first_update`, `health_above_80` — dipakai kode, bukan `id`, supaya aman direfaktor |
| `category` | enum: `growth`, `business`, `engagement` | |
| `title_id`, `title_en` | text | judul bilingual (mengikuti pola `translations.ts` yang sudah ada, tapi disimpan di DB karena ini konten data, bukan UI chrome) |
| `description_id`, `description_en` | text | deskripsi singkat bilingual |
| `condition_type` | enum | lihat §3 — tipe pengecekan yang dipahami `evaluateAchievements()` |
| `condition_config` | jsonb | parameter untuk `condition_type`, mis. `{"dimension": "overall", "threshold": 80}` |
| `sort_order` | int | urutan tampil |
| `is_active` | boolean | supaya definisi bisa dinonaktifkan tanpa hapus data unlock yang sudah ada |

### `business_achievements` (data pelanggan — siapa membuka apa, kapan)

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid, PK | |
| `business_profile_id` | uuid, FK → `business_profiles.id` | konsisten dengan seluruh tabel Business Engine lain — Business Profile tetap pusat |
| `achievement_definition_id` | uuid, FK → `achievement_definitions.id` | |
| `unlocked_at` | timestamptz | |
| `source_ref` | jsonb, nullable | jejak opsional data yang memicu unlock (mis. `{"progress_snapshot_id": "..."}`) — untuk audit/debug, bukan untuk dibaca ulang oleh logic apapun |
| — | UNIQUE (`business_profile_id`, `achievement_definition_id`) | mencegah unlock ganda untuk achievement yang sama |

Tidak ada kolom skor atau angka yang dihitung ulang di sini — tabel ini hanya mencatat **keputusan** (unlocked atau belum), bukan **perhitungan**.

---

## 3. Cara Unlock — Tanpa Logika Baru

Prinsip: `evaluateAchievements(businessProfileId)` **membaca**, tidak pernah menghitung skor/metric baru. Ia hanya membandingkan angka yang SUDAH ada (dari `business_health`, `progress_snapshots`, `business_updates`, `business_metrics`) terhadap ambang batas yang tersimpan di `achievement_definitions.condition_config`.

Analoginya sama persis dengan `getHealthTrend.ts` yang baru dibangun untuk Growth: itu juga "hanya membaca dan membandingkan", bukan menghitung skor baru. Achievement mengikuti pola yang sama, satu tingkat lebih jauh (baca lalu putuskan unlock/tidak).

`condition_type` yang dibutuhkan untuk kategori di §4 (himpunan tetap, ditambah lewat kode kalau perlu tipe baru — bukan lewat data):

| condition_type | Sumber baca | Contoh config |
|---|---|---|
| `update_count_reached` | `business_updates` (count) | `{"count": 1}` → Update Pertama |
| `update_streak_weeks` | `progress_snapshots` (baris berurutan tanpa gap per `period_start` mingguan) | `{"weeks": 4}` → Konsisten 4 Minggu |
| `journey_delta_percent` | `progress_snapshots` (baseline vs latest, sama seperti `getProgress`) | `{"percent": 20}` → Journey +20% |
| `health_dimension_above` | `business_health` (baris terbaru per dimensi) | `{"dimension": "overall", "threshold": 80}` |
| `member_since_days` | `business_profiles.created_at` | `{"days": 30}` |

**Trigger point** (kapan `evaluateAchievements` dipanggil):
1. Di akhir `submitBusinessUpdate` (setelah `recalculateProgress`, pola yang sama seperti pemanggilan `recalculateBusinessHealth` → `recalculateProgress` yang sudah ada) — menangkap achievement kategori Growth & Business.
2. Saat Workspace dimuat (dipanggil bersama `getMembership`/`getBusinessHealth` yang sudah eager-fetch) — menangkap achievement berbasis waktu murni (`member_since_days`) yang bisa jadi benar tanpa ada Business Update baru. Proyek ini tidak punya cron job (Vercel Hobby, tanpa scheduled function), jadi titik pemuatan Workspace adalah kesempatan paling ringan untuk mengecek ini, tanpa infrastruktur baru.

Setiap pemanggilan idempoten: definisi yang sudah pernah di-unlock (dicek via `UNIQUE` constraint) dilewati, tidak dicatat dua kali.

**Respons ke frontend:** `submitBusinessUpdate` akan menyertakan `newlyUnlocked: [{code, titleId, titleEn}]` di response body kalau ada achievement baru terbuka saat itu juga — supaya Workspace bisa menampilkan notifikasi kecil yang related langsung dengan aksi yang baru saja pelanggan lakukan (bagian dari "Workspace terasa hidup" yang kamu minta), tanpa perlu polling terpisah.

---

## 4. Kategori Achievement (set awal, realistis dengan data yang ada hari ini)

### Growth
| Achievement | condition_type | Siap dari data yang ada? |
|---|---|---|
| Update Pertama | `update_count_reached` (1) | ✅ ya |
| Konsisten 4 Minggu | `update_streak_weeks` (4) | ✅ ya |
| Journey Meningkat 20% | `journey_delta_percent` (20) | ✅ ya |

### Business
| Achievement | condition_type | Siap dari data yang ada? |
|---|---|---|
| Business Health di Atas 80 | `health_dimension_above` (overall, 80) | ✅ ya |
| Target Tercapai | — | ⚠️ **belum bisa** — lihat catatan di bawah |

### Engagement
| Achievement | condition_type | Siap dari data yang ada? |
|---|---|---|
| 30 Hari Bersama THE HIVE | `member_since_days` (30) | ✅ ya (`business_profiles.created_at`) |
| Login Rutin | — | ⚠️ **belum bisa** — lihat catatan di bawah |

**Dua catatan jujur, bukan keputusan sepihak saya:**

- *Target Tercapai* tidak bisa dievaluasi hari ini karena target pelanggan disimpan sebagai teks bebas (`raw_input.target`, contoh: "omset saya ingin naik dan stabil untuk bayar karyawan") — bukan angka yang bisa dibandingkan. Mewujudkan achievement ini butuh Target jadi data terstruktur (mis. angka omset target) di masa depan, di luar scope Achievement Engine ini.
- *Login Rutin* butuh catatan riwayat sesi yang saat ini tidak disimpan di mana pun. Supabase Auth punya `last_sign_in_at` per user (bisa dipakai untuk cek "aktif baru-baru ini", tapi tidak cukup untuk "rutin" yang butuh histori beberapa titik waktu). Kalau achievement frekuensi login ini penting, akan butuh tabel pencatatan kunjungan ringan tambahan — saya usulkan ditunda sampai ada kebutuhan konkret, bukan dibangun sekarang secara spekulatif.

Saya sengaja tidak mengarang cara mengakali dua ini — sesuai prinsip "jangan fabrikasi data" yang sudah dipegang konsisten di `recalculateHealth.ts`.

---

## 5. Tampilan di Workspace

Dua opsi, saya perlu keputusanmu:

**Opsi A — Bagian di dalam tab Growth.** Achievement muncul sebagai strip/list kecil di bagian bawah Growth (setelah Growth Timeline). Lebih ringan (tidak menambah menu baru), dan secara naratif masuk akal karena Achievement memang "produk sampingan" dari data yang sama dengan Growth.

**Opsi B — Menu tersendiri di sidebar Workspace.** Lebih mudah ditemukan, tapi menambah satu menu lagi ke sidebar yang sudah cukup padat (7 menu saat ini).

**Rekomendasi saya: Opsi A.** Sejalan dengan prinsip "tidak ada menu yang cuma berisi sedikit konten" — kalau Achievement baru punya 3-5 kartu, itu terasa kurus sebagai menu sendiri, tapi pas sebagai penutup cerita di tab Growth yang sudah bercerita soal perjalanan bisnis.

Gaya tampilan (berlaku di kedua opsi): kartu sederhana — judul, deskripsi singkat, tanggal unlock. Tidak ada progress bar "X/Y badge", tidak ada ikon berkilau, tidak ada leaderboard. Hanya achievement yang **sudah terbuka** yang ditampilkan menonjol; achievement yang belum terbuka tidak perlu ditampilkan sama sekali di versi pertama ini (menghindari kesan "koleksi badge") — kalau nanti kamu ingin menunjukkan "achievement berikutnya yang bisa dikejar" sebagai motivasi, itu keputusan produk terpisah yang bisa didiskusikan setelah versi pertama berjalan.

---

## 6. Integrasi AI Engine (masa depan, belum dibangun)

Kontrak yang perlu dipegang nanti: AI Engine **membaca** `business_achievements` sebagai bagian dari konteks yang diberikan ke Claude API, persis seperti ia akan membaca output Business Health/Progress — bukan menghitung ulang, bukan memutuskan achievement apa yang terbuka. Achievement Engine tetap satu-satunya pemilik keputusan "terbuka atau tidak".

Contoh alur nanti: saat AI Engine menyusun narasi laporan, ia menerima daftar achievement yang terbuka dalam rentang waktu relevan (mis. minggu ini) sebagai bagian dari prompt context, lalu menuliskan kalimat apresiasi berdasarkan itu — seperti contoh yang kamu berikan ("Selamat! Anda berhasil mempertahankan peningkatan Business Health selama empat minggu berturut-turut."). Tidak ada perubahan skema yang dibutuhkan untuk ini — `business_achievements` sudah dalam bentuk yang siap dibaca kapan saja AI Engine tersebut mulai dibangun.

---

## 7. Kesiapan untuk Role Masa Depan (Super Admin, CS, Marketing, Employee Platform)

Desain ini sengaja tidak menghalangi pengembangan role-role tersebut nanti:

- Semua tabel di-scope lewat `business_profile_id`, konsisten dengan seluruh Business Engine — role manapun yang nanti butuh melihat achievement pelanggan (CS saat menangani tiket, Marketing untuk segmentasi kampanye "pelanggan yang baru mencapai Journey +20%") tinggal query dengan pola yang sudah familiar di seluruh codebase.
- `achievement_definitions` sebagai tabel katalog terpisah dari kode berarti Super Admin Platform (nanti) bisa mengelola daftar achievement (menambah, menonaktifkan, mengubah teks) lewat panel admin tanpa perlu deploy kode baru — cukup CRUD ke satu tabel.
- Tidak ada logika Achievement yang tertanam di komponen UI Workspace secara langsung — semuanya lewat service layer (`services/achievement/...`) dan action baru di router `/api/workspace`, pola yang sama seperti Business Engine — sehingga platform lain (Employee Platform, dsb.) yang nanti perlu membaca achievement bisa memanggil service yang sama, bukan menulis ulang logic.

---

## Ringkasan Keputusan yang Perlu Persetujuanmu

1. **Tampilan**: Opsi A (bagian dalam tab Growth) atau Opsi B (menu tersendiri)?
2. **Target Tercapai**: ditunda dulu (menunggu Target jadi data terstruktur) — setuju?
3. **Login Rutin**: ditunda dulu (belum ada tabel pencatatan sesi, tidak ingin dibangun spekulatif) — setuju, atau ingin saya rancang tabel pencatatan kunjungan ringan sekarang juga?
4. **Struktur tabel** di §2 dan `condition_type` di §3 — apakah sudah sesuai, atau ada penyesuaian?

Setelah keempat hal ini disetujui, saya lanjut ke implementasi mengikuti disiplin yang sama: Implementasi → Type Check → Testing → Commit → Push.
