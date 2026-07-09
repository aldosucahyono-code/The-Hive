status: PRODUCT REVIEW — bukan Code Review. Tidak ada kode yang ditulis dari dokumen ini.
disusun: berdasarkan pembacaan ulang langsung src/components/Workspace.tsx (1749 baris) per 2026-07-09 —
seluruh 7 tab (Business Score, Report, Target, Competitor, Growth, History, Chat), semua empty state,
AccessStatusCard, BusinessSwitcher, dan pola ComingSoon yang dipakai untuk tab yang belum dibangun.

---

# SMART WORKSPACE EVOLUTION — VERSION 1.0

## Prinsip yang Memandu Review Ini

Tujuan bukan membuat AI lebih pintar. Tujuannya membuat pemilik bisnis merasa **tidak bisa menjalankan
bisnisnya tanpa membuka THE HIVE** — bukan "terkesan sama AI-nya". Setiap ide di bawah dinilai dari satu
pertanyaan: *apakah ini membuat keputusan bisnis harian lebih mudah, atau cuma membuat AI kelihatan
lebih canggih?* Ide yang gagal lolos pertanyaan ini tidak masuk daftar prioritas.

Batasan yang dipegang ketat sepanjang review: tidak ada perubahan Domain Model, tidak ada perubahan
Business Engine (frozen), tidak ada logic baru yang menghitung ulang apa pun yang sudah dihitung
Business Engine — Zero Duplicate Logic.

---

## 1. Kondisi Workspace Saat Ini

Dibaca langsung dari `Workspace.tsx`: Workspace adalah navigasi 7 tab datar (flat sidebar, bukan
dashboard/beranda) — **Business Score, Report, Target, Competitor, Growth, History, Chat**. Tidak ada
tab "Home"/"Ringkasan" yang otomatis merangkum kondisi bisnis saat pertama dibuka — pelanggan harus
memilih sendiri tab mana yang mau dilihat.

Yang sudah dibangun penuh (bukan placeholder):

- **Business Score** — skor 0-100 + breakdown 6 dimensi (untuk PRO/PLATINUM) + Insight Beemo (khusus
  PLATINUM), dibaca dari `business_health`/`analyses`.
- **Report** — ringkasan analisa lengkap (summary, findings, strengths, improvements, opportunity) —
  sama untuk semua tier.
- **Target** — target yang pelanggan isi sendiri di wizard, plus (khusus PLATINUM) Journey/Period
  Progress dari Business Engine.
- **Growth** — Journey Progress, Period Progress, Growth Timeline (gabungan Business Update +
  Achievement, terurut kronologis), daftar Achievement dengan `business_value`, dan Next Milestone.
  Ini tab paling "hidup" secara desain — hasil kerja Achievement Engine.
- **History** — daftar seluruh analisa yang pernah dibuat, dengan badge "baseline".
- **Chat** — Chat Beemo, gated PRO/PLATINUM, percakapan bebas (lihat `BEEMO-AI-ENGINE-ARCHITECTURE.md`
  untuk detail teknisnya).

Yang masih **placeholder generik**: tab apa pun yang belum diberi implementasi jatuh ke komponen
`ComingSoon` — kotak abu-abu dengan judul tab dan 1 kalimat "coming soon" yang sama persis untuk semua
tab yang belum jadi.

**Competitor** secara teknis sudah "jadi" (bukan `ComingSoon`), tapi isinya baru berupa 1 kalimat pesan
generik ("khusus PRO/PLATINUM" untuk Free yang terkunci, atau 1 paragraf pesan untuk yang sudah
berlangganan) — belum ada peta kompetitor sungguhan. Ini persis yang dikeluhkan user saat QA langsung:
*"peta kompetitor masih 0."*

---

## 2. Apa yang Sudah Sangat Baik

- **Growth tab** adalah bukti konkret bahwa "hidup tanpa gamifikasi murahan" itu bisa dicapai — Journey
  Progress, Achievement dengan `business_value` (alasan bisnis, bukan cuma lencana), dan Next Milestone
  yang priority-aware, semua murni membaca Business Engine tanpa AI. Ini pola yang layak dicontoh untuk
  tab lain, bukan diulang persis, tapi *prinsipnya*: setiap angka yang ditampilkan selalu punya
  penjelasan "kenapa ini penting untuk bisnismu", bukan cuma angka telanjang.
- **Disiplin arsitektur** — pemisahan Business Engine/Workspace sudah sangat bersih, tidak ada
  recompute di React sepanjang file yang dibaca. Fondasi ini membuat ide-ide berikutnya di dokumen ini
  aman dibangun di atasnya tanpa risiko teknis yang besar.
- **Tier-gating konsisten** — pola `tier === "free"`/`tier === "platinum"` dicek di level komponen
  render, bukan disembunyikan CSS saja — konsisten dari `AccessStatusCard` sampai `CompetitorPanel`.
- **Bilingual penuh** — tidak ada teks hardcoded satu bahasa di seluruh file yang dibaca; semua lewat
  `t.workspace.*` dan `fillTemplate`.

---

## 3. Apa yang Masih Terasa "Mati"

Ini adalah inti dari feedback pelanggan yang pernah masuk saat QA ("belum mendapatkan ketertarikan dari
isi workspace") — dan setelah membaca ulang seluruh file, berikut akar masalahnya yang konkret:

1. **Tidak ada titik masuk yang merangkum kondisi bisnis.** Saat Workspace dibuka, pelanggan mendarat di
   1 tab spesifik (kemungkinan default ke Business Score) tanpa ada 1 layar yang bilang "ini yang
   berubah sejak terakhir kamu buka, ini yang perlu kamu lakukan hari ini". Setiap tab adalah pulau
   sendiri-sendiri — pelanggan harus mengunjungi 7 tab untuk merakit sendiri gambaran lengkap.
2. **Competitor tab kosong secara harfiah** — bukan cuma "belum lengkap", tapi 1 paragraf pesan generik
   yang sama untuk semua pelanggan PRO/PLATINUM, tidak ada data spesifik bisnis sama sekali.
3. **Tidak ada sinyal "sesuatu terjadi"** di luar tab Growth (toast perayaan Achievement). Kalau
   Business Health turun, target ketinggalan jauh, atau Business Update sudah lama tidak diisi — semua
   ini ADA datanya (Business Engine sudah menghitungnya), tapi pelanggan hanya melihatnya kalau mereka
   secara aktif membuka tab yang tepat. Tidak ada dorongan pasif untuk kembali.
3.1. **Menu sidebar sendiri tidak punya indikator apa pun** — tidak ada badge/titik merah di tab mana
   pun untuk menandakan "ada yang baru di sini". Semua 7 tombol menu tampil identik setiap saat.
4. **Empty state yang datar** — `HistoryList`, `BusinessScorePanel` (saat belum ada data),
   `TargetPanel` progress placeholder — semuanya menampilkan 1 kalimat netral ("belum ada analisa",
   dsb). Tidak ada yang mengarahkan pelanggan ke langkah selanjutnya secara spesifik.
5. **Chat Beemo tidak tahu apa-apa selain 1 baris ringkasan lama** — seperti didokumentasikan detail di
   `BEEMO-AI-ENGINE-ARCHITECTURE.md` §0, Chat Beemo hari ini buta terhadap Business Health, Progress,
   Achievement — jadi meskipun pelanggan sudah py Journey Progress bagus di tab Growth, begitu mereka
   chat, Beemo tidak menyadarinya sama sekali.
6. **Tidak ada "kenapa saya harus balik besok"** — semua tab bersifat statis-informational: begitu
   dilihat sekali, tidak ada alasan kuat untuk membuka lagi besok kecuali ingat sendiri untuk mengisi
   Business Update mingguan.

---

## 4. Bagaimana Membuat Workspace Terasa Hidup

Bukan lewat animasi atau notifikasi ramai — lewat **informasi yang tepat waktu dan personal**, muncul
di tempat yang pelanggan pasti lihat pertama kali:

- Satu titik masuk (bukan tab baru yang rumit, cukup kartu ringkas di atas semua tab) yang langsung
  menjawab: apa yang berubah, apa yang perlu dilakukan hari ini, apa yang membaik/menurun, target minggu
  ini, keputusan yang masih menggantung. Ini konsep **Business Pulse** (lihat §5.13) — dan ini akar dari
  "hidup" yang dimaksud: pelanggan tidak perlu merakit sendiri gambaran dari 7 tab.
- Silent by default: Workspace tidak boleh jadi ramai notifikasi. Sinyal hanya muncul kalau memang
  penting (Health turun, target tertinggal jauh, Achievement baru, Business Update terlambat) — selebihnya
  diam. Ini justru yang membuat sinyal terasa berarti saat muncul, bukan diabaikan seperti notifikasi
  aplikasi lain pada umumnya.
- Chat Beemo yang benar-benar mengenal perjalanan bisnis (lewat AI Engine di dokumen terpisah) membuat
  setiap percakapan terasa melanjutkan hubungan, bukan mulai dari nol setiap kali.

---

## 5. Ide Penyempurnaan Tanpa Mengubah Business Engine

Semua ide di bawah murni membaca ulang/menyajikan ulang data yang sudah ada dari Business Engine (atau
menambah layer BARU yang terpisah total, seperti Memory/Decision Journal) — tidak ada satu pun yang
mengubah `business_health`, `progress_snapshots`, `business_achievements`, atau tabel Business Engine
lain.

### 5.1 Business DNA
Profil hidup yang dibangun dari Business Engine (jenis usaha, umur bisnis, lokasi, target, Health,
Journey, Period, Achievement, Business Update, gaya pengambilan keputusan) — dipakai sebagai fondasi
Context Builder di AI Engine (lihat dokumen terpisah), bukan fitur UI berdiri sendiri. Tidak pernah
dibangun dari chat, selalu dari Business Engine.

### 5.2 Business Memory
Bukan histori chat mentah — ringkasan perjalanan bisnis (Business Update pertama, Health pertama,
Achievement pertama, perubahan besar, keputusan penting, target). Beemo bicara "Dua bulan lalu kita
memutuskan fokus ke pelanggan lama" — bukan "Dua bulan lalu kamu bilang...". Detail teknis di
`BEEMO-AI-ENGINE-ARCHITECTURE.md` §3.3/§7.

### 5.3 Decision Journal
**Kandidat fitur masa depan paling penting** menurut arahan pelanggan. Setiap rekomendasi AI + keputusan
pelanggan dicatat: tanggal, keputusan, alasan, Business Health saat itu, rekomendasi AI, status, hasil
beberapa minggu kemudian. Ini memungkinkan AI (dan pelanggan sendiri) mengevaluasi keputusan lama dengan
data nyata — bukan ingatan. Wajib berupa **layer baru di atas Business Engine**, sama sekali tidak
mengubah tabel Business Engine yang sudah ada.

### 5.4 Business Forecast
Prediksi HANYA dari data Business Engine (tidak pernah dari internet/data eksternal), selalu disertai
level keyakinan, dan berani bilang "belum cukup data" kalau memang begitu adanya (khususnya untuk
bisnis yang baru punya 1-2 Business Update).

### 5.5 AI Confidence
Setiap insight penting harus punya level keyakinan eksplisit (mis. 95% vs 43%) supaya pelanggan paham
batas kemampuan AI — bukan menyajikan semua insight seolah-olah pasti benar.

### 5.6 Silent AI
AI tidak boleh selalu bicara. Workspace tidak boleh penuh notifikasi. AI hanya muncul kalau memang
penting: Health turun, target tertinggal, Achievement baru, Business Update terlambat. Selain itu, diam.

### 5.7 Next Best Action
Satu langkah berikutnya — bukan 10, bukan 15. Contoh: "Hari ini fokus menghubungi pelanggan lama."
Selaras langsung dengan Recommendation Engine (`BEEMO-AI-ENGINE-ARCHITECTURE.md` §3.5/§8).

### 5.8 Beemo State of Mind
Coach/Analyst/Strategist/Mentor/Operator — kepribadian Beemo tidak berubah, hanya gaya penyampaian.
Detail penuh ada di `BEEMO-AI-ENGINE-ARCHITECTURE.md` §3.6.

### 5.9 Smart Workspace (rasa "hidup" lewat informasi)
Saat dibuka, pelanggan langsung paham: apa yang berubah, apa yang harus dilakukan, apa yang
membaik/menurun, target minggu ini, keputusan yang menggantung — bukan lewat animasi, lewat informasi
yang tepat sasaran. Ini konsep payung yang mengikat 5.13 (Business Pulse) dan 5.7 (Next Best Action)
menjadi satu pengalaman kohesif di titik masuk Workspace.

### 5.10 Zero Duplicate Logic
Tidak ada satu pun ide di atas boleh menghitung ulang skor, membuat skor baru, atau membangun "Business
Engine kedua". Semuanya membaca dari service Business Engine yang sudah ada (`getBusinessHealth`,
`getProgress`, `getHealthTrend`, `getAchievements`, `getActiveMembership`) — sama seperti pola yang
sudah dipakai `TargetPanel`/`GrowthPanel` hari ini.

### 5.11 Future Ready
Seluruh desain di atas (terutama Business Pulse dan Smart Workspace) tidak boleh mengasumsikan hanya
ada 1 jenis pengguna (Customer) — struktur data yang sama harus bisa dipakai Super Admin/CS/Marketing/
Employee Platform nanti tanpa perombakan, meski tidak dibangun sekarang.

### 5.12 Larangan Eksplisit
Tidak boleh: mengubah Domain Model, mengubah Business Engine, mengubah Workspace Flow, menambah utang
teknis, membuat AI terlalu banyak bicara, gamifikasi murahan, notifikasi yang mengganggu.

### 5.13 Business Pulse
Sebelum melihat dashboard/tab apa pun, pelanggan melihat 1 kartu sederhana:

```
🟢 Business Pulse: Stabil
🟡 Business Pulse: Perlu Perhatian
🔴 Business Pulse: Tindakan Diperlukan

Alasan utama:
- Penjualan minggu ini turun 12%.
- Business Update sudah 9 hari belum diisi.
- Target bulan ini baru tercapai 43%.
```

Tidak ada grafik rumit, tidak ada belasan kartu — dalam 5 detik pemilik bisnis tahu kondisi bisnisnya.
**Ini murni menyajikan ulang output Business Engine yang sudah ada** (delta Health mingguan dari
`getHealthTrend`, jarak hari sejak Business Update terakhir dari `business_updates`, persentase target
tercapai dari `progress_snapshots`) dalam bentuk yang jauh lebih bermakna — sama sekali tidak menghitung
apa pun yang baru. Warna (hijau/kuning/merah) adalah ambang sederhana dari angka-angka yang sudah ada,
bukan skor baru.

Ini secara langsung menjawab akar masalah di §3: pelanggan tidak perlu lagi merakit sendiri gambaran
dari 7 tab terpisah — cukup lihat Business Pulse, lalu putuskan mau menyelami tab mana.

---

## 6. Prioritas Implementasi

Dinilai dari 4 sumbu: **Impact** (ke pengalaman pelanggan), **Effort** (teknis), **Business Value**
(retensi/upgrade), **Technical Risk** (terhadap fondasi yang sudah frozen).

| # | Ide | Impact | Effort | Business Value | Technical Risk | Prioritas |
|---|---|---|---|---|---|---|
| 1 | **Business Pulse** | Sangat Tinggi | Rendah-Sedang (murni presentasi ulang data yang sudah ada) | Sangat Tinggi (alasan buka aplikasi tiap hari) | Sangat Rendah (read-only, tanpa AI) | **#1 — mulai duluan** |
| 2 | **Next Best Action** | Tinggi | Rendah-Sedang | Tinggi | Rendah (turunan langsung Business Engine) | **#2** |
| 3 | **Context Builder untuk Chat Beemo** (baca Health/Progress/Achievement, bukan cuma summary lama) | Tinggi | Sedang | Tinggi (Chat jadi relevan) | Rendah-Sedang (lihat detail teknis di `BEEMO-AI-ENGINE-ARCHITECTURE.md`) | **#3** |
| 4 | **Silent AI / sinyal pasif di sidebar** (indikator "ada yang perlu dilihat" di tab tertentu) | Sedang-Tinggi | Rendah | Sedang | Rendah | **#4** |
| 5 | **Business Memory** | Sedang-Tinggi | Sedang | Tinggi (jangka panjang) | Sedang (tabel baru, perlu desain lifecycle) | #5 |
| 6 | **Beemo State of Mind** | Sedang | Sedang | Sedang | Rendah (rule-based dulu) | #6 |
| 7 | **AI Confidence pada tiap insight** | Sedang | Rendah | Sedang (kepercayaan pelanggan) | Rendah | #7 |
| 8 | **Competitor tab sungguhan** (bukan lagi 1 paragraf generik) | Tinggi | Tinggi (butuh sumber data kompetitor yang belum ada — di luar scope Business Engine) | Tinggi | Sedang (butuh sumber data baru, bukan cuma presentasi ulang) | #8 — perlu keputusan produk terpisah soal sumber data |
| 9 | **Business Forecast** | Sedang | Sedang-Tinggi | Sedang | Sedang (mudah disalahgunakan jadi janji berlebihan tanpa disiplin confidence level) | #9 |
| 10 | **Decision Journal** | Tinggi (jangka panjang) | Tinggi | Sangat Tinggi (jangka panjang) | Sedang (layer baru, perlu desain matang sebelum dibangun) | #10 — penting tapi butuh desain terpisah sebelum implementasi |

Catatan urutan: Business Pulse dan Next Best Action didahulukan karena rasio impact/effort paling
tinggi dan risiko paling rendah — keduanya murni menyajikan ulang data yang sudah dihitung Business
Engine, tanpa AI generatif sama sekali untuk versi pertamanya (ambang angka sederhana sudah cukup).
Competitor tab dan Decision Journal sengaja diletakkan lebih belakang bukan karena kurang penting,
tapi karena keduanya butuh keputusan produk tambahan (sumber data kompetitor dari mana; struktur
Decision Journal seperti apa) sebelum bisa masuk fase implementasi.

---

## 7. Dampak terhadap Pengguna

- Business Pulse dan sinyal pasif di sidebar mengubah kebiasaan dari "buka Workspace kalau ingat" jadi
  "buka Workspace karena penasaran kondisi bisnis hari ini" — inti dari tujuan produk.
- Next Best Action mengurangi beban keputusan (paradox of choice) — pelanggan UMKM sering kewalahan
  dengan terlalu banyak saran; satu langkah jelas jauh lebih actionable.
  Beemo State of Mind & Context Builder yang lebih kaya membuat Chat terasa personal, bukan generik.
- Risiko yang harus diwaspadai: kalau Business Pulse terlalu sering merah/kuning tanpa alasan yang jelas
  dan actionable, ini bisa jadi sumber kecemasan alih-alih bantuan — desain ambang warna harus hati-hati
  (dibahas lebih lanjut saat fase desain detail, bukan di dokumen ini).

---

## 8. Dampak terhadap Biaya AI

Kabar baik: **Business Pulse dan Next Best Action versi awal tidak butuh panggilan Claude API sama
sekali** — keduanya bisa berupa ambang angka sederhana dari data Business Engine yang sudah dihitung
(delta Health, hari sejak update terakhir, persentase target). Biaya AI baru mulai relevan di:

- Context Builder untuk Chat (biaya sudah ada hari ini, hanya bertambah sedikit karena context lebih
  kaya — lihat estimasi di `BEEMO-AI-ENGINE-ARCHITECTURE.md` §15).
- Business Memory (butuh 1 panggilan model kecil untuk deteksi "layak disimpan", bukan tiap giliran chat).
- Business Forecast (satu-satunya ide di daftar yang berpotensi butuh panggilan AI generatif signifikan
  per bisnis — sebaiknya diberi jeda/caching ketat kalau dibangun nanti).

Prinsipnya konsisten dengan `BEEMO-AI-ENGINE-ARCHITECTURE.md` §15: pakai AI hanya di tempat yang benar-
benar butuh generasi bahasa/penalaran, bukan di tempat yang cukup dijawab ambang angka biasa.

---

## 9. Dampak terhadap Performa

- Business Pulse dan Next Best Action, karena murni membaca ulang service yang sudah ada
  (`getBusinessHealth`, `getProgress`, `getHealthTrend`, `business_updates` terakhir), tidak menambah
  query baru yang berat — cukup 1 pemanggilan gabungan yang sudah tersedia atau kombinasi ringan dari
  service yang sudah dipakai `TargetPanel`/`GrowthPanel`.
- Sinyal pasif sidebar sebaiknya dihitung sekali per pembukaan Workspace (bukan polling terus-menerus)
  untuk menjaga beban Supabase tetap ringan, konsisten dengan disiplin performa yang sudah dijaga ketat
  di Achievement Engine (caching, bounded query — lihat `ACHIEVEMENT-ENGINE-FINAL.md` §3 bagian
  Performance).
- Business Memory dan Decision Journal menambah tabel baru — perlu index yang tepat sejak awal
  (`business_profile_id`, `created_at`) mengikuti pola RLS dan indexing yang sudah konsisten di seluruh
  skema.

---

## 10. Roadmap Implementasi Bertahap

Sekali lagi: **ini bukan izin untuk mulai coding.** Roadmap ini hanya urutan yang diusulkan untuk fase
implementasi SETELAH dokumen ini (dan `BEEMO-AI-ENGINE-ARCHITECTURE.md`) disetujui Product Owner.

1. **Tahap A — Business Pulse (tanpa AI).** Kartu ringkas di atas Workspace, ambang sederhana dari data
   Business Engine yang sudah ada. Tidak butuh Claude API sama sekali di versi pertama.
2. **Tahap B — Sinyal pasif di sidebar menu.** Indikator kecil di tab yang punya sesuatu baru (mis.
   Achievement baru belum dilihat, Business Update terlambat) — perluasan langsung dari toast perayaan
   Achievement yang sudah ada.
3. **Tahap C — Next Best Action.** Turunan langsung dari Business Health terlemah + Next Milestone,
   ditampilkan berdampingan dengan Business Pulse.
4. **Tahap D — Context Builder yang lebih kaya untuk Chat Beemo** (lihat roadmap detail di
   `BEEMO-AI-ENGINE-ARCHITECTURE.md` §20 Fase 1-2).
5. **Tahap E — Business Memory.** Setelah Context Builder matang, baru Memory Layer dibangun agar ada
   fondasi yang jelas untuk apa yang perlu diingat.
6. **Tahap F — Decision Journal & Business Forecast.** Diletakkan paling akhir karena butuh desain
   produk tersendiri yang lebih matang (belum cukup dibahas kedalamannya di dokumen ini untuk langsung
   diimplementasikan).

---

## Prinsip Penutup

Bukan mengejar AI paling pintar — membangun platform yang paling membantu pemilik bisnis. Ide yang
membuat AI lebih pintar tapi Workspace lebih rumit ditolak; ide yang membuat keputusan bisnis harian
lebih mudah diterima. Tujuan akhirnya pelanggan berkata *"saya tidak bisa menjalankan bisnis tanpa
membuka THE HIVE"* — bukan *"saya terkesan dengan AI-nya"*.

**Status:** menunggu review dan persetujuan Product Owner. Tidak ada implementasi yang dimulai dari
dokumen ini.
