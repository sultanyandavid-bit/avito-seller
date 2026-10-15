import {
  criteria,
  type CompareInput,
  type KnowledgeProduct,
  type Scenario,
  type SellerData,
  type Turn,
} from "./types";
const record = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const str = (x: unknown, max: number, min = 0): x is string =>
  typeof x === "string" && x.length <= max && x.trim().length >= min;
export function isProduct(x: unknown): x is KnowledgeProduct {
  return (
    record(x) &&
    str(x.id, 100, 1) &&
    str(x.name, 120, 1) &&
    str(x.category, 100, 1) &&
    str(x.description, 2000, 1) &&
    str(x.specifications, 2500) &&
    typeof x.price === "number" &&
    Number.isFinite(x.price) &&
    x.price >= 0 &&
    x.price <= 1e9 &&
    Number.isInteger(x.stock) &&
    Number(x.stock) >= 0 &&
    Number(x.stock) <= 1e6 &&
    str(x.delivery, 1500) &&
    str(x.discounts, 1500) &&
    str(x.instructions, 2000)
  );
}
export function isTurns(x: unknown): x is Turn[] {
  return (
    Array.isArray(x) &&
    x.length <= 20 &&
    x.every(
      (t) =>
        record(t) &&
        ["buyer", "seller"].includes(String(t.role)) &&
        str(t.text, 2000, 1),
    ) &&
    x.reduce((n, t) => n + t.text.length, 0) <= 12000
  );
}
export function isScenario(x: unknown): x is Scenario {
  return (
    record(x) &&
    str(x.id, 100, 1) &&
    str(x.name, 120, 1) &&
    str(x.question, 4000, 1) &&
    isTurns(x.context)
  );
}
export function parseCompare(x: unknown): CompareInput | null {
  if (
    !record(x) ||
    !["demo", "real"].includes(String(x.mode)) ||
    !Array.isArray(x.modelKeys) ||
    x.modelKeys.length < 1 ||
    x.modelKeys.length > 4 ||
    !x.modelKeys.every((k) => str(k, 300, 1)) ||
    new Set(x.modelKeys).size !== x.modelKeys.length ||
    !isProduct(x.product) ||
    !isScenario(x.scenario)
  )
    return null;
  return x as CompareInput;
}
const nullableCount = (x: unknown) =>
  x === null || (typeof x === "number" && Number.isSafeInteger(x) && x >= 0);
export function parseSellerData(raw: string): SellerData | null {
  try {
    if (raw.length > 8000000) return null;
    const x: unknown = JSON.parse(raw);
    if (
      !record(x) ||
      x.version !== 1 ||
      !Array.isArray(x.products) ||
      x.products.length > 100 ||
      !x.products.every(isProduct) ||
      !Array.isArray(x.scenarios) ||
      x.scenarios.length > 100 ||
      !x.scenarios.every(isScenario) ||
      !Array.isArray(x.runs) ||
      x.runs.length > 50
    )
      return null;
    if (
      !x.runs.every(
        (r) =>
          record(r) &&
          str(r.id, 100, 1) &&
          str(r.createdAt, 50, 1) &&
          Number.isFinite(Date.parse(r.createdAt)) &&
          isScenario(r.scenario) &&
          isProduct(r.product) &&
          Array.isArray(r.results) &&
          r.results.length <= 4 &&
          r.results.every(
            (t) =>
              record(t) &&
              str(t.id, 100, 1) &&
              record(t.model) &&
              str(t.model.key, 300, 1) &&
              str(t.model.label, 160, 1) &&
              str(t.model.modelId, 200, 1) &&
              ["demo", "yandex", "deepseek", "qwen", "gigachat"].includes(
                String(t.model.provider),
              ) &&
              typeof t.model.demo === "boolean" &&
              typeof t.model.available === "boolean" &&
              (t.text === null || str(t.text, 16000)) &&
              (t.error === null || str(t.error, 1000)) &&
              (t.handoff === null || typeof t.handoff === "boolean") &&
              nullableCount(t.inputTokens) &&
              nullableCount(t.outputTokens) &&
              typeof t.durationMs === "number" &&
              Number.isFinite(t.durationMs) &&
              t.durationMs >= 0 &&
              (t.cost === null ||
                (record(t.cost) &&
                  typeof t.cost.amount === "number" &&
                  Number.isFinite(t.cost.amount) &&
                  t.cost.amount >= 0 &&
                  str(t.cost.currency, 10, 1) &&
                  str(t.cost.source, 500, 1))) &&
              record(t.review) &&
              str(t.review.comment, 2000) &&
              record(t.review.scores) &&
              Object.entries(t.review.scores).every(
                ([k, v]) =>
                  criteria.some(([id]) => id === k) &&
                  Number.isInteger(v) &&
                  Number(v) >= 1 &&
                  Number(v) <= 5,
              ),
          ),
      )
    )
      return null;
    return x as SellerData;
  } catch {
    return null;
  }
}
export function importConversation(text: string, json: boolean): Turn[] {
  if (text.length > 100000)
    throw new Error("Файл слишком большой. Максимум 100 КБ.");
  let turns: unknown;
  if (json) {
    try {
      turns = JSON.parse(text);
    } catch {
      throw new Error(
        "Некорректный JSON. Нужен массив сообщений с role и text.",
      );
    }
  } else {
    turns = text
      .split(/\r?\n/)
      .filter((x) => x.trim())
      .map((line) => {
        const match = /^(Покупатель|Продавец):\s*(.+)$/i.exec(line);
        if (!match)
          throw new Error(
            "Каждая строка TXT должна начинаться с «Покупатель:» или «Продавец:».",
          );
        return {
          role: match[1].toLowerCase() === "покупатель" ? "buyer" : "seller",
          text: match[2],
        };
      });
  }
  if (!isTurns(turns) || !turns.length)
    throw new Error(
      "Нужно 1–20 сообщений buyer/seller, до 2000 символов каждое и 12000 суммарно.",
    );
  return turns;
}
