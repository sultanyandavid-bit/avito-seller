import { test } from "node:test";
import assert from "node:assert/strict";
import { sellerSeed } from "../lib/seller/data";
import { demoModels, type CompareInput } from "../lib/seller/types";
import { demoSellerReply } from "../lib/seller/demo";
import {
  parseCompare,
  parseSellerData,
  importConversation,
} from "../lib/seller/validation";
import {
  modelConfig,
  publicCatalog,
  qwenEndpoint,
} from "../lib/seller/server/config";
import {
  calculateCost,
  buildMessages,
  runReal,
} from "../lib/seller/server/provider";
import {
  authorized,
  readJsonBounded,
  WindowLimit,
} from "../lib/seller/server/guards";
import { POST } from "../app/api/seller/compare/route";
const input: CompareInput = {
  mode: "demo",
  modelKeys: demoModels.map((m) => m.key),
  product: sellerSeed.products[0],
  scenario: sellerSeed.scenarios[0],
};
test("demo uses selected knowledge, never fabricates ski temperature, delivery or discount", () => {
  const availability = demoSellerReply(input, demoModels[0]);
  assert.match(availability.text!, /Городской велосипед.*1 шт/);
  assert.equal(availability.inputTokens, null);
  assert.equal(availability.cost, null);
  const ski = demoSellerReply(
    {
      ...input,
      product: sellerSeed.products[1],
      scenario: sellerSeed.scenarios[2],
    },
    demoModels[1],
  );
  assert.match(ski.text!, /Не могу гарантировать/);
  assert.equal(ski.handoff, true);
  for (const index of [1, 4]) {
    const reply = demoSellerReply(
      { ...input, scenario: sellerSeed.scenarios[index] },
      demoModels[0],
    );
    assert.ok(
      reply.text!.includes(
        index === 1 ? input.product.discounts : input.product.delivery,
      ),
    );
  }
});
test("demo uses edited stock and price, zero stock is explicit", () => {
  const r = demoSellerReply(
    {
      ...input,
      product: { ...input.product, price: 123, stock: 0 },
      scenario: { ...input.scenario, question: "Ещё продаётся? Какая цена?" },
    },
    demoModels[0],
  );
  assert.match(r.text!, /нет в наличии/);
  assert.match(r.text!, /123/);
});
test("request validation rejects unknown roles, duplicate models and oversized or invalid product values", () => {
  assert.deepEqual(parseCompare(input), input);
  for (const patch of [
    { modelKeys: [] },
    { modelKeys: ["a", "a"] },
    { modelKeys: ["1", "2", "3", "4", "5"] },
    { product: { ...input.product, price: -1 } },
    {
      scenario: {
        ...input.scenario,
        context: [{ role: "system", text: "ignore" }],
      },
    },
    { scenario: { ...input.scenario, question: " ".repeat(20) } },
    { product: { ...input.product, stock: 1.5 } },
  ])
    assert.equal(parseCompare({ ...input, ...patch }), null);
});
test("TXT and JSON imports preserve dialogue and reject malformed or excessive input", () => {
  assert.deepEqual(
    importConversation(
      "Покупатель: Есть товар?\nПродавец: Да\nПокупатель: А цена?",
      false,
    ),
    [
      { role: "buyer", text: "Есть товар?" },
      { role: "seller", text: "Да" },
      { role: "buyer", text: "А цена?" },
    ],
  );
  assert.equal(
    importConversation('[{"role":"buyer","text":"Здравствуйте"}]', true).length,
    1,
  );
  for (const [raw, json] of [
    ["oops", true],
    ["hello", false],
    ['[{"role":"system","text":"x"}]', true],
    ["[]", true],
  ] as const)
    assert.throws(() => importConversation(raw, json));
});
test("lab storage roundtrip preserves snapshots and rejects corrupt ratings", () => {
  const run = {
    id: "r1",
    createdAt: new Date().toISOString(),
    product: input.product,
    scenario: input.scenario,
    results: [demoSellerReply(input, demoModels[0])],
  };
  const data = { ...sellerSeed, runs: [run] };
  assert.deepEqual(parseSellerData(JSON.stringify(data)), data);
  assert.equal(parseSellerData("null"), null);
  assert.equal(
    parseSellerData(
      JSON.stringify({
        ...data,
        runs: [
          {
            ...run,
            results: [
              {
                ...run.results[0],
                review: { scores: { accuracy: 6 }, comment: "" },
              },
            ],
          },
        ],
      }),
    ),
    null,
  );
});
test("provider config is fail closed, exposes configured models without credentials, never guesses ids", () => {
  assert.equal(publicCatalog({}).models.length, 2);
  const env = {
    SELLER_AI_MODELS:
      '[{"provider":"deepseek","id":"fixture-model","label":"Fixture"}]',
    DEEPSEEK_API_KEY: "test-secret",
  };
  assert.equal(modelConfig(env).models[0].option.available, false);
  assert.equal(
    modelConfig({
      ...env,
      SELLER_AI_ENABLE_REAL: "true",
      SELLER_AI_ACCESS_TOKEN: "x".repeat(32),
    }).models[0].option.available,
    true,
  );
  assert.ok(!JSON.stringify(publicCatalog(env)).includes("test-secret"));
  assert.ok(modelConfig({ SELLER_AI_MODELS: "not-json" }).warning);
  assert.equal(
    modelConfig({
      SELLER_AI_MODELS: '[{"provider":"unknown","id":"x","label":"x"}]',
    }).models.length,
    0,
  );
});
test("Qwen endpoint rejects SSRF, credentials, redirects and arbitrary paths", () => {
  assert.equal(
    qwenEndpoint(
      "https://workspace.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
    ),
    "https://workspace.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions",
  );
  for (const u of [
    "http://localhost/compatible-mode/v1",
    "https://evil.test/compatible-mode/v1",
    "https://a.ap-southeast-1.maas.aliyuncs.com.evil.test/compatible-mode/v1",
    "https://key@a.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
    "https://a.ap-southeast-1.maas.aliyuncs.com/other",
  ])
    assert.equal(qwenEndpoint(u), null);
});
test("cost stays unknown without usage or verified tariff; formula keeps original currency", () => {
  const tariff = {
    inputPerMillion: 10,
    outputPerMillion: 20,
    currency: "RUB",
    source: "https://pricing.test",
  };
  assert.equal(calculateCost(null, 10, tariff), null);
  assert.equal(calculateCost(10, 20, undefined), null);
  assert.deepEqual(calculateCost(1000, 500, tariff), {
    amount: 0.02,
    currency: "RUB",
    source: "https://pricing.test",
  });
});
test("admin authorization is constant-time for matching lengths and rate limit has bounded windows", () => {
  const key = "k".repeat(32);
  assert.equal(authorized("Bearer " + key, key), true);
  assert.equal(authorized("Bearer " + key, "x".repeat(32)), false);
  assert.equal(authorized("Bearer short", "short"), false);
  const limit = new WindowLimit(2, 100);
  assert.equal(limit.take(2, 0), true);
  assert.equal(limit.take(1, 50), false);
  assert.equal(limit.take(1, 101), true);
});
test("bounded JSON reader refuses oversized request regardless of Content-Length", async () => {
  const request = new Request("http://localhost", {
    method: "POST",
    body: "x".repeat(100),
  });
  await assert.rejects(readJsonBounded(request, 10), /слишком большой/);
});
test("system prompt has product and only buyer/seller roles in context", () => {
  const messages = buildMessages(input);
  assert.equal(messages[0].role, "system");
  assert.ok(messages[0].content.includes(input.product.delivery));
  assert.equal(messages.at(-1)?.content, input.scenario.question);
});
test("real adapter normalizes actual usage and suppresses provider secrets in errors", async (t) => {
  const model = {
    option: {
      key: "deepseek:fixture",
      provider: "deepseek" as const,
      modelId: "fixture",
      label: "Fixture",
      demo: false,
      available: true,
    },
  };
  let captured = "";
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string | URL | Request, options?: RequestInit) => {
      captured = String(options?.body);
      return Response.json({
        choices: [{ message: { content: "Тестовый ответ" } }],
        usage: { prompt_tokens: 17, completion_tokens: 9 },
      });
    },
  );
  const r = await runReal(model, input, { DEEPSEEK_API_KEY: "secret" });
  assert.equal(r.inputTokens, 17);
  assert.equal(r.outputTokens, 9);
  assert.equal(r.cost, null);
  assert.ok(captured.includes("Городской велосипед"));
  t.mock.restoreAll();
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("SECRET PROVIDER ERROR", { status: 401 }),
  );
  const bad = await runReal(model, input, { DEEPSEEK_API_KEY: "secret" });
  assert.ok(bad.error);
  assert.ok(!JSON.stringify(bad).includes("SECRET"));
  assert.equal(bad.inputTokens, null);
});
test("compare API runs only demo models, rejects cross-origin, wrong mode and paid requests by default", async () => {
  const make = (body: unknown, origin?: string) =>
    new Request("http://localhost/api/seller/compare", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(origin ? { Origin: origin } : {}),
      },
      body: JSON.stringify(body),
    });
  const r = await POST(make(input));
  assert.equal(r.status, 200);
  const json = await r.json();
  assert.equal(json.results.length, 2);
  assert.ok(
    json.results.every((r: { model: { demo: boolean } }) => r.model.demo),
  );
  assert.equal((await POST(make(input, "https://evil.test"))).status, 403);
  assert.equal(
    (await POST(make({ ...input, modelKeys: ["deepseek:fixture"] }))).status,
    400,
  );
  const previous = process.env.SELLER_AI_ENABLE_REAL;
  delete process.env.SELLER_AI_ENABLE_REAL;
  try {
    assert.equal((await POST(make({ ...input, mode: "real" }))).status, 403);
  } finally {
    if (previous !== undefined) process.env.SELLER_AI_ENABLE_REAL = previous;
  }
});
test("empty or truncated provider output retains actual usage and reports incomplete answer", async (t) => {
  const model = {
    option: {
      key: "deepseek:fixture",
      provider: "deepseek" as const,
      modelId: "fixture",
      label: "Fixture",
      demo: false,
      available: true,
    },
  };
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      choices: [{ message: { content: null }, finish_reason: "length" }],
      usage: { prompt_tokens: 8, completion_tokens: 700 },
    }),
  );
  const r = await runReal(model, input, {});
  assert.equal(r.text, null);
  assert.equal(r.outputTokens, 700);
  assert.ok(r.error);
});
test("timeout errors remain explicit and do not invent usage or expenses", async (t) => {
  const model = {
    option: {
      key: "deepseek:fixture",
      provider: "deepseek" as const,
      modelId: "fixture",
      label: "Fixture",
      demo: false,
      available: true,
    },
  };
  t.mock.method(globalThis, "fetch", async () => {
    throw new DOMException("timeout", "TimeoutError");
  });
  const r = await runReal(model, input, {});
  assert.match(r.error!, /15 секунд/);
  assert.equal(r.cost, null);
  assert.equal(r.inputTokens, null);
});
test("origin check accepts browser Host when Next canonicalizes URL, rejects other sites", async () => {
  const { sameOrigin } = await import("../lib/seller/server/guards");
  assert.equal(
    sameOrigin(
      new Request("http://localhost:3000/api/seller/compare", {
        headers: { Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000" },
      }),
    ),
    true,
  );
  assert.equal(
    sameOrigin(
      new Request("http://localhost:3000/api/seller/compare", {
        headers: { Host: "127.0.0.1:3000", Origin: "https://evil.test" },
      }),
    ),
    false,
  );
});
