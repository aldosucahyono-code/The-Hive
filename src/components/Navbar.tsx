import logo from "../assets/logo/hive-logo.png";
import { hardNavigate } from "../utils/navigate";
import { useLanguage } from "../i18n/LanguageContext";

function navigateTo(hash: string) {
  return (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    hardNavigate(hash);
  };
}

const NAV_LINKS = [
  { label: "Beranda", hash: "" },
  { label: "Fitur AI", hash: "fitur" },
  { label: "Paket Bisnis", hash: "paket" },
  { label: "Tentang Kami", hash: "tentang-kami" },
];

function Navbar() {
  // Sama seperti App.tsx: karena navigasi selalu hard-reload, hash saat ini
  // cukup dibaca sekali langsung dari URL — tidak perlu state/listener.
  const currentHash = window.location.hash.replace("#", "");
  const { lang, toggleLang } = useLanguage();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">

        <div className="flex items-center gap-3">
          <img src={logo} alt="THE HIVE" className="h-14 w-14 object-contain" />
          <div>
            <h1 className="text-lg font-extrabold leading-tight">THE HIVE</h1>
            <p className="text-xs text-neutral-400">Konsultan Bisnis AI Anda</p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-6">
          {NAV_LINKS.map((link) => {
            const isActive = currentHash === link.hash;
            return (
              <a
                key={link.hash}
                href={link.hash ? `#${link.hash}` : "#"}
                onClick={navigateTo(link.hash)}
                className={
                  "text-sm font-medium transition-colors " +
                  (isActive
                    ? "border-b-2 border-primary text-primary"
                    : "border-b-2 border-transparent text-neutral-300 hover:text-white")
                }
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

          <button className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-neutral-200">
            <span>⚡</span>
            <span>Powered by <strong className="text-primary">Beemo AI</strong></span>
          </button>
        </div>

      </div>
    </header>
  );
}

export default Navbar;
