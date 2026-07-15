import { useEffect, useState } from "react";
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

type NavbarProps = {
  // Redesign Juli 2026 (directive PO: "background hitam ketika masuk
  // workspace saja, lainnya putih") — default SEKARANG "light". Cuma rute
  // Workspace yang secara eksplisit minta variant="dark" (lihat App.tsx);
  // semua rute lain (homepage, ChatWizard, halaman legal/tentang-kami/
  // pembayaran/dst) otomatis terang tanpa perlu diset satu-satu.
  variant?: "dark" | "light";
  // Audit Juli 2026 (bug nyata: klik magic link di email tapi tetap
  // "belum Login" / landing page tanpa penjelasan): App.tsx mendeteksi
  // redirect error dari Supabase (#error=access_denied&error_code=
  // otp_expired, biasanya karena email client memindai link duluan dan
  // menghabiskan token sekali-pakainya) dan meneruskan sinyal ini --
  // modal login otomatis terbuka dengan pesan jelas alih-alih pengguna
  // mendarat diam-diam tanpa penjelasan apapun.
  authError?: boolean;
};

function Navbar({ variant = "light", authError = false }: NavbarProps) {
  const currentHash = window.location.hash.replace("#", "");
  const { lang, toggleLang, t } = useLanguage();
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(authError);
  const isLight = variant === "light";

  // Audit Juli 2026 ("verifikasi magic link lintas perangkat" -- lihat
  // migrations/2026-07-14_login_relay.sql): kalau modal login sedang
  // terbuka dan `user` tiba-tiba terisi TANPA reload apapun (ini bisa
  // terjadi kalau login dikonfirmasi lewat link yang diklik di perangkat
  // lain -- lihat AuthContext.tsx/AuthModal.tsx), langsung tutup modal &
  // masuk Workspace, persis seperti kalau tombol Workspace diklik manual
  // setelah login normal di perangkat yang sama.
  useEffect(() => {
    if (user && showAuthModal) {
      setShowAuthModal(false);
      hardNavigate("workspace");
    }
  }, [user, showAuthModal]);

  // Isi navbar (link + tombol) SAMA di semua rute termasuk Workspace
  // (audit Juli 2026, directive PO: "isi navbar di workspace sama dengan
  // landing page, background tetap gelap") — dulu variant="dark" (Workspace)
  // punya daftar link lebih pendek (cuma Beranda/Fitur AI/Tentang Kami).
  // Sekarang link & tombol identik untuk kedua variant; HANYA warna
  // (lihat isLight di bawah) yang masih dibedakan supaya latar gelap
  // Workspace tidak berubah.
  const NAV_LINKS = [
    { label: t.navbar.beranda, hash: "" },
    { label: t.navbar.fitur, hash: "fitur" },
    { label: t.navbar.caraKerja, hash: "cara-kerja" },
    { label: t.navbar.faq, hash: "faq" },
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

  const headerClassName = isLight
    ? "sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur-md"
    : "sticky top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur-md";

  return (
    <header className={headerClassName}>
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 sm:py-4">
        {/* Baris utama — logo, toggle bahasa, dan CTA Workspace SELALU satu
            baris tanpa wrap, di semua ukuran layar, supaya header tidak
            pernah terlihat berantakan di HP sempit. */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <img src={logo} alt="THE HIVE" className="h-10 w-10 flex-shrink-0 object-contain sm:h-14 sm:w-14" />
            <div className="min-w-0">
              <h1 className={"truncate text-base font-extrabold leading-tight sm:text-lg " + (isLight ? "text-neutral-900" : "")}>THE HIVE</h1>
              <p className={"hidden text-xs sm:block " + (isLight ? "text-neutral-500" : "text-neutral-400")}>{t.navbar.tagline}</p>
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
                  : isLight
                    ? "border-b-2 border-transparent text-neutral-600 hover:text-neutral-900"
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
              className={
                "flex items-center gap-1.5 rounded-full border px-2.5 py-2 text-xs font-bold sm:px-3 " +
                (isLight
                  ? "border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-primary/40 hover:text-neutral-900"
                  : "border-white/15 bg-white/5 text-neutral-200 hover:border-primary/40 hover:text-white")
              }
            >
              <span>🌐</span>
              <span>{lang === "id" ? "EN" : "ID"}</span>
            </button>

            {/* Tombol SAMA di kedua variant sekarang — cuma warna border/teks
                tombol outline yang disesuaikan supaya kebaca di latar
                gelap Workspace. */}
            <button
              onClick={handleWorkspaceButtonClick}
              className={
                "whitespace-nowrap rounded-full border px-3 py-2 text-xs font-bold sm:px-4 sm:text-sm " +
                (isLight
                  ? "border-neutral-300 text-neutral-800 hover:border-neutral-400"
                  : "border-white/25 text-white hover:border-white/50")
              }
            >
              {user ? t.navbar.workspaceButton : t.navbar.loginButton}
            </button>
            <button
              onClick={() => hardNavigate("mulai")}
              className="whitespace-nowrap rounded-full bg-primary px-3 py-2 text-xs font-bold text-black hover:opacity-90 sm:px-4 sm:text-sm"
            >
              {t.hero.ctaPrimary}
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
                    : isLight
                      ? "border-neutral-200 text-neutral-600 hover:border-primary/30 hover:text-neutral-900"
                      : "border-white/10 text-neutral-300 hover:border-primary/30 hover:text-white")
                }
              >
                {link.label}
              </a>
            );
          })}
        </nav>
      </div>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} initialError={authError} />}
    </header>
  );
}

export default Navbar;
