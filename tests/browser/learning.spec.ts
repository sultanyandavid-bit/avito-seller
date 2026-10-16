import { test, expect } from "@playwright/test";
test("assistant feedback, correction, approval, retrieval and deletion persist", async ({
  page,
}) => {
  await page.goto("/assistant");
  await page
    .getByLabel("Вопрос покупателя")
    .fill("Какое состояние аккумулятора?");
  await page.getByRole("button", { name: "Предпросмотр ответа" }).click();
  await expect(page.locator(".assistant-exchange")).toHaveCount(1);
  await page.getByRole("button", { name: "Исправить и обучить" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Исправленный или собственный ответ")
    .fill("Здравствуйте! Уточню состояние аккумулятора у продавца.");
  await dialog
    .getByLabel("Пояснение для AI")
    .fill("Не обещать неподтверждённые характеристики.");
  await dialog.getByRole("button", { name: "Сохранить пример" }).click();
  await page.goto("/learning");
  await expect(page.locator(".learning-example")).toHaveCount(1);
  await expect(page.locator(".learning-example")).toContainText(
    "Уточню состояние",
  );
  await page.reload();
  await expect(page.locator(".learning-example")).toHaveCount(1);
  await page.getByRole("button", { name: "Изменить пример" }).click();
  await dialog.getByLabel("Статус примера").selectOption("edited");
  await dialog.getByRole("button", { name: "Сохранить пример" }).click();
  await expect(page.locator(".learning-example")).toContainText(
    "Исправлен · ждёт одобрения",
  );
  await page
    .getByLabel("Вопрос для поиска")
    .fill("Какое состояние аккумулятора?");
  await expect(
    page.getByText("Одобренных примеров по этому товару и вопросу пока нет."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Изменить пример" }).click();
  await dialog.getByLabel("Статус примера").selectOption("approved");
  await dialog.getByRole("button", { name: "Сохранить пример" }).click();
  await expect(page.locator(".approved-reference")).toHaveCount(1);
  await page.getByText("История изменений · 2", { exact: true }).click();
  await expect(page.locator(".example-revision")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Удалить пример", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Удалить пример", exact: true })
    .click();
  await expect(page.locator(".learning-example")).toHaveCount(0);
});
test("local stores isolate products, conversations, learning and seller knowledge without losing legacy data", async ({
  page,
}, info) => {
  await page.goto("/seller");
  await page.getByRole("button", { name: "Запустить демосравнение" }).click();
  await expect(page.locator(".seller-result-card")).toHaveCount(2);
  await page
    .locator(".seller-result-card")
    .first()
    .getByRole("button", { name: "Одобрить ответ", exact: true })
    .click();
  await page.goto("/legacy/settings");
  await page.getByLabel("Название нового магазина").fill("Второй магазин");
  await page
    .getByRole("button", { name: "Добавить магазин", exact: true })
    .click();
  await expect(
    page.getByLabel("Название магазина", { exact: true }),
  ).toHaveValue("Второй магазин");
  await page.goto("/products");
  await expect(page.locator("article")).toHaveCount(0);
  await page.goto("/legacy/messages");
  await expect(
    page.getByText("Выберите диалог", { exact: true }),
  ).toBeVisible();
  await page.goto("/learning");
  await expect(page.locator(".learning-example")).toHaveCount(0);
  await page.goto("/seller");
  await page.getByRole("tab", { name: "База знаний" }).click();
  await expect(page.locator(".seller-knowledge-card")).toHaveCount(0);
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Открыть меню" }).click();
  await page
    .getByLabel("Выбор магазина", { exact: true })
    .selectOption("local-main");
  await expect(
    page.getByRole("heading", { name: "AI-продавец", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "База знаний" }).click();
  await expect(page.locator(".seller-knowledge-card")).toHaveCount(2);
  await page.goto("/products");
  await expect(page.locator("article")).toHaveCount(4);
  await page.goto("/learning");
  await expect(page.locator(".learning-example")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".learning-example")).toHaveCount(1);
});
test("own answer can be saved and rejected examples are excluded from search", async ({
  page,
}) => {
  await page.goto("/learning");
  await page.getByRole("button", { name: "Свой пример" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Вопрос покупателя").fill("А скидка будет?");
  await dialog
    .getByLabel("Исправленный или собственный ответ")
    .fill("Условия скидки подтвердит продавец.");
  await dialog.getByLabel("Статус примера").selectOption("rejected");
  await dialog.getByRole("button", { name: "Сохранить пример" }).click();
  await page.getByLabel("Вопрос для поиска").fill("А скидка будет?");
  await expect(page.locator(".approved-reference")).toHaveCount(0);
  await expect(page.locator(".learning-example")).toContainText("Неудачный");
  await page.getByRole("button", { name: "Изменить пример" }).click();
  await dialog.getByLabel("Статус примера").selectOption("approved");
  await dialog.getByRole("button", { name: "Сохранить пример" }).click();
  await expect(page.locator(".approved-reference")).toHaveCount(1);
});
test("invalid existing data is preserved, not overwritten by fallback views", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("ai-avito-seller:v1", "invalid-base");
    localStorage.setItem("seller-ai:lab:v1", "invalid-lab");
    localStorage.setItem("sellerai:learning:v1:local-main", "invalid-training");
  });
  await page.goto("/seller");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Данные AI-продавца повреждены" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "База знаний" }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("seller-ai:lab:v1")),
  ).toBe("invalid-lab");
  await page.goto("/learning");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Сохранённые данные повреждены" })
      .first(),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("sellerai:learning:v1:local-main"),
    ),
  ).toBe("invalid-training");
  expect(
    await page.evaluate(() => localStorage.getItem("ai-avito-seller:v1")),
  ).toBe("invalid-base");
});

test("future automation settings never enable sending and analytics uses local observations", async ({
  page,
}) => {
  await page.goto("/seller");
  await page.getByLabel("Режим работы AI").selectOption("seller");
  await page.getByText("Правила будущих автоответов", { exact: true }).click();
  await expect(
    page.getByRole("switch", { name: "Автоматическая отправка", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("switch", { name: "Автоматическая отправка", exact: true }),
  ).toHaveAttribute("aria-checked", "false");
  await page.getByLabel("Цена", { exact: true }).check();
  await page.reload();
  await expect(page.getByLabel("Режим работы AI")).toHaveValue("seller");
  await page.getByText("Правила будущих автоответов", { exact: true }).click();
  await expect(page.getByLabel("Цена", { exact: true })).toBeChecked();
  await page.goto("/analytics");
  await expect(
    page.getByRole("heading", {
      name: "Конверсия и эффективность продаж пока неизвестны",
    }),
  ).toBeVisible();
  await expect(page.getByText("Нет данных", { exact: true })).toBeVisible();
});
