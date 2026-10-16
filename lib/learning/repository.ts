import { LOCAL_WORKSPACE_ID } from "../workspaces/types";
import type {
  TrainingData,
  TrainingExample,
  ExampleInput,
  FeedbackStatus,
} from "./types";
const statuses: FeedbackStatus[] = [
  "approved",
  "edited",
  "rejected",
  "pending",
];
const text = (x: unknown, max: number, min = 0) =>
  typeof x === "string" && x.length <= max && x.trim().length >= min;
const date = (x: unknown) =>
  typeof x === "string" && Number.isFinite(Date.parse(x));
export function emptyTraining(storeId: string): TrainingData {
  return { version: 1, workspaceId: LOCAL_WORKSPACE_ID, storeId, examples: [] };
}
export function parseTraining(
  raw: string,
  storeId: string,
): TrainingData | null {
  try {
    const x = JSON.parse(raw);
    if (
      x?.version !== 1 ||
      x.workspaceId !== LOCAL_WORKSPACE_ID ||
      x.storeId !== storeId ||
      !Array.isArray(x.examples) ||
      x.examples.length > 1000 ||
      !x.examples.every(
        (e: TrainingExample) =>
          e &&
          e.workspaceId === LOCAL_WORKSPACE_ID &&
          e.storeId === storeId &&
          text(e.id, 100, 1) &&
          text(e.productId, 100, 1) &&
          text(e.productName, 120, 1) &&
          text(e.question, 4000, 1) &&
          text(e.originalReply, 8000) &&
          text(e.correctedReply, 8000) &&
          statuses.includes(e.status) &&
          (e.status !== "approved" || e.correctedReply.trim().length > 0) &&
          text(e.comment, 2000) &&
          date(e.createdAt) &&
          date(e.updatedAt) &&
          Array.isArray(e.revisions) &&
          e.revisions.length <= 100 &&
          e.revisions.every(
            (r) =>
              r &&
              statuses.includes(r.status) &&
              text(r.correctedReply, 8000) &&
              text(r.comment, 2000) &&
              date(r.changedAt),
          ),
      )
    )
      return null;
    return x;
  } catch {
    return null;
  }
}
export function saveExample(
  data: TrainingData,
  input: ExampleInput,
  id?: string,
  now = new Date().toISOString(),
): TrainingData {
  if (
    !input.question.trim() ||
    !input.productId ||
    !input.productName.trim() ||
    !text(input.originalReply, 8000) ||
    !text(input.correctedReply, 8000) ||
    !text(input.question, 4000, 1) ||
    !text(input.comment, 2000) ||
    !statuses.includes(input.status) ||
    (input.status === "approved" && !input.correctedReply.trim())
  )
    throw new Error("Заполните товар, вопрос и одобренный вариант ответа.");
  const old = id
    ? data.examples.find((e) => e.id === id && e.storeId === data.storeId)
    : undefined;
  if (id && !old) throw new Error("Пример не найден в этом магазине.");
  if (!old && data.examples.length >= 1000)
    throw new Error(
      "Достигнут лимит 1000 примеров. Сначала экспортируйте и упорядочьте базу.",
    );
  if (old && old.revisions.length >= 100)
    throw new Error(
      "Достигнут лимит 100 изменений примера. Создайте новый пример; история сохранена.",
    );
  const example: TrainingExample = {
    ...input,
    question: input.question.trim(),
    correctedReply: input.correctedReply.trim(),
    id: old?.id ?? crypto.randomUUID(),
    storeId: data.storeId,
    workspaceId: data.workspaceId,
    createdAt: old?.createdAt ?? now,
    updatedAt: now,
    revisions: old
      ? [
          ...old.revisions,
          {
            correctedReply: old.correctedReply,
            status: old.status,
            comment: old.comment,
            changedAt: old.updatedAt,
          },
        ]
      : [],
  };
  return {
    ...data,
    examples: old
      ? data.examples.map((e) => (e.id === id ? example : e))
      : [example, ...data.examples],
  };
}
const stop = new Set([
  "здравствуйте",
  "добрый",
  "день",
  "подскажите",
  "пожалуйста",
  "этот",
  "этого",
  "можно",
  "ли",
  "и",
  "а",
  "в",
  "на",
  "у",
  "для",
  "как",
  "что",
  "вы",
  "вас",
  "мне",
  "есть",
]);
const terms = (q: string) =>
  new Set(
    q
      .toLocaleLowerCase("ru")
      .replaceAll("ё", "е")
      .match(/[а-яa-z0-9]{2,}/g)
      ?.filter((x) => !stop.has(x)) ?? [],
  );
export function relevantExamples(
  examples: TrainingExample[],
  storeId: string,
  productId: string,
  question: string,
  limit = 3,
) {
  const q = terms(question);
  if (!q.size) return [];
  return examples
    .filter(
      (e) =>
        e.storeId === storeId &&
        e.productId === productId &&
        e.status === "approved",
    )
    .map((e) => {
      const t = terms(e.question);
      const matches = [...q].filter((x) => t.has(x)).length;
      return {
        example: e,
        score: matches / Math.max(1, new Set([...q, ...t]).size),
      };
    })
    .filter((x) => x.score >= 0.15)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.example.updatedAt.localeCompare(a.example.updatedAt),
    )
    .slice(0, limit);
}
export function approvedContext(
  examples: TrainingExample[],
  storeId: string,
  productId: string,
  question: string,
) {
  return relevantExamples(examples, storeId, productId, question).map((x) => ({
    question: x.example.question,
    approvedReply: x.example.correctedReply,
    note: x.example.comment,
  }));
}
