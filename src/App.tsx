import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";

import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Features from "./components/Features";
import HowItWorks from "./components/HowItWorks";
import ReportPreview from "./components/ReportPreview";
import InsightAgregat from "./components/InsightAgregat";
import FAQSection from "./components/FAQSection";
import ChatWizard from "./components/ChatWizard";
import Footer from "./components/Footer";
import LegalPage from "./components/LegalPage";
import FeedbackPage from "./components/FeedbackPage";
import ContactPage from "./components/ContactPage";
import { ADMIN_SECRET_PATH } from "./adminSecretPath";
import TentangKami from "./components/TentangKami";
import NurtureUnsubscribePage from "./components/NurtureUnsubscribePage";
import ErrorBoundary from "./components/ErrorBoundary";

// Audit Juli 2026 (Performance, masukan ChatGPT "ringan di banyak device" +
// prinsip PO "sekalipun orang gaptek/awam teknologi harus terbimbing" --
// audit performa terpisah tadi menemukan NOL code-splitting di seluruh
// src/, semua rute eager-imported jadi satu bundle raksasa). Navigasi di
// App ini SELALU lewat hardNavigate (full page reload, lihat
// utils/navigate.ts) -- jadi lazy() di sini TIDAK mengubah perilaku
// navigasi sama sekali, cuma memisahkan Workspace (6000+ baris, fitur
// dashboard lengkap) / AdminPage / PaymentPage / ReferralPage jadi chunk
// terpisah yang HANYA diunduh saat rute itu benar-benar dibuka -- supaya
// pengunjung landing page pertama kali (termasuk yang koneksinya lambat,
// tepat golongan yang ingin benar-benar dilayani) tidak perlu mengunduh
// kode Workspace/Admin yang bahkan belum tentu mereka pakai.
const Workspace = lazy(() => import("./components/Workspace"));
const AdminPage = lazy(() => import("./components/AdminPage"));
const PaymentPage = lazy(() => import("./components/PaymentPage"));
const ReferralPage = lazy(() => import("./components/ReferralPage"));

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <p className="text-neutral-400">Memuat...</p>
    </div>
  );
}

function App() {

  const [start, setStart] = useState(false);
  const { loading, user } = useAuth();

  // BUGFIX Juli 2026 ("klik magic link -> mendarat di Landing page, BUKAN
  // Workspace, walau login SUDAH berhasil" -- laporan users lewat video,
  // dikonfirmasi lewat frame-by-frame + audit kode). Root cause: SEBELUM
  // ini, rawHashRaw/urlParams dibaca ULANG dari window.location di SETIAP
  // render (bukan cuma sekali). supabase-js (detectSessionInUrl: true)
  // otomatis MEMBERSIHKAN #access_token=... dari address bar begitu token
  // itu selesai diproses jadi sesi -- pembersihan ini terjadi kira-kira
  // BERSAMAAN dengan "loading" berubah false & "user" terisi. Race-nya:
  // begitu "user" berubah dan komponen ini re-render, rawHashRaw yang
  // dibaca ULANG saat render itu JUGA sudah ikut kosong (sudah keburu
  // dibersihkan duluan oleh supabase-js) -- isAuthCallback pun ikut jadi
  // false TEPAT di render yang seharusnya memicu redirect ke #workspace
  // (effect di bawah, baris ~62). Hasilnya: redirect tidak pernah jalan,
  // App jatuh ke rute default (Landing page) walau pengguna sudah benar-
  // benar berhasil login -- persis gejala di video laporan (URL akhirnya
  // cuma "/#" polos, padahal Navbar sudah menampilkan tombol "Workspace"
  // yang membuktikan sesi sebenarnya sudah aktif).
  //
  // Fix: baca window.location HANYA SEKALI saat komponen ini mount (lazy
  // initializer useState, bukan window.location langsung tiap render) --
  // nilainya jadi STABIL sepanjang hidup komponen ini, terlepas kapan
  // supabase-js membersihkan address bar setelahnya. Aman dipakai di
  // seluruh App ini karena navigasi SELALU lewat hardNavigate (full page
  // reload, lihat utils/navigate.ts) -- tidak pernah ada perubahan
  // hash/query TANPA remount komponen ini.
  const [rawHashRaw] = useState(() => window.location.hash.replace("#", ""));
  const [initialSearch] = useState(() => window.location.search);

  // Setelah user klik Magic Link di email, Supabase bisa memakai salah satu
  // dari DUA cara mengembalikan token, tergantung konfigurasi Auth flow
  // project (PKCE vs implicit) — kita TIDAK mengasumsikan salah satunya:
  // 1. PKCE (umumnya default sekarang): ?code=xxxx di query string.
  // 2. Implicit (lama): #access_token=...&type=magiclink di hash fragment.
  // AUDIT Juli 2026: sebelumnya HANYA mendeteksi kasus #1 — kalau project
  // ternyata memakai flow #2, rawHash berisi teks token yang tidak cocok
  // rute manapun, jatuh ke halaman utama (Beranda), dan pelanggan harus
  // klik "Workspace" manual alih-alih langsung masuk. Sekarang keduanya
  // dideteksi, supaya SELALU diarahkan ke #workspace terlepas dari flow
  // yang aktif di project ini.
  const urlParams = new URLSearchParams(initialSearch);
  const hasAuthCode = urlParams.has("code");
  const hasHashToken =
    rawHashRaw.includes("access_token=") || rawHashRaw.includes("type=magiclink") || rawHashRaw.includes("type=recovery");
  const isAuthCallback = hasAuthCode || hasHashToken;
  // Kalau hash-nya sendiri berisi token mentah (flow implicit), JANGAN
  // dipakai sebagai rawHash rute biasa (bukan "workspace"/"bayar-pro"/dst)
  // — anggap kosong sampai useEffect di bawah membersihkannya jadi
  // "#workspace" lewat reload.
  const rawHash = hasHashToken ? "" : rawHashRaw;

  useEffect(() => {
    // Bugfix Juli 2026 (bug nyata dialami lewat in-app browser Gmail di
    // HP): SEBELUMNYA syaratnya cuma "isAuthCallback && !loading" -- kalau
    // Supabase gagal menyimpan sesi dari token di URL (mis. localStorage
    // tidak selalu bertahan lewat window.location.reload() di webview
    // in-app tertentu), reload di bawah tetap dipaksa jalan dan mendarat
    // di Workspace TANPA sesi -- pengguna cuma melihat guard "Kamu belum
    // login" tanpa penjelasan apapun kenapa. Sekarang WAJIB "user" sudah
    // benar-benar terisi dulu -- kalau tidak, effect di bawah (deteksi
    // hashTokenSessionFailed) yang menangani, BUKAN reload buta ke sini.
    if (isAuthCallback && !loading && user) {
      // Bersihkan ?code=xxxx / #access_token=... dari URL biar rapi DAN
      // supaya pengguna tidak bisa refresh/bookmark URL yang masih membawa
      // token mentah, lalu arahkan langsung ke Workspace-nya sendiri.
      // window.location.reload() di bawah memuat ulang seluruh halaman dari
      // nol (bukan navigasi client-side) — memastikan tidak ada state React
      // basi dari sesi sebelumnya (mis. kalau browser ini tadinya login
      // sebagai akun lain) yang ikut terbawa ke tampilan Workspace baru ini.
      window.history.replaceState({}, "", window.location.pathname + "#workspace");
      window.location.reload();
    }
  }, [isAuthCallback, loading, user]);

  // Audit Juli 2026 ("verifikasi magic link lintas perangkat" -- lihat
  // migrations/2026-07-14_login_relay.sql untuk alur lengkap): ini adalah
  // sisi "Device B" -- perangkat MANAPUN yang benar-benar mengklik link di
  // email (bisa beda dari perangkat yang tadinya minta link/"Device A").
  // Supabase sendiri (lewat detectSessionInUrl, lihat supabaseClient.ts)
  // SUDAH otomatis membaca access_token/refresh_token dari hash URL dan
  // membuat sesi login UNTUK PERANGKAT INI -- efek di bawah ini TIDAK
  // mengurus itu. Tugasnya cuma satu: kalau ada "rid" di query string
  // (artinya link ini datang dari alur relai, bukan link magic link
  // biasa), titipkan token yang sama ke backend (action
  // confirmLoginRelay) supaya Device A yang sedang menunggu bisa
  // mengambilnya lewat polling dan otomatis masuk juga -- tanpa perlu
  // menunggu apapun dari sisi Device B ini. Fire-and-forget & jalan SEKALI
  // saat mount, terlepas dari status loading sesi Device B sendiri.
  useEffect(() => {
    const rid = urlParams.get("rid");
    if (!hasHashToken || !rid) return;

    const hashParams = new URLSearchParams(rawHashRaw);
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    if (!accessToken || !refreshToken) return;

    fetch("/api/check-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirmLoginRelay", rid, accessToken, refreshToken }),
    }).catch((err) => console.error("confirmLoginRelay error:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Audit Juli 2026 (bug nyata dilaporkan pemilik produk: klik link login
  // di email -> "belum Login" di HP, landing page tanpa penjelasan di
  // laptop). Supabase mengembalikan #error=access_denied&error_code=
  // otp_expired&error_description=... kalau token magic link SUDAH
  // dipakai/kedaluwarsa SEBELUM pengguna benar-benar mengklik secara
  // manual -- penyebab paling umum: pemindai keamanan email (Gmail/
  // Outlook Safe Links dsb) "mengunjungi" link itu duluan di server
  // mereka untuk pemindaian, menghabiskan token sekali-pakainya. Hash ini
  // TIDAK cocok rute manapun (bukan "workspace"/dst) dan sebelumnya jatuh
  // diam-diam ke landing page biasa tanpa penjelasan apapun -- sekarang
  // dideteksi eksplisit lewat "error_code=" dan diteruskan ke Navbar
  // supaya AuthModal otomatis terbuka dengan pesan jelas + tombol kirim
  // ulang (lihat Navbar.tsx/AuthModal.tsx).
  const hasAuthErrorHash = rawHashRaw.includes("error_code=");

  // Bugfix Juli 2026 (mode kegagalan KEDUA, ditemukan lewat laporan
  // langsung + screenshot pemilik produk dari in-app browser Gmail di HP):
  // link-nya VALID (hash punya access_token=, TANPA error_code= sama
  // sekali), tapi setelah reload paksa ke #workspace di effect di atas,
  // sesi ternyata TIDAK ada (user masih null) -- Workspace menampilkan
  // guard "Kamu belum login" yang membingungkan, padahal link-nya sendiri
  // sah. Kemungkinan besar localStorage/cookie sesi tidak selalu bertahan
  // lewat window.location.reload() di webview in-app tertentu (Gmail,
  // Instagram, dst berperilaku beda dari browser biasa). Diperlakukan SAMA
  // seperti hasAuthErrorHash di atas -- buka AuthModal dengan pesan jelas
  // + tombol kirim ulang, BUKAN reload buta ke Workspace yang gagal diam-diam.
  const hashTokenSessionFailed = hasHashToken && !loading && !user;
  const authError = hasAuthErrorHash || hashTokenSessionFailed;

  useEffect(() => {
    if (!authError) return;
    // Bersihkan hash/token mentah dari URL (query string ?rid=... SENGAJA
    // dipertahankan -- kalau pengguna minta link baru dari modal yang baru
    // saja otomatis terbuka, alur relai lintas-perangkat yang sama tetap
    // bisa dipakai) supaya tidak bisa di-refresh/bookmark dengan hash
    // mentah/pesan error Supabase.
    window.history.replaceState({}, "", window.location.pathname + window.location.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authError]);

  const animateHero = rawHash === "";

  useEffect(() => {
    if (start) return;

    const hash = rawHash;
    if (!hash) return;

    let attempts = 0;
    let frameId: number;
    let resizeObserver: ResizeObserver | undefined;
    let failsafeTimeoutId: number | undefined;

    // Catatan penting: navigasi antar-section SELALU lewat hardNavigate
    // (full page reload, lihat utils/navigate.ts), jadi "scroll ke section"
    // ini sebenarnya "pulihkan posisi setelah reload" — bukan smooth-scroll
    // in-page biasa. html{scroll-behavior:smooth} (index.css) membuat
    // scrollIntoView() dianimasikan; kalau gambar di atas target (mascot
    // Beemo, ikon fitur, dst) masih memuat SAAT animasi berjalan, tinggi
    // dokumen berubah di tengah jalan dan hasilnya scroll bisa mendarat
    // meleset (pernah teramati: overshoot sampai lewat section tujuan).
    // Fix: paksa instant (lompat langsung, tidak lomba dengan animasi),
    // lalu re-align setiap kali tinggi body BENAR-BENAR berubah (via
    // ResizeObserver) — bukan menebak durasi delay.
    function alignToTarget() {
      const target = document.getElementById(hash);
      if (target) target.scrollIntoView({ behavior: "instant", block: "start" });
    }

    function tryScroll() {
      const target = document.getElementById(hash);

      if (target) {
        alignToTarget();

        if (typeof ResizeObserver !== "undefined") {
          let settleTimer: number;
          resizeObserver = new ResizeObserver(() => {
            alignToTarget();
            window.clearTimeout(settleTimer);
            settleTimer = window.setTimeout(() => resizeObserver?.disconnect(), 400);
          });
          resizeObserver.observe(document.body);
          // Failsafe — jangan amati tanpa batas kalau tidak pernah "diam".
          failsafeTimeoutId = window.setTimeout(() => resizeObserver?.disconnect(), 3000);
        }
        return;
      }

      attempts += 1;
      if (attempts < 60) {
        frameId = requestAnimationFrame(tryScroll);
      }
    }

    frameId = requestAnimationFrame(tryScroll);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      if (failsafeTimeoutId) window.clearTimeout(failsafeTimeoutId);
    };
  }, [start, rawHash]);

  // PENTING (bugfix Juli 2026): pengecekan "loading" ini HARUS berada di
  // sini, SETELAH semua hook (useState/useEffect) di atas sudah dipanggil,
  // bukan disisipkan di antara dua useEffect seperti sebelumnya. Versi lama
  // membuat jumlah hook yang dipanggil berbeda antar render begitu "loading"
  // berubah dari true->false di tengah proses tukar token magic link
  // (Rules of Hooks violation) — React meng-crash-kan seluruh App menjadi
  // layar putih kosong yang cuma bisa dipulihkan dengan refresh manual.
  // Early return SETELAH hook (seperti blok rawHash di bawah) aman karena
  // tidak ada hook lagi sesudahnya.
  if (isAuthCallback && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-neutral-400">Mengaktifkan Workspace kamu...</p>
      </div>
    );
  }

  // Audit Juli 2026 ("email dorongan personal bulanan... link berhenti
  // langganan"): halaman PUBLIK, dicek lewat query string (bukan hash)
  // supaya bisa langsung diklik dari email tanpa perlu App ini sempat
  // memuat state lain dulu. Tidak butuh login apapun -- lihat
  // services/nurture/unsubscribe.ts untuk validasi tokennya.
  const unsubscribeToken = urlParams.get("unsub");
  if (unsubscribeToken) {
    return (
      <>
        <Navbar authError={authError} />
        <NurtureUnsubscribePage token={unsubscribeToken} />
        <Footer />
      </>
    );
  }

  // Halaman khusus (legal, ulasan internal, referensi) tampil MENGGANTIKAN
  // seluruh landing page/wizard — bukan cuma section di dalam Beranda.
  if (rawHash === "privasi" || rawHash === "syarat" || rawHash === "refund") {
    return (
      <>
        <Navbar authError={authError} />
        <LegalPage type={rawHash as "privasi" | "syarat" | "refund"} />
        <Footer />
      </>
    );
  }

  if (rawHash === "ulasan-internal") {
    return (
      <>
        <Navbar authError={authError} />
        <FeedbackPage />
        <Footer />
      </>
    );
  }

  // Audit Juli 2026 ("channel support publik"): BEDA dari #ulasan-internal
  // di atas (sengaja disembunyikan, tidak ada link publik) -- #kontak ini
  // PUBLIK, tertaut dari Footer semua halaman (lihat Footer.tsx), supaya
  // pengguna yang bukan kenalan pribadi tetap punya jalur menghubungi.
  if (rawHash === "kontak") {
    return (
      <>
        <Navbar authError={authError} />
        <ContactPage />
        <Footer />
      </>
    );
  }

  // Audit Juli 2026 ("pisahkan halaman super admin ini dari users, atau
  // hackers"): TIDAK LAGI di hash "#admin" yang gampang ditebak -- sekarang
  // di PATH acak (lihat src/adminSecretPath.ts + vercel.json rewrites,
  // HARUS SAMA PERSIS dengan services/admin/adminSecretPath.ts di backend).
  // Path ini SENDIRIAN bukan proteksi utama (bundle JS publik tetap bisa
  // dibaca siapapun yang mencari) -- proteksi sebenarnya ada di alur email
  // admin terdaftar + PIN 6 digit di dalam AdminPage.tsx sendiri (lihat
  // migrations/2026-07-15c_admin_security.sql).
  if (window.location.pathname === `/${ADMIN_SECRET_PATH}`) {
    return (
      <>
        <Navbar authError={authError} />
        {/* Audit Juli 2026 ("halaman admin belum berfungsi sebagaimana
            baiknya... ketika salah satu diklik loading tiba2 blank"):
            AdminPage sebelumnya TIDAK punya ErrorBoundary sama sekali --
            kalau render detail pelanggan gagal (mis. data pelanggan besar/
            tak terduga), seluruh halaman jadi putih kosong tanpa pesan.
            Sama seperti Workspace, ini pagar pengaman generik, bukan
            pengganti dari memperbaiki penyebab render error itu sendiri. */}
        <ErrorBoundary>
          <Suspense fallback={<RouteLoadingFallback />}>
            <AdminPage />
          </Suspense>
        </ErrorBoundary>
        <Footer />
      </>
    );
  }

  if (rawHash === "referensi") {
    return (
      <>
        <Navbar authError={authError} />
        <ErrorBoundary>
          <Suspense fallback={<RouteLoadingFallback />}>
            <ReferralPage />
          </Suspense>
        </ErrorBoundary>
        <Footer />
      </>
    );
  }

  if (rawHash === "tentang-kami") {
    return (
      <>
        <Navbar authError={authError} />
        <TentangKami />
        <Footer />
      </>
    );
  }

  if (rawHash === "workspace") {
    // Satu-satunya rute yang TETAP gelap (directive PO: "background hitam
    // ketika masuk workspace saja, lainnya putih") — Navbar/Footer default
    // sekarang terang, jadi di sini keduanya eksplisit diminta variant
    // "dark", dan seluruh konten dibungkus .theme-dark (index.css) supaya
    // elemen di dalam Workspace yang mengandalkan warna teks putih bawaan
    // body tetap terbaca (body sendiri sekarang defaultnya terang).
    return (
      <div className="theme-dark">
        <Navbar variant="dark" authError={authError} />
        {/* Audit pra-soft-launch (19 Jul 2026): ditemukan crash nyata yang
            membuat seluruh halaman kosong putih tanpa pesan/tombol apapun.
            ErrorBoundary di sini TIDAK memperbaiki bug aslinya (itu masih
            perlu dicari), tapi memastikan crash render apa pun di Workspace
            (sekarang atau nanti) menampilkan pesan + tombol "Muat Ulang",
            bukan layar putih buntu. */}
        <ErrorBoundary>
          <Suspense fallback={<RouteLoadingFallback />}>
            <Workspace />
          </Suspense>
        </ErrorBoundary>
        <Footer variant="dark" />
      </div>
    );
  }

  // Route khusus "#mulai" — render ChatWizard langsung tanpa harus lewat
  // Hero/tombol "Mulai" dulu (audit Juli 2026, directive PO: "satu-satunya
  // pintu untuk analisa bisnis baru... hanya lewat chat wizzard"). Dipakai
  // sebagai target redirect dari Workspace yang masih kosong dan tombol
  // "Tambah Bisnis" di Workspace untuk user yang sudah login — ChatWizard
  // sendiri (lewat useAuth) mendeteksi status login dan menyesuaikan alurnya
  // (skip pertanyaan email, cek batas paket sebelum form, dst).
  if (rawHash === "mulai") {
    return (
      <>
        <Navbar authError={authError} />
        <ChatWizard />
        <Footer />
      </>
    );
  }

  if (rawHash === "bayar-pro" || rawHash === "bayar-platinum") {
    return (
      <>
        <Navbar authError={authError} />
        <ErrorBoundary>
          <Suspense fallback={<RouteLoadingFallback />}>
            <PaymentPage plan={rawHash === "bayar-pro" ? "pro" : "platinum"} />
          </Suspense>
        </ErrorBoundary>
        <Footer />
      </>
    );
  }

  // Homepage (Beranda) — landing page terang, Juli 2026 (redesign per
  // instruksi PO: "lebih ringan, profesional, background putih"). variant
  // "light" di sini eksplisit untuk kejelasan meski sekarang sudah jadi
  // default Navbar/Footer — satu-satunya rute yang TETAP gelap adalah
  // Workspace (lihat blok "workspace" di atas). Setelah user klik CTA
  // (start=true) di bawah, tampilan pindah ke ChatWizard — TETAP terang
  // (bukan gelap seperti sebelum redesign ini) — konsisten dengan
  // directive "satu-satunya pintu untuk analisa bisnis baru... hanya
  // lewat chat wizzard".
  if (!start) {
    return (
      <div className="bg-white text-neutral-900">
        <Navbar variant="light" authError={authError} />
        <Hero onStart={() => setStart(true)} animate={animateHero} />
        <Features animate={animateHero} />
        <HowItWorks animate={animateHero} />
        <ReportPreview onStart={() => setStart(true)} animate={animateHero} />
        <InsightAgregat animate={animateHero} />
        <FAQSection animate={animateHero} />
        <Footer variant="light" />
      </div>
    );
  }

  return (
    <>
      <Navbar authError={authError} />
      <ChatWizard />
      <Footer />
    </>
  );
}

export default App;
