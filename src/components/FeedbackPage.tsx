import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";

function FeedbackPage() {
  const { t } = useLanguage();
  const [nama, setNama] = useState("");
  const [kontak, setKontak] = useState("");
  const [pesan, setPesan] = useState("");
  const [rating, setRating] = useState(0);
  const [sent, setSent] = useState(false);

  function handleSubmit() {
    if (!pesan.trim()) return;

    // CATATAN TEKNIS: karena belum ada backend/database, kirim lewat email
    // client bawaan (mailto) untuk sementara. Begitu backend siap, ganti
    // ini dengan panggilan API yang menyimpan ke database.
    const subject = encodeURIComponent(t.feedbackPage.emailSubject);
    const body = encodeURIComponent(
      `Nama: ${nama || t.feedbackPage.notFilled}\nKontak: ${kontak || t.feedbackPage.notFilled}\nRating: ${rating || "-"}/5\n\nPesan:\n${pesan}`
    );
    window.location.href = `mailto:masukan@thehive-bisnis.com?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <section className="mx-auto max-w-xl px-6 py-16">

      <div className="mb-8 text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-primary">{t.feedbackPage.internalLabel}</span>
        <h1 className="mt-2 text-2xl font-extrabold">{t.feedbackPage.title}</h1>
        <p className="mt-2 text-sm text-neutral-600">
          {t.feedbackPage.descPrefix}
          <strong className="text-neutral-900">{t.feedbackPage.descBold}</strong>
          {t.feedbackPage.descSuffix}
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8">

        <div className="mb-5">
          <label className="mb-2 block text-sm">{t.feedbackPage.namaLabel}</label>
          <input
            type="text"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-primary"
            placeholder={t.feedbackPage.namaPlaceholder}
          />
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-sm">{t.feedbackPage.kontakLabel}</label>
          <input
            type="text"
            value={kontak}
            onChange={(e) => setKontak(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-primary"
            placeholder={t.feedbackPage.kontakPlaceholder}
          />
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-sm">{t.feedbackPage.ratingLabel}</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRating(n)}
                className={"h-10 w-10 rounded-lg border text-sm font-bold " + (rating >= n ? "border-primary bg-primary text-black" : "border-neutral-300 text-neutral-600")}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm">{t.feedbackPage.pesanLabel} <span className="text-primary">*</span></label>
          <textarea
            rows={5}
            value={pesan}
            onChange={(e) => setPesan(e.target.value)}
            className="w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-primary"
            placeholder={t.feedbackPage.pesanPlaceholder}
          />
        </div>

        {sent && (
          <p className="mb-4 text-sm text-amber-700">
            {t.feedbackPage.sentMessage}
          </p>
        )}

        <button
          onClick={handleSubmit}
          className="w-full rounded-xl bg-primary py-4 text-base font-bold text-black transition-transform hover:-translate-y-0.5"
        >
          {t.feedbackPage.submitButton}
        </button>

      </div>

    </section>
  );
}

export default FeedbackPage;
