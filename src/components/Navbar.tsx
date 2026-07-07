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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="THE HIVE" className="h-14 w-14 object-contain" />
          <div>
            <h1 className="text-lg font-extrabold leading-tight">THE HIVE</h1>
            <p className="text-xs text-neutral-400">{t.navbar.tagline}</p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-6">
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

        <div className="flex items-center gap-3">
          <button
            onClick={toggleLang}
            title={lang === "id" ? "Switch to English" : "Ganti ke Bahasa Indonesia"}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-neutral-200 hover:border-primary/40 hover:text-white"
          >
            <span>🌐</span>
            <span>{lang === "id" ? "EN" : "ID"}</span>
          </button>

          <button
            onClick={handleWorkspaceButtonClick}
            className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-black hover:opacity-90"
          >
            {user ? "Workspace" : "Aktifkan Workspace"}
          </button>
        </div>
      </div>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </header>
  );
}

export default Navbar;
