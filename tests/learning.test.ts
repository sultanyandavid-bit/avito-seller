import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyTraining,
  saveExample,
  parseTraining,
  relevantExamples,
  approvedContext,
} from "../lib/learning/repository";
import {
  MAIN_STORE_ID,
  scopedKey,
  parseWorkspace,
  workspaceSeed,
} from "../lib/workspaces/types";
import { parseChatData, chatSeed } from "../lib/learning/chat";
import type { ExampleInput } from "../lib/learning/types";
const sample: ExampleInput = {
  productId: "ski",
  productName: "Костюм",
  question: "Костюм подойдёт для -20 градусов?",
  originalReply: "Неизвестно, уточню.",
  correctedReply:
    "Здравствуйте! Планируете активное катание или прогулки? Уточню характеристики модели.",
  status: "approved",
  comment: "Не обещать температурный режим без данных.",
};
test("learning saves complete scoped records and records prior versions on edits", () => {
  let data = saveExample(
    emptyTraining("shop-a"),
    sample,
    undefined,
    "2026-10-16T10:00:00Z",
  );
  const first = data.examples[0];
  assert.equal(first.storeId, "shop-a");
  assert.equal(first.workspaceId, "local-workspace");
  assert.equal(first.originalReply, sample.originalReply);
  data = saveExample(
    data,
    { ...sample, correctedReply: "Уточню характеристики.", status: "edited" },
    first.id,
    "2026-10-16T11:00:00Z",
  );
  assert.equal(data.examples[0].revisions.length, 1);
  assert.equal(
    data.examples[0].revisions[0].correctedReply,
    sample.correctedReply,
  );
  assert.equal(data.examples[0].createdAt, first.createdAt);
  assert.deepEqual(parseTraining(JSON.stringify(data), "shop-a"), data);
  assert.equal(parseTraining(JSON.stringify(data), "shop-b"), null);
});
test("only approved examples with matching store and product appear in contextual search", () => {
  const a = saveExample(emptyTraining("a"), sample).examples[0];
  const b = saveExample(emptyTraining("b"), sample).examples[0];
  const rejected = { ...a, id: "bad", status: "rejected" as const };
  const otherProduct = { ...a, id: "other", productId: "bike" };
  const list = [a, b, rejected, otherProduct];
  assert.deepEqual(
    relevantExamples(list, "a", "ski", "Для -20 градусов подойдёт?").map(
      (r) => r.example.id,
    ),
    [a.id],
  );
  assert.equal(
    relevantExamples(list, "a", "ski", "Как оплатить картой?").length,
    0,
  );
  assert.equal(
    approvedContext(list, "a", "ski", "Для -20 градусов подойдёт?")[0]
      .approvedReply,
    sample.correctedReply,
  );
});
test("invalid approved examples and cross-store edits are rejected", () => {
  assert.throws(() =>
    saveExample(emptyTraining("a"), { ...sample, correctedReply: " " }),
  );
  assert.throws(() =>
    saveExample(emptyTraining("a"), sample, "not-from-this-store"),
  );
  assert.equal(parseTraining("garbage", "a"), null);
  const d = saveExample(emptyTraining("a"), sample);
  assert.equal(
    parseTraining(
      JSON.stringify({
        ...d,
        examples: [{ ...d.examples[0], status: "invented" }],
      }),
      "a",
    ),
    null,
  );
});
test("legacy keys are retained for original store and new stores receive distinct keys", () => {
  assert.equal(
    scopedKey("ai-avito-seller:v1", MAIN_STORE_ID),
    "ai-avito-seller:v1",
  );
  assert.notEqual(
    scopedKey("ai-avito-seller:v1", "a"),
    scopedKey("ai-avito-seller:v1", "b"),
  );
  assert.deepEqual(
    parseWorkspace(JSON.stringify(workspaceSeed)),
    workspaceSeed,
  );
  assert.equal(
    parseWorkspace(
      JSON.stringify({ ...workspaceSeed, activeStoreId: "missing" }),
    ),
    null,
  );
});
test("assistant history accepts all valid drafts and rejects invalid dates and roles", () => {
  assert.deepEqual(parseChatData(JSON.stringify(chatSeed)), chatSeed);
  assert.equal(
    parseChatData(
      JSON.stringify({
        version: 1,
        drafts: [
          {
            id: "x",
            productId: "p",
            question: "q",
            original: "r",
            edited: null,
            handoff: true,
            createdAt: "not-date",
          },
        ],
      }),
    ),
    null,
  );
});
