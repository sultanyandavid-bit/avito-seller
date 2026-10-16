import type { AISettings, Product } from "./types";
export type Reply = { text: string; handoff: boolean };
// Future OpenAI adapter must live on the server and implement this contract.
export interface AssistantProvider {
  preview(
    question: string,
    product: Product | undefined,
    settings: AISettings,
  ): Promise<Reply>;
}
export function demoReply(
  question: string,
  product: Product | undefined,
  settings: AISettings,
): Reply {
  const greeting =
    settings.style === "business" || settings.style === "expert"
      ? "Добрый день. "
      : settings.style === "brief"
        ? ""
        : "Здравствуйте! ";
  if (!product)
    return {
      text:
        greeting + "Товар удалён из каталога. Уточню информацию у продавца.",
      handoff: true,
    };
  if (
    /скид|торг|жалоб|возврат|верну|гарант|достав|когда|встреч|посмотр|оплат/i.test(
      question,
    )
  )
    return {
      text:
        greeting + "Передам вопрос продавцу: условия нужно подтвердить лично.",
      handoff: true,
    };
  if (product.stock === 0)
    return {
      text:
        greeting +
        "Сейчас товара нет в наличии. Срок поступления уточнит продавец.",
      handoff: true,
    };
  if (/цен|стоит|стоим/i.test(question))
    return {
      text:
        greeting +
        `Цена «${product.name}» — ${new Intl.NumberFormat("ru-RU").format(product.price)} ₽.`,
      handoff: false,
    };
  if (/налич|продаже|товар есть|^есть[?!. ]*$/i.test(question))
    return {
      text: greeting + `«${product.name}» в наличии: ${product.stock} шт.`,
      handoff: false,
    };
  if (/комплект|характер|состояни|аккумулятор|памят/i.test(question))
    return {
      text:
        greeting +
        product.description +
        (settings.style === "consultative"
          ? " Что для вас важнее при выборе?"
          : ""),
      handoff: false,
    };
  return {
    text: greeting + "Уточню этот вопрос у продавца, чтобы дать точный ответ.",
    handoff: true,
  };
}
export const demoAssistant: AssistantProvider = {
  async preview(question, product, settings) {
    return demoReply(question, product, settings);
  },
};
