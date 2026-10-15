"use client";
import {
  criteria,
  providerLabels,
  type TestRun,
  type Review,
  type Result,
} from "@/lib/seller/types";
export function CostLabel({ result }: { result: Result }) {
  return (
    <>
      {result.model.demo
        ? "Не применяется"
        : result.cost
          ? `${result.cost.amount.toLocaleString("ru-RU", { maximumFractionDigits: 8 })} ${result.cost.currency}`
          : "Неизвестна"}
    </>
  );
}
export default function Results({
  run,
  onReview,
}: {
  run: TestRun;
  onReview: (resultId: string, review: Review) => void;
}) {
  return (
    <section className="seller-results" aria-label="Результаты сравнения">
      <div className="seller-section-heading">
        <div>
          <h2>Ответы на один сценарий</h2>
          <p>{run.product.name} · Снимок знаний на момент теста</p>
        </div>
        <span className="status neutral">
          {run.results.every((r) => r.model.demo)
            ? "Тестовые ответы, не нейросети"
            : "Черновики · нужна проверка"}
        </span>
      </div>
      <p className="seller-question">«{run.scenario.question}»</p>
      <details className="seller-details">
        <summary>Контекст и факты этого теста</summary>
        <p>
          {run.scenario.context
            .map(
              (t) =>
                `${t.role === "buyer" ? "Покупатель" : "Продавец"}: ${t.text}`,
            )
            .join("\n") || "Предыдущих сообщений нет."}
        </p>
        <pre>{JSON.stringify(run.product, null, 2)}</pre>
      </details>
      <div className="seller-result-grid">
        {run.results.map((r) => (
          <article className="panel seller-result-card" key={r.id}>
            <div className="panel-heading">
              <div>
                <h3>{r.model.label}</h3>
                <small>{providerLabels[r.model.provider]}</small>
              </div>
              <span className={`status ${r.model.demo ? "draft" : "active"}`}>
                {r.model.demo ? "ДЕМО" : "API"}
              </span>
            </div>
            <code className="seller-model-id">
              {r.model.demo ? "Локальный алгоритм" : r.model.modelId}
            </code>
            {r.error ? (
              <div role="alert" className="notice seller-error">
                {r.error}
              </div>
            ) : null}
            {r.text && <div className="seller-answer">{r.text}</div>}
            {r.handoff === true && (
              <span className="seller-handoff">Нужно уточнение у продавца</span>
            )}
            {!r.model.demo && !r.error && (
              <p className="muted">
                Ответ модели не проверен автоматически. Перед использованием
                сверьте факты с карточкой.
              </p>
            )}
            <dl className="seller-metrics">
              <div>
                <dt>Входные токены</dt>
                <dd>
                  {r.model.demo
                    ? "Не применяется"
                    : (r.inputTokens ?? "Неизвестно")}
                </dd>
              </div>
              <div>
                <dt>Выходные токены</dt>
                <dd>
                  {r.model.demo
                    ? "Не применяется"
                    : (r.outputTokens ?? "Неизвестно")}
                </dd>
              </div>
              <div>
                <dt>Расчётная стоимость</dt>
                <dd>
                  <CostLabel result={r} />
                </dd>
              </div>
              <div>
                <dt>{r.model.demo ? "Время алгоритма" : "Время запроса"}</dt>
                <dd>{r.durationMs} мс</dd>
              </div>
            </dl>
            {r.cost && (
              <p className="seller-tariff-source">
                По настроенному тарифу: {r.cost.source}. Не счёт провайдера;
                кеширование и скидки не учитываются.
              </p>
            )}
            {r.error && !r.model.demo && (
              <p className="muted">
                При ошибке провайдер мог учесть запрос. Токены и расходы
                неизвестны.
              </p>
            )}
            <details className="seller-details">
              <summary>Оценить ответ вручную</summary>
              <p className="muted">
                Ваша субъективная оценка: 1 — плохо, 5 — отлично. Без оценки —
                не проверено. Это не показатель эффективности продаж.
              </p>
              {criteria.map(([id, label]) => (
                <label className="seller-rating" key={id}>
                  <span>{label}</span>
                  <select
                    disabled={!!r.error}
                    aria-label={`${label} — ${r.model.label}`}
                    value={r.review.scores[id] ?? ""}
                    onChange={(e) => {
                      const scores = { ...r.review.scores };
                      if (e.target.value) scores[id] = Number(e.target.value);
                      else delete scores[id];
                      onReview(r.id, { ...r.review, scores });
                    }}
                  >
                    <option value="">Не оценено</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label>
                Комментарий к ответу
                <textarea
                  aria-label={`Комментарий — ${r.model.label}`}
                  rows={3}
                  maxLength={2000}
                  value={r.review.comment}
                  onChange={(e) =>
                    onReview(r.id, { ...r.review, comment: e.target.value })
                  }
                />
              </label>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
