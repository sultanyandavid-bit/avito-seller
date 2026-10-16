/** Local owner workspace. Real user authentication/authorization is a server concern. */
export const MAIN_STORE_ID = "local-main";
export const LOCAL_WORKSPACE_ID = "local-workspace";
export type LocalStore = { id: string; name: string };
export type LocalWorkspace = {
  version: 1;
  id: string;
  activeStoreId: string;
  stores: LocalStore[];
};
export const workspaceSeed: LocalWorkspace = {
  version: 1,
  id: LOCAL_WORKSPACE_ID,
  activeStoreId: MAIN_STORE_ID,
  stores: [{ id: MAIN_STORE_ID, name: "Техно Стор" }],
};
export const workspaceKey = "sellerai:workspace:v1";
export function parseWorkspace(raw: string): LocalWorkspace | null {
  try {
    const x = JSON.parse(raw);
    if (
      x?.version !== 1 ||
      x.id !== LOCAL_WORKSPACE_ID ||
      !Array.isArray(x.stores) ||
      x.stores.length < 1 ||
      x.stores.length > 30 ||
      !x.stores.every(
        (s: LocalStore) =>
          s &&
          typeof s.id === "string" &&
          /^[a-z0-9_-]{1,100}$/.test(s.id) &&
          typeof s.name === "string" &&
          s.name.trim().length > 0 &&
          s.name.length <= 60,
      ) ||
      !x.stores.some((s: LocalStore) => s.id === x.activeStoreId) ||
      new Set(x.stores.map((s: LocalStore) => s.id)).size !== x.stores.length
    )
      return null;
    return x;
  } catch {
    return null;
  }
}
export function scopedKey(original: string, storeId: string) {
  return storeId === MAIN_STORE_ID ? original : `${original}:store:${storeId}`;
}
