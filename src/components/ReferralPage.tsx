import { useState } from "react";

function ReferralPage() {
  const [copied, setCopied] = useState(false);

  const shareUrl = "https://thehive.id";
  const shareText = "Sebelum buka atau kembangkan usaha, cek dulu peluangnya di THE HIVE — analisis bisnis berbasis AI, gratis untuk mulai.";

  function copyLink() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`;

  return (
    <section className="mx-auto max-w-xl px-6 py-16 text-center">

      <span className="text-xs font-bold uppercase tracking-widest text-primary">Bagikan THE HIVE</span>
      <h1 className="mt-2 text-2xl font-extrabold">Kenalkan THE HIVE ke Teman Anda</h1>
      <p className="mt-3 text-sm text-neutral-400">
        Punya teman atau kenalan yang sedang mau buka usaha atau mengembangkan
        bisnisnya? Bagikan THE HIVE supaya mereka bisa coba analisis gratisnya.
      </p>

      <div className="mt-8 rounded-2xl border border-white/10 bg-surface p-6">

        <p className="mb-4 text-sm text-neutral-300">{shareText}</p>

        <div className="mb-4 flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-neutral-300">
          <span>{shareUrl}</span>
          <button onClick={copyLink} className="rounded-full border border-primary/30 px-3 py-1 text-xs text-primary">
            {copied ? "Tersalin!" : "Salin"}
          </button>
        </div>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-xl bg-primary py-4 text-base font-bold text-black transition-transform hover:-translate-y-0.5"
        >
          📲 Bagikan lewat WhatsApp
        </a>

      </div>

    </section>
  );
}

export default ReferralPage;
