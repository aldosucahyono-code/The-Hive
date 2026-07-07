import { useEffect, useRef, useState } from "react";
import type { WizardData } from "./ChatWizard";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../context/AuthContext";
import {
  isValidNameLike,
  isValidBrandName,
  isValidProfesi,
  isValidEmail,
  isValidLocation,
  isValidOmset,
  isValidPastDate,
  isValidFutureDate,
  isValidFreeText,
  getTodayString,
} from "../utils/validation";

type ChatFlowProps = {
  data: WizardData;
  updateField: (field: keyof WizardData, value: string) => void;
  startTime: number;
  onSuccess: () => void;
};

type InputKind = "text" | "email" | "textarea" | "date-past" | "date-future" | "currency";

type PhaseKey = "kenal" | "kondisi" | "target" | "strategi";

type Question = {
  field: keyof WizardData;
  prompt: (d: WizardData) => string;
  inputType: InputKind;
  placeholder?: string;
  validate: (value: string) => boolean;
  invalidNudge: string;
  phase: PhaseKey;
};

const todayString = getTodayString();

/** Ganti token {namaField} di template terjemahan dengan jawaban yang sudah
 * diberikan pengguna sejauh ini, supaya pertanyaan berikutnya terasa
 * menyambung/personal — bukan daftar pertanyaan lepas-lepas. */
function fill(template: string, data: WizardData): string {
  return template
    .replace(/\{nama\}/g, data.nama || "")
    .replace(/\{profesi\}/g, data.profesi || "")
    .replace(/\{namaBisnis\}/g, data.namaBisnis || "");
}

function ChatFlow({ data, updateField, startTime, onSuccess }: ChatFlowProps) {
  const { t } = useLanguage();
  const { signInWithMagicLink } = useAuth();
  const isBaru = data.jenisAnalisis === "baru";

  const questions: Question[] = [
    {
      field: "nama",
      prompt: () => t.chatFlow.greeting,
      inputType: "text",
      placeholder: t.stepOne.namaPlaceholder,
      validate: isValidNameLike,
      invalidNudge: t.chatFlow.invalidNudge,
      phase: "kenal",
    },
    {
      field: "email",
      prompt: (d) => fill(t.chatFlow.askEmail, d),
      inputType: "email",
      placeholder: t.stepOne.emailPlaceholder,
      validate: isValidEmail,
      invalidNudge: t.chatFlow.invalidEmailNudge,
      phase: "kenal",
    },
    {
      field: "profesi",
      prompt: () => t.chatFlow.askProfesi,
      inputType: "text",
      placeholder: t.stepOne.profesiPlaceholder,
      validate: isValidProfesi,
      invalidNudge: t.chatFlow.invalidNudge,
      phase: "kenal",
    },
    {
      field: "namaBisnis",
      prompt: (d) => fill(t.chatFlow.askNamaBisnis, d),
      inputType: "text",
      placeholder: t.stepOne.namaBisnisPlaceholder,
      validate: isValidBrandName,
      invalidNudge: t.chatFlow.invalidNudge,
      phase: "kenal",
    },
    {
      field: "jenisBisnis",
      prompt: (d) => fill(t.chatFlow.askJenisBisnis, d),
      inputType: "text",
      placeholder: t.stepOne.jenisBisnisPlaceholder,
      validate: isValidNameLike,
      invalidNudge: t.chatFlow.invalidNudge,
      phase: "kenal",
    },
    {
      field: "lokasi",
      prompt: () => (isBaru ? t.chatFlow.askLokasiNew : t.chatFlow.askLokasiRunning),
      inputType: "text",
      placeholder: t.stepTwo.lokasiPlaceholder,
      validate: isValidLocation,
      invalidNudge: t.chatFlow.invalidNudge,
      phase: "kondisi",
    },
    ...(isBaru
      ? ([
          {
            field: "targetPelanggan",
            prompt: () => t.chatFlow.askTargetPelanggan,
            inputType: "textarea",
            placeholder: t.stepTwo.targetPelangganPlaceholder,
            validate: (v: string) => isValidFreeText(v, 7, 2),
            invalidNudge: t.chatFlow.invalidNudge,
            phase: "kondisi",
          },
          {
            field: "rencanaLaunching",
            prompt: () => t.chatFlow.askRencanaLaunching,
            inputType: "date-future",
            validate: isValidFutureDate,
            invalidNudge: t.chatFlow.invalidDateFutureNudge,
            phase: "kondisi",
          },
        ] as Question[])
      : ([
          {
            field: "sejakKapan",
            prompt: () => t.chatFlow.askSejakKapan,
            inputType: "date-past",
            validate: isValidPastDate,
            invalidNudge: t.chatFlow.invalidDatePastNudge,
            phase: "kondisi",
          },
        ] as Question[])),
    {
      field: "omsetBulanan",
      prompt: () => (isBaru ? t.chatFlow.askModalAwal : t.chatFlow.askOmset),
      inputType: "currency",
      placeholder: isBaru ? t.stepTwo.omsetPlaceholderNew : t.stepTwo.omsetPlaceholderRunning,
      validate: isValidOmset,
      invalidNudge: t.chatFlow.invalidGenericNudge,
      phase: "kondisi",
    },
    {
      field: "tantangan",
      prompt: (d) => fill(isBaru ? t.chatFlow.askTantanganNew : t.chatFlow.askTantanganRunning, d),
      inputType: "textarea",
      placeholder: isBaru ? t.stepThree.tantanganPlaceholderNew : t.stepThree.tantanganPlaceholderRunning,
      validate: (v: string) => isValidFreeText(v),
      invalidNudge: t.chatFlow.invalidNudge,
      phase: "target",
    },
    {
      field: "target",
      prompt: () => t.chatFlow.askTarget,
      inputType: "textarea",
      placeholder: isBaru ? t.stepThree.targetPlaceholderNew : t.stepThree.targetPlaceholderRunning,
      validate: (v: string) => isValidFreeText(v),
      invalidNudge: t.chatFlow.invalidNudge,
      phase: "target",
    },
    {
      field: "ceritaVisi",
      prompt: (d) => fill(t.chatFlow.askCeritaVisi, d),
      inputType: "textarea",
      placeholder: t.stepFour.placeholder,
      validate: (v: string) => isValidFreeText(v, 40, 10),
      invalidNudge: t.chatFlow.invalidNudge,
      phase: "strategi",
    },
  ];

  const [answeredCount, setAnsweredCount] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [showError, setShowError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [botError, setBotError] = useState(false);
  const [editingField, setEditingField] = useState<keyof WizardData | null>(null);
  // "Kenali email yang sudah pernah gabung" — murni fitur UX, bukan gerbang
  // akses. Kalau email dikenali, tawarkan kirim Magic Link (verifikasi
  // kepemilikan tetap wajib) alih-alih memaksa isi wizard dari nol.
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "recognized">("idle");
  const [magicLinkState, setMagicLinkState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const scrollRef = useRef<HTMLDivElement>(null);
  const currencyInputRef = useRef<HTMLInputElement>(null);

  const allAnswered = answeredCount >= questions.length;
  const activeQuestion = editingField
    ? questions.find((q) => q.field === editingField)!
    : questions[answeredCount];

  // Teks pesan bot yang "sedang" ditampilkan saat ini — baik itu pertanyaan
  // aktif, pertanyaan yang sedang diedit, maupun ringkasan penutup.
  function getCurrentBotText(): string | null {
    if (editingField) {
      const q = questions.find((qq) => qq.field === editingField);
      return q ? q.prompt(data) : null;
    }
    if (emailStatus === "recognized") return t.chatFlow.emailRecognizedMessage;
    if (allAnswered) return t.chatFlow.summaryIntro;
    return activeQuestion ? activeQuestion.prompt(data) : null;
  }

  const [revealedLength, setRevealedLength] = useState(0);
  const [showTypingDots, setShowTypingDots] = useState(false);
  const typingIntervalRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  // Kunci unik per "pesan bot yang sedang tampil" — dipakai supaya animasi
  // mengetik cuma jalan sekali per pesan baru, bukan tiap kali komponen
  // render ulang (misalnya saat mengetik jawaban).
  const typingKey = editingField
    ? `edit-${editingField}`
    : emailStatus === "recognized"
      ? "email-recognized"
      : allAnswered
        ? "summary"
        : `q-${answeredCount}`;

  useEffect(() => {
    if (typingIntervalRef.current) window.clearInterval(typingIntervalRef.current);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);

    const fullText = getCurrentBotText();
    setRevealedLength(0);

    if (fullText === null) {
      setShowTypingDots(false);
      return;
    }

    setShowTypingDots(true);
    typingTimeoutRef.current = window.setTimeout(() => {
      setShowTypingDots(false);
      // Ringan: cuma setInterval biasa yang menambah panjang teks yang
      // ditampilkan sedikit demi sedikit — bukan library animasi.
      typingIntervalRef.current = window.setInterval(() => {
        setRevealedLength((prev) => {
          const next = prev + 3;
          if (next >= fullText.length) {
            if (typingIntervalRef.current) window.clearInterval(typingIntervalRef.current);
            return fullText.length;
          }
          return next;
        });
      }, 16);
    }, 450);

    return () => {
      if (typingIntervalRef.current) window.clearInterval(typingIntervalRef.current);
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typingKey]);

  const currentBotFullText = getCurrentBotText() || "";
  const typingDone = !showTypingDots && revealedLength >= currentBotFullText.length;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [answeredCount, editingField, revealedLength, showTypingDots]);

  function handleCurrencyChange(e: React.ChangeEvent<HTMLInputElement>) {
    const oldValue = (data.omsetBulanan as string) || "";
    const rawValue = e.target.value;
    const newCursorPos = e.target.selectionStart ?? rawValue.length;
    const isSingleBackspace = rawValue.length === oldValue.length - 1;

    let workingDigits: string;
    let digitsBeforeCursor: number;
    const deletedChar = isSingleBackspace ? oldValue[newCursorPos] : undefined;

    if (isSingleBackspace && deletedChar && !/[0-9]/.test(deletedChar)) {
      const digitsBeforeOldCursor = oldValue.slice(0, newCursorPos).replace(/[^0-9]/g, "").length;
      const allDigits = oldValue.replace(/[^0-9]/g, "");
      workingDigits = allDigits.slice(0, digitsBeforeOldCursor - 1) + allDigits.slice(digitsBeforeOldCursor);
      digitsBeforeCursor = digitsBeforeOldCursor - 1;
    } else {
      workingDigits = rawValue.replace(/[^0-9]/g, "");
      digitsBeforeCursor = rawValue.slice(0, newCursorPos).replace(/[^0-9]/g, "").length;
    }

    const formatted = workingDigits ? "Rp" + Number(workingDigits).toLocaleString("id-ID") + ",-" : "";
    updateField("omsetBulanan", formatted);

    requestAnimationFrame(() => {
      const el = currencyInputRef.current;
      if (!el) return;
      let seen = 0;
      let newPos = el.value.length;
      if (digitsBeforeCursor <= 0) {
        newPos = 0;
      } else {
        for (let i = 0; i < el.value.length; i++) {
          if (/[0-9]/.test(el.value[i])) {
            seen++;
            if (seen === digitsBeforeCursor) {
              newPos = i + 1;
              break;
            }
          }
        }
      }
      el.setSelectionRange(newPos, newPos);
    });
  }

  async function handleSubmitAnswer() {
    if (!activeQuestion) return;
    const value = activeQuestion.inputType === "currency" ? (data.omsetBulanan as string) || "" : inputValue;

    if (!activeQuestion.validate(value)) {
      setShowError(true);
      return;
    }

    setShowError(false);
    updateField(activeQuestion.field, value);

    if (editingField) {
      setEditingField(null);
      setInputValue("");
      return;
    }

    const isEmailField = activeQuestion.field === "email";
    setAnsweredCount((prev) => prev + 1);
    setInputValue("");

    if (isEmailField) {
      setEmailStatus("checking");
      try {
        const response = await fetch("/api/check-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: value }),
        });
        const json = await response.json();
        setEmailStatus(response.ok && json.exists ? "recognized" : "idle");
      } catch (err) {
        console.error("check-email error:", err);
        // Gagal cek -> tetap lanjutkan wizard seperti biasa, jangan
        // menghalangi orang baru gara-gara masalah jaringan sesaat.
        setEmailStatus("idle");
      }
    }
  }

  async function handleSendMagicLink() {
    setMagicLinkState("sending");
    const { error } = await signInWithMagicLink(data.email);
    setMagicLinkState(error ? "error" : "sent");
  }

  function handleContinueAsNewAnalysis() {
    setEmailStatus("idle");
    setMagicLinkState("idle");
  }

  // Enter mengirim jawaban; di textarea, Shift+Enter tetap bikin baris baru
  // (pola chat yang sudah familiar bagi kebanyakan orang).
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;
    const isTextarea = (e.target as HTMLElement).tagName === "TEXTAREA";
    if (isTextarea && e.shiftKey) return;
    e.preventDefault();
    handleSubmitAnswer();
  }

  function startEdit(field: keyof WizardData) {
    setEditingField(field);
    setInputValue((data[field] as string) || "");
    setShowError(false);
  }

  function handleProses() {
    const elapsed = Date.now() - startTime;
    const looksLikeBot = data.honeypot.trim().length > 0 || elapsed < 5000;
    if (looksLikeBot) {
      setBotError(true);
      return;
    }
    setBotError(false);
    setLoading(true);
    onSuccess();
  }

  function renderInput(question: Question) {
    const commonClass =
      "w-full rounded-2xl border bg-black/30 px-4 py-3 text-sm outline-none focus:border-primary " +
      (showError ? "border-red-500" : "border-white/10");

    if (question.inputType === "textarea") {
      return (
        <textarea
          autoFocus
          rows={3}
          placeholder={question.placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={commonClass + " resize-none"}
        />
      );
    }
    if (question.inputType === "date-past" || question.inputType === "date-future") {
      return (
        <input
          autoFocus
          type="date"
          min={question.inputType === "date-future" ? todayString : undefined}
          max={question.inputType === "date-past" ? todayString : undefined}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={commonClass + " [color-scheme:dark]"}
        />
      );
    }
    if (question.inputType === "currency") {
      return (
        <input
          ref={currencyInputRef}
          autoFocus
          type="text"
          inputMode="numeric"
          placeholder={question.placeholder}
          value={data.omsetBulanan}
          onChange={handleCurrencyChange}
          onKeyDown={handleKeyDown}
          className={commonClass}
        />
      );
    }
    return (
      <input
        autoFocus
        type={question.inputType === "email" ? "email" : "text"}
        placeholder={question.placeholder}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className={commonClass}
      />
    );
  }

  const summaryRows: { label: string; field: keyof WizardData; group: string }[] = [
    { group: t.chatFlow.identitasTitle, label: t.chatFlow.namaLabel, field: "nama" },
    { group: t.chatFlow.identitasTitle, label: t.chatFlow.profesiLabel, field: "profesi" },
    { group: t.chatFlow.identitasTitle, label: t.chatFlow.namaBisnisLabel, field: "namaBisnis" },
    { group: t.chatFlow.identitasTitle, label: t.chatFlow.jenisBisnisLabel, field: "jenisBisnis" },
    { group: t.chatFlow.lokasiKondisiTitle, label: t.chatFlow.lokasiLabel, field: "lokasi" },
    ...(isBaru
      ? [
          { group: t.chatFlow.lokasiKondisiTitle, label: t.chatFlow.targetPelangganLabel, field: "targetPelanggan" as const },
          { group: t.chatFlow.lokasiKondisiTitle, label: t.chatFlow.rencanaLaunchingLabel, field: "rencanaLaunching" as const },
        ]
      : [{ group: t.chatFlow.lokasiKondisiTitle, label: t.chatFlow.sejakKapanLabel, field: "sejakKapan" as const }]),
    {
      group: t.chatFlow.lokasiKondisiTitle,
      label: isBaru ? t.chatFlow.modalAwalLabel : t.chatFlow.omsetLabel,
      field: "omsetBulanan",
    },
    { group: t.chatFlow.tantanganTargetTitle, label: t.chatFlow.tantanganLabel, field: "tantangan" },
    { group: t.chatFlow.tantanganTargetTitle, label: t.chatFlow.targetLabel, field: "target" },
    { group: t.chatFlow.ceritaVisiTitle, label: t.chatFlow.ceritaVisiTitle, field: "ceritaVisi" },
  ];

  const groupedSummary: { group: string; rows: typeof summaryRows }[] = [];
  for (const row of summaryRows) {
    let bucket = groupedSummary.find((g) => g.group === row.group);
    if (!bucket) {
      bucket = { group: row.group, rows: [] };
      groupedSummary.push(bucket);
    }
    bucket.rows.push(row);
  }

  const showComposer =
    !!activeQuestion &&
    (!allAnswered || !!editingField) &&
    typingDone &&
    emailStatus !== "checking" &&
    emailStatus !== "recognized";

  const phaseLabels: Record<PhaseKey, string> = {
    kenal: t.chatFlow.phaseKenal,
    kondisi: t.chatFlow.phaseKondisi,
    target: t.chatFlow.phaseTarget,
    strategi: t.chatFlow.phaseStrategi,
  };
  const currentPhaseLabel = allAnswered
    ? t.chatFlow.phaseSelesai
    : activeQuestion
      ? phaseLabels[activeQuestion.phase]
      : "";
  const progressPercent = Math.round((answeredCount / questions.length) * 100);

  return (
    <div className="flex h-[75dvh] max-h-[720px] min-h-[420px] flex-col">
      {/* Progress bar persisten — menggantikan teks "Step X dari Y" supaya
          terasa seperti aplikasi AI modern, bukan formulir/wizard. */}
      <div className="mb-3 flex-none">
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-neutral-400">
          <span>{currentPhaseLabel}</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>

      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          type="text"
          id="website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={data.honeypot}
          onChange={(e) => updateField("honeypot", e.target.value)}
        />
      </div>

      {/* Area pesan — bisa di-scroll, composer di bawah selalu terlihat */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-1 pb-2 pr-2">
        {questions.slice(0, answeredCount).map((q) => (
          <div key={q.field as string} className="space-y-2">
            <ChatBubble role="bot" text={q.prompt(data)} />
            <ChatBubble role="user" text={(data[q.field] as string) || ""} />
          </div>
        ))}

        {allAnswered && !editingField && (
          <div className="space-y-2">
            {showTypingDots ? (
              <TypingDots />
            ) : (
              <ChatBubble role="bot" text={currentBotFullText.slice(0, revealedLength)} />
            )}
            {typingDone && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
                {groupedSummary.map((g) => (
                  <div key={g.group} className="mb-4 last:mb-0">
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">{g.group}</h4>
                    {g.rows.map((row) => (
                      <div
                        key={row.field as string}
                        className="flex items-start justify-between gap-3 border-b border-white/5 py-1.5 text-sm last:border-b-0"
                      >
                        <div className="min-w-0">
                          <span className="block text-neutral-400">{row.label}</span>
                          <strong className="break-words">{(data[row.field] as string) || "—"}</strong>
                        </div>
                        <button
                          onClick={() => startEdit(row.field)}
                          className="flex-none rounded-full border border-white/15 px-3 py-1 text-xs text-neutral-300 hover:border-primary/40 hover:text-white"
                        >
                          {t.chatFlow.editLabel}
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeQuestion && (!allAnswered || editingField) && (
          <div className="space-y-1.5">
            {showTypingDots ? (
              <TypingDots />
            ) : (
              <ChatBubble role="bot" text={currentBotFullText.slice(0, revealedLength)} />
            )}
          </div>
        )}

        {emailStatus === "recognized" && typingDone && (
          <div className="space-y-3 pt-1">
            {magicLinkState === "sent" ? (
              <p className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-neutral-200">
                {t.chatFlow.emailRecognizedSent}
              </p>
            ) : (
              <>
                <button
                  onClick={handleSendMagicLink}
                  disabled={magicLinkState === "sending"}
                  className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {magicLinkState === "sending"
                    ? t.chatFlow.emailRecognizedSending
                    : t.chatFlow.emailRecognizedSendButton}
                </button>
                {magicLinkState === "error" && (
                  <p className="text-sm text-red-400">{t.chatFlow.emailRecognizedError}</p>
                )}
                <button
                  onClick={handleContinueAsNewAnalysis}
                  className="w-full rounded-xl border border-white/15 py-3 text-sm text-neutral-300 hover:border-primary/40 hover:text-white"
                >
                  {t.chatFlow.emailRecognizedContinueButton}
                </button>
              </>
            )}
          </div>
        )}

        {allAnswered && !editingField && typingDone && (
          <div className="pt-1">
            {botError && <p className="mb-3 text-sm text-red-400">{t.chatFlow.botError}</p>}
            <button
              onClick={handleProses}
              disabled={loading}
              className="flex w-full flex-col items-center gap-1 rounded-xl bg-primary py-4 text-black disabled:opacity-60"
            >
              <span className="text-base font-bold">
                {loading ? t.chatFlow.submitLoading : t.chatFlow.submitLabel}
              </span>
              <span className="text-xs font-medium opacity-80">{t.chatFlow.submitHelper}</span>
            </button>
          </div>
        )}
      </div>

      {/* Composer — selalu menempel di bawah, mirip aplikasi chat pada umumnya */}
      {showComposer && (
        <div className="mt-3 flex-none border-t border-white/10 pt-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">{renderInput(activeQuestion)}</div>
            <button
              onClick={handleSubmitAnswer}
              aria-label="send"
              className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-primary text-black transition-transform hover:scale-105 active:scale-95"
            >
              ➤
            </button>
          </div>
          {showError && (
            <p className="mt-2 text-sm text-amber-400">⚠ {activeQuestion.invalidNudge}</p>
          )}
        </div>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-end gap-2">
      <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-primary/30 bg-surface text-sm">
        🤖
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-surface px-4 py-3.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:0ms]"></span>
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:150ms]"></span>
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:300ms]"></span>
      </div>
    </div>
  );
}

function ChatBubble({ role, text }: { role: "bot" | "user"; text: string }) {
  const isBot = role === "bot";
  return (
    <div className={"flex items-end gap-2 " + (isBot ? "justify-start" : "justify-end")}>
      {isBot && (
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-primary/30 bg-surface text-sm">
          🤖
        </div>
      )}
      <div
        className={
          "max-w-[80%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-relaxed " +
          (isBot ? "rounded-bl-sm bg-surface text-neutral-200" : "rounded-br-sm bg-primary text-black")
        }
      >
        {text}
      </div>
    </div>
  );
}

export default ChatFlow;
