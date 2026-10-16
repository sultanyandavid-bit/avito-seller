import { test, expect } from "@playwright/test";
test("all sections render without horizontal overflow or runtime errors", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [url, title] of [
    ["/legacy/dashboard", "Хороший день для продаж"],
    ["/products", "Товары"],
    ["/legacy/messages", "Сообщения"],
    ["/assistant", "AI-ассистент"],
    ["/seller", "AI-продавец"],
    ["/legacy/settings", "Настройки"],
  ]) {
    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.goto("/legacy/dashboard");
  await expect(
    page.getByRole("heading", { name: "Хороший день для продаж" }),
  ).toBeVisible();
  await page.screenshot({
    path: `work/${info.project.name}-dashboard.png`,
    fullPage: true,
  });
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Открыть меню" }).click();
    await page.getByRole("navigation").getByRole("link", {name:"Объявления"}).click();
    await expect(page.getByRole("heading",{name:"Начнём с вашего пространства"})).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test("product creation, editing, persistence, deletion and orphan conversation", async ({
  page,
}) => {
  await page.goto("/products");
  await page.getByRole("button", { name: "Добавить товар" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Название", { exact: true }).fill("Тестовый монитор");
  await dialog.getByLabel("Описание").fill("Монитор 27 дюймов");
  await dialog.getByLabel("Цена, ₽").fill("10000");
  await dialog.getByLabel("Категория").fill("Мониторы");
  await dialog.getByRole("button", { name: "Сохранить товар" }).click();
  await expect(
    page.getByRole("heading", { name: "Тестовый монитор" }),
  ).toBeVisible();
  await page.reload();
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Тестовый монитор" }) });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Редактировать" }).click();
  await dialog.getByLabel("Цена, ₽").fill("12000");
  await dialog.getByRole("button", { name: "Сохранить товар" }).click();
  await expect(card).toContainText("12 000");
  await card.getByRole("button", { name: "Удалить Тестовый монитор" }).click();
  await dialog
    .getByRole("button", { name: "Удалить товар", exact: true })
    .click();
  await expect(card).toHaveCount(0);
  await page
    .getByRole("button", { name: "Удалить iPhone 15 Pro, 256 ГБ" })
    .click();
  await dialog
    .getByRole("button", { name: "Удалить товар", exact: true })
    .click();
  await page.goto("/legacy/messages");
  await expect(
    page.getByText("Товар удалён из каталога. Переписка сохранена."),
  ).toBeVisible();
});
test("assistant preview, manual messages, human handoff and saved settings", async ({
  page,
}) => {
  await page.goto("/assistant");
  await page.getByRole("switch").click();
  await page.getByLabel("Вопрос покупателя").fill("Будет скидка?");
  await page.getByRole("button", { name: "Предпросмотр ответа" }).click();
  await expect(page.locator(".ai-response")).toContainText("ПЕРЕДАЧА ПРОДАВЦУ");
  await page.goto("/legacy/messages");
  await page.getByRole("button", { name: "Предложить ответ" }).click();
  await expect(page.locator(".reply-preview")).toBeVisible();
  await page.getByRole("button", { name: "Вставить в поле ответа" }).click();
  await expect(page.getByLabel("Текст ответа")).not.toBeEmpty();
  await page.getByRole("button", { name: "Отправить демоответ" }).click();
  await expect(page.locator(".bubble.seller")).toHaveCount(2);
  await page.getByRole("button", { name: "Передать человеку" }).click();
  await expect(
    page.getByRole("button", { name: "Предложить ответ" }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.locator(".bubble.seller")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Снять передачу" }),
  ).toBeVisible();
  await page.goto("/legacy/settings");
  await page.getByLabel("Название магазина").fill("Мой магазин");
  await page.getByRole("button", { name: "Сохранить настройки" }).click();
  await page.reload();
  await expect(page.getByLabel("Название магазина")).toHaveValue("Мой магазин");
  await expect(page.getByText("Не подключено", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Восстановить демоданные" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Восстановить", exact: true })
    .click();
  await expect(page.getByLabel("Название магазина")).toHaveValue("Техно Стор");
});

test("corrupt storage falls back safely and no external integration is called", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:3000") &&
      !r.url().startsWith("data:")
    )
      external.push(r.url());
  });
  await page.addInitScript(() =>
    localStorage.setItem("ai-avito-seller:v1", '{"version":1,"products":null}'),
  );
  await page.goto("/legacy/settings");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Сохранённые данные повреждены" }),
  ).toContainText("Сохранённые данные повреждены");
  await expect(page.getByLabel("Название магазина")).toHaveValue("Техно Стор");
  await expect(page.getByText("Не подключено", { exact: true })).toBeVisible();
  expect(external).toEqual([]);
});
