import { useLanguage } from "../i18n/LanguageContext";

type ChooseAnalysisTypeProps = {
  onChoose: (type: "baru" | "berjalan") => void;
};

function ChooseAnalysisType({ onChoose }: ChooseAnalysisTypeProps) {
  const { t } = useLanguage();

  return (
    <section className="mx-auto max-w-3xl px-6 py-16">

      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-white text-2xl">
          🤖
        </div>
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
