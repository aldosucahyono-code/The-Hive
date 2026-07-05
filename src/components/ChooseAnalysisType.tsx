type ChooseAnalysisTypeProps = {
  onChoose: (type: "baru" | "berjalan") => void;
};

function ChooseAnalysisType({ onChoose }: ChooseAnalysisTypeProps) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">

      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-surface text-2xl">
          🤖
        </div>
        <h2 className="text-xl font-bold">Halo, saya Beemo.</h2>
        <p className="mt-1 text-neutral-400">Pilih dulu jenis analisis yang Anda butuhkan.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

        <button
          onClick={() => onChoose("baru")}
          className="rounded-2xl border border-white/10 bg-surface p-6 text-left transition-transform hover:-translate-y-1 hover:border-primary/40"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl">🌱</div>
          <h3 className="mb-2 font-bold">Analisis Bisnis Baru</h3>
          <p className="text-sm leading-relaxed text-neutral-300">
            Untuk Anda yang belum memiliki usaha. Cocok untuk validasi ide bisnis,
            mengetahui potensi pasar, target pelanggan, dan strategi memulai usaha.
          </p>
        </button>

        <button
          onClick={() => onChoose("berjalan")}
          className="rounded-2xl border border-white/10 bg-surface p-6 text-left transition-transform hover:-translate-y-1 hover:border-primary/40"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl">📈</div>
          <h3 className="mb-2 font-bold">Analisis Bisnis Berjalan</h3>
          <p className="text-sm leading-relaxed text-neutral-300">
            Untuk usaha yang sudah beroperasi. Cocok untuk mengetahui posisi
            dibanding kompetitor, peluang pertumbuhan, dan rekomendasi peningkatan performa.
          </p>
        </button>

      </div>

    </section>
  );
}

export default ChooseAnalysisType;
