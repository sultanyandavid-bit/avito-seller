export type ListingStyle =
  "brief" | "detailed" | "professional" | "premium" | "benefits";
export type Listing = {
  id: string;
  storeId: string;
  productId: string;
  category: string;
  sourceDescription: string;
  title: string;
  description: string;
  advantages: string;
  specifications: string;
  condition: string;
  price: number | null;
  terms: string;
  instructions: string;
  style: ListingStyle;
  alternative: string;
  assetIds: string[];
  createdAt: string;
  updatedAt: string;
};
export type ListingsData = { version: 1; storeId: string; listings: Listing[] };
export const listingStyles: Record<ListingStyle, string> = {
  brief: "Краткое",
  detailed: "Подробное",
  professional: "Профессиональное",
  premium: "Премиальное",
  benefits: "На преимуществах",
};
export function emptyListings(storeId: string): ListingsData {
  return { version: 1, storeId, listings: [] };
}
export function parseListings(
  raw: string,
  storeId: string,
): ListingsData | null {
  try {
    const x = JSON.parse(raw);
    if (
      x?.version !== 1 ||
      x.storeId !== storeId ||
      !Array.isArray(x.listings) ||
      x.listings.length > 200 ||
      !x.listings.every(
        (l: Listing) =>
          l &&
          l.storeId === storeId &&
          typeof l.id === "string" &&
          typeof l.productId === "string" &&
          [
            "category",
            "sourceDescription",
            "title",
            "description",
            "advantages",
            "specifications",
            "condition",
            "terms",
            "instructions",
            "alternative",
          ].every(
            (k) =>
              typeof l[k as keyof Listing] === "string" &&
              String(l[k as keyof Listing]).length <= 10000,
          ) &&
          (l.price === null ||
            (typeof l.price === "number" &&
              Number.isFinite(l.price) &&
              l.price >= 0)) &&
          Object.hasOwn(listingStyles, l.style) &&
          Array.isArray(l.assetIds) &&
          l.assetIds.length <= 10 &&
          l.assetIds.every((id) => typeof id === "string") &&
          Number.isFinite(Date.parse(l.createdAt)) &&
          Number.isFinite(Date.parse(l.updatedAt)),
      )
    )
      return null;
    return x;
  } catch {
    return null;
  }
}
export function buildListing(input: {
  name: string;
  category: string;
  description: string;
  specifications: string;
  condition: string;
  price: number | null;
  terms: string;
  instructions: string;
  style: ListingStyle;
}) {
  if (
    !input.category.trim() ||
    !input.name.trim() ||
    !input.description.trim() ||
    !input.specifications.trim() ||
    !input.condition.trim() ||
    !input.terms.trim() ||
    typeof input.price !== "number" ||
    !Number.isFinite(input.price) ||
    input.price < 0
  )
    throw new Error(
      "Укажите категорию, название, описание, подтверждённые характеристики, состояние, цену и условия продажи.",
    );
  const info = [
    input.description.trim(),
    `Состояние: ${input.condition.trim()}`,
    `Характеристики:\n${input.specifications.trim()}`,
    `Цена: ${input.price.toLocaleString("ru-RU")} ₽`,
    input.terms.trim(),
  ];
  return {
    title: input.name.trim(),
    description: (input.style === "brief"
      ? [info[0], info[1], info[3], info[4]]
      : input.style === "benefits"
        ? [info[2], info[0], info[1], info[3], info[4]]
        : input.style === "premium"
          ? [
              input.name.trim(),
              info[0],
              info[2],
              info[1],
              "Условия приобретения",
              info[3],
              info[4],
            ]
          : input.style === "professional"
            ? [
                "Информация о товаре",
                info[0],
                info[1],
                info[2],
                info[3],
                info[4],
              ]
            : info
    ).join("\n\n"),
    alternative: [input.name.trim(), ...info].join("\n"),
    advantages: input.specifications.trim(),
  };
}
