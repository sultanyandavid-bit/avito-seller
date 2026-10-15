import type { Store } from "./types";
export const STORAGE_KEY = "ai-avito-seller:v1";
export function parseStore(raw: string): Store | null {
  try {
    const x = JSON.parse(raw);
    if (
      x?.version !== 1 ||
      typeof x.shopName !== "string" ||
      typeof x.city !== "string" ||
      !Array.isArray(x.products) ||
      !Array.isArray(x.conversations) ||
      !x.ai ||
      typeof x.ai.enabled !== "boolean" ||
      !["friendly", "business", "brief"].includes(x.ai.style) ||
      typeof x.ai.instructions !== "string"
    )
      return null;
    if (
      !x.products.every(
        (p: Record<string, unknown>) =>
          p &&
          typeof p.id === "string" &&
          typeof p.name === "string" &&
          typeof p.description === "string" &&
          typeof p.category === "string" &&
          typeof p.price === "number" &&
          Number.isFinite(p.price) &&
          p.price >= 0 &&
          Number.isInteger(p.stock) &&
          Number(p.stock) >= 0 &&
          ["active", "draft", "archived"].includes(String(p.status)) &&
          ["phone", "laptop", "headphones", "camera", "box"].includes(
            String(p.visual),
          ),
      )
    )
      return null;
    if (
      !x.conversations.every(
        (c: Record<string, unknown>) =>
          c &&
          typeof c.id === "string" &&
          typeof c.name === "string" &&
          typeof c.productId === "string" &&
          Number.isInteger(c.unread) &&
          Number(c.unread) >= 0 &&
          typeof c.human === "boolean" &&
          Array.isArray(c.messages) &&
          c.messages.every(
            (m) =>
              m &&
              typeof m.id === "string" &&
              ["buyer", "seller"].includes(m.role) &&
              typeof m.text === "string" &&
              typeof m.time === "string",
          ),
      )
    )
      return null;
    return x as Store;
  } catch {
    return null;
  }
}
