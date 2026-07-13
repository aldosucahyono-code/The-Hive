import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";

function ReferralPage() {
  const { t } = useLanguage();
  const p = t.referral;
  const [copied, setCopied] = useState(false);

  const shareUrl = "https://thehive.id";
  const shareText = p.shareText;

  function copyLink() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`;

  return (
    <section className="mx-auto max-w-xl px-6 py-16 text-center">

      <span className="text-xs font-bold uppercase tracking-widest text-primary">{p.eyebrow}</span>
      <h1 className="mt-2 text-2xl font-extrabold">{p.title}</h1>
      <p className="mt-3 text-sm text-neutral-600">
        {p.subtitle}
      </p>

      <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6">

        <p className="mb-4 text-sm text-neutral-700">{shareText}</p>

        <div className="mb-4 flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          <span>{shareUrl}</span>
          <button onClick={copyLink} className="rounded-full border border-primary/30 px-3 py-1 text-xs text-primary">
            {copied ? p.copiedLabel : p.copyLabel}
          </button>
        </div>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-xl bg-primary py-4 text-base font-bold text-black transition-transform hover:-translate-y-0.5"
        >
          {p.whatsappLabel}
        </a>

      </div>

    </section>
  );
}

export default ReferralPage;
