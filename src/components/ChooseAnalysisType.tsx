import { useLanguage } from "../i18n/LanguageContext";
import beemoLaptop from "../assets/mascot/beemo-laptop.png";

type ChooseAnalysisTypeProps = {
  onChoose: (type: "baru" | "berjalan") => void;
};

function ChooseAnalysisType({ onChoose }: ChooseAnalysisTypeProps) {
  const { t } = useLanguage();

  return (
    <section className="mx-auto max-w-3xl px-6 py-16">

      <div className="mb-8 text-center">
        {/* Ganti emoji 🤖 generik dengan mascot Beemo asli (Juli 2026, request
            PO). Tanpa border ring supaya tidak terlihat seperti "badge" biasa
            — cukup drop-shadow oranye lembut (pola sama dengan Hero.tsx &
            PricingCards.tsx) supaya kesan eksklusif tanpa outline kaku. */}
        <img
          src={beemoLaptop}
          alt="Beemo AI"
          className="mx-auto mb-4 h-[120px] w-[120px] rounded-full object-cover drop-shadow-[0_6px_18px_rgba(255,152,0,0.45)]"
        />
        <h2 className="text-xl font-bold">{t.chooseAnalysisType.greeting}</h2>
        <p className="mt-1 text-neutral-600">{t.chooseAnalysisType.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

        <button
          onClick={() => onChoose("baru")}
          className="rounded-2xl border border-neutral-200 bg-white p-6 text-left transition-transform hover:-translate-y-1 hover:border-primary/40"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl">🌱</div>
          <h3 className="mb-2 font-bold">{t.chooseAnalysisType.newTitle}</h3>
          <p className="text-sm leading-relaxed text-neutral-700">{t.chooseAnalysisType.newDesc}</p>
        </button>

        <button
          onClick={() => onChoose("berjalan")}
          className="rounded-2xl border border-neutral-200 bg-white p-6 text-left transition-transform hover:-translate-y-1 hover:border-primary/40"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl">📈</div>
          <h3 className="mb-2 font-bold">{t.chooseAnalysisType.runningTitle}</h3>
          <p className="text-sm leading-relaxed text-neutral-700">{t.chooseAnalysisType.runningDesc}</p>
        </button>

      </div>

    </section>
  );
}

export default ChooseAnalysisType;
