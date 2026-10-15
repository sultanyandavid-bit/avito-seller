import { parseCompare } from "@/lib/seller/validation";
import { demoModels } from "@/lib/seller/types";
import { demoSellerReply } from "@/lib/seller/demo";
import { modelConfig } from "@/lib/seller/server/config";
import { runReal } from "@/lib/seller/server/provider";
import {
  RequestError,
  sameOrigin,
  readJsonBounded,
  authorized,
  acquire,
  demoLimit,
  realMinuteLimit,
  realHourLimit,
} from "@/lib/seller/server/guards";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    if (!sameOrigin(request))
      throw new RequestError(
        403,
        "Запрос разрешён только со страницы приложения.",
      );
    if (!request.headers.get("content-type")?.includes("application/json"))
      throw new RequestError(415, "Нужен Content-Type application/json.");
    const input = parseCompare(await readJsonBounded(request));
    if (!input)
      throw new RequestError(
        400,
        "Проверьте товар, сценарий и выбор 1–4 моделей.",
      );
    if (input.mode === "demo") {
      if (!demoLimit.take())
        throw new RequestError(
          429,
          "Слишком много демозапросов. Повторите через минуту.",
        );
      const models = input.modelKeys.map((k) =>
        demoModels.find((m) => m.key === k),
      );
      if (models.some((m) => !m))
        throw new RequestError(
          400,
          "В деморежиме доступны только локальные алгоритмы.",
        );
      release = acquire();
      return Response.json(
        { results: models.map((m) => demoSellerReply(input, m!)) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (process.env.SELLER_AI_ENABLE_REAL !== "true")
      throw new RequestError(403, "Реальные API-запросы отключены на сервере.");
    if (
      !authorized(
        request.headers.get("authorization"),
        process.env.SELLER_AI_ACCESS_TOKEN,
      )
    )
      throw new RequestError(
        401,
        "Для реальных запросов нужен код доступа администратора.",
      );
    const configured = modelConfig().models;
    const models = input.modelKeys.map((k) =>
      configured.find((m) => m.option.key === k && m.option.available),
    );
    if (models.some((m) => !m))
      throw new RequestError(
        400,
        "Выбранная модель не настроена или недоступна.",
      );
    release = acquire();
    if (
      !realMinuteLimit.take(models.length) ||
      !realHourLimit.take(models.length)
    )
      throw new RequestError(
        429,
        "Лимит реальных запросов исчерпан. Повторите позже.",
      );
    return Response.json(
      { results: await Promise.all(models.map((m) => runReal(m!, input))) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof RequestError
            ? e.message
            : "Не удалось выполнить сравнение. Повторите попытку.",
      },
      {
        status: e instanceof RequestError ? e.status : 500,
        headers: {
          "Cache-Control": "no-store",
          ...(e instanceof RequestError && e.status === 429
            ? { "Retry-After": "60" }
            : {}),
        },
      },
    );
  } finally {
    release?.();
  }
}
