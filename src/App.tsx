import { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";

import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Features from "./components/Features";
import HowItWorks from "./components/HowItWorks";
import ReportPreview from "./components/ReportPreview";
import FAQSection from "./components/FAQSection";
import ChatWizard from "./components/ChatWizard";
import Footer from "./components/Footer";
import LegalPage from "./components/LegalPage";
import FeedbackPage from "./components/FeedbackPage";
import ReferralPage from "./components/ReferralPage";
import TentangKami from "./components/TentangKami";
import PaymentPage from "./components/PaymentPage";
import Workspace from "./components/Workspace";

function App() {

  const [start, setStart] = useState(false);
  const { loading } = useAuth();

  const rawHashRaw = window.location.hash.replace("#", "");

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
  const urlParams = new URLSearchParams(window.location.search);
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
    if (isAuthCallback && !loading) {
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
  }, [isAuthCallback, loading]);

  if (isAuthCallback && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-neutral-400">Mengaktifkan Workspace kamu...</p>
      </div>
    );
  }

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

  // Halaman khusus (legal, ulasan internal, referensi) tampil MENGGANTIKAN
  // seluruh landing page/wizard — bukan cuma section di dalam Beranda.
  if (rawHash === "privasi" || rawHash === "syarat" || rawHash === "refund") {
    return (
      <>
        <Navbar />
        <LegalPage type={rawHash as "privasi" | "syarat" | "refund"} />
        <Footer />
      </>
    );
  }

  if (rawHash === "ulasan-internal") {
    return (
      <>
        <Navbar />
        <FeedbackPage />
        <Footer />
      </>
    );
  }

  if (rawHash === "referensi") {
    return (
      <>
        <Navbar />
        <ReferralPage />
        <Footer />
      </>
    );
  }

  if (rawHash === "tentang-kami") {
    return (
      <>
        <Navbar />
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
        <Navbar variant="dark" />
        <Workspace />
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
        <Navbar />
        <ChatWizard />
        <Footer />
      </>
    );
  }

  if (rawHash === "bayar-pro" || rawHash === "bayar-platinum") {
    return (
      <>
        <Navbar />
        <PaymentPage plan={rawHash === "bayar-pro" ? "pro" : "platinum"} />
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
        <Navbar variant="light" />
        <Hero onStart={() => setStart(true)} animate={animateHero} />
        <Features animate={animateHero} />
        <HowItWorks animate={animateHero} />
        <ReportPreview onStart={() => setStart(true)} animate={animateHero} />
        <FAQSection animate={animateHero} />
        <Footer variant="light" />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <ChatWizard />
      <Footer />
    </>
  );
}

export default App;
