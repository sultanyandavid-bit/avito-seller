import { test } from "node:test";
import assert from "node:assert/strict";
import { demoReply } from "../lib/assistant";
import { initialStore } from "../lib/demo";
import { parseStore } from "../lib/storage";
const product = initialStore.products[0],
  ai = initialStore.ai;
test("price and stock come from current product, including edited values", () => {
  const p = { ...product, price: 12345, stock: 7 };
  assert.match(demoReply("Какая цена?", p, ai).text, /12\s345/);
  assert.match(demoReply("Есть в наличии?", p, ai).text, /7 шт/);
});
test("discounts, delivery, payments and unknown facts require human", () => {
  for (const q of [
    "Будет скидка?",
    "Какая доставка?",
    "Как оплатить?",
    "Есть гарантия?",
    "Хочу вернуть товар",
  ])
    assert.equal(demoReply(q, product, ai).handoff, true);
});
test("out of stock and deleted products never promise availability", () => {
  assert.equal(demoReply("Есть в наличии?", undefined, ai).handoff, true);
  const r = demoReply("Есть в наличии?", { ...product, stock: 0 }, ai);
  assert.equal(r.handoff, true);
  assert.match(r.text, /нет в наличии/);
});
test("characteristics use exact catalog description", () => {
  assert.ok(
    demoReply("Что в комплекте?", product, ai).text.includes(
      product.description,
    ),
  );
});
test("styles change greeting", () => {
  assert.match(
    demoReply("Цена?", product, { ...ai, style: "business" }).text,
    /^Добрый день/,
  );
  assert.match(
    demoReply("Цена?", product, { ...ai, style: "brief" }).text,
    /^Цена/,
  );
});
test("storage accepts valid roundtrip without mutating demo seed", () => {
  const x = parseStore(JSON.stringify(initialStore));
  assert.deepEqual(x, initialStore);
  x!.products[0].price = 1;
  assert.notEqual(initialStore.products[0].price, 1);
});
test("storage rejects corrupt or incompatible data", () => {
  for (const raw of [
    "garbage",
    "null",
    "{}",
    JSON.stringify({ ...initialStore, version: 2 }),
    JSON.stringify({ ...initialStore, products: [{ ...product, price: -1 }] }),
    JSON.stringify({ ...initialStore, conversations: [{ messages: [] }] }),
    JSON.stringify({ ...initialStore, ai: { ...ai, enabled: "yes" } }),
  ])
    assert.equal(parseStore(raw), null);
});
