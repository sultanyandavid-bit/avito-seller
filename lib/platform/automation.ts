export const allowedScenarios = {
  availability: "Наличие",
  price: "Цена",
  specifications: "Подтверждённые характеристики",
};
export type AutomationPolicy = {
  version: 1;
  storeId: string;
  mode: "learner" | "assistant" | "seller";
  autoEnabled: false;
  allowed: (keyof typeof allowedScenarios)[];
  intervalSeconds: number;
};
export function emptyPolicy(storeId: string): AutomationPolicy {
  return {
    version: 1,
    storeId,
    mode: "assistant",
    autoEnabled: false,
    allowed: [],
    intervalSeconds: 30,
  };
}
export function parsePolicy(
  raw: string,
  storeId: string,
): AutomationPolicy | null {
  try {
    const x = JSON.parse(raw);
    return x?.version === 1 &&
      x.storeId === storeId &&
      ["learner", "assistant", "seller"].includes(x.mode) &&
      x.autoEnabled === false &&
      Array.isArray(x.allowed) &&
      x.allowed.every(
        (s: unknown) =>
          typeof s === "string" && Object.hasOwn(allowedScenarios, s),
      ) &&
      Number.isInteger(x.intervalSeconds) &&
      x.intervalSeconds >= 10 &&
      x.intervalSeconds <= 3600
      ? x
      : null;
  } catch {
    return null;
  }
}
export function replyIdentity(
  storeId: string,
  conversationId: string,
  messageId: string,
) {
  return JSON.stringify([storeId, conversationId, messageId]);
}
/** Pure safety planner for a future sender; this does not send any message. */
export function evaluateAutomation(input: {
  authorized: boolean;
  officialConnection: boolean;
  explicitPermission: boolean;
  enabled: boolean;
  scenario: string;
  allowed: string[];
  human: boolean;
  alreadySent: boolean;
  lastSentAt: number | null;
  now: number;
  intervalSeconds: number;
}) {
  if (!input.authorized)
    return { allowed: false, reason: "Нет подтверждённых прав на магазин" };
  if (!input.officialConnection)
    return { allowed: false, reason: "Нет официального подключения" };
  if (!input.explicitPermission || !input.enabled)
    return {
      allowed: false,
      reason: "Нет разрешения на автоматическую отправку",
    };
  if (input.human) return { allowed: false, reason: "Вмешался продавец" };
  if (input.alreadySent)
    return { allowed: false, reason: "На сообщение уже ответили" };
  if (!input.allowed.includes(input.scenario))
    return { allowed: false, reason: "Сценарий передаётся человеку" };
  if (
    input.lastSentAt !== null &&
    input.now - input.lastSentAt < input.intervalSeconds * 1000
  )
    return { allowed: false, reason: "Ограничение частоты" };
  return {
    allowed: true,
    reason: "Проверки пройдены; требуется серверный отправитель",
  };
}
