import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";

type LoadingAIProps = {
  /** true begitu hasil (sukses ATAU error) dari pemanggilan API sudah didapat. */
  ready: boolean;
  onDone: () => void;
};

const MIN_DISPLAY_MS = 3600;

function LoadingAI({ ready, onDone }: LoadingAIProps) {
  const { t } = useLanguage();
  const steps = t.loadingAI.steps;
  const workingSteps = t.loadingAI.workingSteps;
  const [index, setIndex] = useState(0);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  // Polishing pass (review kedua, poin 6): begitu checklist (steps) selesai
  // dicentang tapi `ready` masih belum true (analisa Claude nyatanya masih
  // butuh beberapa detik lagi), baris terakhir berputar lewat workingSteps
  // supaya terasa "masih bekerja" alih-alih diam macet. Murni animasi timer.
  const [workingIndex, setWorkingIndex] = useState(0);
  const checklistDone = index >= steps.length - 1;

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setIndex((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 900);

    const minTimeTimeout = setTimeout(() => {
      setMinTimeElapsed(true);
    }, MIN_DISPLAY_MS);

    return () => {
      clearInterval(stepInterval);
      clearTimeout(minTimeTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!checklistDone || ready) return;
    const workingInterval = setInterval(() => {
      setWorkingIndex((prev) => (prev + 1) % workingSteps.length);
    }, 1800);
    return () => clearInterval(workingInterval);
  }, [checklistDone, ready, workingSteps.length]);

  // Baru pindah ke hasil begitu KEDUANYA terpenuhi: animasi minimum sudah
  // berjalan cukup lama (supaya tidak terasa "instan" dan mencurigakan),
  // DAN hasil sungguhan dari Claude API (sukses atau error) sudah didapat.
  useEffect(() => {
    if (ready && minTimeElapsed) {
      onDone();
    }
  }, [ready, minTimeElapsed, onDone]);

  const progress = ready ? 100 : Math.min(95, ((index + 1) / steps.length) * 100);

  return (
    <section className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <div className="mb-6 flex h-16 w-16 animate-pulse items-center justify-center rounded-full border border-primary/30 bg-white text-2xl">
        🤖
      </div>
      <h2 className="text-lg font-bold">{t.loadingAI.title}</h2>

      {/* Revisi UX Juli 2026 (review PO: "Loading jangan cuma Loading...")
          — checklist yang bertambah satu per satu terasa lebih hidup
          daripada satu baris teks yang berganti-ganti. Murni animasi +
          timer yang SUDAH ADA (index/ready), tidak ada AI/panggilan
          tambahan apapun di sini. */}
      <div className="mt-4 w-full space-y-2 text-left">
        {steps.map((stepText, i) => {
          const isDone = i < index || (i === index && checklistDone) || ready;
          const isCurrent = i === index && !checklistDone && !ready;
          return (
            <div
              key={stepText}
              className={
                "flex items-center gap-2 text-sm transition-opacity duration-300 " +
                (isDone ? "text-neutral-800" : isCurrent ? "text-neutral-700" : "text-neutral-400 opacity-60")
              }
            >
              <span className="flex-none">{isDone ? "✓" : isCurrent ? "⏳" : "○"}</span>
              <span>{stepText}{isCurrent && "..."}</span>
            </div>
          );
        })}
        {checklistDone && !ready && (
          <div className="flex items-center gap-2 text-sm text-neutral-700">
            <span className="flex-none">⏳</span>
            <span>{workingSteps[workingIndex]}</span>
          </div>
        )}
      </div>

      <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </section>
  );
}

export default LoadingAI;
