/**
 * THE HIVE — Report Data Schema
 * ------------------------------------------------------------------
 * This file is the CONTRACT between content (whatever produces the
 * business analysis — an LLM call, a rules engine, a human editor)
 * and the LOCKED visual template validated in the PRO/PLATINUM PDF
 * prototypes. As long as content conforms to these types, the PDF
 * output is guaranteed to match the approved format.
 *
 * Content generation and template rendering are deliberately kept
 * separate: this file never contains business logic, only shapes.
 */

export type Tier = "pro" | "platinum";
export type Decision = "GO" | "WAIT" | "PIVOT" | "STOP";

export interface Kpi {
  value: string;
  label: string;
}

/** Every chart type validated in the prototype has an equivalent here. */
export type ChartSpec =
  | { type: "radar"; labels: string[]; values: number[] }
  | { type: "bar"; labels: string[]; values: number[]; accent?: string }
  | { type: "pie"; labels: string[]; values: number[]; colors?: string[] }
  | {
      type: "matrix";
      points: { label: string; x: number; y: number }[];
      xLabel: string;
      yLabel: string;
      // "risk" colors by quadrant severity, "priority" highlights the
      // top-right quadrant as the action-now zone.
      variant: "risk" | "priority";
    }
  | { type: "timeline"; milestones: { period: string; title: string }[] };

export interface SwotSpec {
  kekuatan: string[];
  kelemahan: string[];
  peluang: string[];
  ancaman: string[];
}

/**
 * One Business Intelligence page: Identity -> KPI row -> Executive
 * Insight -> Visual -> (optional short analysis) -> Business Impact ->
 * AI Recommendation -> Decision + Confidence.
 * This is the ONLY page shape in the whole report — every chapter is
 * an instance of this, which is what keeps the whole document visually
 * consistent no matter who or what generates the content.
 */
export interface IntelligencePage {
  eyebrow: string; // e.g. "MARKET INTELLIGENCE"
  title: string; // e.g. "Ukuran Pasar Bukan Masalah Utama"
  kpis: Kpi[]; // 3-4 recommended
  insight: string; // 1-2 sentences, no hedging, consultant voice
  visual?: ChartSpec | { type: "swot"; data: SwotSpec };
  analysis?: string[]; // optional short paragraphs, use sparingly
  impact: string;
  recommendation: string;
  decision: Decision;
  confidencePct: number; // 0-100
  confidenceBasis: string; // what the confidence is grounded in
  /** Escape hatch for supplementary tables that don't fit the standard
   * blocks (e.g. Financial Data Completeness, a KPI reference table).
   * Must be a small, self-contained HTML fragment using the shared
   * `.hive-table` class so styling stays consistent. */
  extraHtml?: string;
}

export interface BusinessProfile {
  ownerName: string;
  businessName: string;
  businessType: string;
  profession: string;
  location: string;
  status: string;
  initialCapital: string;
}

export interface DecisionMapRow {
  chapter: string;
  decision: Decision;
  reason: string;
}

export interface ExecutiveSummaryData {
  businessScore: number;
  overallDecision: Decision;
  confidencePct: number;
  nextCheckpoint: string;
  summary: string;
  decisionMap: DecisionMapRow[];
  thisWeek: string;
}

export interface CeoDecision {
  title: string;
  text: string;
}

export interface ReferenceRow {
  topic: string;
  source: string;
}

export interface GlossaryRow {
  term: string;
  meaning: string;
}

export interface ConfidenceMatrixRow {
  section: string;
  source: string;
  confidencePct: number;
}

export interface AppendixData {
  references: ReferenceRow[];
  glossary: GlossaryRow[];
  confidenceMatrix: ConfidenceMatrixRow[];
  dataNeeded: string[];
  aiNotes: string;
}

export interface CoverMeta {
  reportNo: string;
  date: string;
  version: string;
  industry: string;
  preparedBy: string;
  businessScore: number;
  confidencePct: number;
  executiveRecommendation: string;
  snapshot: string;
}

/** The full, typed payload a caller must assemble for one report. */
export interface ReportData {
  tier: Tier;
  price: string; // e.g. "Rp99.000"
  tagline: string;
  profile: BusinessProfile;
  cover: CoverMeta;
  executiveSummary?: ExecutiveSummaryData; // Platinum only
  sections: IntelligencePage[];
  ceoRecommendation?: CeoDecision[]; // Platinum only
  appendix?: AppendixData; // Platinum only
}
