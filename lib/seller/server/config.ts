import {
  demoModels,
  providerLabels,
  providerDocs,
  type ModelOption,
  type ProviderId,
} from "../types";
export type Env = Record<string, string | undefined>;
export type Tariff = {
  inputPerMillion: number;
  outputPerMillion: number;
  currency: string;
  source: string;
};
export type ConfiguredModel = { option: ModelOption; tariff?: Tariff };
export const credentials: Record<Exclude<ProviderId, "demo">, string> = {
  yandex: "YANDEX_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  qwen: "QWEN_API_KEY",
  gigachat: "GIGACHAT_ACCESS_TOKEN",
};
export function qwenEndpoint(value: string | undefined): string | null {
  try {
    if (!value) return null;
    const u = new URL(value);
    if (
      u.protocol !== "https:" ||
      u.port ||
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      !/^[a-z0-9-]+\.(ap-southeast-1|cn-beijing|cn-hongkong|us-east-1|ap-northeast-1)\.maas\.aliyuncs\.com$/.test(
        u.hostname,
      ) ||
      u.pathname.replace(/\/$/, "") !== "/compatible-mode/v1"
    )
      return null;
    return u.origin + "/compatible-mode/v1/chat/completions";
  } catch {
    return null;
  }
}
export function modelConfig(env: Env = process.env): {
  models: ConfiguredModel[];
  warning: string | null;
} {
  try {
    const raw: unknown = JSON.parse(env.SELLER_AI_MODELS || "[]");
    if (!Array.isArray(raw) || raw.length > 30) throw new Error();
    const seen = new Set<string>();
    const models = raw.map((x): ConfiguredModel => {
      if (
        !x ||
        typeof x !== "object" ||
        !Object.hasOwn(credentials, x.provider) ||
        typeof x.id !== "string" ||
        !x.id.trim() ||
        x.id.length > 200 ||
        typeof x.label !== "string" ||
        !x.label.trim() ||
        x.label.length > 160
      )
        throw new Error();
      const provider = x.provider as Exclude<ProviderId, "demo">;
      const key = `${provider}:${x.id}`;
      if (seen.has(key)) throw new Error();
      seen.add(key);
      let tariff: Tariff | undefined;
      if (x.tariff !== undefined) {
        const t = x.tariff;
        if (
          !t ||
          !Number.isFinite(t.inputPerMillion) ||
          t.inputPerMillion < 0 ||
          !Number.isFinite(t.outputPerMillion) ||
          t.outputPerMillion < 0 ||
          !["RUB", "USD", "EUR", "CNY"].includes(t.currency) ||
          typeof t.source !== "string" ||
          t.source.length > 500 ||
          !t.source.startsWith("https://")
        )
          throw new Error();
        tariff = t;
      }
      const ready =
        env.SELLER_AI_ENABLE_REAL === "true" &&
        (env.SELLER_AI_ACCESS_TOKEN?.length ?? 0) >= 32 &&
        !!env[credentials[provider]] &&
        (provider !== "yandex" || !!env.YANDEX_FOLDER_ID) &&
        (provider !== "qwen" || !!qwenEndpoint(env.QWEN_BASE_URL));
      return {
        option: {
          key,
          provider,
          modelId: x.id,
          label: x.label,
          demo: false,
          available: ready,
          reason: ready
            ? undefined
            : "Реальные запросы выключены или серверная конфигурация не завершена.",
        },
        tariff,
      };
    });
    return { models, warning: null };
  } catch {
    return {
      models: [],
      warning:
        "Конфигурация моделей некорректна. Доступен деморежим; проверьте SELLER_AI_MODELS на сервере.",
    };
  }
}
export function publicCatalog(env: Env = process.env) {
  const config = modelConfig(env);
  return {
    models: [...demoModels, ...config.models.map((m) => m.option)],
    providers: (Object.keys(credentials) as Exclude<ProviderId, "demo">[]).map(
      (id) => ({
        id,
        label: providerLabels[id],
        docs: providerDocs[id],
        configured: config.models.some(
          (m) => m.option.provider === id && m.option.available,
        ),
      }),
    ),
    warning: config.warning,
  };
}
