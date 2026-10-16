"use client";
import { useCallback, useMemo } from "react";
import { BarChart3 } from "lucide-react";
import type { Store } from "@/lib/types";
import { useLearning } from "./learning/provider";
import { usePersistentState } from "@/lib/client/use-persistent-state";
import { emptyListings, parseListings } from "@/lib/listings/types";
import { emptyMedia, parseMedia } from "@/lib/media/types";
import { sellerSeed, sellerStorageKey } from "@/lib/seller/data";
import { parseSellerData } from "@/lib/seller/validation";
import { scopedKey, MAIN_STORE_ID } from "@/lib/workspaces/types";
import Heading from "./heading";
export default function Analytics({
  storeId,
  store,
}: {
  storeId: string;
  store: Store;
}) {
  const { data: training, error: learningError } = useLearning();
  const ls = useMemo(() => emptyListings(storeId), [storeId]),
    ms = useMemo(() => emptyMedia(storeId), [storeId]);
  const lp = useCallback(
      (raw: string) => parseListings(raw, storeId),
      [storeId],
    ),
    mp = useCallback((raw: string) => parseMedia(raw, storeId), [storeId]);
  const listings = usePersistentState(
      `sellerai:listings:v1:${storeId}`,
      ls,
      lp,
    ),
    media = usePersistentState(`sellerai:media-jobs:v1:${storeId}`, ms, mp);
  const seed = useMemo(
    () =>
      storeId === MAIN_STORE_ID
        ? sellerSeed
        : { ...sellerSeed, products: [], runs: [] },
    [storeId],
  );
  const lab = usePersistentState(
    scopedKey(sellerStorageKey, storeId),
    seed,
    parseSellerData,
  );
  const approved = training.examples.filter(
      (e) => e.status === "approved",
    ).length,
    edited = training.examples.filter(
      (e) => e.correctedReply && e.correctedReply !== e.originalReply,
    ).length;
  const real = lab.data.runs
    .flatMap((r) => r.results)
    .filter((r) => !r.model.demo);
  const known = real.reduce<Record<string, number>>((s, r) => {
    if (r.cost) s[r.cost.currency] = (s[r.cost.currency] ?? 0) + r.cost.amount;
    return s;
  }, {});
  const questions = Object.entries(
    training.examples.reduce<Record<string, number>>((s, e) => {
      const k = e.question.trim().toLowerCase();
      s[k] = (s[k] ?? 0) + 1;
      return s;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  return (
    <>
      <Heading
        eyebrow="НАБЛЮДЕНИЯ БЕЗ ВЫДУМАННЫХ МЕТРИК"
        title="Аналитика"
        description="Локальные действия в выбранном магазине. Это не статистика продаж маркетплейса."
      />
      {(learningError || listings.error || media.error || lab.error) && (
        <p role="alert" className="notice seller-error">
          Часть данных не удалось прочитать. Показатели неполны:{" "}
          {learningError || listings.error || media.error || lab.error}
        </p>
      )}
      <div className="learning-summary">
        <div className="panel">
          <small>Одобрено примеров</small>
          <strong>{approved}</strong>
          <p>
            {training.examples.length
              ? `${Math.round((approved / training.examples.length) * 100)}% сохранённых примеров`
              : "Нет оценённых примеров"}
          </p>
        </div>
        <div className="panel">
          <small>Исправленных примеров</small>
          <strong>{edited}</strong>
          <p>Не число переобучений модели</p>
        </div>
        <div className="panel">
          <small>Сохранено объявлений</small>
          <strong>{listings.data.listings.length}</strong>
          <p>Черновики в этом браузере</p>
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <h2>Тесты и AI-ресурсы</h2>
          <dl className="analytics-facts">
            <dt>Сохранено сравнений</dt>
            <dd>{lab.data.runs.length}</dd>
            <dt>Реальных попыток API</dt>
            <dd>{real.length}</dd>
            <dt>Известная часть расходов</dt>
            <dd>
              {Object.entries(known)
                .map(
                  ([c, n]) =>
                    `${n.toLocaleString("ru-RU", { maximumFractionDigits: 6 })} ${c}`,
                )
                .join(" · ") || "Нет данных"}
            </dd>
            <dt>Расходы неизвестны</dt>
            <dd>{real.filter((r) => !r.cost).length} попыток</dd>
            <dt>Заданий медиа</dt>
            <dd>{media.data.jobs.length}</dd>
            <dt>Готовых локальных заданий</dt>
            <dd>
              {
                media.data.jobs.filter(
                  (j) => j.status === "completed" && j.mode === "local",
                ).length
              }
            </dd>
          </dl>
          <p className="muted">
            Расходы рассчитаны только по сохранённым usage и заданным тарифам.
            Это не счёт провайдера и не общий расход аккаунта.
          </p>
        </section>
        <section className="panel">
          <h2>Частые вопросы в примерах</h2>
          {questions.length ? (
            questions.map(([q, n]) => (
              <div className="analytics-question" key={q}>
                <span>{q}</span>
                <b>{n}</b>
              </div>
            ))
          ) : (
            <p className="muted">
              Сохраните обучающие примеры, чтобы увидеть повторяющиеся вопросы.
            </p>
          )}
          <p className="muted">
            Это выборка вашей базы примеров, не поток реальных обращений
            покупателей.
          </p>
        </section>
      </div>
      <section className="panel analytics-empty">
        <BarChart3 size={32} />
        <div>
          <h2>Конверсия и эффективность продаж пока неизвестны</h2>
          <p>
            Нет подтверждённых заказов и официальной интеграции. Диалоги
            текущего демомагазина ({store.conversations.length}) нельзя
            использовать как доказательство роста продаж.
          </p>
        </div>
      </section>
    </>
  );
}
