import { test, expect } from "@playwright/test";
const widths = [320, 375, 390, 430, 768, 1024, 1440];
test("shared selects and all existing pages fit required widths", async ({
  page,
}) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 950 });
    for (const url of [
      "/",
      "/products",
      "/messages",
      "/assistant",
      "/seller",
      "/settings",
    ]) {
      await page.goto(url);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator(".loading")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${url} at ${width}px`,
      ).toBeTruthy();
      const controls = page.locator(".select-control:visible");
      for (let i = 0; i < (await controls.count()); i++) {
        const c = controls.nth(i);
        const geometry = await c.evaluate((el) => {
          const s = el.querySelector("select")!,
            a = el.querySelector("svg")!;
          return {
            gap:
              el.getBoundingClientRect().right -
              a.getBoundingClientRect().right,
            appearance: getComputedStyle(s).appearance,
            padding: parseFloat(getComputedStyle(s).paddingRight),
            height: s.getBoundingClientRect().height,
          };
        });
        expect(geometry.gap).toBeCloseTo(16, 0);
        expect(geometry.appearance).toBe("none");
        expect(geometry.padding).toBeGreaterThanOrEqual(44);
        expect(geometry.height).toBeGreaterThanOrEqual(44);
      }
    }
  }
});
test("assistant is a persistent editable chat and mobile navigation supports keyboard", async ({
  page,
}) => {
  await page.goto("/assistant");
  await page.getByLabel("Вопрос покупателя").fill("Какая цена?");
  await page.getByRole("button", { name: "Предпросмотр ответа" }).click();
  await expect(page.locator(".assistant-exchange")).toHaveCount(1);
  await page.getByRole("button", { name: "Редактировать ответ" }).click();
  await page
    .getByLabel("Ваш вариант ответа")
    .fill("Здравствуйте! Уточню условия у продавца.");
  await page.getByRole("button", { name: "Сохранить вариант" }).click();
  await expect(page.locator(".bubble.seller")).toContainText("Уточню условия");
  await page.reload();
  await expect(page.locator(".bubble.seller")).toContainText("Уточню условия");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await expect(
    page.getByRole("button", { name: "Закрыть меню", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Открыть меню" }),
  ).toBeFocused();
  await expect(page.locator("aside")).toHaveAttribute("inert", "");
});
