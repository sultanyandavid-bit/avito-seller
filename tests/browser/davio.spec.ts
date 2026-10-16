import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { emptyProject, type Project } from "../../lib/davio/types";
const origin = "http://127.0.0.1:3000";
async function account(request: APIRequestContext, name = "Тест DAVIO") {
  const response = await request.post("/api/davio/register", {
    headers: { Origin: origin },
    data: {
      email: `davio-${randomUUID()}@example.test`,
      password: `test-${randomUUID()}`,
      name,
    },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).user;
}
async function create(
  request: APIRequestContext,
  title = "Тестовый велосипед",
): Promise<Project> {
  const result = await request.post("/api/davio/projects", {
    headers: { Origin: origin },
    data: {
      data: {
        ...emptyProject,
        title,
        facts: "Рама 19 дюймов",
        condition: "Б/у",
        defects: "Царапины на раме",
        price: 20000,
      },
    },
  });
  expect(result.status()).toBe(201);
  return result.json();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
}
test("real registration, persisted session, theme and four navigation sections", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByLabel("Ваше имя").fill("Тестовый продавец");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`ui-${randomUUID()}@example.test`);
  await page
    .getByLabel("Пароль", { exact: true })
    .fill(`Password-${randomUUID()}`);
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Добрый день, Тестовый продавец" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(4);
  await page.getByRole("button", { name: /Тема:/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  for (const [url, title] of [
    ["/", "Добрый день, Тестовый продавец"],
    ["/listings", "Объявления"],
    ["/messages", "Сообщения"],
    ["/settings", "Настройки"],
  ]) {
    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await noOverflow(page);
  }
  await page.goto("/");
  await page.screenshot({
    path: `work/davio-${info.project.name}-dark.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: /Тема:/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.screenshot({
    path: `work/davio-${info.project.name}-light.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Выйти из аккаунта" }).click();
  await expect(
    page.getByRole("heading", { name: "Начнём с вашего пространства" }),
  ).toBeVisible();
});
test("unified project: upload, compose, correct, revise and export without losing media", async ({
  page,
}) => {
  test.setTimeout(90000);
  await account(page.request);
  await page.goto("/listings");
  await page.getByRole("button", { name: "Создать объявление" }).click();
  await expect(page).toHaveURL(/\/projects\//);
  await page
    .getByLabel("Название товара", { exact: true })
    .fill("Тестовый велосипед");
  await page.getByLabel("Категория", { exact: true }).fill("Велосипеды");
  await page.getByLabel("Что важно знать о товаре").fill("Рама 19 дюймов");
  await page.getByLabel("Состояние", { exact: true }).fill("Б/у");
  const bytes = await sharp({
    create: { width: 480, height: 320, channels: 3, background: "#667e80" },
  })
    .png()
    .toBuffer();
  await page.getByLabel("Фотографии товара", { exact: true }).setInputFiles([
    { name: "bike.png", mimeType: "image/png", buffer: bytes },
    { name: "second.png", mimeType: "image/png", buffer: bytes },
  ]);
  await expect(page.locator(".dv-photo-item")).toHaveCount(2);
  await page.getByRole("button", { name: "Фото 2 влево" }).click();
  await expect(page.getByRole("status")).toContainText("Порядок");
  await page
    .getByRole("button", { name: "Создать описание", exact: true })
    .click();
  await expect(page.getByLabel("Описание объявления")).toHaveValue(/19 дюймов/);
  await page
    .getByLabel("Описание объявления")
    .fill("Мой подтверждённый текст без выдумок.");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Проект сохранён");
  await page.getByRole("button", { name: "Фотографии", exact: true }).click();
  await page.getByLabel(/Яркость/).fill("1.1");
  await page
    .getByRole("button", { name: "Обработать фотографию", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Обработанная версия", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Описание", exact: true }).click();
  await expect(page.getByLabel("Описание объявления")).toHaveValue(
    "Мой подтверждённый текст без выдумок.",
  );
  await page.reload();
  await page.getByRole("button", { name: "Описание", exact: true }).click();
  await expect(page.getByLabel("Описание объявления")).toHaveValue(
    "Мой подтверждённый текст без выдумок.",
  );
  await page
    .getByRole("button", { name: "Сделать короче", exact: true })
    .click();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Проект сохранён");
  await page.getByText("История версий текста", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Восстановить версию 3", exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Восстановить версию 3", exact: true })
    .click();
  await expect(page.getByLabel("Описание объявления")).toHaveValue(
    "Мой подтверждённый текст без выдумок.",
  );
  await page.getByRole("button", { name: "Экспорт", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать комплект ZIP" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.zip$/);
  await expect(page.locator(".dv-export-item")).toHaveCount(3);
  await noOverflow(page);
});
test("protected API rejects guests, other owners, CSRF, stale revisions and normal-user admin", async ({
  request,
  browser,
}) => {
  await account(request);
  const p = await create(request);
  const bytes = await sharp({
    create: { width: 40, height: 40, channels: 3, background: "#778899" },
  })
    .png()
    .toBuffer();
  const upload = await request.post(`/api/davio/projects/${p.id}/photos`, {
    headers: { Origin: origin },
    multipart: {
      file: { name: "photo.png", mimeType: "image/png", buffer: bytes },
    },
  });
  expect(upload.status()).toBe(201);
  const asset = (await upload.json()).assets[0];
  const guest = await browser.newContext();
  expect(
    (await guest.request.get(`/api/davio/files/${asset.id}`)).status(),
  ).toBe(401);
  await account(guest.request, "Другой тестовый пользователь");
  for (const url of [
    `projects/${p.id}`,
    `files/${asset.id}`,
    `projects/${p.id}/export`,
  ])
    expect((await guest.request.get(`/api/davio/${url}`)).status()).toBe(404);
  expect((await guest.request.get("/api/davio/admin")).status()).toBe(403);
  expect(
    (
      await request.patch(`/api/davio/projects/${p.id}`, {
        headers: { Origin: "https://attacker.test" },
        data: { data: p.data, revision: 1 },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.patch(`/api/davio/projects/${p.id}`, {
        headers: { Origin: origin },
        data: { data: { ...p.data, title: "Изменённый" }, revision: 1 },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.patch(`/api/davio/projects/${p.id}`, {
        headers: { Origin: origin },
        data: { data: p.data, revision: 1 },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.post(`/api/davio/projects/${p.id}/photos`, {
        headers: { Origin: origin },
        multipart: {
          file: {
            name: "fake.png",
            mimeType: "image/png",
            buffer: Buffer.from("<svg>invalid</svg>"),
          },
        },
      })
    ).status(),
  ).toBe(400);
  const current = await (
    await request.get(`/api/davio/projects/${p.id}`)
  ).json();
  expect(current.assets).toHaveLength(1);
  await guest.close();
});
test("three assistant modes share persistent history and never send to a marketplace", async ({
  page,
}) => {
  await account(page.request);
  const p = await create(page.request);
  await page.goto("/messages");
  await page.getByLabel("Контекст товара").selectOption(p.id);
  await page
    .getByLabel("Ваше сообщение")
    .fill("Можно доставкой Авито со скидкой?");
  await page.getByRole("button", { name: "Подготовить ответ" }).click();
  await expect(page.locator(".dv-bubble.answer")).toContainText(
    "без подтверждения",
  );
  await page.getByRole("button", { name: "Обучение", exact: true }).click();
  await page.getByLabel("Ваше сообщение").fill("Как подготовить объявление?");
  await page.getByRole("button", { name: "Подготовить ответ" }).click();
  await expect(page.locator(".dv-bubble.answer")).toContainText(
    "локальная памятка",
  );
  await page.reload();
  await page.getByRole("button", { name: "Обучение", exact: true }).click();
  await expect(page.locator(".dv-bubble.answer")).toHaveCount(1);
  await page.getByRole("button", { name: "Продавец", exact: true }).click();
  await expect(page.locator(".dv-bubble.answer")).toContainText(
    "без подтверждения",
  );
});
test("DAVIO editor and both themes fit 320–1440px; PWA caches no private API", async ({
  page,
}) => {
  test.setTimeout(120000);
  await account(page.request);
  const p = await create(page.request);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    for (const url of [
      "/",
      "/listings",
      `/projects/${p.id}`,
      "/messages",
      "/settings",
      "/admin",
    ]) {
      await page.goto(url);
      await expect(page.locator("main h1")).toBeVisible();
      await noOverflow(page);
    }
    await page.goto(`/projects/${p.id}`);
    for (const tab of ["Описание", "Фотографии", "Видео", "Экспорт"]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await noOverflow(page);
    }
  }
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.display).toBe("standalone");
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  const caches = await page.evaluate(async () => {
    const keys = await window.caches.keys();
    return (
      await Promise.all(
        keys.map(async (k) =>
          (await (await window.caches.open(k)).keys()).map((r) => r.url),
        ),
      )
    ).flat();
  });
  expect(caches.some((x) => x.includes("/api/"))).toBe(false);
  expect(caches.some((x) => x.endsWith("/offline"))).toBe(true);
  expect(errors).toEqual([]);
});

test("FFmpeg queue produces a downloadable MP4 that actually plays in the editor", async ({
  page,
}) => {
  test.setTimeout(120000);
  await account(page.request);
  const p = await create(page.request);
  const bytes = await sharp({
    create: { width: 480, height: 320, channels: 3, background: "#5d786b" },
  })
    .png()
    .toBuffer();
  const upload = await page.request.post(`/api/davio/projects/${p.id}/photos`, {
    headers: { Origin: origin },
    multipart: {
      file: { name: "video-source.png", mimeType: "image/png", buffer: bytes },
    },
  });
  expect(upload.status()).toBe(201);
  const usage = await (await page.request.get("/api/davio/usage")).json();
  test.skip(
    !usage.worker.online,
    "Для этой интеграционной проверки запустите npm run worker с тестовым DAVIO_DATA_DIR.",
  );
  await page.goto(`/projects/${p.id}`);
  await page.getByRole("button", { name: "Видео", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Длительность", exact: true })
    .selectOption("6");
  await page.getByRole("button", { name: "Создать MP4", exact: true }).click();
  const video = page.locator(".dv-video-result video").last();
  await expect(video).toBeVisible({ timeout: 90000 });
  await video.evaluate(async (el: HTMLVideoElement) => {
    el.muted = true;
    await el.play();
  });
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
    .toBeGreaterThan(0.25);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Скачать MP4", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.mp4$/);
  await page.getByRole("button", { name: "Описание", exact: true }).click();
  await page
    .getByLabel("Описание объявления")
    .fill("Текст изменён после монтажа");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Видео", exact: true }).click();
  await expect(page.locator(".dv-video-result video")).toHaveCount(1);
});

test("media refresh cannot adopt another tab's text revision or overwrite unseen changes", async ({
  page,
}) => {
  await account(page.request);
  const p = await create(page.request);
  await page.goto(`/projects/${p.id}`);
  await page
    .getByLabel("Название товара", { exact: true })
    .fill("Моя несохранённая правка");
  const update = await page.request.patch(`/api/davio/projects/${p.id}`, {
    headers: { Origin: origin },
    data: {
      data: { ...p.data, title: "Изменено в другой вкладке" },
      revision: 1,
    },
  });
  expect(update.status()).toBe(200);
  const bytes = await sharp({
    create: { width: 40, height: 40, channels: 3, background: "#778899" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Фотографии товара", { exact: true })
    .setInputFiles({
      name: "concurrent.png",
      mimeType: "image/png",
      buffer: bytes,
    });
  await expect(page.locator(".dv-photo-item")).toHaveCount(1);
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "другой вкладке" }),
  ).toBeVisible();
  await expect(page.getByLabel("Название товара", { exact: true })).toHaveValue(
    "Моя несохранённая правка",
  );
  const actual = await (
    await page.request.get(`/api/davio/projects/${p.id}`)
  ).json();
  expect(actual.data.title).toBe("Изменено в другой вкладке");
});

test("admin CLI grants only the test user; protected panel changes actual plans and limits", async ({
  page,
}) => {
  const user = await account(page.request);
  execFileSync(
    process.execPath,
    [
      "--env-file-if-exists=.env.local",
      "--import",
      "tsx",
      "scripts/davio-admin.ts",
      user.email,
      "grant",
    ],
    {
      env: {
        ...process.env,
        DAVIO_DATA_DIR:
          process.env.DAVIO_E2E_DATA_DIR || path.resolve("work/davio-e2e"),
      },
    },
  );
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Администрирование", exact: true }),
  ).toBeVisible();
  const admin = await (await page.request.get("/api/davio/admin")).json();
  const basic = admin.plans.find((p: { id: string }) => p.id === "basic");
  try {
    const plan = page
      .locator("section")
      .filter({
        has: page.getByRole("heading", {
          name: "Базовый · лимиты",
          exact: true,
        }),
      });
    await plan
      .getByLabel("Проекты", { exact: true })
      .fill(String(basic.projects + 1));
    await plan.getByRole("button", { name: "Сохранить лимиты" }).click();
    await expect(page.getByRole("status")).toContainText("Изменения сохранены");
    const ownRow = page
      .locator(".dv-admin-user")
      .filter({ hasText: user.email });
    await ownRow.getByRole("combobox").selectOption("pro");
    await expect(ownRow.getByRole("combobox")).toHaveValue("pro");
    const session = await (await page.request.get("/api/davio/session")).json();
    expect(session.user.plan).toBe("pro");
  } finally {
    await page.request.patch("/api/davio/admin/plans", {
      headers: { Origin: origin },
      data: basic,
    });
    execFileSync(
      process.execPath,
      [
        "--env-file-if-exists=.env.local",
        "--import",
        "tsx",
        "scripts/davio-admin.ts",
        user.email,
        "revoke",
      ],
      {
        env: {
          ...process.env,
          DAVIO_DATA_DIR:
            process.env.DAVIO_E2E_DATA_DIR || path.resolve("work/davio-e2e"),
        },
      },
    );
  }
});
