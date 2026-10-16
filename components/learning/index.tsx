"use client";
import { useMemo, useState } from "react";
import { GraduationCap, Plus, Search } from "lucide-react";
import type { Store } from "@/lib/types";
import { sellerSeed, sellerStorageKey } from "@/lib/seller/data";
import { parseSellerData } from "@/lib/seller/validation";
import { scopedKey, MAIN_STORE_ID } from "@/lib/workspaces/types";
import { usePersistentState } from "@/lib/client/use-persistent-state";
import { downloadJson } from "@/lib/client/download";
import { feedbackLabels, type TrainingExample } from "@/lib/learning/types";
import { relevantExamples, approvedContext } from "@/lib/learning/repository";
import Heading from "../heading";
import Modal from "../modal";
import Select from "../ui/select";
import ExampleEditor from "./editor";
import { useLearning } from "./provider";
export default function Learning({
  store,
  storeId,
}: {
  store: Store;
  storeId: string;
}) {
  const { data, ready, error, remove } = useLearning();
  const seed = useMemo(
    () =>
      storeId === MAIN_STORE_ID
        ? sellerSeed
        : { ...sellerSeed, products: [], runs: [] },
    [storeId],
  );
  const { data: lab } = usePersistentState(
    scopedKey(sellerStorageKey, storeId),
    seed,
    parseSellerData,
  );
  const products = [
    ...store.products.map((p) => ({ id: p.id, name: p.name })),
    ...lab.products.filter((p) => !store.products.some((c) => c.id === p.id)),
  ];
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [productId, setProductId] = useState("all"),
    [editing, setEditing] = useState<TrainingExample | "new" | null>(null),
    [deleting, setDeleting] = useState<TrainingExample | null>(null),
    [notice, setNotice] = useState(""),
    [searchProduct, setSearchProduct] = useState(products[0]?.id ?? ""),
    [searchQuestion, setSearchQuestion] = useState("");
  const visible = data.examples.filter(
    (e) =>
      (status === "all" || e.status === status) &&
      (productId === "all" || e.productId === productId) &&
      `${e.question} ${e.correctedReply} ${e.comment} ${e.productName}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const matches = relevantExamples(
    data.examples,
    storeId,
    searchProduct,
    searchQuestion,
  );
  return (
    <>
      <Heading
        eyebrow="ОБУЧЕНИЕ НА ВАШЕМ ОПЫТЕ"
        title="AI-ученик"
        description="Сохраняйте проверенные ответы и объясняйте, что стоит улучшить."
      >
        <button
          className="button primary"
          disabled={!ready || !products.length}
          onClick={() => setEditing("new")}
        >
          <Plus size={17} />
          Свой пример
        </button>
      </Heading>
      <div className="notice">
        <GraduationCap size={22} />
        <div>
          <strong>Ваши исправления — основа будущих подсказок</strong>
          <p>
            Рабочая база примеров этого магазина. В поиск попадают только
            одобренные ответы по выбранному товару. Модель не переобучается;
            автоматическая отправка отключена.
          </p>
        </div>
      </div>
      {error && (
        <div className="notice seller-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <p role="status" className="action-status">
          {notice}
        </p>
      )}
      <div className="learning-summary">
        <div className="panel">
          <small>Всего примеров</small>
          <strong>{data.examples.length}</strong>
        </div>
        <div className="panel">
          <small>Одобрено</small>
          <strong>
            {data.examples.filter((e) => e.status === "approved").length}
          </strong>
        </div>
        <div className="panel">
          <small>Нужно проверить</small>
          <strong>
            {
              data.examples.filter(
                (e) => e.status === "edited" || e.status === "pending",
              ).length
            }
          </strong>
        </div>
      </div>
      <div className="toolbar learning-toolbar">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Поиск обучающих примеров"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти вопрос или пояснение…"
          />
        </label>
        <Select
          aria-label="Фильтр по статусу"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">Все статусы</option>
          {Object.entries(feedbackLabels).map(([id, label]) => (
            <option value={id} key={id}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Фильтр по товару"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        >
          <option value="all">Все товары</option>
          {Array.from(
            new Map(
              [
                ...products,
                ...data.examples.map((e) => ({
                  id: e.productId,
                  name: e.productName,
                })),
              ].map((p) => [p.id, p]),
            ).values(),
          ).map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <button
          className="button secondary"
          disabled={!data.examples.length}
          onClick={() =>
            downloadJson(`sellerai-learning-${storeId}.json`, data)
          }
        >
          Экспорт JSON
        </button>
      </div>
      {!ready ? (
        <p className="loading">Загружаем примеры…</p>
      ) : !visible.length ? (
        <div className="panel empty">
          <GraduationCap size={34} />
          <h2>
            {data.examples.length
              ? "Нет подходящих примеров"
              : "Первый пример начинается с вашего ответа"}
          </h2>
          <p>
            Одобрите или исправьте ответ в AI-ассистенте либо сохраните свой
            вариант здесь.
          </p>
        </div>
      ) : (
        <div className="learning-list">
          {visible.map((e) => (
            <article className="panel learning-example" key={e.id}>
              <div className="panel-heading">
                <div>
                  <h2>{e.productName}</h2>
                  <small>
                    {new Date(e.updatedAt).toLocaleString("ru-RU", {
                      timeZone: "Europe/Moscow",
                    })}{" "}
                    МСК
                  </small>
                </div>
                <span
                  className={`status ${e.status === "approved" ? "active" : e.status === "rejected" ? "draft" : "neutral"}`}
                >
                  {feedbackLabels[e.status]}
                </span>
              </div>
              <h3>{e.question}</h3>
              <dl>
                <dt>Первоначальный ответ</dt>
                <dd>{e.originalReply || "Собственный пример продавца"}</dd>
                <dt>Ваш вариант</dt>
                <dd>{e.correctedReply || "Не задан"}</dd>
                {e.comment && (
                  <>
                    <dt>Пояснение</dt>
                    <dd>{e.comment}</dd>
                  </>
                )}
              </dl>
              <div className="chat-actions">
                <button
                  className="button secondary"
                  onClick={() => setEditing(e)}
                >
                  Изменить пример
                </button>
                <button className="text-link" onClick={() => setDeleting(e)}>
                  Удалить пример
                </button>
              </div>
              <details className="seller-details">
                <summary>История изменений · {e.revisions.length}</summary>
                <p>
                  Создан:{" "}
                  {new Date(e.createdAt).toLocaleString("ru-RU", {
                    timeZone: "Europe/Moscow",
                  })}{" "}
                  МСК
                </p>
                {[...e.revisions].reverse().map((r, i) => (
                  <div className="example-revision" key={i}>
                    <strong>
                      {feedbackLabels[r.status]} ·{" "}
                      {new Date(r.changedAt).toLocaleString("ru-RU", {
                        timeZone: "Europe/Moscow",
                      })}{" "}
                      МСК
                    </strong>
                    <p>{r.correctedReply || "Без варианта ответа"}</p>
                    {r.comment && <p>{r.comment}</p>}
                  </div>
                ))}
              </details>
            </article>
          ))}
        </div>
      )}
      <section className="panel learning-search">
        <div className="panel-heading">
          <h2>Проверить поиск похожих примеров</h2>
        </div>
        <p className="muted">
          Локальный поиск по словам. Он не подтверждает актуальность фактов:
          проверьте цену, наличие и условия перед использованием.
        </p>
        <div className="form-grid">
          <label>
            Товар для поиска
            <Select
              aria-label="Товар для поиска"
              value={searchProduct}
              onChange={(e) => setSearchProduct(e.target.value)}
            >
              {products.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </label>
          <label>
            Вопрос для поиска
            <input
              maxLength={4000}
              value={searchQuestion}
              onChange={(e) => setSearchQuestion(e.target.value)}
            />
          </label>
        </div>
        {searchQuestion.trim() && (
          <div aria-live="polite">
            {matches.length ? (
              matches.map((m) => (
                <div className="approved-reference" key={m.example.id}>
                  <strong>{m.example.question}</strong>
                  <p>{m.example.correctedReply}</p>
                  <small>Одобренный пример · не готовый ответ модели</small>
                </div>
              ))
            ) : (
              <p className="muted">
                Одобренных примеров по этому товару и вопросу пока нет.
              </p>
            )}
            <button
              className="button secondary"
              disabled={!matches.length}
              onClick={() =>
                downloadJson("approved-context.json", {
                  storeId,
                  productId: searchProduct,
                  examples: approvedContext(
                    data.examples,
                    storeId,
                    searchProduct,
                    searchQuestion,
                  ),
                })
              }
            >
              Экспорт контекста
            </button>
          </div>
        )}
      </section>
      {editing && (
        <ExampleEditor
          initial={editing === "new" ? undefined : editing}
          products={products}
          onClose={() => setEditing(null)}
          onSaved={() => setNotice("Пример сохранён в этом магазине.")}
        />
      )}
      {deleting && (
        <Modal
          title="Удалить обучающий пример?"
          onClose={() => setDeleting(null)}
        >
          <p>
            Пример и его история будут удалены из этого магазина. Остальные
            магазины и переписки сохранятся.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setDeleting(null)}
            >
              Отмена
            </button>
            <button
              className="button danger"
              onClick={() => {
                remove(deleting.id);
                setDeleting(null);
                setNotice("Пример удалён.");
              }}
            >
              Удалить пример
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
