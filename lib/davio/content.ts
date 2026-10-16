import { emptyProject, type ProjectData, type ChatMode } from "./types";
export class DavioError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function projectData(raw: unknown): ProjectData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new DavioError(400, "Проверьте данные проекта.");
  const obj = raw as Record<string, unknown>,
    out = { ...emptyProject };
  for (const key of Object.keys(emptyProject) as (keyof ProjectData)[]) {
    if (key === "price") {
      const p = obj[key];
      if (
        p !== null &&
        (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 1e9)
      )
        throw new DavioError(400, "Некорректная цена.");
      out.price = p;
    } else if (key === "style") {
      if (!["brief", "standard", "detailed"].includes(String(obj[key])))
        throw new DavioError(400, "Неизвестный стиль.");
      out.style = obj[key] as ProjectData["style"];
    } else {
      const v = obj[key];
      if (typeof v !== "string" || v.length > (key === "title" ? 120 : 10000))
        throw new DavioError(400, "Проверьте длину полей проекта.");
      out[key] = v;
    }
  }
  return out;
}
export function composeDescription(p: ProjectData, action = "generate") {
  if (!p.title.trim()) throw new DavioError(400, "Укажите название товара.");
  const details = [
    p.brand && `Бренд: ${p.brand}`,
    p.model && `Модель: ${p.model}`,
    p.condition && `Состояние: ${p.condition}`,
    p.facts,
    p.equipment && `Комплектация: ${p.equipment}`,
    p.defects && `Особенности и дефекты: ${p.defects}`,
  ].filter(Boolean);
  const short = action === "shorten" || p.style === "brief";
  const price =
    p.price !== null ? `Цена: ${p.price.toLocaleString("ru-RU")} ₽` : "";
  const normal = [p.title, ...details, price, p.extra].filter(Boolean);
  const concise = [
    p.title,
    p.condition && `Состояние: ${p.condition}`,
    p.facts,
    p.defects && `Дефекты: ${p.defects}`,
    price,
  ].filter(Boolean);
  const detailed = [
    p.title,
    "О товаре",
    ...details,
    price && `Условия продажи\n${price}`,
    p.extra,
  ].filter(Boolean);
  const rewrite = [p.title, price, ...details, p.extra].filter(Boolean);
  const description = (
    short
      ? concise
      : action === "rewrite"
        ? rewrite
        : p.style === "detailed" || action === "improve"
          ? detailed
          : normal
  ).join(short ? "\n" : "\n\n");
  const missing = [
    !p.condition && "состояние",
    !p.facts && "характеристики",
    !p.equipment && "комплектацию",
    !p.defects && "наличие дефектов",
    p.price === null && "цену",
  ].filter(Boolean);
  return {
    description,
    advantages: p.facts,
    recommendations: missing.length
      ? `Перед публикацией уточните: ${missing.join(", ")}.`
      : "Проверьте текст и соответствие фотографий товару. Условия модерации уточняйте на площадке.",
    mode: "template" as const,
  };
}
export function assistantAnswer(
  mode: ChatMode,
  question: string,
  p?: ProjectData,
) {
  if (mode === "learn")
    return "План подготовки объявления: 1. Снимите товар при ровном свете с нескольких сторон. 2. Укажите точную модель, состояние, комплектацию и дефекты. 3. Подтвердите цену и условия доставки. 4. Соберите текст в редакторе DAVIO и проверьте результат. 5. Скачайте материалы и опубликуйте вручную. Это локальная памятка, а не ответ языковой модели.";
  if (mode === "assistant")
    return p
      ? `Для «${p.title || "товара"}» откройте редактор: дополните подтверждённые характеристики, проверьте дефекты, выберите основную фотографию. Кнопка «Создать описание» соберёт текст из ваших данных. Фото и видео сохранятся независимо от текста.`
      : "Выберите проект, чтобы подготовить материалы. В разделе «Объявления» загрузите фото, добавьте название и факты. Базовая коррекция и монтаж работают без AI API.";
  if (!p)
    return "Выберите проект товара. Без подтверждённых данных я не могу обещать наличие, скидки, комплектацию или доставку.";
  const q = question.toLocaleLowerCase("ru");
  if (/скид|торг|достав|налич|продаётся|продается|отправ/.test(q))
    return "Здравствуйте! Уточню у продавца актуальное наличие и условия продажи. Скидку или доставку без подтверждения обещать не могу.";
  if (/комплект/.test(q))
    return p.equipment
      ? `Здравствуйте! Указанная продавцом комплектация: ${p.equipment}`
      : "Здравствуйте! Комплектация пока не подтверждена. Уточню её у продавца.";
  if (/цен|дорог|стоит/.test(q))
    return p.price !== null
      ? `Здравствуйте! Цена «${p.title}» — ${p.price.toLocaleString("ru-RU")} ₽. Если подскажете, что для вас важно, продавец уточнит детали.`
      : "Здравствуйте! Уточню актуальную цену у продавца.";
  return `Здравствуйте! ${p.title}. ${p.facts || "Подробные характеристики пока не подтверждены."} ${p.condition ? `Состояние: ${p.condition}.` : ""} Уточните, какой параметр вас интересует — неизвестные детали проверим у продавца.`;
}
