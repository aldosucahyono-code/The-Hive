import { useEffect, useState } from "react";

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

function App() {

  const [start, setStart] = useState(false);

  const rawHash = window.location.hash.replace("#", "");

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
