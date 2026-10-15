import { test, expect } from "@playwright/test";
test("seller lab demo comparison, manual review and history survive reload", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/seller");
  await expect(
    page.getByRole("heading", { name: "AI-продавец", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Товар из базы знаний").selectOption("kb-ski");
  await page.getByLabel("Сценарий", { exact: true }).selectOption("s3");
  await page.getByRole("button", { name: "Запустить демосравнение" }).click();
  await expect(page.locator(".seller-result-card")).toHaveCount(2);
  await expect(page.locator(".seller-result-card").first()).toContainText(
    "Не могу гарантировать",
  );
  await expect(page.locator(".seller-result-card").first()).toContainText(
    "Не применяется",
  );
  await expect(page.locator(".seller-result-card").first()).toContainText(
    "ДЕМО",
  );
  const first = page.locator(".seller-result-card").first();
  await first.getByText("Оценить ответ вручную", { exact: true }).click();
  await first
    .getByLabel("Точность информации — Демо · краткий ответ")
    .selectOption("4");
  await first
    .getByLabel("Комментарий — Демо · краткий ответ")
    .fill("Осторожный ответ, без выдуманных обещаний");
  await page.screenshot({
    path: `work/${info.project.name}-seller.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.reload();
  await page.getByRole("tab", { name: "История тестов" }).click();
  await expect(page.locator(".seller-run")).toHaveCount(1);
  await expect(page.locator(".seller-run")).toContainText("4.0 / 5");
  await page.locator(".seller-run").click();
  await page
    .locator(".seller-result-card")
    .first()
    .getByText("Оценить ответ вручную", { exact: true })
    .click();
  await expect(
    page.getByLabel("Комментарий — Демо · краткий ответ"),
  ).toHaveValue("Осторожный ответ, без выдуманных обещаний");
  expect(errors).toEqual([]);
});
test("knowledge CRUD preserves old catalog and historical product snapshots", async ({
  page,
}) => {
  await page.goto("/seller");
  await page.getByRole("button", { name: "Запустить демосравнение" }).click();
  await expect(page.locator(".seller-result-card")).toHaveCount(2);
  await page.getByRole("tab", { name: "База знаний" }).click();
  const bike = page
    .locator(".seller-knowledge-card")
    .filter({
      has: page.getByRole("heading", { name: "Городской велосипед" }),
    });
  await bike.getByRole("button", { name: "Редактировать знания" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Цена, ₽").fill("100");
  await dialog.getByLabel("Инструкции продавца").fill("Не обещать доставку.");
  await dialog.getByRole("button", { name: "Сохранить знания" }).click();
  await expect(bike).toContainText("100");
  await page.getByRole("tab", { name: "История тестов" }).click();
  await page.locator(".seller-run").click();
  await page.getByText("Контекст и факты этого теста", { exact: true }).click();
  await expect(page.locator(".seller-details pre")).toContainText("24000");
  await page.getByRole("tab", { name: "База знаний" }).click();
  await page.getByRole("button", { name: "Добавить в базу" }).click();
  await dialog.getByLabel("Название товара").fill("Тестовый шлем");
  await dialog.getByLabel("Описание", { exact: true }).fill("Демо-шлем");
  await dialog.getByLabel("Характеристики", { exact: true }).fill("Размер M");
  await dialog.getByRole("button", { name: "Сохранить знания" }).click();
  const helmet = page
    .locator(".seller-knowledge-card")
    .filter({ has: page.getByRole("heading", { name: "Тестовый шлем" }) });
  await expect(helmet).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "База знаний" }).click();
  await expect(helmet).toBeVisible();
  await helmet.getByRole("button", { name: "Удалить", exact: true }).click();
  await dialog.getByRole("button", { name: "Удалить карточку" }).click();
  await expect(helmet).toHaveCount(0);
  await page.goto("/products");
  await expect(page.locator("article")).toHaveCount(4);
});
test("imported conversations and custom scenarios persist and real mode stays honest", async ({
  page,
}) => {
  await page.goto("/seller");
  await page
    .getByText("Контекст и загрузка переписки", { exact: true })
    .click();
  await page.getByLabel("Загрузить переписку").setInputFiles({
    name: "dialogue.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify([
        { role: "buyer", text: "Здравствуйте, велосипед ещё продаётся?" },
        { role: "seller", text: "Здравствуйте, да." },
        { role: "buyer", text: "Почему у вас дороже, чем у других?" },
      ]),
    ),
  });
  await expect(page.getByLabel("Сообщение покупателя")).toHaveValue(
    "Почему у вас дороже, чем у других?",
  );
  await expect(page.getByText("2 сообщений контекста")).toBeVisible();
  await page
    .getByRole("button", { name: "Сохранить сценарий", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Название сценария")
    .fill("Разговор о цене");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Сохранить сценарий" })
    .click();
  await page.reload();
  await page
    .getByLabel("Сценарий", { exact: true })
    .selectOption({ label: "Разговор о цене" });
  await page.getByRole("button", { name: "Запустить демосравнение" }).click();
  await expect(page.locator(".seller-result-card").first()).toContainText(
    "нет подтверждённых данных",
  );
  await page
    .getByRole("button", { name: "Реальные модели", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Отправить запросы моделям" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Реальные модели пока не подключены.", { exact: false }),
  ).toBeVisible();
  const response = await page.request.post("/api/seller/compare", {
    data: {
      mode: "real",
      modelKeys: ["demo:short"],
      product: {},
      scenario: {},
    },
  });
  expect(response.status()).toBe(400);
});
test("lab handles API failure and malformed saved data without affecting existing app", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("seller-ai:lab:v1", '{"version":999}'),
  );
  await page.goto("/seller");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Данные AI-продавца повреждены" }),
  ).toBeVisible();
  await page.route("**/api/seller/compare", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({ error: "Тест: лимит запросов" }),
    }),
  );
  await page.getByRole("button", { name: "Запустить демосравнение" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Тест: лимит запросов" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Запустить демосравнение" }),
  ).toBeEnabled();
  await page.goto("/messages");
  await expect(
    page.getByRole("heading", { name: "Сообщения", exact: true }),
  ).toBeVisible();
});
