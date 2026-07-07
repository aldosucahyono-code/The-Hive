import { hardNavigate } from "../utils/navigate";
import { useLanguage } from "../i18n/LanguageContext";

function navigateTo(hash: string) {
  return (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    hardNavigate(hash);
  };
}

function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-white/10 py-8 text-center text-sm text-neutral-400">
      <p className="mb-3">{t.footer.copyright}</p>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
        <a href="#privasi" onClick={navigateTo("privasi")} className="hover:text-white">{t.footer.privacyPolicy}</a>
        <span className="text-neutral-700">•</span>
        <a href="#syarat" onClick={navigateTo("syarat")} className="hover:text-white">{t.footer.terms}</a>
        <span className="text-neutral-700">•</span>
        <a href="#refund" onClick={navigateTo("refund")} className="hover:text-white">{t.footer.refundPolicy}</a>
        <span className="text-neutral-700">•</span>
        <a href="#referensi" onClick={navigateTo("referensi")} className="hover:text-white">{t.footer.shareToFriend}</a>
      </div>
    </footer>
  );
}

export default Footer;
