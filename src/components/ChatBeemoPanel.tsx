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
type ChatMessage = { role: "user" | "assistant"; content: string };
type PendingMemoryFact = { id: string; factKey: string; factValue: unknown; proposedAt: string };
type DecisionRecord = {
  id: string | null;
  question: string;
  goal: string;
  risk: string;
  opportunity: string;
  supportingData: string[];
  recommendation: string;
  conclusion: string;
  status: string;
  createdAt: string;
};

// Decision Engine result field — dipakai untuk Goal/Risk/Opportunity/
// Recommendation/Conclusion, tidak dirender kalau kosong (jangan sampai
// tampil label tanpa isi kalau Beemo jujur bilang datanya belum cukup).
function DecisionField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-neutral-200">{value}</p>
    </div>
  );
}

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

  // Decision Engine ("AI Business Mentor, bukan AI Reporter") — entrypoint
  // ringan di dalam Chat Beemo panel yang sudah ada, bukan halaman baru.
  const [showDecisionForm, setShowDecisionForm] = useState(false);
  const [decisionQuestion, setDecisionQuestion] = useState("");
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionResult, setDecisionResult] = useState<DecisionRecord | null>(null);
  const [decisionHistory, setDecisionHistory] = useState<DecisionRecord[]>([]);
  const [decisionHistoryLoading, setDecisionHistoryLoading] = useState(false);
  const [decisionHistoryLoaded, setDecisionHistoryLoaded] = useState(false);

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

    try {
      const response = await fetch("/api/beemo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "chat", businessProfileId, messages: nextMessages, lang }),
      });
      const json = await response.json();

      if (!response.ok) {
        setError(json.error || t.workspace.chatErrorGeneric);
        setSending(false);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: json.reply }]);
      setSending(false);
    } catch (err) {
      console.error("chat-beemo error:", err);
      setError(t.workspace.chatErrorGeneric);
      setSending(false);
    }
  }

  // Decision History dimuat sekali saat form pertama kali dibuka — bukan
  // fetch terpisah berulang setiap render.
  async function loadDecisionHistory() {
    if (!session?.access_token) return;
    setDecisionHistoryLoading(true);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "listDecisions", businessProfileId, lang }),
      });
      const json = await response.json();
      if (response.ok) {
        setDecisionHistory(json.decisions || []);
      }
    } catch (err) {
      console.error("listDecisions error:", err);
    }
    setDecisionHistoryLoading(false);
    setDecisionHistoryLoaded(true);
  }

  function handleToggleDecisionForm() {
    const next = !showDecisionForm;
    setShowDecisionForm(next);
    setDecisionError(null);
    if (next && !decisionHistoryLoaded) loadDecisionHistory();
  }

  async function handleProposeDecision() {
    const trimmed = decisionQuestion.trim();
    if (!trimmed || decisionLoading || !session?.access_token) return;
    setDecisionLoading(true);
    setDecisionError(null);

    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "proposeDecision", businessProfileId, question: trimmed, lang }),
      });
      const json = await response.json();

      if (!response.ok) {
        setDecisionError(json.error || t.workspace.decisionErrorGeneric);
        setDecisionLoading(false);
        return;
      }

      setDecisionResult(json.decision);
      setDecisionHistory((prev) => [json.decision, ...prev]);
      setDecisionQuestion("");
      setDecisionLoading(false);
    } catch (err) {
      console.error("proposeDecision error:", err);
      setDecisionError(t.workspace.decisionErrorGeneric);
      setDecisionLoading(false);
    }
  }

  return (
    <WorkspaceSection>
      <SectionHeader title={t.workspace.menuChat} description={t.workspace.chatSectionDesc} />

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
              <div
                className={
                  "max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed " +
                  (m.role === "user" ? "bg-primary text-black" : "border border-white/10 bg-white/5 text-neutral-200")
                }
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && <p className="text-xs text-neutral-500">{t.workspace.chatSending}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
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

      <WorkspaceCard tone="primary">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-primary">{t.workspace.decisionSectionTitle}</h3>
            <p className="mt-1 text-xs leading-relaxed text-neutral-400">{t.workspace.decisionSectionDesc}</p>
          </div>
          <button
            onClick={handleToggleDecisionForm}
            className="rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white transition-colors duration-150 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            {showDecisionForm ? t.workspace.decisionCancelButton : t.workspace.decisionOpenButton}
          </button>
        </div>

        {showDecisionForm && (
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <textarea
                value={decisionQuestion}
                onChange={(e) => setDecisionQuestion(e.target.value)}
                placeholder={t.workspace.decisionInputPlaceholder}
                rows={3}
                disabled={decisionLoading}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition-colors duration-150 focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/70 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                onClick={handleProposeDecision}
                disabled={decisionLoading || !decisionQuestion.trim()}
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-black transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                {decisionLoading ? t.workspace.decisionSubmitLoading : t.workspace.decisionSubmitButton}
              </button>
              {decisionError && <p className="text-sm text-red-400">{decisionError}</p>}
            </div>

            {decisionResult && (
              <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
                <DecisionField label={t.workspace.decisionGoalLabel} value={decisionResult.goal} />
                <DecisionField label={t.workspace.decisionRiskLabel} value={decisionResult.risk} />
                <DecisionField label={t.workspace.decisionOpportunityLabel} value={decisionResult.opportunity} />
                {decisionResult.supportingData && decisionResult.supportingData.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      {t.workspace.decisionSupportingDataLabel}
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-neutral-200">
                      {decisionResult.supportingData.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <DecisionField label={t.workspace.decisionRecommendationLabel} value={decisionResult.recommendation} />
                <DecisionField label={t.workspace.decisionConclusionLabel} value={decisionResult.conclusion} />
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {t.workspace.decisionHistoryTitle}
              </p>
              {!decisionHistoryLoading && decisionHistory.length === 0 && (
                <p className="text-xs text-neutral-500">{t.workspace.decisionHistoryEmpty}</p>
              )}
              {decisionHistory.length > 0 && (
                <div className="space-y-2">
                  {decisionHistory.map((d, i) => (
                    <div key={d.id || i} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-sm font-semibold text-white">{d.question}</p>
                      {d.conclusion && <p className="mt-1 text-xs text-neutral-400">{d.conclusion}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </WorkspaceCard>
    </WorkspaceSection>
  );
}

export default ChatBeemoPanel;
