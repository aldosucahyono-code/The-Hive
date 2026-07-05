import { hardNavigate } from "../utils/navigate";

function navigateTo(hash: string) {
  return (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    hardNavigate(hash);
  };
}

function Footer() {
  return (
    <footer className="border-t border-white/10 py-8 text-center text-sm text-neutral-400">
      <p className="mb-3">© 2026 THE HIVE - Powered by Beemo AI</p>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
        <a href="#privasi" onClick={navigateTo("privasi")} className="hover:text-white">Kebijakan Privasi</a>
        <span className="text-neutral-700">•</span>
        <a href="#syarat" onClick={navigateTo("syarat")} className="hover:text-white">Syarat & Ketentuan</a>
        <span className="text-neutral-700">•</span>
        <a href="#refund" onClick={navigateTo("refund")} className="hover:text-white">Kebijakan Refund</a>
        <span className="text-neutral-700">•</span>
        <a href="#referensi" onClick={navigateTo("referensi")} className="hover:text-white">Bagikan ke Teman</a>
      </div>
    </footer>
  );
}

export default Footer;
