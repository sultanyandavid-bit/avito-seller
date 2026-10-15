"use client";
import { useState } from "react";
import type { TestRun } from "@/lib/seller/types";
import Modal from "../modal";
export default function History({
  runs,
  busy,
  onOpen,
  onClear,
}: {
  runs: TestRun[];
  busy: boolean;
  onOpen: (id: string) => void;
  onClear: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const real = runs.flatMap((r) => r.results).filter((r) => !r.model.demo);
  const known = real.filter((r) => r.cost);
  const amounts = known.reduce<Record<string, number>>((s, r) => {
    if (r.cost) s[r.cost.currency] = (s[r.cost.currency] ?? 0) + r.cost.amount;
    return s;
  }, {});
  const exportRuns = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(runs, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "seller-ai-tests.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <div className="seller-section-heading">
        <div>
          <h2>История и расходы</h2>
          <p>
            Последние 50 тестов в этом браузере. Оценки выставляет продавец.
          </p>
        </div>
        {runs.length > 0 && (
          <div className="seller-card-actions">
            <button className="button secondary" onClick={exportRuns}>
              Экспорт JSON
            </button>
            <button
              disabled={busy}
              className="text-link"
              onClick={() => setConfirm(true)}
            >
              Очистить историю
            </button>
          </div>
        )}
      </div>
      <div className="seller-analytics">
        <div className="panel">
          <small>Сохранено тестов</small>
          <strong>{runs.length}</strong>
          <p>
            {runs.filter((r) => r.results.every((m) => m.model.demo)).length} в
            деморежиме
          </p>
        </div>
        <div className="panel">
          <small>Реальные попытки API</small>
          <strong>{real.length}</strong>
          <p>Демо не расходует API-токены</p>
        </div>
        <div className="panel">
          <small>Известная часть расходов</small>
          <strong className="seller-cost-total">
            {Object.entries(amounts)
              .map(
                ([c, n]) =>
                  `${n.toLocaleString("ru-RU", { maximumFractionDigits: 6 })} ${c}`,
              )
              .join(" · ") || "Нет данных"}
          </strong>
          <p>
            {real.length - known.length > 0
              ? `Расходы неизвестны по ${real.length - known.length} попыткам`
              : "Только известные тарифы; не счёт провайдера"}
          </p>
        </div>
      </div>
      {runs.length ? (
        <div className="panel seller-run-list">
          {runs.map((r) => {
            const scores = r.results
              .flatMap((x) => Object.values(x.review.scores))
              .filter((n): n is number => typeof n === "number");
            return (
              <button
                key={r.id}
                className="seller-run"
                onClick={() => onOpen(r.id)}
              >
                <span>
                  <strong>{r.scenario.name}</strong>
                  <small>
                    {r.product.name} ·{" "}
                    {new Date(r.createdAt).toLocaleString("ru-RU", {
                      timeZone: "Europe/Moscow",
                    })}{" "}
                    МСК
                  </small>
                  <p>{r.scenario.question}</p>
                </span>
                <span>
                  <b className="status neutral">
                    {r.results.every((x) => x.model.demo) ? "ДЕМО" : "API"} ·{" "}
                    {r.results.length} ответа
                  </b>
                  <small>
                    {scores.length
                      ? `Ручная оценка: ${(scores.reduce((s, n) => s + n, 0) / scores.length).toFixed(1)} / 5 (${scores.length} критериев)`
                      : "Ещё не оценено"}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="panel empty">
          <h2>Здесь появятся ваши тесты</h2>
          <p>Запустите первое сравнение во вкладке «Тестирование AI».</p>
        </div>
      )}
      {confirm && (
        <Modal
          title="Очистить историю тестов?"
          onClose={() => setConfirm(false)}
        >
          <p>
            Сохранённые ответы, оценки и комментарии будут удалены из этого
            браузера. База знаний и сценарии сохранятся.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setConfirm(false)}
            >
              Отмена
            </button>
            <button
              className="button danger"
              onClick={() => {
                onClear();
                setConfirm(false);
              }}
            >
              Очистить
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
