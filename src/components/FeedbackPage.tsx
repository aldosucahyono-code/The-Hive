import { useState } from "react";

function FeedbackPage() {
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
    const subject = encodeURIComponent("Masukan untuk THE HIVE");
    const body = encodeURIComponent(
      `Nama: ${nama || "(tidak diisi)"}\nKontak: ${kontak || "(tidak diisi)"}\nRating: ${rating || "-"}/5\n\nPesan:\n${pesan}`
    );
    window.location.href = `mailto:masukan@thehive.id?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <section className="mx-auto max-w-xl px-6 py-16">

      <div className="mb-8 text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-primary">Halaman Internal</span>
        <h1 className="mt-2 text-2xl font-extrabold">Beri Masukan untuk Kami</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Ulasan ini <strong className="text-white">tidak ditampilkan ke publik</strong> — hanya
          digunakan untuk perbaikan produk secara langsung.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-surface p-6 sm:p-8">

        <div className="mb-5">
          <label className="mb-2 block text-sm">Nama (opsional)</label>
          <input
            type="text"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-primary"
            placeholder="Nama Anda"
          />
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-sm">Email/WhatsApp (opsional, kalau ingin ditanggapi)</label>
          <input
            type="text"
            value={kontak}
            onChange={(e) => setKontak(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-primary"
            placeholder="email@contoh.com atau nomor WhatsApp"
          />
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-sm">Seberapa puas Anda dengan hasil analisisnya?</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRating(n)}
                className={"h-10 w-10 rounded-lg border text-sm font-bold " + (rating >= n ? "border-primary bg-primary text-black" : "border-white/15 text-neutral-400")}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm">Masukan Anda <span className="text-primary">*</span></label>
          <textarea
            rows={5}
            value={pesan}
            onChange={(e) => setPesan(e.target.value)}
            className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-primary"
            placeholder="Ceritakan pengalaman Anda, apa yang kurang, atau saran perbaikan..."
          />
        </div>

        {sent && (
          <p className="mb-4 text-sm text-amber-300">
            Email masukan sedang disiapkan di aplikasi email Anda — silakan kirim dari sana.
          </p>
        )}

        <button
          onClick={handleSubmit}
          className="w-full rounded-xl bg-primary py-4 text-base font-bold text-black transition-transform hover:-translate-y-0.5"
        >
          Kirim Masukan
        </button>

      </div>

    </section>
  );
}

export default FeedbackPage;
