import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";

// Audit Juli 2026 ("channel support publik"): BEDA dari FeedbackPage.tsx
// (#ulasan-internal, sengaja disembunyikan, mailto-based) -- halaman ini
// PUBLIK, tertaut dari Footer semua halaman, dan menyimpan pesan ke
// database lewat api/contact.ts (bukan mailto), supaya pengguna yang
// BUKAN kenalan pribadi pemilik produk tetap punya jalur menghubungi
// kalau ada kendala/pertanyaan, dan pesan tidak hilang kalau perangkat
// pengguna tidak punya aplikasi email default terkonfigurasi.
function ContactPage() {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !message.trim()) return;

    setState("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || t.contactPage.errorMessage);
        setState("error");
        return;
      }

      setState("sent");
    } catch (err) {
      console.error("contact submit error:", err);
      setErrorMsg(t.contactPage.errorMessage);
      setState("error");
    }
  }

  return (
    <section className="mx-auto max-w-xl px-6 py-16">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-extrabold">{t.contactPage.title}</h1>
        <p className="mt-2 text-sm text-neutral-600">{t.contactPage.desc}</p>
        <p className="mt-3 text-sm text-neutral-500">
          {t.contactPage.emailFallbackPrefix}
          <a href="mailto:support@thehive-bisnis.com" className="font-semibold text-primary hover:opacity-80">
            support@thehive-bisnis.com
          </a>
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8">
        {state === "sent" ? (
          <div className="text-center">
            <h2 className="mb-2 text-lg font-bold text-neutral-900">{t.contactPage.sentTitle}</h2>
            <p className="text-sm leading-relaxed text-neutral-600">{t.contactPage.sentMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <label className="mb-2 block text-sm">{t.contactPage.namaLabel}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={state === "sending"}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-primary"
                placeholder={t.contactPage.namaPlaceholder}
              />
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-sm">
                {t.contactPage.emailLabel} <span className="text-primary">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={state === "sending"}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-primary"
                placeholder={t.contactPage.emailPlaceholder}
              />
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-sm">
                {t.contactPage.pesanLabel} <span className="text-primary">*</span>
              </label>
              <textarea
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                disabled={state === "sending"}
                className="w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-primary"
                placeholder={t.contactPage.pesanPlaceholder}
              />
            </div>

            {state === "error" && <p className="mb-4 text-sm text-red-600">{errorMsg}</p>}

            <button
              type="submit"
              disabled={state === "sending"}
              className="w-full rounded-xl bg-primary py-4 text-base font-bold text-black transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state === "sending" ? t.contactPage.sendingButton : t.contactPage.submitButton}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

export default ContactPage;
