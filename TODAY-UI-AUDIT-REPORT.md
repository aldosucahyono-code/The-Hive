# THE HIVE — Full UI Audit: Today (Master Template)

Audit murni observasi, tidak ada kode yang diubah. Cakupan: `Workspace.tsx` (shell header/sidebar + `TodayPanel`) dan `translations.ts`. Format sesuai permintaan: ✓ Sudah Baik, ⚠ Perlu Diperbaiki, 💡 Rekomendasi, 🎯 Prioritas.

---

## 1. Layout

- ✓ Grid utama `md:grid-cols-[264px_1fr]` konsisten, sidebar `sticky top-6`, spacing makro sudah pakai skala 6/8 (24/32px) secara konsisten antar section.
- ✓ Metric row 5 kartu pakai struktur 3-baris identik + `minHeight: 128` — tinggi kartu benar-benar seragam, tidak ada yang "naik turun sendiri".
- ⚠ Mission Today (`min-h-[380px]`) dan kartu-kartu di bawahnya (checklist, prioritas, chart) tidak berbagi satu skala tinggi minimum yang konsisten — beberapa pakai `p-6`, Mission Today pakai `p-8 sm:p-10`. Tidak salah, tapi belum ada dokumentasi eksplisit "kapan pakai p-6 vs p-8/p-10", sehingga developer berikutnya bisa menebak-nebak saat membangun halaman lain.
  🎯 Prioritas Rendah — Dampak: Maintainability sedang, UX rendah.
- ⚠ Kolom kanan (Insight/Opportunity/Reminder) punya total tinggi konten yang bervariasi (Reminder selalu 3 slot vs Insight cuma 1 paragraf), sehingga di layar lebar kolom kiri & kanan bisa berhenti di titik berbeda — bukan bug, tapi belum ada aturan eksplisit soal keseimbangan visual dua kolom ini untuk halaman-halaman berikutnya.
  💡 Rekomendasi: dokumentasikan sebagai bagian dari Workspace Design System (Tahap "Refactor menjadi komponen reusable") — bukan revisi sekarang.

## 2. Typography

- ✓ Hierarki cukup jelas: judul kartu `text-sm font-bold`, angka besar `text-2xl font-black`/`text-5xl` (Business Score), caption `text-[11px]`/`text-xs`.
- ⚠ Ukuran caption terkecil (`text-[11px]`, `text-[10px]`) ada di banyak tempat (label metrik, subtitle sidebar, badge chart) — ini di bawah standar minimum 12px yang lazim untuk keterbacaan, dan sedikit di bawah "Product Principles" yang menyebut minimum 14px untuk isi utama (caption memang biasanya dikecualikan, tapi `text-[10px]` pada badge "Preview" & subtitle sidebar cukup kecil di layar HP kelas menengah).
  🎯 Prioritas Sedang — Dampak: Accessibility sedang, UX sedang.
  💡 Rekomendasi: naikkan caption terkecil dari 10px → minimal 11px, dan pertimbangkan 11px → 12px untuk subtitle sidebar 2-baris supaya tetap terbaca di 360px.
- ✓ `line-height`/`leading-relaxed` dipakai konsisten untuk paragraf deskriptif (Insight, Opportunity, ComingSoon).

## 3. Colors

- ✓ Semantik warna konsisten: hijau = naik/aman, merah = turun/urgent, amber = perhatian/fokus, primary/orange = aksi utama. Dipakai sama persis di metric row, reminder badge, priority border-left, journey stepper.
- ✓ Kontras teks utama (putih/neutral-100 di atas `#141414`/`#090909`) sudah tinggi, aman secara WCAG AA untuk teks besar.
- ⚠ Beberapa teks sekunder pakai `text-neutral-600`/`text-neutral-700` di atas `bg-surface` (`#141414`) — ini kemungkinan **di bawah rasio kontras 4.5:1 WCAG AA** untuk teks kecil (contoh: `todayChecklistSessionNote`, catatan chart `todayChartPlaceholderNote`, empty reminder slot). Belum diverifikasi dengan alat kontras otomatis (belum ada tool browser di sandbox ini), tapi secara visual `neutral-600`/`neutral-700` pada teks 11-12px berisiko gagal AA.
  🎯 Prioritas Sedang — Dampak: Accessibility tinggi (ini justru satu-satunya temuan yang menyentuh "color-must-carry-meaning" + kontras sekaligus), UX rendah.
  💡 Rekomendasi: naikkan warna teks catatan/caption paling redup minimal ke `neutral-500`, dan lakukan pengecekan kontras dengan browser DevTools atau alat seperti WebAIM Contrast Checker sebelum halaman lain dibangun di atas skala warna yang sama.

## 4. Card

- ✓ Radius sudah konsisten mengikuti skala yang ditetapkan: 24px (`rounded-3xl` — Mission Today, ComingSoon, Journey stepper), 20px (`rounded-[20px]` — metric card, checklist, insight/opportunity/reminder), 16px (`rounded-2xl` — tombol, priority card dalam), full pill (badge/chip).
- ✓ Shadow ringan & konsisten dengan filosofi "border tipis + glow lembut": `shadow-[0_0_..px_-Npx_rgba(255,152,0,...)]` dipakai untuk elemen aktif/primary, bukan box-shadow gelap generik.
- ⚠ **Tidak ada state hover pada kartu non-interaktif** (metric card, insight/opportunity/reminder card) — hanya tombol & nav item yang punya hover. Ini sebenarnya benar secara UX (kartu bukan link), tapi berarti "Component Standard: setiap card butuh header/content/CTA + full state coverage (loading/empty/error/hover/focus/disabled)" dari Master Guideline belum 100% terpenuhi secara harfiah untuk kartu-kartu ini.
  💡 Rekomendasi: klarifikasi definisi "hover state" di Design System — untuk kartu statis, cukup dianggap N/A, bukan kekurangan. Perlu keputusan eksplisit supaya audit halaman lain nanti tidak salah ukur.
- ⚠ **State `error` hilang di semua kartu Today** (lihat detail di §12 Reusability/Data). Loading & empty sudah ada (skeleton pulse, `todayReminderEmptySlot`, dsb), tapi tidak ada satupun kartu yang punya tampilan "gagal memuat data" — kalau `getTodaySnapshot` gagal, seluruh `TodayPanel` diam di skeleton selamanya (lihat §11).
  🎯 **Prioritas Tinggi** — Dampak: UX tinggi (silent failure tak berujung), Maintainability sedang.

## 5. Button

- ✓ Tinggi tombol header diseragamkan `h-10` (40px) — sudah sesuai catatan kode sendiri soal pixel alignment.
- ⚠ **Target sentuh di bawah 44×44px** pada beberapa tombol: tombol notifikasi/akun `h-10 w-10` (40×40px) sedikit di bawah rekomendasi 44×44px Master Guideline. Tombol checklist toggle punya padding `px-2 py-2` dengan ikon 20px — area klik efektifnya kemungkinan di bawah 44px tinggi juga (tergantung line-height teks, tapi baris `py-2` pada teks `text-sm` umumnya menghasilkan ~36-38px).
  🎯 Prioritas Sedang — Dampak: Accessibility tinggi (touch target adalah kriteria WCAG 2.5.5/2.5.8), UX sedang (terutama di HP).
  💡 Rekomendasi: naikkan tombol ikon bulat (notif, akun) dari `h-10 w-10` → `h-11 w-11` (44px), atau pertahankan ukuran visual 40px tapi tambah padding klik transparan di sekelilingnya.
- ⚠ **Tidak ada `disabled` state pada tombol yang secara logis bisa disabled** — tombol "Update Bisnis" di header & Mission Today tidak disabled saat data sedang loading/submit (state disabled hanya ada di form modal terpisah, bukan di titik ini). Risiko: double-click memicu dua kali `setShowBusinessUpdate(true)` (tidak berbahaya di sini karena idempotent), tapi tetap bukan pola yang konsisten dengan prinsip "full state coverage".
  🎯 Prioritas Rendah — Dampak: UX rendah, Maintainability rendah.
- ✓ `hover:scale-[1.03]` + `motion-reduce:` sudah konsisten di 2 tombol utama (baru diperbaiki sesi ini) dan di 2 item nav sidebar.

## 6. Sidebar

- ✓ Spacing, active state (solid `bg-primary` + glow), subtitle 2-baris, dan profile card sudah rapi & konsisten dengan skala radius/warna global.
- ✓ Icon standar 20px (`h-5 w-5`), stroke 1.6 — seragam di semua 11 `MenuKey`.
- ⚠ Sidebar disembunyikan penuh di mobile (`hidden ... md:flex` untuk logo & profile card; nav sendiri jadi horizontal scroll `overflow-x-auto` di mobile). Ini pilihan desain yang masuk akal, tapi belum ada indikator visual (misal fade edge/scroll shadow) bahwa nav bisa di-scroll ke samping di layar sempit — pengguna baru mungkin tidak sadar ada item menu lain di luar layar.
  🎯 Prioritas Rendah — Dampak: UX sedang (khusus mobile), Accessibility rendah.
  💡 Rekomendasi: tambah gradient fade tipis di ujung kanan nav saat discroll, atau scroll-snap, sebagai polish ringan nanti.

## 7. Header

- ✓ Greeting time-aware (`greetingPrefix`) + pulse headline/subheadline sudah 1 sumber kebenaran (dipakai bareng oleh `Workspace()` & `TodayPanel`, tidak dobel/tidak sinkron).
- ✓ Notifikasi, Bantuan, Switcher, Update Bisnis sudah rata tinggi `h-10`.
- ⚠ **Emoji 👋 di teks greeting** (`{greetingPrefix(t)}, {business}! 👋`) tidak dibungkus `aria-hidden` — screen reader kemungkinan akan mengejanya ("waving hand") setelah nama bisnis. Dampak kecil tapi gampang diperbaiki.
  🎯 Prioritas Rendah — Dampak: Accessibility rendah.
- ⚠ Badge notifikasi merah berisi angka statis `"1"` (placeholder visual, sudah disclosure sebagai belum ada sistem nyata) — ini sesuai arahan Design Authority sebagai placeholder, tapi tidak ada `aria-label` yang menyebutkan jumlahnya untuk screen reader (tombolnya sendiri sudah punya `aria-label` dari tooltip teks, jadi ini cuma redundansi kecil, bukan blocker).

## 8. Mission Today

- ✓ Hierarki visual kuat: badge → judul besar → deskripsi → 2 tombol aksi → Beemo hero di kanan. Beemo 280×300 dengan glow lembut (`blur-2xl`, bukan `blur-3xl`) — sudah mengikuti arahan performa.
- ✓ Progress hari ini (chip "X/Y selesai") memakai data checklist asli, bukan estimasi karangan — konsisten dengan prinsip "no fabricated data".
- ⚠ Beemo hero (`hidden ... sm:flex`) hilang total di layar <640px — di mobile, Mission Today jadi kartu teks polos tanpa mascot sama sekali. Ini trade-off responsif yang wajar (menghindari mascot mendesak konten di HP), tapi berarti "Beemo philosophy: harus ada sentuhan Beemo di setiap halaman" secara literal tidak terpenuhi di breakpoint mobile untuk kartu ini (walau Insight card & floating chat button tetap menampilkan Beemo di semua breakpoint, jadi prinsip besarnya tetap terjaga secara halaman, bukan per-kartu).
  💡 Rekomendasi: cukup didokumentasikan sebagai keputusan sadar, bukan bug.
- ⚠ CTA "Tandai Selesai" (`missionDone`) murni state lokal `useState` — hilang saat reload, tanpa keterangan eksplisit di UI (`todayMissionDoneNote` hanya muncul setelah diklik, bukan disclosure permanen). Sudah didokumentasikan lewat komentar kode sebagai keputusan sadar Fase 1, tapi dari sisi pengguna akhir berpotensi membingungkan ("kok tadi sudah saya centang, sekarang hilang lagi?").
  🎯 Prioritas Sedang — Dampak: UX sedang, Maintainability rendah.

## 9. Checklist

- ✓ Custom checkbox hijau, hover state jelas (`group-hover:border-primary/60` + ring lembut), line-through saat selesai.
- ✓ Selalu ada catatan kecil (`todayChecklistSessionNote`) bahwa checklist ini per-sesi — jujur ke pengguna.
- ⚠ Item checklist dirender sebagai `<button>` polos tanpa `role="checkbox"`/`aria-checked` — secara semantik screen reader akan mengumumkannya sebagai "button", bukan "checkbox, dicentang/tidak dicentang". Fungsinya benar secara visual tapi tidak accessible sepenuhnya untuk pengguna pembaca layar.
  🎯 Prioritas Sedang — Dampak: Accessibility tinggi (checklist adalah komponen interaktif inti halaman), Maintainability rendah (perbaikan kecil: tambah `role="checkbox" aria-checked={done}`).

## 10. Insight

- ✓ Sudah dibahas di ringkasan atas (struktur identik dengan Opportunity/Reminder, ikon Beemo asli bukan emoji, fallback data jujur berjenjang: whatChanged → nextMilestone → pesan kosong).
- ✓ Tidak ada klaim "AI" langsung di teks — persona Beemo dipakai murni sebagai framing rule-engine, sesuai prinsip "bukan robot, bukan AI generik".

## 11. Reminder

- ✓ Selalu 3 slot sesuai arahan, slot kosong ditandai jujur (bukan karangan), badge warna sesuai jenis risiko (urgent/fokus/waspada/aman).
- ⚠ Sama seperti temuan §4/§12: kalau `topRisk` gagal dimuat karena network error (bukan karena memang tidak ada risiko), UI akan menampilkan badge hijau "Aman" — yang secara teknis salah (bukan "aman", tapi "gagal memuat"). Ini satu-satunya tempat di mana ketiadaan error-state benar-benar bisa menyesatkan pengguna (menampilkan status positif palsu), bukan cuma kosong.
  🎯 **Prioritas Tinggi** — Dampak: UX tinggi (informasi salah, bukan cuma hilang), Accessibility rendah.

## 12. Opportunity

- ✓ Struktur identik Insight/Reminder, fallback `opportunityGeneric` kalau `snapshot.opportunity` kosong — tidak pernah render kartu kosong.

## 13. Chart

- ✓ Badge "Preview" jelas, tooltip statis diberi label sama, SVG dummy dengan gradient tipis & gridline halus — ringan (SVG kecil, tanpa library chart).
- ⚠ **Label tanggal di bawah chart hardcoded**: `["3 Jul", "4 Jul", ..., "9 Jul"]` — dua masalah sekaligus: (1) ini string literal yang tidak lewat sistem terjemahan (melanggar mandat bilingual "zero hardcoded strings" — format bahasa Inggris akan tetap menampilkan format Indonesia "3 Jul" alih-alih "Jul 3"), dan (2) tanggalnya statis/tidak dihitung dari tanggal hari ini, jadi akan terlihat "salah"/basi begitu tanggal sungguhan berbeda dari yang tertulis.
  🎯 **Prioritas Tinggi** — Dampak: Maintainability sedang, UX sedang (tanggal chart bisa bikin bingung kalau tidak cocok tanggal asli), ini juga temuan bilingual paling konkret di halaman ini.
  💡 Rekomendasi: hitung 7 label tanggal dari `new Date()` mundur, format lewat `toLocaleDateString(LOCALE_MAP[lang], { day: "numeric", month: "short" })` (pola yang sudah dipakai `formatDate`/`GrowthTimeline` di file yang sama) — bukan fitur baru, cuma menyamakan pola yang sudah ada.

## 14. Journey

- ✓ Stepper full-width, node 48px (`h-12 w-12`), warna hijau/orange-glow/abu sesuai status, garis penghubung terisi sesuai progres, catatan jujur bahwa baru 2 fase (`preparation`/`running`) dari 8 label yang dibedakan Business Stage Engine v1.
- ✓ `overflow-x-auto` + `min-w-[760px]` mencegah node saling tumpuk di layar sempit, walau berarti muncul scroll horizontal di dalam kartu (bukan di halaman) pada breakpoint <760px — ini scroll yang disengaja/terkontain, bukan overflow halaman yang melanggar aturan "no horizontal scroll" (yang dimaksud aturan itu adalah scroll di level halaman/viewport).

## 15. Floating Chat

- ✓ Posisi `fixed bottom-6 right-6`, ukuran & kontras cukup, `hover:scale-105` (tanpa `motion-reduce` — lihat catatan performa di bawah).
- ⚠ **Terlewat dari pass `motion-reduce` sebelumnya**: tombol floating chat masih punya `hover:scale-105` tanpa `motion-reduce:hover:scale-100`/`motion-reduce:transition-none`, tidak konsisten dengan 4 tombol lain yang baru diperbaiki di sesi ini.
  🎯 Prioritas Sedang — Dampak: Accessibility rendah-sedang (konsistensi), Maintainability rendah (fix satu baris).
- ⚠ Tombol ini `fixed`, bisa menutupi konten di ujung kanan-bawah pada layar pendek (misal tablet landscape dengan Journey stepper penuh) — belum diverifikasi tabrakan visual langsung, tapi berpotensi menutupi footer note Journey (`todayJourneyUpcomingNote`) di layar pendek.
  💡 Rekomendasi: cek visual di breakpoint 768-1024px dengan window pendek saat sesi review berikutnya.

---

## Performance Audit

| Area | Temuan | Prioritas |
|---|---|---|
| Blur/backdrop-filter | Hanya 1 `blur-2xl` (glow Beemo) + 1 `backdrop-blur-md` (toast achievement, jarang & singkat muncul) di seluruh halaman — sudah ringan. | ✓ Baik |
| Shadow | Semua shadow pakai `box-shadow` custom tipis (`0_0_Npx_-Mpx`), tidak ada shadow bertumpuk/berat. | ✓ Baik |
| Animasi | Semua transition ≤300ms (`duration-200`/`duration-300`), tidak ada animasi panjang. `motion-reduce` sudah menutup 4 dari 5 titik hover-scale/translate (floating chat masih terlewat, lihat §15). | ⚠ Sedang |
| DOM depth | `TodayPanel` cukup dalam (grid > grid > card > flex > span berlapis) tapi wajar untuk kompleksitas layout ini — tidak ada tanda pemborosan node (tidak ada wrapper `div` kosong berulang yang tidak perlu). | ✓ Baik |
| SVG | Ikon sidebar & chart pakai SVG inline kecil (path sederhana, bukan file eksternal) — ringan, tidak ada library ikon baru. | ✓ Baik |
| Re-render | `TodayPanel` menerima props baru tiap kali `Workspace()` re-render (fungsi inline `onOpenUpdateModal={() => ...}` dibuat ulang tiap render) — bukan masalah besar di skala halaman ini (tidak ada list panjang/virtualisasi), tapi **belum ada satupun `memo`/`useCallback`** di seluruh file, yang disebut eksplisit di Master Guideline ("gunakan memoization"). Untuk halaman sekompleks Today, dampak nyata di device low-end kemungkinan kecil (tidak ada re-render loop), tapi jadi utang teknis kalau halaman lain menambah state yang sering berubah (misal polling). | 🎯 Prioritas Sedang (Maintainability tinggi untuk jangka panjang, Performa rendah untuk saat ini) |
| Gambar | `beemoMascot` di-import sebagai modul (di-bundle Vite, otomatis lewat pipeline optimasi build) dipakai 3× (Mission Today besar, Insight kecil, floating chat kecil) — satu file yang sama, browser cache 1× fetch, tidak ada pemborosan. Ukuran asli file (~168KB) belum di-compress/di-resize khusus untuk tampilan 20-24px di Insight/floating chat (browser tetap download ukuran penuh, di-downscale via CSS) — untuk device low-end/koneksi lambat ini sedikit boros bandwidth pada request pertama. | 💡 Rekomendasi: sediakan versi kecil (`beemo-sm.png`, ~32px) khusus icon-size usage kalau ukuran file mulai terasa di Lighthouse. |

## Accessibility Audit

- ✓ Semua elemen interaktif utama (nav, tombol) memang elemen `<button>` asli — bukan `div onClick`, jadi sudah bisa difokus & dipicu keyboard (Enter/Space) secara native tanpa kerja tambahan.
- ⚠ **`aria-label` sangat jarang dipakai** (cuma 4 titik: notifikasi, akun menu, dismiss toast achievement, loading skeleton) — tombol ikon-saja lain (kalau ada di halaman lain nanti) berisiko tidak terdeskripsi untuk screen reader kalau polanya tidak diteruskan konsisten.
- ⚠ **Tidak ada `focus-visible` custom** di seluruh file — mengandalkan outline default browser. Ini sebenarnya *aman* secara fungsi (keyboard nav tetap bekerja), tapi outline biru default browser di atas tema gelap custom sering terlihat "pecah"/tidak match brand, dan sesuai Master Guideline ("clear focus states") sebaiknya di-style eksplisit (misal `focus-visible:ring-2 focus-visible:ring-primary`).
  🎯 Prioritas Sedang — Dampak: Accessibility tinggi, UX rendah.
- ⚠ Checklist item pakai `<button>` tanpa `role="checkbox"`/`aria-checked` (detail di §9).
- ⚠ Target sentuh beberapa tombol ikon 40×40px, di bawah 44×44px (detail di §5).
- ✓ Kontras teks utama tinggi; kontras caption paling redup perlu verifikasi (detail di §3).
- ✓ `prefers-reduced-motion` sudah didukung di 4 dari 5 titik animasi (baru diperbaiki sesi ini); 1 titik tersisa (floating chat, §15).
- Belum diverifikasi: urutan tab (`tab order`) dan screen reader end-to-end — memerlukan pengujian langsung di browser (di luar kapasitas sandbox ini saat ini, perlu dilakukan manual atau lewat Claude in Chrome saat tersedia).

## Bilingual Audit (Zero Hardcoded String)

Tiga pelanggaran konkret ditemukan di `Workspace.tsx` (semua string lain sudah lewat `t.workspace.*`, dan `tsc -b` yang bersih mengonfirmasi tidak ada key yang hilang dari `Translations` type):

1. **Baris ~1114-1117**: ternary `lang === "id" ? "Hari ini" : "Today"` untuk label "terakhir update" — hardcoded, bukan lewat `t.workspace`. 🎯 Prioritas Tinggi (gampang diperbaiki: sudah ada pola `todayQuickStatsNever`/`todayDaysAgo` di sebelahnya, tinggal tambah 1 key baru `todayLastUpdateToday`).
2. **Baris ~1488**: label tanggal chart `["3 Jul", "4 Jul", ..., "9 Jul"]` — hardcoded & statis (detail di §13). 🎯 Prioritas Tinggi.
3. **Baris ~2578**: `tier === "platinum" ? "Platinum Member" : tier === "pro" ? "Pro Member" : t.workspace.accessFreeTitle` di kartu profil sidebar — dua cabang pertama hardcoded Inggris walau UI dalam mode Indonesia, hanya cabang `free` yang lewat i18n. 🎯 Prioritas Tinggi (gampang: tambah `memberTierPlatinum`/`memberTierPro` key, pola sudah ada persis di sebelahnya).

Ketiganya kecil & cepat diperbaiki (bukan restrukturisasi), tapi termasuk pelanggaran langsung terhadap mandat "zero hardcoded strings" dari Master Guideline, jadi diberi prioritas tinggi meski dampak per-temuan kecil.

## Responsive Audit (360-1920px)

- ✓ Metric row: `grid-cols-2` (mobile) → `md:grid-cols-3` → `lg:grid-cols-5` — tidak ada overflow, kartu menyusut rapi.
- ✓ Dua kolom utama (`lg:grid-cols-3`, kiri col-span-2) baru pecah jadi 2 kolom di ≥1024px — di bawah itu (768/390/360) semua stack vertikal, aman.
- ✓ Journey stepper pakai `overflow-x-auto` + `min-w-[760px]` terkontain di dalam kartunya sendiri — tidak menyebabkan scroll horizontal di level halaman.
- ✓ Sidebar nav jadi horizontal-scroll di mobile (`overflow-x-auto md:overflow-visible`) — juga terkontain, bukan overflow halaman.
- ⚠ Belum ada verifikasi visual langsung (screenshot browser nyata) di 8 breakpoint yang diminta (360/390/414/768/1024/1280/1440/1920) — audit ini murni pembacaan kelas Tailwind & struktur grid, **bukan** hasil render browser sungguhan (sandbox ini tidak punya sesi Supabase terautentikasi + tidak ada browser tool aktif saat ini). Risiko tersembunyi seperti teks kepotong di 360px pada subtitle nav 2-baris belum bisa dipastikan 100% tanpa screenshot nyata.
  🎯 Prioritas Sedang — Dampak: perlu verifikasi visual sebelum dianggap "selesai 100%".
  💡 Rekomendasi: pakai Claude in Chrome (kalau tersedia di sesi berikutnya) untuk screenshot nyata di tiap breakpoint, bukan preview HTML statis.

## Reusability Audit

Komponen yang **sudah cukup reusable** (dipakai berulang / tidak spesifik satu halaman):
- `pulseVisual`, `pulseHeadlineText`, `pulseSubheadlineText`, `greetingPrefix`, `MenuIcon`, `ComingSoon`, `formatDate`, `DIMENSION_LABELS` — semua module-level, sudah dipakai lintas komponen (`Workspace()` & `TodayPanel` berbagi pulse text; `ComingSoon` dipakai 3 menu).

Komponen yang **masih inline di dalam JSX besar**, layak diekstrak sebelum halaman lain dibangun di atas Design System yang sama:
- 💡 **`MetricCard`** — 5 kartu metrik di baris atas Today (struktur label/value/secondary-line + `minHeight: 128`) saat ini adalah 5 blok JSX yang mirip tapi disalin manual, bukan satu komponen dengan props. Kalau halaman lain (Business Score, Target) butuh pola metrik serupa, akan disalin manual lagi.
- 💡 **`SectionHeader`** — pola "judul kecil bold + elemen kanan opsional (badge/count/CTA)" berulang di Checklist/Yang Berubah/Prioritas/Chart/Journey, masing-masing ditulis ulang.
- 💡 **`InsightCard` / `SidebarCard`** generik — Insight/Opportunity/Reminder punya 90% struktur sama (ikon bulat + judul + body + CTA), beda di warna aksen & isi konten. Bisa jadi satu komponen `<AccentCard accent="primary|green|amber" icon={...} title={...} cta={...}>`.
- 💡 **`JourneyNode`** — logic `state`/`lineDone`/warna di dalam `.map()` Journey stepper cukup kompleks untuk diulang manual di halaman lain (kalau Journey penuh 8-fase dibangun terpisah nanti, ini harus jadi komponen sendiri, bukan disalin).
- 💡 **`StatusBadge`** — pola pill berwarna (`bg-X-500/15 text-X-300`) muncul berulang (reminder badge, difficulty badge di Growth, achievement badge) dengan warna berbeda-beda ditulis manual tiap tempat — kandidat kuat jadi satu komponen `<StatusBadge tone="red|amber|green|blue">`.
- 💡 **`CTAButton`** primer (`bg-primary ... hover:scale-[1.03] motion-reduce:...`) sudah identik di 2 tempat (header, Mission Today) tapi ditulis manual 2×; kalau dijadikan komponen, perbaikan `motion-reduce` yang baru saja dilakukan otomatis berlaku ke semua pemakaian, tidak perlu diingat manual tiap titik (ini persis yang menyebabkan floating chat button terlewat di §15).

🎯 Prioritas Tinggi untuk tahap "Refactor menjadi komponen reusable" yang sudah direncanakan sebagai langkah berikutnya — bukan revisi sekarang, tapi audit ini mengonfirmasi kebutuhannya nyata (bukan cuma prinsip di atas kertas): minimal 1 bug nyata (`motion-reduce` floating chat) sudah terjadi akibat pola yang belum di-reuse.

---

## Ringkasan Prioritas

**🎯 Prioritas Tinggi** (disarankan masuk revisi pertama setelah audit ini disetujui):
1. Tidak ada error-state kalau `getTodaySnapshot`/`getBusinessHealth` gagal — skeleton loading tanpa akhir & Reminder bisa menampilkan "Aman" palsu (§4, §11).
2. 3 hardcoded string: "Hari ini"/"Today", label tanggal chart, "Platinum/Pro Member" (Bilingual Audit).
3. Ekstrak komponen reusable (`MetricCard`, `AccentCard`, `StatusBadge`, `CTAButton`, `JourneyNode`) sebelum halaman lain dibangun — mencegah bug duplikasi seperti `motion-reduce` yang terlewat di floating chat.

**🎯 Prioritas Sedang**:
4. Kontras caption paling redup (`neutral-600`/`700`) belum diverifikasi WCAG AA.
5. Target sentuh tombol ikon 40×40px → idealnya 44×44px.
6. Tidak ada `focus-visible` custom di seluruh halaman.
7. Checklist item butuh `role="checkbox"`/`aria-checked`.
8. Floating chat button terlewat dari pass `motion-reduce`.
9. Verifikasi visual nyata di 8 breakpoint (belum pernah screenshot browser sungguhan).
10. `missionDone` hilang saat reload tanpa disclosure permanen.

**🎯 Prioritas Rendah**:
11. Dokumentasi eksplisit skala padding kartu (`p-6` vs `p-8/p-10`) & keseimbangan tinggi 2 kolom.
12. Indikator scroll horizontal sidebar mobile.
13. Emoji 👋 di greeting belum `aria-hidden`.
14. Tombol Update Bisnis tanpa `disabled` state saat proses berjalan.
15. Gambar Beemo belum ada versi kecil khusus icon-size.

Tidak ada satu pun temuan di atas yang berupa "salah desain" — semuanya penyempurnaan di atas fondasi yang sudah solid. Menunggu persetujuan Anda sebelum masuk ke revisi manapun.
