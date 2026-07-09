status: DRAFT ARSITEKTUR — MENUNGGU REVIEW & PERSETUJUAN PRODUCT OWNER
tipe: Dokumen desain produk + teknis. TIDAK ADA kode/endpoint/tabel/migrasi yang dijalankan dari dokumen ini.
disusun sebagai jawaban gabungan atas: (1) "THE HIVE WORKSPACE V2 – PRODUCT TRANSFORMATION DIRECTIVE",
dan (2) "PRODUCTION DIRECTIVE — THE HIVE BUSINESS COMMAND CENTER". Kedua directive menggambarkan satu
visi yang sama dari dua sudut (produk & eksekusi), jadi digabung jadi satu dokumen supaya tidak ada
kontradiksi antar dokumen.
dasar pembacaan kode nyata (2026-07-09): src/components/Workspace.tsx (1749 baris, seluruh 7 panel),
services/business/create.ts (field business_stage yang SUDAH ADA hari ini), api/promote-draft.ts,
services/beemo/chat.ts, api/business.ts, plus referensi mockup visual yang dikirim Product Owner
(4 gambar: 2 varian Today Page "Stabil"/"Perlu Perhatian", 1 screenshot live production Business Score
tab, 1 mockup perbandingan Free/Pro/Platinum).

---

# THE HIVE — BUSINESS COMMAND CENTER ARCHITECTURE

## 0. Ringkasan Eksekutif & Prinsip yang Tidak Boleh Berubah

Titik tolak dokumen ini adalah kritik yang sangat tepat dari Product Owner: Workspace hari ini dibangun
berdasarkan **fitur** ("Business Score", "Report", "Target", "Growth", "History", "Competitor", "Chat"),
padahal yang dijual THE HIVE adalah **pendampingan**, bukan laporan. Mockup yang dikirim (Today Page
dengan Business Pulse, Mission Today, Checklist, Insight Beemo, Journey stepper) adalah representasi
visual yang tepat dari arah yang benar — dokumen ini merancang bagaimana itu dibangun di atas fondasi
yang sudah ada, tanpa membongkarnya.

**Perubahan paradigma inti:** Workspace berhenti menjadi Dashboard/BI Report, menjadi **Business Command
Center** — satu layar (**Today**) yang setiap pagi menjawab 5 pertanyaan dalam 30 detik pertama: apa
kondisi bisnis hari ini, apa yang harus dilakukan, apa risikonya, apa peluangnya, apa prioritas nomor
satu. Menu lama (Business Score, Report, Target, Growth, History, Competitor) **tidak hilang** — semua
tetap membaca Business Engine yang sama persis — tapi berpindah dari "menu utama" menjadi "halaman
pendukung" di bawah payung baru: **Insights**.

Lima prinsip berikut adalah non-negotiable, dikutip ulang dari kedua directive, dan menjadi filter untuk
setiap keputusan desain di seluruh dokumen ini:

1. **Business Engine tetap Source of Truth, tetap Frozen.** Tidak ada perhitungan baru, tidak ada skor
   baru, tidak ada "Business Engine kedua". Setiap tabel Business Engine yang sudah ada
   (`business_health`, `progress_snapshots`, `business_achievements`, `business_updates`, `subscriptions`)
   tidak disentuh sama sekali oleh dokumen ini.
2. **AI hanya membaca dan menjelaskan, tidak pernah menghitung.** Beemo mengubah fakta dari Business
   Engine menjadi insight/prioritas/rekomendasi/pendampingan — tidak pernah membuat angka sendiri.
3. **Semua layer baru (Business Stage Engine, Today Engine, Memory, Decision Journal) bersifat
   ADDITIVE** — tabel baru, terpisah total, tidak mengubah skema Business Engine yang ada.
4. **Tidak ada big bang rewrite.** Implementasi (kalau nanti disetujui) berjalan bertahap, dengan
   Quality Gate (Type Check, QA, migrasi, dokumentasi, commit granular, review) di setiap sub-fase.
5. **Domain Model, Business Flow, Membership, Payment Flow, Translation, Responsive UI — tidak boleh
   rusak.** Refactor komponen yang sudah ada boleh, tapi kontraknya (props, service call, tier-gating)
   harus tetap konsisten dengan yang sudah terbukti jalan.

Dokumen ini murni **desain** — 18 bagian di bawah menjawab persis 18 deliverable yang diminta. Tidak ada
implementasi yang dimulai sampai dokumen ini direview dan disetujui.

---

## 1. Business Operating System Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     BUSINESS ENGINE (FROZEN)                     │
│   business_profiles · business_updates · business_health         │
│   progress_snapshots · business_achievements · subscriptions      │
│   Deterministic. Zero AI. Sudah Production Ready.                │
└───────────────────────────┬────────────────────────────────────┘
                            │  READ ONLY (tidak pernah ditulis balik)
                            ▼
┌────────────────────────────────────────────────────────────────┐
│               BUSINESS STAGE ENGINE  (layer baru, §5)             │
│  Membaca fakta Business Engine → menentukan 1 dari 12 fase        │
│  bisnis. Murni aturan (rule-based), bukan AI, bukan opini.        │
└───────────────────────────┬────────────────────────────────────┘
                            │  Business Stage (mis. "OPERATIONS")
                            ▼
┌────────────────────────────────────────────────────────────────┐
│                    TODAY ENGINE  (layer baru, §4)                 │
│  Menggabungkan Business Stage + fakta Business Engine + AI        │
│  Engine → Mission Today, Priority, Opportunity, Risk, Checklist,   │
│  Reminder, Weekly Goal, Tomorrow Preview                           │
└───────────────────────────┬────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌───────────────────────────┐   ┌───────────────────────────────┐
│   BEEMO AI ENGINE           │   │   MEMORY / DECISION JOURNAL     │
│   (lihat BEEMO-AI-ENGINE-   │   │   (layer baru, terpisah, §8)    │
│   ARCHITECTURE.md)          │   │                                  │
│   Insight, narasi, Chat      │   │   Mengingat perjalanan bisnis,   │
└───────────────────────────┘   │   keputusan & hasilnya           │
                                 └───────────────────────────────┘
              │
              ▼
┌────────────────────────────────────────────────────────────────┐
│           BUSINESS COMMAND CENTER (Workspace UI, React)           │
│   Today (utama) · Journey · Business Updates · Insights ·         │
│   Competitor Intelligence · Decision Journal · Beemo AI            │
│   React tetap presentation layer murni — tidak ada logic/hitung   │
└────────────────────────────────────────────────────────────────┘
```

Empat layer baru (Business Stage Engine, Today Engine, Memory Layer, Decision Journal) semuanya duduk
**di atas** Business Engine, satu arah panah, sama persis dengan pola yang sudah dipakai AI Engine
(lihat `BEEMO-AI-ENGINE-ARCHITECTURE.md` §2). Tidak ada satu pun layer baru yang boleh dipanggil oleh
Business Engine — arah ketergantungan cuma satu arah, dari atas ke bawah membaca, tidak pernah
sebaliknya.

---

## 2. Workspace V2 UX Blueprint

### 2.1 Information Architecture baru

| Lama (flat, 7 tab) | Baru (Business Command Center) |
|---|---|
| Business Score | → pindah ke dalam **Insights** |
| Report | → pindah ke dalam **Insights** (referensi, bukan tujuan) |
| Target | → pindah ke dalam **Journey** (target adalah bagian dari perjalanan) |
| Competitor | → menjadi **Competitor Intelligence**, tab tersendiri (upgrade dari 1 paragraf generik, lihat §7) |
| Growth | → dipecah: progress/timeline masuk **Journey**, riwayat masuk **Business Updates** |
| History | → menjadi **Business Updates** (aktivitas & histori, penamaan yang lebih manusiawi) |
| Chat | → menjadi **Beemo AI**, tapi insight-nya juga hadir di semua panel lain (§13) |
| *(tidak ada)* | → **Today** — BARU, jadi halaman utama/beranda Workspace |
| *(tidak ada)* | → **Decision Journal** — BARU |

Struktur akhir sidebar (5 grup utama, sesuai arahan): **Today · Journey · Business Updates · Insights ·
Competitor · Decision Journal · Beemo AI**. Ini konsisten dengan mockup yang dikirim — sidebar di
mockup menunjukkan persis pola ini (Today, Journey, Business Updates, Insights, Competitor, Decision
Journal, Beemo AI, lalu Pengaturan di bagian bawah).

### 2.2 Hero Section (mengganti "Halo, {nama}")

Sesuai kritik langsung dari directive: hero tidak lagi sapaan kosong, tapi kondisi bisnis dalam satu
kalimat, diturunkan dari Business Pulse (§2.3):

| Kondisi Business Pulse | Contoh hero (bukan "Halo, Pasir!") |
|---|---|
| Stabil | "Bisnismu berjalan baik hari ini!" |
| Perlu Perhatian | "Siap menjalankan bisnis hari ini?" + ringkasan 1 kalimat alasan |
| Tindakan Diperlukan | "Ada yang perlu segera kamu tangani." |
| Pra-Launch (belum ada Business Update sama sekali) | "Hari ke-{N} menuju Launch" |

Sapaan nama (`Selamat pagi, {nama}!`) tetap ada sebagai baris kecil di atas hero, bukan dihapus total —
tetap personal, tapi tidak lagi jadi satu-satunya isi header (persis seperti kedua mockup yang
dikirim: "Selamat pagi, Pasir! 👋" kecil di atas, lalu headline besar "Bisnismu berjalan baik hari ini!").

### 2.3 Anatomi halaman Today (dari mockup, dipetakan ke sumber data nyata)

| Elemen di mockup | Sumber data (service yang SUDAH ADA) | Catatan |
|---|---|---|
| Business Pulse (badge 🟢/🟡/🔴 + 1 kalimat) | `getHealthTrend` (delta mingguan) + `business_updates` (hari sejak terakhir) + `progress_snapshots` (persen target) | Ambang sederhana, bukan skor baru — lihat §4.2 |
| Business Score 72/100 | `getBusinessHealth` (`health.overall`) — sama persis dengan `BusinessScorePanel` hari ini | Tidak dihitung ulang |
| Journey Progress 65% + "Fase: Operasional" | `getProgress` (journey) + **Business Stage Engine** (§5) untuk label fase | Fase BARU, progress-nya lama |
| Target Bulan Ini Rp72.5jt/Rp100jt | `progress_snapshots` (period) + `rawInput.target` — sama seperti `TargetPanel` hari ini | Tidak dihitung ulang |
| Update Terakhir "2 jam lalu" | `business_updates`, row terbaru | Sudah ada |
| Mission Today + tombol "Mulai Kerjakan"/"Tandai Selesai" | **Today Engine** (§4) | Baru |
| Insight dari Beemo | **AI Engine Recommendation Engine** (`BEEMO-AI-ENGINE-ARCHITECTURE.md` §3.5) | Baru, AI generatif tapi grounded |
| Checklist Hari Ini (progress "3/7 selesai") | **Today Engine**, item checklist dari **Business Stage Engine** template (§5.3) + centang tersimpan (§8 `daily_missions`) | Baru |
| "Yang Berubah Sejak Kemarin" (Omzet/Tritase/Marketing/Finance dengan delta) | `getHealthTrend` (delta per dimensi) + `business_updates` (delta omset) | Murni presentasi ulang, tidak ada hitungan baru |
| "Performa 7 Hari Terakhir" (chart garis) | `business_health`/`business_updates` historis, di-render ulang sebagai chart (bukan tabel angka) | Tidak ada hitungan baru — cuma visualisasi berbeda dari data yang sama |
| Insight/Opportunity Hari Ini | AI Engine, grounded di data Business Engine + kemungkinan input eksternal terbatas (mis. lokasi) — **catatan risiko**: contoh mockup ("proyek jalan provinsi", "kontraktor kecil di sekitar") menyiratkan data eksternal/observasi manusia yang BELUM ada sumbernya di Business Engine — lihat §16 Risk Analysis poin 1 |
| Reminder Penting (Business Update, Target, Achievement) | Gabungan sinyal dari `business_updates`, `progress_snapshots`, `evaluateAchievements` Next Milestone | Sudah ada semua datanya, tinggal dirangkai |
| Journey stepper horizontal (Persiapan→Soft Opening→Launching→Operasional→Growth→Scale Up→Sistemisasi→Automasi) | **Business Stage Engine** (§5) | Baru |

Baris terakhir yang penting: **hampir semua elemen di mockup sudah punya sumber data yang valid di
Business Engine hari ini.** Yang benar-benar baru hanya 3 hal: (a) label fase/stage, (b) checklist
harian, (c) narasi insight dari AI. Ini kabar baik — risiko teknis rendah karena mayoritas pekerjaan
adalah re-presentasi, bukan komputasi baru.

### 2.4 Sidebar dinamis per stage

Sesuai arahan "Sidebar juga harus berubah", sidebar tidak lagi 1 daftar tetap untuk semua orang.
Rancangan 3 varian (dipetakan dari kelompok 12-stage di §3 menjadi 3 kelompok tampilan sidebar supaya
tidak membuat sidebar terlalu ramai):

| Kelompok Stage | Sidebar yang tampil |
|---|---|
| IDEA, PREPARATION, PRE_LAUNCH, SOFT_OPENING | Today · Persiapan · Roadmap Launch · Brand & Supplier · Beemo AI |
| LAUNCH, OPERATIONS, GROWTH | Today · Journey · Business Updates · Insights · Competitor · Decision Journal · Beemo AI |
| EXPANSION, SCALE, SYSTEMIZATION, AUTOMATION | Today · KPI & Tim · Delegasi & SOP · Cabang/Ekspansi · Insights · Beemo AI |

`EXIT` sengaja tidak diberi sidebar khusus di v1 — dianggap kasus tepi (exit/akuisisi/tutup), di luar
scope pendampingan harian, cukup ditangani lewat Beemo AI secara kontekstual tanpa modul UI baru.

**Item sidebar "Today" dan "Beemo AI" SELALU ada di semua stage** — dua ini adalah konstanta, sisanya
adaptif. Ini technically diimplementasikan sebagai *filter* atas 1 daftar menu master (bukan 3 komponen
sidebar terpisah yang di-maintain manual) — lihat §11 Component Tree.

---

## 3. Business Journey Architecture

12 fase, urutan linear dengan kemungkinan tetap diam di 1 fase lama (tidak selalu maju):

| # | Stage | Definisi singkat | Sinyal objektif yang TERSEDIA hari ini |
|---|---|---|---|
| 1 | IDEA | Baru daftar, bisnis belum berjalan sama sekali | `business_profiles.business_stage = "idea"` (field yang SUDAH ADA, diisi wizard) |
| 2 | PREPARATION | Sedang menyiapkan (nama, legalitas, supplier, harga) | Belum ada `business_updates` sama sekali |
| 3 | PRE_LAUNCH | Persiapan mendekati selesai, tanggal launching direncanakan | Field `rencanaLaunching` dari wizard (sudah ada di `wizard_drafts`/`analyses.raw_input`) |
| 4 | SOFT_OPENING | Mulai jualan terbatas | Business Update pertama masuk, dengan sinyal skala kecil |
| 5 | LAUNCH | Resmi buka | Business Update ke-2/3 dengan `kondisi_penjualan` terisi konsisten |
| 6 | OPERATIONS | Berjalan rutin, belum tumbuh signifikan | Journey Progress delta relatif datar dalam beberapa minggu |
| 7 | GROWTH | Tumbuh konsisten | Journey Progress delta positif berkelanjutan (mis. 3+ minggu naik) |
| 8 | EXPANSION | Mulai menambah cabang/lini produk | **Tidak ada sinyal objektif hari ini** — butuh input eksplisit dari pelanggan |
| 9 | SCALE | Omset besar, mulai butuh tim/sistem | Business Health tinggi + konsisten tinggi dalam waktu lama |
| 10 | SYSTEMIZATION | Fokus SOP, delegasi | **Tidak ada sinyal objektif hari ini** — butuh input eksplisit |
| 11 | AUTOMATION | Sistem berjalan tanpa campur tangan harian pemilik | **Tidak ada sinyal objektif hari ini** — butuh input eksplisit |
| 12 | EXIT | Menutup/menjual bisnis | Tidak dirancang detail di v1 (lihat §2.4) |

**Temuan jujur dari audit ini (bukan asumsi):** Business Engine hari ini punya sinyal kuat untuk
membedakan stage 1-7 secara otomatis. Stage 8-11 (Expansion/Scale/Systemization/Automation) TIDAK bisa
dibedakan murni dari data yang ada — Business Health tinggi tidak otomatis berarti "sudah waktunya buka
cabang". Untuk stage-stage ini, desain mengharuskan **kombinasi sinyal otomatis + konfirmasi manual
dari pelanggan** (lihat §5.2). Ini didokumentasikan secara eksplisit di sini karena "jangan pakai
asumsi" adalah aturan tetap proyek — lebih baik jujur ada gap daripada berpura-pura Business Stage
Engine bisa "menebak" transisi yang datanya belum ada.

### 3.1 Checklist per kelompok stage (contoh konten, bukan final copy)

| Kelompok | Contoh isi checklist |
|---|---|
| Persiapan (1-4) | Tentukan nama usaha · Tentukan positioning · Cari supplier · Hitung modal · Tentukan harga · Buat branding/logo · Daftar domain · Buat Instagram · Google Business Profile · WhatsApp Business · Rencana Soft Opening |
| Berjalan (5-7) | Follow up pelanggan lama · Tambah reseller · Review margin · Audit stok · Evaluasi marketing · Isi Business Update · Upload dokumentasi · Review cashflow |
| Bertumbuh (8-11) | Rekrut Supervisor · Audit SOP · Buka cabang · Dashboard KPI · Struktur organisasi · Delegasi tugas rutin · Digitalisasi proses |

Checklist per stage adalah **template statis per kelompok** (dikonfigurasi sebagai data, bukan hardcode
di komponen React), bukan hasil AI generatif di v1 — supaya konsisten, predictable, dan murah. AI Engine
boleh MEMILIH mana yang ditonjolkan sebagai "Mission Today" dari daftar itu (lihat §4), tapi tidak
mengarang item checklist baru dari nol.

---

## 4. Today Engine Architecture

### 4.1 Kontrak input/output

```
TodayEngine.compute(businessProfileId) → TodaySnapshot {
  businessPulse: { level: "stable"|"attention"|"action_required", headline: string, reasons: string[] }
  missionToday: { title: string, description: string, sourceReason: string }
  priority: { dimension: string, label: string }
  opportunity: { title: string, description: string } | null
  risk: { title: string, description: string } | null
  checklist: { id: string, label: string, done: boolean }[]
  whatChangedSinceYesterday: { metric: string, value: string, delta: string }[]
  reminders: { type: "business_update_overdue"|"target_behind"|"achievement_near", label: string, urgency: "low"|"med"|"high" }[]
  tomorrowPreview: string | null
  weeklyGoal: string | null
  computedAt: string
  businessStage: string   // dari Business Stage Engine, §5
}
```

Input yang dibaca Today Engine — **seluruhnya lewat service yang sudah ada** (tidak ada query tabel
Business Engine langsung dari Today Engine, sama seperti aturan AI Engine di
`BEEMO-AI-ENGINE-ARCHITECTURE.md` §13):

`getBusinessHealth`, `getProgress`, `getHealthTrend`, `getAchievements` (untuk Next Milestone),
`getActiveMembership`, `business_updates` terbaru, **Business Stage Engine** (§5), dan (untuk narasi
Insight/Opportunity) **AI Engine Recommendation Engine**.

### 4.2 Business Pulse — logika ambang (bukan AI, bukan skor baru)

Business Pulse adalah **hasil dari beberapa ambang sederhana** terhadap angka yang sudah ada, bukan
model AI dan bukan skor baru:

| Kondisi | Level |
|---|---|
| Business Health delta ≥ 0 DAN Business Update dalam 7 hari terakhir DAN target on-track (≥ proporsional bulan berjalan) | 🟢 Stabil |
| Salah satu: Business Health turun 2 minggu berturut, ATAU Business Update 8-14 hari belum diisi, ATAU target tertinggal >20% dari proporsional | 🟡 Perlu Perhatian |
| Business Update >14 hari belum diisi, ATAU Business Health turun tajam (>10 poin) dalam 1 minggu, ATAU membership `expired` | 🔴 Tindakan Diperlukan |

Ambang di atas adalah **usulan awal untuk didiskusikan**, bukan angka final — poin pentingnya adalah
logikanya deterministik dan bisa dijelaskan ke pelanggan/tim, bukan black-box.

### 4.3 Caching & recompute

`TodaySnapshot` dihitung **sekali per hari per bisnis**, disimpan di tabel `today_snapshot` (§8), dan
di-invalidate lebih awal kalau ada event penting: Business Update baru disimpan (`submitUpdate.ts`
selesai), atau checklist item ditandai selesai. Ini konsisten dengan pola caching yang sudah diusulkan
di `BEEMO-AI-ENGINE-ARCHITECTURE.md` §16 — event-driven invalidation, bukan cuma time-based.

---

## 5. Business Stage Engine Architecture

### 5.1 Prinsip

Business Stage Engine adalah **layer baru, read-only**, mengikuti pola arsitektur yang identik dengan
AI Engine Context Builder. Ia tidak pernah menulis ke `business_profiles.business_stage` (kolom lama,
frozen) — ia menghasilkan stage-nya sendiri ke tabel baru terpisah, `business_stage_state` (§8), supaya
tidak ada risiko menyentuh Domain Model yang sudah ada.

### 5.2 Model penentuan stage: hybrid (otomatis + konfirmasi manual)

Karena §3 menemukan bahwa stage 1-7 punya sinyal objektif tapi stage 8-11 tidak, rancangan bukan murni
inferensi otomatis:

1. **Onboarding**: pelanggan sudah menjawab `jenisAnalisis` ("baru"/"berjalan") di wizard — ini jadi
   titik awal (`IDEA` atau langsung ke estimasi `OPERATIONS`, tergantung sinyal lain).
2. **Auto-progression** untuk stage 1-7: dihitung ulang tiap kali Business Stage Engine dipanggil
   (idealnya dipicu bersamaan Today Engine), berdasar tabel sinyal di §3.
3. **Manual confirmation/override** untuk transisi ke stage 8+ (dan sebagai tombol "koreksi" kalau
   pelanggan merasa stage-nya salah dideteksi) — pelanggan bisa menekan "Saya sudah di fase Ekspansi"
   di Journey tab, tersimpan sebagai override eksplisit yang mengalahkan hasil otomatis sampai override
   berikutnya.

Ini penting secara jujur diakui: **Business Stage Engine v1 tidak akan 100% akurat secara otomatis** —
dan itu tidak apa-apa, selama pelanggan selalu punya kontrol untuk mengoreksi, dan sistem transparan
soal ini (bukan mengklaim "AI tahu persis fase bisnismu").

### 5.3 Output

```
BusinessStageResult {
  stage: "IDEA"|"PREPARATION"|...|"AUTOMATION"|"EXIT"
  stageGroup: "persiapan"|"berjalan"|"bertumbuh"
  since: string           // kapan mulai di stage ini
  source: "auto"|"manual_override"
  checklistTemplateId: string   // referensi ke §3.1
}
```

---

## 6. Daily Operating Loop

```
Pelanggan buka THE HIVE
   ↓
Lihat Today (Business Pulse, Mission Today, Checklist)
   ↓
Kerjakan checklist / kerjakan Mission Today
   ↓
Isi Business Update (kalau relevan hari itu)
   ↓
submitUpdate.ts: Business Engine recalculate
   (recalculateBusinessHealth → recalculateProgress → evaluateAchievements — TIDAK BERUBAH, frozen)
   ↓
Event "business engine updated" → invalidate today_snapshot + business_stage_state cache
   ↓
Today Engine + Business Stage Engine recompute (lazy, saat snapshot berikutnya diminta)
   ↓
Besok: Today berubah — Mission baru, Pulse mungkin berubah, checklist baru
   ↓
Pelanggan kembali karena penasaran apa yang berubah
```

Loop ini adalah alasan retensi harian: **yang berubah bukan cuma angka, tapi apa yang diminta dilakukan
hari itu** — ini yang membedakan Command Center dari dashboard biasa.

---

## 7. UI Wireframe Lengkap Setiap Fase Bisnis

### 7.1 Stage: Persiapan (IDEA/PREPARATION/PRE_LAUNCH/SOFT_OPENING)

```
==================================================================
 Selamat pagi, {nama}!
 Hari ke-{N} menuju Launch
------------------------------------------------------------------
 BUSINESS PULSE: 🟡 Persiapan   Progress Fase Persiapan: 28%
------------------------------------------------------------------
 MISSION TODAY
 Tentukan nama usaha & buat akun Google Business
------------------------------------------------------------------
 CHECKLIST HARI INI                          0/3 selesai
 □ Tentukan nama usaha
 □ Buat logo sederhana
 □ Buat akun Google Business
------------------------------------------------------------------
 NEXT STEP
 Setelah ini, tentukan target pasarmu.
==================================================================
```
(Sidebar: Today · Persiapan · Roadmap Launch · Brand & Supplier · Beemo AI — TIDAK ada Business
Score/Growth/Competitor, karena belum relevan, sesuai kritik langsung di directive.)

### 7.2 Stage: Berjalan (LAUNCH/OPERATIONS/GROWTH) — sudah tervalidasi di mockup

```
==================================================================
 Selamat pagi, Pasir! 👋
 Bisnismu berjalan baik hari ini!
------------------------------------------------------------------
 BUSINESS PULSE      BUSINESS SCORE    JOURNEY    TARGET    UPDATE
 🟢 Stabil            72/100            65%        72,5jt/   2 jam
                                        Operasional 100jt     lalu
------------------------------------------------------------------
 MISSION TODAY                          | INSIGHT DARI BEEMO
 Follow up 5 kontraktor aktif            | Omzet naik 12%, peluang
 [Mulai Kerjakan] [Tandai Selesai]        | terbesar di area Lumajang.
------------------------------------------------------------------
 CHECKLIST HARI INI    3/7   | YANG BERUBAH SEJAK KEMARIN
 ✓ Kirim penawaran HJG        | Omzet +12%  Tritase +8%
 ✓ Follow up supplier         | Marketing +4  Finance +3
 ✓ Update omzet hari ini      |
 □ Upload foto dokumentasi    | PERFORMA 7 HARI TERAKHIR
 □ Cek stok pasir             | [chart garis]
------------------------------------------------------------------
 JOURNEY: Persiapan✓ Soft Opening✓ Launching✓ (●Operasional) Growth
          Scale Up  Sistemisasi  Automasi
==================================================================
```
(Ini adalah struktur yang SUDAH divalidasi lewat mockup — dokumen ini mengonfirmasi setiap elemennya
punya sumber data nyata, lihat tabel pemetaan di §2.3.)

### 7.3 Stage: Bertumbuh (EXPANSION/SCALE/SYSTEMIZATION/AUTOMATION)

```
==================================================================
 Selamat pagi, {nama}!
 Cabang kedua sudah siap. Cashflow sehat.
------------------------------------------------------------------
 BUSINESS PULSE: 🟢 Excellent
------------------------------------------------------------------
 MISSION TODAY
 Mulai dokumentasikan SOP operasional cabang pertama
------------------------------------------------------------------
 CHECKLIST HARI INI
 □ Rekrut Supervisor
 □ Audit SOP
 □ Review struktur organisasi
==================================================================
```
(Sidebar: Today · KPI & Tim · Delegasi & SOP · Cabang/Ekspansi · Insights · Beemo AI.)

---

## 8. Database Schema Baru (seluruhnya additive)

| Tabel (usulan) | Kolom inti | Catatan |
|---|---|---|
| `business_stage_state` | `business_profile_id`, `stage`, `stage_group`, `source` ('auto'/'manual_override'), `since`, `updated_at` | 1 baris aktif per bisnis, histori transisi disimpan sebagai baris baru (pola sama seperti `business_health` — tidak overwrite, insert baris baru per perubahan) |
| `today_snapshot` | `business_profile_id`, `snapshot_date`, `payload` (jsonb — bentuk `TodaySnapshot` §4.1), `computed_at` | 1 per bisnis per hari; index `(business_profile_id, snapshot_date)` |
| `daily_missions` / `checklist_items` | `business_profile_id`, `stage_group`, `item_key`, `label_id`, `label_en`, `done`, `done_at` | Status centang checklist persisten antar sesi |
| `business_memory` | `business_profile_id`, `category` ('goal'/'style'/'strategy'/'decision'/'avoid'), `content`, `created_at`, `superseded_by` | Sesuai desain di `BEEMO-AI-ENGINE-ARCHITECTURE.md` §3.3/§7 |
| `decision_journal` | `business_profile_id`, `decision_date`, `problem`, `options`, `decision`, `reason`, `health_snapshot_ref`, `ai_recommendation`, `status`, `outcome_reviewed_at`, `outcome_notes` | Review otomatis dijadwalkan 30 hari setelah `decision_date` (lewat scheduled task, bukan trigger DB) |
| `ai_recommendations` | `business_profile_id`, `generated_at`, `payload` (jsonb), `confidence` | Cache output Recommendation Engine (`BEEMO-AI-ENGINE-ARCHITECTURE.md` §8) |

Semua tabel baru: RLS aktif sejak awal (`business_profile_id IN (SELECT id FROM business_profiles WHERE
user_id = auth.uid())`), pola identik dengan migrasi RLS Achievement Engine yang sudah terbukti jalan di
production. Tidak satu pun mengubah kolom/tabel Business Engine yang sudah ada.

---

## 9. API Contract

Mengikuti pola action-dispatch router yang sudah ada (hemat function-count Vercel Hobby):

| Router (usulan) | Action | Deskripsi |
|---|---|---|
| `api/today.ts` (baru) | `getSnapshot` | Ambil/compute `TodaySnapshot` untuk 1 bisnis |
| `api/today.ts` | `completeChecklistItem` | Tandai 1 item checklist selesai |
| `api/stage.ts` (baru, atau digabung ke `api/today.ts`) | `getStage` | Ambil stage aktif |
| `api/stage.ts` | `overrideStage` | Konfirmasi/override manual stage |
| `api/decisions.ts` (baru) | `list` / `create` / `reviewOutcome` | CRUD Decision Journal |
| `api/beemo.ts` (sudah ada) | `getRecommendation` (diusulkan di `BEEMO-AI-ENGINE-ARCHITECTURE.md` §11) | Insight yang dipakai di semua panel (§13) |

Menambah maksimal 2-3 file router baru (bukan 1 per action) — tetap disiplin terhadap limit 12
Serverless Function Vercel Hobby yang sudah jadi kendala nyata di proyek ini.

---

## 10. Service Layer

```
services/today/
  computeSnapshot.ts     // orkestrator: panggil Business Stage Engine + Business Engine reads + AI Engine
  completeChecklist.ts
services/stage/
  determineStage.ts       // Business Stage Engine — murni rule-based, TIDAK memanggil Claude API
  overrideStage.ts
services/decisions/
  createDecision.ts
  reviewOutcome.ts
  listDecisions.ts
services/ai/               // dari BEEMO-AI-ENGINE-ARCHITECTURE.md §10
  buildContext.ts
  composePrompt.ts
  recommend.ts
  memory/
```

`determineStage.ts` sengaja **tidak memanggil Claude API sama sekali** — murni fungsi deterministik dari
data Business Engine (§5), supaya cepat, murah, dan bisa dipanggil sesering mungkin tanpa biaya AI.

---

## 11. React Component Tree

```
<Workspace>
  <WorkspaceShell>
    <DynamicSidebar stage={businessStage} />          // filter dari 1 master menu list, §2.4
    <HeroSection pulse={todaySnapshot.businessPulse} />
    <Router activeMenu>
      <TodayPage>                                      // BARU, halaman utama
        <BusinessPulseCard />
        <QuickStatsRow>                                 // Score / Journey / Target / Update Terakhir
          <BusinessScoreMini /> <JourneyMini /> <TargetMini /> <LastUpdateMini />
        </QuickStatsRow>
        <MissionTodayCard />
        <BeemoInsightCard />                             // §13
        <ChecklistTodayPanel />
        <WhatChangedCard />
        <PerformanceChart7d />
        <OpportunityCard /> <RiskCard />
        <ReminderList />
        <JourneyStepperMini />
      </TodayPage>
      <JourneyPage>                                     // gabungan Target lama + Growth Timeline lama
        <JourneyStepperFull />
        <TargetProgressPanel />          {/* reuse TargetPanel logic */}
        <GrowthTimeline />                 {/* REUSE komponen existing, tidak ditulis ulang */}
      </JourneyPage>
      <BusinessUpdatesPage>                              {/* reuse HistoryList + update form */}
      <InsightsPage>
        <BusinessScorePanel />             {/* REUSE existing component */}
        <ReportPanel />                    {/* REUSE existing component */}
        <ForecastPanel />                  {/* baru, opsional, lihat SMART-WORKSPACE-EVOLUTION.md §5.4 */}
      </InsightsPage>
      <CompetitorIntelligencePage />       {/* upgrade dari CompetitorPanel lama, §7 arahan Command Center */}
      <DecisionJournalPage />              {/* BARU */}
      <BeemoAIPage />                      {/* REUSE ChatBeemoPanel, dengan Context Builder lebih kaya */}
    </Router>
  </WorkspaceShell>
</Workspace>
```

Penekanan penting: `BusinessScorePanel`, `ReportPanel`, `GrowthTimeline`, `HistoryList`,
`ChatBeemoPanel` — **semua komponen yang sudah ada dipakai ulang (reuse), bukan ditulis ulang.** Mereka
cuma pindah lokasi dalam information architecture (dari tab mandiri menjadi sub-bagian dari
Today/Journey/Insights), sesuai instruksi eksplisit "gunakan sebanyak mungkin komponen yang sudah ada."

---

## 12. State Management Flow

- `WorkspaceContext` (React context, sudah ada pola serupa lewat state `activeBusinessId` di
  `Workspace()` hari ini) diperluas menyimpan: `activeBusinessId`, `businessStage`, `todaySnapshot`.
- Saat bisnis aktif berganti (`BusinessSwitcher`, sudah ada) → invalidate & refetch `businessStage` dan
  `todaySnapshot` untuk bisnis baru — pola fetch-on-switch yang sudah dipakai untuk `latestPreview`/
  `businessHealth` hari ini, diperluas saja.
- Saat checklist item ditandai selesai atau Business Update baru disimpan → optimistic update di state
  lokal + panggil ulang `getSnapshot` di background untuk sinkronisasi (bukan full page reload).
- Tidak ada state Business Engine (Health/Progress/Achievement) yang di-cache lebih lama dari sesi
  React — cache "beneran" (lintas request) hidup di server (`today_snapshot` table), bukan di client.

---

## 13. AI Integration Flow — Beemo hadir di seluruh Workspace

Sesuai arahan "Beemo tidak hanya hidup di menu Chat", desain agar Beemo insight muncul di banyak panel
TANPA memanggil Claude API berkali-kali per halaman (mahal & lambat):

1. **Satu payload, banyak tampilan.** `getRecommendation` (§9) dipanggil SEKALI per snapshot harian
   (dicache di `ai_recommendations`, §8), menghasilkan objek dengan beberapa slot narasi: insight umum
   (Today), penjelasan Business Score (kenapa naik/turun), strategi Target, insight Growth, dampak
   Competitor. Setiap panel menampilkan **slot yang relevan** dari payload yang sama — bukan trigger
   panggilan Claude API baru tiap panel dibuka.
2. Field `confidence` (dari `BEEMO-AI-ENGINE-ARCHITECTURE.md` §8) tetap dibawa ke setiap slot, supaya
   panel manapun yang menampilkan insight tetap transparan soal batas keyakinannya.
3. Chat Beemo (percakapan bebas) tetap request-per-giliran seperti sekarang — hanya konteksnya
   diperkaya (lihat `BEEMO-AI-ENGINE-ARCHITECTURE.md` §20 Fase 1).

---

## 14. Migration Plan

Urutan migrasi (semua additive, mengikuti pola `CREATE TABLE IF NOT EXISTS` + `DROP POLICY IF EXISTS`
sebelum `CREATE POLICY` yang sudah terbukti dari migrasi Achievement Engine):

1. `business_stage_state` + RLS
2. `today_snapshot` + RLS
3. `daily_missions`/`checklist_items` + RLS
4. `business_memory` + RLS (bisa paralel dengan AI Engine Fase 3, lihat `BEEMO-AI-ENGINE-ARCHITECTURE.md` §20)
5. `decision_journal` + RLS
6. `ai_recommendations` + RLS

Setiap migrasi tetap dijalankan MANUAL oleh Product Owner di Supabase SQL Editor (Claude menulis SQL,
tidak pernah mengeksekusi — aturan tetap proyek), setelah masing-masing file ditinjau.

---

## 15. Incremental Implementation Roadmap

Dipetakan 1:1 ke urutan prioritas yang diminta di "PRODUCTION DIRECTIVE — BUSINESS COMMAND CENTER":

| Fase | Deliverable | Bergantung pada |
|---|---|---|
| 1 | Business Command Center (Today Page) — versi awal tanpa AI insight, cuma Business Pulse (ambang sederhana) + quick stats reuse | `today_snapshot`, `business_stage_state` (versi stage sederhana dulu: idea/running dari kolom lama, BUKAN 12 stage penuh) |
| 2 | Mission Today | Today Engine dasar, checklist template statis per stage_group |
| 3 | Business Pulse (penyempurnaan ambang, lihat §4.2) | — |
| 4 | Hero Workspace | Pulse dari fase 3 |
| 5 | Stage-based Workspace (12 stage penuh + hybrid manual override) | `business_stage_state` diperluas dari fase 1 |
| 6 | Dynamic Sidebar | Fase 5 |
| 7 | Integrasi seluruh menu (Journey/Insights/Business Updates konsolidasi) | Reuse komponen existing, §11 |
| 8 | Beemo Embedded Insight | `ai_recommendations`, `BEEMO-AI-ENGINE-ARCHITECTURE.md` Fase 1-2 |
| 9 | Penyempurnaan UI/UX | Semua fase di atas |
| 10 | Optimasi performa | Setelah semua fitur ada baseline untuk diukur |

Setiap fase = 1 siklus Four-Artifact Rule penuh (§18) sebelum lanjut ke fase berikutnya — tidak boleh
menumpuk beberapa fase tanpa checkpoint review.

---

## 16. Risk Analysis

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Business Stage Engine salah mendeteksi fase (khususnya stage 8-11 yang tanpa sinyal objektif, §3) | Checklist/Mission tidak relevan, pelanggan bingung | Model hybrid (§5.2): auto untuk stage bersinyal kuat, manual override selalu tersedia dan menonjol di UI |
| Opportunity/Risk card di mockup menyiratkan data eksternal (lokasi proyek, aktivitas kompetitor) yang belum ada sumbernya | AI berpotensi "mengarang" insight yang terdengar spesifik tapi tidak grounded | Batasi versi awal insight hanya dari data Business Engine murni (delta angka, hari sejak update) — insight yang butuh data eksternal (lokasi, tren pasar) ditunda sampai ada sumber data yang jelas dan disetujui terpisah |
| Biaya AI naik karena insight tampil di banyak panel | Cost per pelanggan aktif naik | Satu payload/hari dicache (§13), bukan panggilan per panel |
| Redesign sidebar membingungkan pelanggan existing yang sudah terbiasa 7 tab lama | Churn jangka pendek/kebingungan navigasi | Rollout bertahap (§15), pertimbangkan tooltip/announcement satu kali saat sidebar baru tayang |
| Big bang rewrite tanpa disadari (scope creep karena banyaknya ide) | Business Engine ikut berisiko rusak, hutang teknis | Roadmap fase eksplisit dengan Quality Gate wajib per fase (§18), dilarang lompat fase |
| Tabel baru (`today_snapshot`, dll) tumbuh besar tanpa retention policy | Storage/performa jangka panjang | Pertimbangkan retention (mis. snapshot >90 hari diarsipkan/dihapus) — didesain saat implementasi, dicatat sebagai follow-up, bukan diputuskan di dokumen ini |

---

## 17. Backward Compatibility Plan

- Semua komponen lama (`BusinessScorePanel`, `ReportPanel`, `TargetPanel`, `CompetitorPanel`,
  `GrowthTimeline`, `HistoryList`, `ChatBeemoPanel`) **tetap dipakai (reuse)** — tidak ada fitur yang
  hilang dari sisi data, hanya lokasi dalam IA yang berubah.
- Hash-routing (`hardNavigate`, dipakai untuk full-reload routing hari ini) perlu peta redirect: hash
  lama yang mengarah ke tab tertentu (kalau ada yang bookmark/share link langsung ke tab) diarahkan ke
  lokasi barunya di Today/Journey/Insights.
- Membership/tier-gating logic (`getActiveMembership`, cek `tier==="free"` dsb.) dipakai ulang persis,
  hanya diterapkan di lokasi UI baru — kontrak fungsinya tidak berubah.
- Translation (`t.workspace.*`) diperluas dengan key baru untuk Today/Journey/stage/checklist, key lama
  tetap dipertahankan selama komponen lama masih dipakai (tidak ada penghapusan key i18n).
- Payment Flow (Midtrans) sama sekali tidak tersentuh — perubahan ini murni presentation-layer di atas
  data membership yang sudah ada.

---

## 18. Four Artifact Plan per Fase Implementasi

Mengikuti aturan tetap proyek, setiap fase di §15 WAJIB menghasilkan 4 artifact sebelum dianggap selesai
dan lanjut ke fase berikutnya:

1. **Kode type-checked** — `tsc` bersih untuk file baru/diubah di fase itu.
2. **Migrasi SQL** (kalau fase itu menambah tabel, lihat §14) — additive, idempotent, ditinjau sebelum
   dijalankan manual oleh Product Owner.
3. **Dokumentasi teknis final** — 1 dokumen ringkas per fase (bukan revisi total dokumen ini), mencatat
   apa yang benar-benar dibangun vs yang direncanakan di sini (disiplin "dokumentasi = implementasi
   nyata" yang sudah jadi standar proyek).
4. **Commit granular & bersih** — 1 fase idealnya 1-beberapa commit logis, bukan 1 commit raksasa
   mencakup banyak fase sekaligus.

Review Product Owner terjadi SETELAH keempat artifact fase itu ada, SEBELUM fase berikutnya dimulai —
tidak ada fase yang dikerjakan paralel tanpa checkpoint.

---

## Definition of Done — Fase Arsitektur (dokumen ini)

- [x] Business Operating System Architecture (§1)
- [x] Workspace V2 UX Blueprint (§2)
- [x] Business Journey Architecture (§3, termasuk pengakuan jujur soal gap sinyal stage 8-11)
- [x] Today Engine Architecture (§4)
- [x] Business Stage Engine Architecture (§5)
- [x] Daily Operating Loop (§6)
- [x] UI Wireframe tiap fase bisnis (§7, divalidasi terhadap mockup yang dikirim)
- [x] Database Schema baru, seluruhnya additive (§8)
- [x] API Contract (§9)
- [x] Service Layer (§10)
- [x] React Component Tree, menekankan reuse komponen lama (§11)
- [x] State Management Flow (§12)
- [x] AI Integration Flow (§13)
- [x] Migration Plan (§14)
- [x] Incremental Implementation Roadmap, dipetakan ke urutan prioritas directive (§15)
- [x] Risk Analysis, termasuk risiko konkret soal data eksternal yang belum ada sumbernya (§16)
- [x] Backward Compatibility Plan (§17)
- [x] Four Artifact Plan per fase (§18)

**Status:** menunggu review dan persetujuan eksplisit dari Product Owner. Tidak ada kode yang ditulis,
tidak ada tabel yang dibuat, tidak ada endpoint yang dijalankan dari dokumen ini. Implementasi Fase 1
(§15) baru dimulai setelah dokumen ini disetujui.
