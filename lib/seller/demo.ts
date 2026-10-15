import type { CompareInput, ModelOption, Result } from "./types";
export function demoSellerReply(
  input: CompareInput,
  model: ModelOption,
): Result {
  const start = performance.now(),
    p = input.product;
  const question = [
    ...input.scenario.context
      .filter((t) => t.role === "buyer")
      .map((t) => t.text),
    input.scenario.question,
  ].join(" ");
  const facts: string[] = [];
  let handoff = false;
  if (/налич|прода[её]|продаже|ещ[её].*есть/i.test(question))
    facts.push(
      p.stock > 0
        ? `«${p.name}» в наличии: ${p.stock} шт.`
        : "Сейчас товара нет в наличии. Срок поступления нужно уточнить у продавца.",
    );
  if (/температур|[−-]\s*20|мороз|тепл/i.test(question)) {
    facts.push(
      "Температурную пригодность нужно подтвердить у продавца. Не могу гарантировать, что товар подойдёт для −20 °C. Указанные характеристики: " +
        (p.specifications || "не указаны."),
    );
    handoff = true;
  }
  if (/скид|торг|дешевле/i.test(question)) {
    facts.push(
      p.discounts || "Условия скидки не указаны. Их нужно уточнить у продавца.",
    );
    handoff = true;
  }
  if (/достав|отправ|самовывоз/i.test(question)) {
    facts.push(
      p.delivery ||
        "Условия доставки не указаны. Их нужно уточнить у продавца.",
    );
    handoff = true;
  }
  if (/дороже|других|конкурент/i.test(question)) {
    facts.push(
      `Цена — ${p.price.toLocaleString("ru-RU")} ₽. У меня нет подтверждённых данных о предложениях других продавцов, поэтому сравнить их не могу.`,
    );
    handoff = true;
  } else if (/цен|стоит|стоим/i.test(question))
    facts.push(`Цена — ${p.price.toLocaleString("ru-RU")} ₽.`);
  if (/характер|размер|рост|материал|комплект|состояни/i.test(question)) {
    facts.push(
      p.description,
      p.specifications || "Дополнительные характеристики не подтверждены.",
    );
    handoff = true;
  }
  if (!facts.length) {
    facts.push(
      "В базе нет подтверждённого ответа на этот вопрос. Передам его продавцу.",
    );
    handoff = true;
  }
  if (p.instructions.trim()) {
    facts.push(`Правила продавца: ${p.instructions}`);
    handoff = true;
  }
  if (p.stock === 0 && !facts.some((f) => f.includes("нет в наличии"))) {
    facts.unshift("Сейчас товара нет в наличии.");
    handoff = true;
  }
  // These are two formatting variants of one local algorithm, never real model outputs.
  const detailed = model.key === "demo:consult";
  const text =
    (detailed ? "Здравствуйте! " : "") +
    facts.join(" ") +
    (detailed && handoff ? " Уточним детали у продавца перед покупкой." : "");
  return {
    id: crypto.randomUUID(),
    model,
    text,
    error: null,
    handoff,
    inputTokens: null,
    outputTokens: null,
    cost: null,
    durationMs: Math.round(performance.now() - start),
    review: { scores: {}, comment: "" },
  };
}
