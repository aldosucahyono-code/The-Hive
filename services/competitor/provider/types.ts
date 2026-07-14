// services/competitor/provider/types.ts
//
// Kontrak yang harus dipenuhi SEMUA provider data kompetitor. Competitor
// Engine (dan segala sesuatu di atasnya — Workspace/Chat/PDF) hanya
// bicara lewat interface ini, tidak pernah langsung ke Google/OSM. Ganti
// provider = ganti satu file `provider/index.ts`, tanpa menyentuh apapun
// di atasnya.

import type { ProviderQuery, ProviderResult } from "../types/index.js";

export interface CompetitorDataProvider {
  readonly source: "google_places" | "openstreetmap" | "claude_web_search" | "mock";
  fetchCompetitors(query: ProviderQuery): Promise<ProviderResult>;
}
