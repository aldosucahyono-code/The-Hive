import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import type { Translations } from "../i18n/translations";
import {
  WorkspaceCard,
  SectionHeader,
  WorkspaceSection,
  UpgradeLockCard,
  EmptyState,
  ErrorCard,
} from "./WorkspaceDesignSystem";

type Tier = "free" | "pro" | "platinum";
// decisionSaved/decisionHeadline (revisi Juli 2026): Chat Beemo sekarang
// mendeteksi OTOMATIS pertanyaan keputusan besar dan menjalankan Decision
// Engine di dalam balasan yang sama (lihat parseDecisionBlock di
// services/beemo/chat.ts) — tidak ada lagi form "Bantuan Keputusan"
// terpisah. Field ini dipakai untuk menampilkan catatan kecil di bubble
// chat kalau balasan itu baru saja tersimpan ke Decision Journal.
type ChatMessage = { role: "user" | "assistant"; content: string; decisionSaved?: boolean };
type PendingMemoryFact = { id: string; factKey: string; factValue: unknown; proposedAt: string };

function ChatBeemoPanel({
  businessProfileId,
  tier,
  businessType,
  t,
  lang,
  onUpgradeClick,
  pendingMemoryFacts,
  pendingMemoryFactsLoading,
  pendingMemoryFactsError,
  reviewingFactId,
  onReviewMemoryFact,
  onRetryPendingMemoryFacts,
}: {
  businessProfileId: string;
  tier: Tier;
  businessType: "start" | "grow";
  t: Translations;
  lang: "id" | "en";
  onUpgradeClick: () => void;
  pendingMemoryFacts: PendingMemoryFact[];
  pendingMemoryFactsLoading: boolean;
  pendingMemoryFactsError: boolean;
  reviewingFactId: string | null;
  onReviewMemoryFact: (factId: string, decision: "approve" | "reject") => void;
  onRetryPendingMemoryFacts: () => void;
}) {
  const { session } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Nudge Upgrade (directive PO: indikator sukses = pelanggan Pro pakai
  // fitur sampai mentok kuota, lalu upgrade ke Platinum — bahasa HALUS,
  // bukan hard-sell). true kalau balasan terakhir server bilang
  // quotaExceeded — dipisah dari `error` biasa supaya render-nya beda
  // (kartu ajakan upgrade, bukan teks merah generik).
  const [chatQuotaHit, setChatQuotaHit] = useState(false);

  // Business Context: pertanyaan pancingan berbeda untuk mentor "membuka
  // usaha" vs "mengembangkan usaha" — reuse satu komponen Chat yang sama,
  // hanya kontennya yang menyesuaikan (bukan dua implementasi Chat).
  const suggestions =
    businessType === "start"
      ? [t.workspace.chatSuggestion1Start, t.workspace.chatSuggestion2Start, t.workspace.chatSuggestion3Start]
      : [t.workspace.chatSuggestion1, t.workspace.chatSuggestion2, t.workspace.chatSuggestion3];

  if (tier === "free") {
    return (
      <WorkspaceSection>
        <SectionHeader title={t.workspace.menuChat} description={t.workspace.chatSectionDesc} />
        <UpgradeLockCard
          description={t.workspace.chatLockedDesc}
          buttonLabel={t.workspace.chatUpgradeButton}
          onUpgradeClick={onUpgradeClick}
        />
      </WorkspaceSection>
    );
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending || !session?.access_token) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);
    setChatQuotaHit(false);

    try {
      const response = await fetch("/api/beemo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "chat",
          businessProfileId,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          lang,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        if (json.quotaExceeded) {
          setChatQuotaHit(true);
        } else {
          setError(json.error || t.workspace.chatErrorGeneric);
        }
        setSending(false);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: json.reply, decisionSaved: Boolean(json.decisionSaved) }]);
      setSending(false);
    } catch (err) {
      console.error("chat-beemo error:", err);
      setError(t.workspace.chatErrorGeneric);
      setSending(false);
    }
  }

  return (
    <WorkspaceSection>
      <SectionHeader title={t.workspace.menuChat} description={t.workspace.chatSectionDesc} />

      <WorkspaceCard className="flex h-[min(70vh,500px)] min-h-[360px] flex-col !p-0">
        <div
          role="log"
          aria-live="polite"
          aria-label={t.workspace.menuChat}
          className="flex-1 space-y-3 overflow-y-auto p-4"
        >
          {messages.length === 0 && (
            <>
              <EmptyState
                variant="default"
                icon="💬"
                title={t.workspace.chatEmptyTitle}
                description={t.workspace.chatEmptyState}
              />
              <div className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-neutral-300 transition-colors duration-150 hover:border-primary/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[80%]">
                <div
                  className={
                    "rounded-xl px-4 py-2.5 text-sm leading-relaxed " +
                    (m.role === "user" ? "bg-primary text-black" : "border border-white/10 bg-white/5 text-neutral-200")
                  }
                >
                  {m.content}
                </div>
                {/* Decision Engine Auto-Detect (revisi Juli 2026): tidak ada
                    form "Bantuan Keputusan" terpisah lagi — kalau Beemo
                    mendeteksi pertanyaan ini sebagai keputusan besar, catatan
                    kecil ini muncul di bawah balasannya, memberi tahu bahwa
                    analisanya sudah tersimpan ke Decision Journal. */}
                {m.role === "assistant" && m.decisionSaved && (
                  <p className="mt-1 text-[11px] font-semibold text-primary">
                    🐝 {t.workspace.decisionAutoSavedNote}
                  </p>
                )}
              </div>
            </div>
          ))}
          {sending && <p className="text-xs text-neutral-500">{t.workspace.chatSending}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {chatQuotaHit && (
            <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-4">
              <p className="text-sm font-bold text-primary">🐝 {t.workspace.chatQuotaNudgeTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-300">
                {tier === "pro" ? t.workspace.chatQuotaNudgeDescPro : t.workspace.chatQuotaNudgeDescPlatinum}
              </p>
              {tier === "pro" && (
                <button
                  onClick={onUpgradeClick}
                  className="mt-3 rounded-full bg-primary px-4 py-2 text-xs font-bold text-black transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                >
                  {t.workspace.chatQuotaNudgeButton}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-white/10 p-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t.workspace.chatPlaceholder}
            aria-label={t.workspace.chatPlaceholder}
            disabled={sending}
            className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none transition-colors duration-150 focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/70 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-black transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            {t.workspace.chatSendButton}
          </button>
        </div>
      </WorkspaceCard>

      {/* "Beemo mengusulkan pembaruan" (revisi Juli 2026): dipindah ke bawah
          Chat — posisi bekas form "Bantuan Keputusan" yang sudah dihapus,
          supaya Chat Beemo terasa satu alur percakapan utuh, bukan dua
          "chat" terpisah. Isinya sudah, dan tetap, bersumber langsung dari
          percakapan chat (lihat parseMemoryProposal di
          services/beemo/chat.ts) — bukan diagang. */}
      {pendingMemoryFactsError ? (
        <ErrorCard
          title={t.workspace.memoryProposalErrorTitle}
          description={t.workspace.workspaceSectionErrorDesc}
          retryLabel={t.workspace.workspaceRetryButton}
          onRetry={onRetryPendingMemoryFacts}
        />
      ) : (
        !pendingMemoryFactsLoading &&
        pendingMemoryFacts.length > 0 && (
          <WorkspaceCard tone="primary">
            <h3 className="mb-1 text-sm font-bold text-primary">{t.workspace.memoryProposalTitle}</h3>
            <p className="mb-4 text-xs leading-relaxed text-neutral-400">{t.workspace.memoryProposalDesc}</p>
            <div className="space-y-2">
              {pendingMemoryFacts.map((fact) => (
                <div
                  key={fact.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <p className="text-sm text-neutral-200">
                    <span className="font-semibold text-white">{fact.factKey.replace(/_/g, " ")}:</span>{" "}
                    {String(fact.factValue)}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onReviewMemoryFact(fact.id, "approve")}
                      disabled={reviewingFactId === fact.id}
                      className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-black transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                    >
                      {t.workspace.memoryApproveButton}
                    </button>
                    <button
                      onClick={() => onReviewMemoryFact(fact.id, "reject")}
                      disabled={reviewingFactId === fact.id}
                      className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-neutral-300 transition-colors duration-150 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                    >
                      {t.workspace.memoryRejectButton}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </WorkspaceCard>
        )
      )}
    </WorkspaceSection>
  );
}

export default ChatBeemoPanel;
