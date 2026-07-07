import { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";

import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Features from "./components/Features";
import Pricing from "./components/Pricing";
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

  const rawHash = window.location.hash.replace("#", "");

  // Setelah user klik Magic Link di email, Supabase (mode PKCE) akan
  // menambahkan ?code=xxxx di URL. Selama proses tukar-kode-jadi-sesi
  // belum selesai (loading), tampilkan layar transisi singkat.
  const urlParams = new URLSearchParams(window.location.search);
  const hasAuthCode = urlParams.has("code");

  useEffect(() => {
    if (hasAuthCode && !loading) {
      // Bersihkan ?code=xxxx dari URL biar rapi, lalu arahkan ke workspace
      window.history.replaceState({}, "", window.location.pathname + "#workspace");
      window.location.reload();
    }
  }, [hasAuthCode, loading]);

  if (hasAuthCode && loading) {
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

    function tryScroll() {
      const target = document.getElementById(hash);

      if (target) {
        target.scrollIntoView();
        return;
      }

      attempts += 1;
      if (attempts < 60) {
        frameId = requestAnimationFrame(tryScroll);
      }
    }

    frameId = requestAnimationFrame(tryScroll);

    return () => cancelAnimationFrame(frameId);
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
    return (
      <>
        <Navbar />
        <Workspace />
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

  return (
    <>
      <div className="hex-pattern" aria-hidden="true"></div>

      <Navbar />

      {!start ? (
        <>
          <Hero onStart={() => setStart(true)} animate={animateHero} />
          <Features animate={animateHero} />
          <Pricing onStart={() => setStart(true)} animate={animateHero} />
        </>
      ) : (
        <ChatWizard />
      )}

      <Footer />
    </>
  );
}

export default App;
