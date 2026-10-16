import { test, expect } from "@playwright/test";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5L8AAAAASUVORK5CYII=",
  "base64",
);
test("listing templates, manual editing and saved drafts work", async ({
  page,
}) => {
  await page.goto("/listings");
  await page.getByRole("button", { name: "Новое объявление" }).click();
  await page.getByLabel("Товар для объявления").selectOption("p1");
  await page.getByLabel("Подтверждённые характеристики").fill("Память 256 ГБ");
  await page.getByLabel("Состояние товара").fill("Хорошее");
  await page
    .getByLabel("Условия продажи и доставки")
    .fill("Самовывоз после согласования");
  await page
    .getByRole("button", { name: "Составить текст по шаблону" })
    .click();
  await expect(page.getByLabel("Готовое описание")).toHaveValue(/256/);
  await page
    .getByLabel("Готовое описание")
    .fill("Проверенный вручную текст. Самовывоз после согласования.");
  await page.getByRole("button", { name: "Сохранить объявление" }).click();
  await page.reload();
  await expect(page.locator(".listing-saved-grid")).toContainText(
    "Проверенный вручную текст",
  );
  await page.getByRole("button", { name: "Редактировать объявление" }).click();
  await expect(page.getByLabel("Готовое описание")).toHaveValue(
    "Проверенный вручную текст. Самовывоз после согласования.",
  );
});
test("photo studio validates uploads and produces actual persistent PNG outputs", async ({
  page,
}) => {
  await page.goto("/photo");
  await page.getByLabel("Режим студии").selectOption("local");
  await page.getByLabel("Название товара").fill("Тестовое фото");
  await page
    .getByLabel("Исходники студии")
    .setInputFiles({
      name: "fake.png",
      mimeType: "image/png",
      buffer: Buffer.from("<html>not image</html>"),
    });
  await expect(
    page.getByRole("status").filter({ hasText: "Формат файла не подтверждён" }),
  ).toBeVisible();
  await page
    .getByLabel("Исходники студии")
    .setInputFiles({ name: "source.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".asset-grid img").first()).toBeVisible();
  await page.getByLabel("Количество вариантов").selectOption("2");
  await page.getByRole("button", { name: "Запустить локально" }).click();
  await expect(page.locator(".media-job")).toContainText("Готово");
  await expect(page.getByRole("link", { name: "Скачать PNG" })).toHaveCount(2);
  await expect(page.locator('.media-active img').last()).toHaveJSProperty('naturalWidth',1200);
  await expect(page.locator('.media-active img').last()).toHaveJSProperty('naturalHeight',1200);
  await page.reload();
  await page.locator(".media-job").click();
  await expect(page.getByRole("link", { name: "Скачать PNG" })).toHaveCount(2);
});
test("generation requests remain waiting without fabricated progress or output", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:3000") &&
      !r.url().startsWith("blob:") &&
      !r.url().startsWith("data:")
    )
      requests.push(r.url());
  });
  await page.goto("/photo");
  await page.getByLabel("Название товара").fill("Велосипед");
  await page
    .getByLabel("Описание и задача")
    .fill("Предметная съёмка на нейтральном фоне");
  await page.getByLabel("Количество вариантов").selectOption("10");
  await page.getByRole("button", { name: "Сохранить задание" }).click();
  await expect(page.locator(".media-job")).toContainText("Ожидает провайдера");
  await expect(page.locator(".media-active progress")).toHaveCount(0);
  await expect(page.locator(".media-active img")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".media-job")).toContainText("Ожидает провайдера");
  expect(requests).toEqual([]);
});
test("video studio records a playable local slideshow without an AI provider", async ({
  page,
}) => {
  await page.goto("/video");
  await page.getByLabel("Режим студии").selectOption("local");
  await page.getByLabel("Название товара").fill("Наш товар");
  await page.getByLabel("Длительность, секунд").fill("3");
  await page
    .getByLabel("Исходники студии")
    .setInputFiles({ name: "source.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Запустить локально" }).click();
  await expect(page.locator(".media-job")).toContainText("Готово", {
    timeout: 20000,
  });
  await expect(page.locator(".media-active video")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Скачать (WEBM|MP4)/ }),
  ).toBeVisible();
  await page.reload();
  await page.locator(".media-job").click();
  await expect(page.locator(".media-active video")).toBeVisible();
});
