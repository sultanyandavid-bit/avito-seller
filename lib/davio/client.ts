export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/davio/${path}`, {
    ...init,
    headers: {
      ...(init.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init.headers,
    },
    cache: "no-store",
  });
  const value = await response.json();
  if (!response.ok)
    throw new Error(value.error || "Не удалось выполнить запрос.");
  return value as T;
}
export function post<T>(path: string, body: unknown = {}) {
  return api<T>(path, { method: "POST", body: JSON.stringify(body) });
}
export function patch<T>(path: string, body: unknown) {
  return api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}
export const assetUrl = (id: string, download = false) =>
  `/api/davio/files/${encodeURIComponent(id)}${download ? "?download=1" : ""}`;
