/** Future server boundary. Principal must come from verified auth, never request JSON. */
export type Principal = {
  userId: string;
  memberships: {
    workspaceId: string;
    role: "owner" | "admin" | "editor" | "viewer";
  }[];
};
export type TenantStore = { id: string; workspaceId: string };
export type StorePermission = "read" | "edit" | "manage";
export function requireStoreAccess(
  principal: Principal | null,
  store: TenantStore,
  permission: StorePermission,
) {
  if (!principal?.userId) throw new Error("UNAUTHENTICATED");
  const member = principal.memberships.find(
    (m) => m.workspaceId === store.workspaceId,
  );
  if (
    !member ||
    !["owner", "admin", "editor", "viewer"].includes(member.role) ||
    (permission === "manage" && !["owner", "admin"].includes(member.role)) ||
    (permission === "edit" && member.role === "viewer")
  )
    throw new Error("FORBIDDEN");
  return {
    userId: principal.userId,
    workspaceId: store.workspaceId,
    storeId: store.id,
    role: member.role,
  };
}
export type MarketplaceConnection = {
  platform: string;
  official: boolean;
  connected: boolean;
  grantedScopes: string[];
};
export interface MarketplaceAdapter {
  readonly platform: string;
  status(storeId: string): Promise<MarketplaceConnection>;
  sendApprovedReply(
    context: { userId: string; workspaceId: string; storeId: string },
    conversationId: string,
    text: string,
    idempotencyKey: string,
  ): Promise<{ externalId: string }>;
}
export type UsageRecord = {
  id: string;
  workspaceId: string;
  storeId: string;
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  cost: number | null;
  currency: string | null;
  requestId: string;
  createdAt: string;
};
export type SubscriptionPlan = {
  id: string;
  name: string;
  limits: Record<string, number>;
  enabled: boolean;
};
