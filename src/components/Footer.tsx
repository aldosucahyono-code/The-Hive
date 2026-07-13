import { hardNavigate } from "../utils/navigate";
import { useLanguage } from "../i18n/LanguageContext";

function navigateTo(hash: string) {
  return (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    hardNavigate(hash);
  };
}

function Footer({ variant = "light" }: { variant?: "dark" | "light" }) {
  const { t } = useLanguage();
  const isLight = variant === "light";

  const footerClassName = isLight
    ? "border-t border-neutral-200 py-8 text-center text-sm text-neutral-500"
    : "border-t border-white/10 py-8 text-center text-sm text-neutral-400";
  const linkClassName = isLight ? "hover:text-neutral-900" : "hover:text-white";
  const dotClassName = isLight ? "text-neutral-300" : "text-neutral-700";

  return (
    <footer className={footerClassName}>
      <p className="mb-3">{t.footer.copyright}</p>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
        <a href="#privasi" onClick={navigateTo("privasi")} className={linkClassName}>{t.footer.privacyPolicy}</a>
        <span className={dotClassName}>•</span>
        <a href="#syarat" onClick={navigateTo("syarat")} className={linkClassName}>{t.footer.terms}</a>
        <span className={dotClassName}>•</span>
        <a href="#refund" onClick={navigateTo("refund")} className={linkClassName}>{t.footer.refundPolicy}</a>
        <span className={dotClassName}>•</span>
        <a href="#referensi" onClick={navigateTo("referensi")} className={linkClassName}>{t.footer.shareToFriend}</a>
      </div>
    </footer>
  );
}

export default Footer;
