# Business Engine — Technical Summary

Status: **Business Engine v1.0 — Production Ready & Feature Freeze.**

Ini bukan proposal, bukan dokumentasi database. Ini ringkasan teknis tentang Business Engine yang **sudah selesai dibangun dan dibekukan** — dimaksudkan supaya siapapun (termasuk fase AI Engine berikutnya) bisa memahami cara kerjanya tanpa perlu membuka puluhan file satu per satu.

Cakupan dokumen ini: Business Update Engine (2.1), Business Health Engine (2.2), Progress Engine (2.3), Achievement Engine (2.4). Untuk detail Achievement Engine secara spesifik (skema lengkap, condition_type, Next Milestone), lihat `ACHIEVEMENT-ENGINE-FINAL.md` — dokumen ini merangkum semuanya dalam satu gambaran utuh.

---

## 1. Gambaran Arsitektur

Business Engine adalah **lapisan perhitungan deterministik** di antara Business Update (input pengguna) dan Workspace (tampilan). Prinsip yang dipegang ketat di seluruh lapisan ini, tanpa kecuali:

- **Tidak ada AI di dalamnya.** Tidak ada pemanggilan Claude API, tidak ada prompt, tidak ada reasoning generatif. Input yang sama selalu menghasilkan output yang sama.
- **Tidak ada tebakan/fabrikasi.** Dimensi yang belum punya sumber data nyata (marketing, operations, brand) dibiarkan diam di baseline, bukan diisi angka karangan.
- **Read services tidak pernah menghitung ulang.** Semua `get*.ts` di `services/workspace/` murni membaca hasil yang sudah disimpan `recalculate*`/`evaluate*` — pemisahan write (Business Engine inti) vs read (lapisan Workspace) dijaga ketat di seluruh kode.
- **Historical rows sengaja tidak ditimpa** (`business_health`, `progress_snapshots`) — supaya tahap berikutnya dalam rantai (Progress Engine, Achievement Engine) bisa membaca *tren*, bukan cuma angka terakhir.

```
Business Update (input)
       ↓
Business Health Engine   (skor per dimensi, 6 dimensi)
       ↓
Progress Engine          (Journey = sejak awal, Period = minggu vs minggu)
       ↓
Achievement Engine       (baca semua yang di atas, bandingkan ke threshold)
       ↓
Workspace (Growth tab, Business Score, Target)  — murni presentasi
```

Rantai ini **satu arah dan tidak boleh dibalik**: Achievement tidak pernah memicu Health, Progress tidak pernah memicu Update, dst.

---

## 2. Alur Data End-to-End

### 2.1 Sebelum Business Engine mulai (fondasi Business Profile)

```
Wizard (tamu) → generate-preview.ts (Claude API, preview gratis saja)
             → save-submission.ts (simpan wizard_drafts, anonim)
             → Login/Signup (AuthModal)
             → promote-draft.ts (bikin business_profiles + analyses[is_baseline=true], idempotent)
             → create-transaction.ts (Midtrans Snap) → notification-handler.ts (webhook → subscriptions)
             → mendarat di Workspace
```

`analyses.ai_output.businessHealthScore` (hasil AI Report pertama dari Wizard) dipakai **satu kali saja** sebagai titik awal (baseline) 6 dimensi Business Health, kalau bisnis itu belum pernah punya baris `business_health` sama sekali. Setelah itu, AI report tidak pernah disentuh lagi oleh Business Engine — ini satu-satunya titik singgung antara AI Report Engine (di luar cakupan dokumen ini) dan Business Engine.

### 2.2 Loop mingguan Business Engine (inti dokumen ini)

```
User isi Business Update (BusinessUpdateModal)
   ↓
submitBusinessUpdate()                         [services/workspace/submitUpdate.ts]
   1. Validasi + INSERT business_updates
   2. recalculateBusinessHealth(businessProfileId)     → INSERT business_health (6 baris baru)
   3. recalculateProgress(businessProfileId, overallScore) → UPSERT progress_snapshots (per minggu)
                                                          → DELETE+INSERT business_metrics
   4. evaluateAchievements(businessProfileId, "submitBusinessUpdate") → INSERT business_achievements (kalau ada yang unlock)
   ↓
Response ke frontend: { updateId, createdAt, newlyUnlocked[] }
   ↓
Workspace: refreshKey++ (Business Score/Target/Growth refetch), toast kalau ada newlyUnlocked
```

Kegagalan di langkah 2-4 **tidak membatalkan** langkah 1 (Business Update tetap tersimpan) — dicatat di server log saja. Ini keputusan sadar: pengalaman mengisi update tidak boleh gagal gara-gara perhitungan turunan bermasalah.

### 2.3 Titik baca kedua Achievement Engine (tanpa Business Update baru)

```
User buka tab Growth
   ↓
getAchievements()  [services/workspace/getAchievements.ts]
   1. evaluateAchievements(businessProfileId, "getAchievements")  → menangkap achievement berbasis waktu murni (member_since_days)
   2. SELECT business_achievements JOIN achievement_definitions   → daftar unlocked
   ↓
Response: { unlocked[], nextMilestone }
```

Ini satu-satunya alasan Achievement Engine punya DUA trigger point — proyek ini tidak punya cron job (Vercel Hobby plan), jadi pembukaan tab Growth jadi kesempatan paling ringan untuk mengecek achievement yang bisa jadi benar tanpa aksi baru dari user.

---

## 3. Dependency Antar Service

```
submitUpdate.ts
  ├─→ recalculateHealth.ts        (business/)
  ├─→ recalculateProgress.ts      (business/)
  └─→ evaluateAchievements.ts     (business/)

getAchievements.ts
  └─→ evaluateAchievements.ts     (business/)   [dipanggil ulang, sama persis]

getMembership.ts
  └─→ getActiveMembership.ts      (membership/) [satu-satunya sumber kebenaran "tier aktif"]

services/beemo/chat.ts (fitur terpisah, Chat Beemo)
  └─→ getActiveMembership.ts      (membership/) [dipakai bareng, TIDAK duplikat logic]

getBusinessHealth.ts, getProgress.ts, getHealthTrend.ts, listUpdates.ts, getLatestPayment.ts
  └─→ (tidak memanggil service lain — murni baca tabel masing-masing)
```

Tidak ada service Business Engine yang memanggil Claude API, memanggil dirinya sendiri secara rekursif, atau memanggil service di luar `services/business/`, `services/workspace/`, `services/membership/`.

---

## 4. Daftar Tabel yang Digunakan

| Tabel | Ditulis oleh | Dibaca oleh | Catatan |
|---|---|---|---|
| `business_profiles` | `create.ts`, `promote-draft.ts` | hampir semua service (ownership check) | pusat Domain Model, di luar Business Engine tapi semua bergantung padanya |
| `business_updates` | `submitUpdate.ts` | `recalculateHealth.ts`, `recalculateProgress.ts`, `evaluateAchievements.ts`, `listUpdates.ts` | input mentah mingguan, tidak pernah diubah setelah insert |
| `business_health` | `recalculateHealth.ts` | `getBusinessHealth.ts`, `getHealthTrend.ts`, `evaluateAchievements.ts` | baris BARU tiap recalculation (histori penuh, tidak ditimpa) |
| `progress_snapshots` | `recalculateProgress.ts` | `getProgress.ts`, `evaluateAchievements.ts` | 1 baris per minggu kalender per business, di-UPSERT dalam minggu yang sama |
| `business_metrics` | `recalculateProgress.ts` | (belum ada consumer langsung — disiapkan untuk laporan/AI nanti) | dihapus+insert ulang per snapshot, normalisasi omset/pelanggan_baru |
| `achievement_definitions` | migrasi SQL (manual, Product Owner) | `evaluateAchievements.ts`, `getAchievements.ts` | katalog, bukan data pelanggan |
| `business_achievements` | `evaluateAchievements.ts` | `getAchievements.ts` | keputusan unlock, RLS aktif |
| `subscriptions` | `notification-handler.ts`, migrasi manual (test tier) | `getActiveMembership.ts` | satu baris `active` per business (constraint DB) |
| `payments` | `create-transaction.ts`, `notification-handler.ts` | `getLatestPayment.ts` | riwayat transaksi Midtrans |
| `analyses` | `promote-draft.ts`, `saveAnalysis.ts` | `recalculateHealth.ts` (baseline saja) | AI Report Engine — di luar Business Engine, hanya disentuh sekali sebagai baseline |
| `wizard_drafts`, `profiles`, `user_preferences` | alur Wizard/Auth | — | di luar Business Engine, disebut untuk konteks alur end-to-end |

---

## 5. Event Flow (Ringkas)

| Event | Trigger | Efek berantai |
|---|---|---|
| Business Update disimpan | User submit form di Workspace | Health → Progress → Achievement (semua otomatis, satu request) |
| Growth tab dibuka | User klik menu Growth | Achievement re-evaluasi (khusus achievement berbasis waktu) |
| Pembayaran Midtrans sukses | Webhook `notification-handler.ts` | Expire subscription lama → insert subscription baru (tier naik) |
| Business profile baru dibuat | `create.ts` / `promote-draft.ts` | Tidak ada baris Business Engine dibuat otomatis — baru mulai terisi begitu Business Update pertama masuk |

Tidak ada cron job, tidak ada scheduled function. Semua perhitungan terjadi **synchronous di dalam request** (submit update / buka Growth tab) — konsekuensinya sudah dicek di Final Audit Achievement Engine: query dibatasi (`LIMIT`/`range`) dan di-cache per pemanggilan supaya tetap ringan.

---

## 6. API yang Terlibat

| Endpoint | Actions | Fungsi |
|---|---|---|
| `api/workspace.ts` | `submitUpdate`, `listUpdates`, `getBusinessHealth`, `getProgress`, `getHealthTrend`, `getAchievements`, `getLatestPayment`, `getMembership` | Router utama Business Engine — satu file, banyak action (hemat kuota Vercel Hobby) |
| `api/business.ts` | `create`, `archive`, `restore`, `delete`, `saveAnalysis` | Domain Business Profile — di luar Business Engine, tapi jadi prasyaratnya |
| `api/promote-draft.ts` | (tunggal) | Membuat business_profile + analysis baseline pertama kali |
| `api/create-transaction.ts`, `api/notification-handler.ts` | (tunggal) | Domain Payment/Membership — mengisi `subscriptions`/`payments`, dibaca `getActiveMembership.ts` |
| `api/generate-preview.ts`, `api/generate-report.ts` | (tunggal) | AI Report Engine — di luar Business Engine, disebut untuk kejelasan batas |

---

## 7. Workspace yang Membaca Business Engine

| Menu Workspace | Data yang dibaca | Sumber |
|---|---|---|
| Business Score | Skor 6 dimensi + overall | `getBusinessHealth` |
| Target | Journey/Period progress | `getProgress` |
| Growth | Journey+Period (per dimensi), Timeline gabungan, Achievements, Next Milestone | `getProgress`, `getHealthTrend`, `listUpdates`, `getAchievements` |
| History (toggle bawah halaman) | Riwayat Business Update | `listUpdates` (sumber sama dengan Timeline di Growth — tidak ada fetch ganda) |
| Report | Laporan AI (bukan Business Engine) | `analyses.ai_output` |
| Competitor | Placeholder jujur, Tahap B belum dibangun | — |
| Chat Beemo | Gating tier saja | `getActiveMembership` (lewat `services/beemo/chat.ts`) |

Semua komponen React yang menampilkan menu-menu ini (`Workspace.tsx`: `GrowthPanel`, `GrowthTimeline`, dan panel-panel lain) murni presentasi — tidak ada skor/metrik dihitung ulang di frontend, terverifikasi saat Final Audit Achievement Engine.

---

## 8. Batas Tanggung Jawab Business Engine

Business Engine **BERTANGGUNG JAWAB** atas:
- Menyimpan Business Update.
- Menghitung skor Business Health per dimensi (deterministik, dari data Business Update).
- Menghitung Journey/Period Progress (perbandingan snapshot mingguan).
- Mengevaluasi & mencatat Achievement (baca-bandingkan-catat, tidak pernah menghitung metric baru).

Business Engine **TIDAK BERTANGGUNG JAWAB** atas (domain terpisah, di luar cakupan freeze ini):
- Autentikasi & Business Profile CRUD (`api/business.ts`, Auth).
- Membership/Payment (`subscriptions`, `payments`, Midtrans) — Business Engine hanya membaca tier lewat `getActiveMembership`, tidak pernah menulis ke sana.
- AI Report Engine (`analyses`, `generate-preview`/`generate-report`) — hanya disentuh sekali sebagai baseline Business Health.
- Tampilan/UI Workspace — murni konsumen, bukan bagian dari Business Engine itu sendiri.

---

## 9. Hal yang Sengaja Ditunda

- **Dimensi Marketing, Operations, Brand** — tetap di baseline (tidak dihitung ulang) sampai ada sumber data nyata untuk dimensi itu. Tidak difabrikasi.
- **`target_completion`** (achievement berbasis target angka) — menunggu modul **Structured Goal** (`business_goals`, dirancang di Lampiran A `ACHIEVEMENT-ENGINE-PROPOSAL.md`, belum dibangun).
- **Achievement "Login Rutin"** — ditunda sampai ada tabel session/analitik yang genuinely dibutuhkan banyak fitur sekaligus (Super Admin/Employee/Analytics Platform), bukan tabel tunggal untuk satu achievement.
- **Repeatable achievement** (mis. "30/90/365 hari konsisten" berulang) — akan lewat tabel history terpisah nanti, bukan mengubah `business_achievements`.
- **Timeline pagination/lazy-load** — struktur kode sudah siap (`GrowthTimeline` menerima data lewat props), belum diimplementasikan karena belum dibutuhkan (update sudah dibatasi 20 baris terbaru).
- **Dashboard analitik** (jumlah/persentase pelanggan per achievement) — query pattern sudah didokumentasikan di `ACHIEVEMENT-ENGINE-FINAL.md`, menunggu Super Admin Platform.
- **Competitor Analysis (Tahap B)** — placeholder jujur di Workspace, bukan bagian Business Engine.

---

## 10. Kontrak Integrasi Masa Depan dengan AI Engine

Ini bagian paling penting untuk fase berikutnya. Kontrak yang **tidak boleh dilanggar** saat AI Engine mulai dibangun:

1. **AI Engine hanya membaca, tidak pernah menulis** ke `business_updates`, `business_health`, `progress_snapshots`, `business_metrics`, `business_achievements`. Tidak ada skor/metric yang boleh dihasilkan AI menggantikan Business Engine.
2. **AI Engine tidak pernah mengevaluasi achievement.** Achievement selalu ditentukan `evaluateAchievements()` (deterministik) — AI hanya boleh membaca hasilnya (`business_achievements` join `achievement_definitions`) untuk menyusun narasi.
3. **Metadata AI-ready sudah tersedia sejak sekarang**, belum dibaca kode manapun:
   - `achievement_definitions.celebration_message_id/en`, `coach_message_id/en`, `recommendation_key`, `recommended_action_key`, `business_value_id/en` — konteks siap pakai untuk narasi personal.
   - `analyses.ai_output` — laporan AI pertama (baseline), bisa jadi konteks histori "bagaimana AI pernah menilai bisnis ini".
4. **Titik masuk yang wajar** untuk AI Engine membaca Business Engine: sebuah fungsi baca baru (pola sama seperti `get*.ts` di `services/workspace/`) yang mengumpulkan business_health terbaru + progress terbaru + achievement terbuka + Business Update terakhir sebagai satu paket konteks untuk dikirim ke Claude API — bukan query tersebar di banyak tempat.
5. **Tidak ada perubahan skema yang dibutuhkan** untuk mulai membangun AI Engine — seluruh kolom yang diperlukan sudah ada.

---

## Definition of Done — Business Engine v1.0

- ✅ Business Update → Health → Progress → Achievement berjalan end-to-end, terverifikasi di production.
- ✅ Tidak ada AI/randomness di dalam rantai perhitungan.
- ✅ Semua read service murni baca, tidak ada duplikasi logika evaluasi.
- ✅ Query dibatasi & di-cache (hasil Final Audit) — tidak melambat seiring waktu.
- ✅ RLS aktif di seluruh tabel Business Engine.
- ✅ Tidak ada placeholder tersisa di jalur yang sudah diklaim selesai.
- ✅ Dokumentasi ini + `ACHIEVEMENT-ENGINE-FINAL.md` sebagai referensi permanen.

**Business Engine v1.0 dinyatakan Production Ready & Feature Freeze.** Ide baru masuk roadmap versi berikutnya (AI Engine dan seterusnya), bukan ke dokumen/kode Business Engine v1.0 ini.
