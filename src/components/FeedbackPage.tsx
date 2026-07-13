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
    //
    // Bugfix (QA Juli 2026): sebelumnya pakai `window.location.href =
    // "mailto:..."`, yang NAVIGASI TAB SAAT INI ke URI mailto. Kalau browser
    // TIDAK punya handler mailto terdaftar (umum di banyak mesin/browser
    // profile baru tanpa email client default dikonfigurasi), browser
    // mencoba navigasi lalu gagal & me-reload halaman ini -- me-reset semua
    // state React (nama/kontak/rating/pesan yang sudah diisi user HILANG
    // total, dan pesan konfirmasi "sent" tidak sempat tampil sama sekali)
    // tanpa pesan error apapun. Diganti window.open(..., "_blank") supaya
    // percobaan buka mailto terjadi di context terpisah -- kalau gagal pun,
    // tab/halaman feedback ini tidak ikut ter-reload dan state tetap utuh.
    const subject = encodeURIComponent(t.feedbackPage.emailSubject);
    const body = encodeURIComponent(
      `Nama: ${nama || t.feedbackPage.notFilled}\nKontak: ${kontak || t.feedbackPage.notFilled}\nRating: ${rating || "-"}/5\n\nPesan:\n${pesan}`
    );
    window.open(`mailto:masukan@thehive-bisnis.com?subject=${subject}&body=${body}`, "_blank");
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
