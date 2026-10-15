export type KnowledgeProduct = {
  id: string;
  name: string;
  category: string;
  description: string;
  specifications: string;
  price: number;
  stock: number;
  delivery: string;
  discounts: string;
  instructions: string;
};
export type Turn = { role: "buyer" | "seller"; text: string };
export type Scenario = {
  id: string;
  name: string;
  question: string;
  context: Turn[];
};
export type ProviderId = "demo" | "yandex" | "deepseek" | "qwen" | "gigachat";
export type ModelOption = {
  key: string;
  provider: ProviderId;
  modelId: string;
  label: string;
  demo: boolean;
  available: boolean;
  reason?: string;
};
export const criteria = [
  ["accuracy", "Точность информации"],
  ["russian", "Естественность русского языка"],
  ["needs", "Понимание потребностей"],
  ["objections", "Работа с возражениями"],
  ["facts", "Отсутствие выдуманных фактов"],
  ["usefulness", "Краткость и полезность"],
  ["rules", "Соблюдение правил продавца"],
] as const;
export type Criterion = (typeof criteria)[number][0];
export type Review = {
  scores: Partial<Record<Criterion, number>>;
  comment: string;
};
export type Result = {
  id: string;
  model: ModelOption;
  text: string | null;
  error: string | null;
  handoff: boolean | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cost: { amount: number; currency: string; source: string } | null;
  durationMs: number;
  review: Review;
};
export type TestRun = {
  id: string;
  createdAt: string;
  scenario: Scenario;
  product: KnowledgeProduct;
  results: Result[];
};
export type SellerData = {
  version: 1;
  products: KnowledgeProduct[];
  scenarios: Scenario[];
  runs: TestRun[];
};
export type CompareInput = {
  mode: "demo" | "real";
  modelKeys: string[];
  product: KnowledgeProduct;
  scenario: Scenario;
};
export const providerLabels: Record<ProviderId, string> = {
  demo: "Локальный деморежим",
  yandex: "Yandex AI Studio",
  deepseek: "DeepSeek",
  qwen: "Qwen · Alibaba Cloud Model Studio",
  gigachat: "GigaChat",
};
export const providerDocs: Record<Exclude<ProviderId, "demo">, string> = {
  yandex:
    "https://aistudio.yandex.ru/ru/docs/ai-studio/operations/generation/completions-basic",
  deepseek: "https://api-docs.deepseek.com/api/create-chat-completion/",
  qwen: "https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope",
  gigachat:
    "https://developers.sber.ru/docs/ru/gigachat/api/reference/rest/gigachat-api",
};
export const demoModels: ModelOption[] = [
  {
    key: "demo:short",
    provider: "demo",
    modelId: "local-short",
    label: "Демо · краткий ответ",
    demo: true,
    available: true,
  },
  {
    key: "demo:consult",
    provider: "demo",
    modelId: "local-consult",
    label: "Демо · консультация",
    demo: true,
    available: true,
  },
];
