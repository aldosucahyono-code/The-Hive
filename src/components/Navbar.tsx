import { useState } from "react";
import logo from "../assets/logo/hive-logo.png";
import { hardNavigate } from "../utils/navigate";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../context/AuthContext";
import AuthModal from "./AuthModal";

function navigateTo(hash: string) {
  return (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    hardNavigate(hash);
  };
}

function Navbar() {
  const currentHash = window.location.hash.replace("#", "");
  const { lang, toggleLang, t } = useLanguage();
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const NAV_LINKS = [
    { label: t.navbar.beranda, hash: "" },
    { label: t.navbar.fiturAI, hash: "fitur" },
    { label: t.navbar.paketBisnis, hash: "paket" },
    { label: t.navbar.tentangKami, hash: "tentang-kami" },
  ];

  function handleWorkspaceButtonClick() {
    if (user) {
      // Sudah login — langsung ke Workspace, jangan tanya login lagi.
      hardNavigate("workspace");
    } else {
      setShowAuthModal(true);
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 sm:py-4">
        {/* Baris utama — logo, toggle bahasa, dan CTA Workspace SELALU satu
            baris tanpa wrap, di semua ukuran layar, supaya header tidak
            pernah terlihat berantakan di HP sempit. */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <img src={logo} alt="THE HIVE" className="h-10 w-10 flex-shrink-0 object-contain sm:h-14 sm:w-14" />
            <div className="min-w-0">
              <h1 className="truncate text-base font-extrabold leading-tight sm:text-lg">THE HIVE</h1>
              <p className="hidden text-xs text-neutral-400 sm:block">{t.navbar.tagline}</p>
            </div>
          </div>

          {/* Link navigasi teks — tampil inline hanya di layar md ke atas.
              Untuk mobile, link yang sama muncul di baris scroll-horizontal
              di bawah (lihat <nav> kedua) — pola yang sama seperti sidebar
              menu Workspace, bukan hamburger/drawer yang lebih berat. */}
          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => {
              const isActive = currentHash === link.hash;
              const linkClassName =
                "text-sm font-medium transition-colors " +
                (isActive
                  ? "border-b-2 border-primary text-primary"
                  : "border-b-2 border-transparent text-neutral-300 hover:text-white");

              return (
                <a
                  key={link.hash}
                  href={link.hash ? "#" + link.hash : "#"}
                  onClick={navigateTo(link.hash)}
                  className={linkClassName}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
            <button
              onClick={toggleLang}
              title={lang === "id" ? "Switch to English" : "Ganti ke Bahasa Indonesia"}
              className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-2 text-xs font-bold text-neutral-200 hover:border-primary/40 hover:text-white sm:px-3"
            >
              <span>🌐</span>
              <span>{lang === "id" ? "EN" : "ID"}</span>
            </button>

            <button
              onClick={handleWorkspaceButtonClick}
              className="whitespace-nowrap rounded-full bg-primary px-3 py-2 text-xs font-bold text-black hover:opacity-90 sm:px-4 sm:text-sm"
            >
              {user ? t.navbar.workspaceButton : t.navbar.activateWorkspaceButton}
            </button>
          </div>
        </div>

        {/* Link navigasi mobile — baris scroll-horizontal ringan (tanpa
            state buka/tutup, tanpa overlay) supaya tetap cepat dan sesuai
            filosofi "ringan", konsisten dengan pola sidebar Workspace. */}
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden md:hidden">
          {NAV_LINKS.map((link) => {
            const isActive = currentHash === link.hash;
            return (
              <a
                key={link.hash}
                href={link.hash ? "#" + link.hash : "#"}
                onClick={navigateTo(link.hash)}
                className={
                  "flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
                  (isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-white/10 text-neutral-300 hover:border-primary/30 hover:text-white")
                }
              >
                {link.label}
              </a>
            );
          })}
        </nav>
      </div>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </header>
  );
}

export default Navbar;
