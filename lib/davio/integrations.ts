/** Only official adapters may publish. Manual export is always available. */
export interface MarketplaceAdapter {
  readonly id: string;
  capabilities(): { publish: boolean; messages: boolean };
  publish(
    projectId: string,
    confirmedByUser: boolean,
  ): Promise<{ externalId: string }>;
}
export const marketplaceStatus = [
  { id: "avito", label: "Авито", connected: false },
  { id: "ozon", label: "Ozon", connected: false },
  { id: "wildberries", label: "Wildberries", connected: false },
] as const;
export interface ContentAIProvider {
  describe(
    input: import("./types").ProjectData,
    signal: AbortSignal,
  ): Promise<{
    title: string;
    description: string;
    inputTokens: number | null;
    outputTokens: number | null;
    cost: number | null;
  }>;
  recognizePhoto(
    bytes: Uint8Array,
    signal: AbortSignal,
  ): Promise<{
    suggestions: Partial<import("./types").ProjectData>;
    requiresConfirmation: true;
  }>;
}
