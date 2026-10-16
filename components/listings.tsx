"use client";
import { useCallback, useMemo, useState } from "react";
import { FileText, Copy, Plus } from "lucide-react";
import type { Store } from "@/lib/types";
import {
  emptyListings,
  parseListings,
  buildListing,
  listingStyles,
  type Listing,
  type ListingStyle,
} from "@/lib/listings/types";
import { usePersistentState } from "@/lib/client/use-persistent-state";
import { copyText } from "@/lib/client/clipboard";
import { uploadAsset } from "@/lib/media/assets";
import Heading from "./heading";
import Select from "./ui/select";
import Modal from "./modal";
import AssetPreview from "./media/asset-preview";
export default function Listings({
  store,
  storeId,
}: {
  store: Store;
  storeId: string;
}) {
  const seed = useMemo(() => emptyListings(storeId), [storeId]),
    parse = useCallback(
      (raw: string) => parseListings(raw, storeId),
      [storeId],
    );
  const { data, update, ready, error } = usePersistentState(
    `sellerai:listings:v1:${storeId}`,
    seed,
    parse,
  );
  const fresh = (): Listing => ({
    id: crypto.randomUUID(),
    storeId,
    productId: "",
    category: "",
    sourceDescription: "",
    title: "",
    description: "",
    advantages: "",
    specifications: "",
    condition: "",
    price: null,
    terms: "",
    instructions: "",
    style: "professional",
    alternative: "",
    assetIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const [draft, setDraft] = useState<Listing | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [remove, setRemove] = useState<Listing | null>(null);
  const patch = (x: Partial<Listing>) =>
    setDraft((d) => (d ? { ...d, ...x } : d));
  async function upload(files: FileList) {
    if (!draft) return;
    if (draft.assetIds.length + files.length > 10) {
      setMessage("Не более 10 фотографий на объявление.");
      return;
    }
    setBusy(true);
    try {
      const ids = [];
      for (const f of Array.from(files))
        ids.push((await uploadAsset(storeId, f)).id);
      patch({ assetIds: [...draft.assetIds, ...ids] });
      setMessage(
        "Фотографии сохранены локально. Внешним сервисам ничего не отправлено.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Не удалось загрузить файл.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="СОЗДАВАЙТЕ ПОНЯТНЫЕ ПРЕДЛОЖЕНИЯ"
        title="AI-объявления"
        description="Подготовьте и сохраните текст на основе подтверждённых данных."
      >
        <button
          className="button primary"
          disabled={!ready}
          onClick={() => {
            setDraft(fresh());
            setMessage("");
          }}
        >
          <Plus size={17} />
          Новое объявление
        </button>
      </Heading>
      <div className="notice">
        <FileText size={22} />
        <div>
          <strong>Рабочий локальный шаблон — без нейросети</strong>
          <p>
            Текст составляется только из ваших данных. Стили меняют структуру,
            но не добавляют свойства товара. Публикации на Авито нет;
            прохождение модерации не гарантируется.
          </p>
        </div>
      </div>
      {(message || error) && (
        <p className="notice" role={error ? "alert" : "status"}>
          {error || message}
        </p>
      )}
      {draft && (
        <div className="listing-layout">
          <section className="panel form-panel">
            <h2>Данные объявления</h2>
            <label>
              Взять данные товара
              <Select
                aria-label="Товар для объявления"
                value={draft.productId}
                onChange={(e) => {
                  const p = store.products.find((p) => p.id === e.target.value);
                  if (p)
                    patch({
                      productId: p.id,
                      title: p.name,
                      category: p.category,
                      sourceDescription: p.description,
                      description: p.description,
                      price: p.price,
                    });
                }}
              >
                <option value="">Свой товар</option>
                {store.products.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Название
              <input
                maxLength={120}
                value={draft.title}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </label>
            <label>
              Категория
              <input
                maxLength={100}
                value={draft.category}
                onChange={(e) => patch({ category: e.target.value })}
              />
            </label>
            <label>
              Описание товара
              <textarea
                maxLength={5000}
                rows={4}
                value={draft.sourceDescription}
                onChange={(e) => patch({ sourceDescription: e.target.value })}
              />
            </label>
            <label>
              Подтверждённые характеристики
              <textarea
                maxLength={3000}
                rows={3}
                value={draft.specifications}
                onChange={(e) => patch({ specifications: e.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                Состояние товара
                <input
                  maxLength={200}
                  value={draft.condition}
                  onChange={(e) => patch({ condition: e.target.value })}
                />
              </label>
              <label>
                Цена, ₽
                <input
                  type="number"
                  min="0"
                  max="1000000000"
                  value={draft.price ?? ""}
                  onChange={(e) =>
                    patch({
                      price:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <label>
              Условия продажи и доставки
              <textarea
                maxLength={2000}
                rows={2}
                value={draft.terms}
                onChange={(e) => patch({ terms: e.target.value })}
              />
            </label>
            <label>
              Дополнительные инструкции
              <textarea
                maxLength={2000}
                rows={2}
                value={draft.instructions}
                onChange={(e) => patch({ instructions: e.target.value })}
              />
            </label>
            <label>
              Стиль объявления
              <Select
                aria-label="Стиль объявления"
                value={draft.style}
                onChange={(e) =>
                  patch({ style: e.target.value as ListingStyle })
                }
              >
                {Object.entries(listingStyles).map(([id, name]) => (
                  <option value={id} key={id}>
                    {name}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Фотографии товара
              <input
                aria-label="Фотографии объявления"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(e) => {
                  if (e.target.files) void upload(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                try {
                  const built = buildListing({
                    name: draft.title,
                    category: draft.category,
                    description: draft.sourceDescription,
                    specifications: draft.specifications,
                    condition: draft.condition,
                    price: draft.price,
                    terms: draft.terms,
                    instructions: draft.instructions,
                    style: draft.style,
                  });
                  patch(built);
                  setMessage(
                    "Шаблон собран. Проверьте и отредактируйте текст перед сохранением.",
                  );
                } catch (e) {
                  setMessage(
                    e instanceof Error ? e.message : "Проверьте данные.",
                  );
                }
              }}
            >
              Составить текст по шаблону
            </button>
            <p className="muted">
              Инструкции служат вашей заметкой; локальный шаблон не
              интерпретирует свободные команды.
            </p>
          </section>
          <section className="panel form-panel listing-preview">
            <div className="panel-heading">
              <h2>Предпросмотр и редактирование</h2>
              <span className="status neutral">Черновик · Авито</span>
            </div>
            <label>
              Заголовок объявления
              <input
                maxLength={120}
                value={draft.title}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </label>
            <label>
              Готовое описание
              <textarea
                maxLength={10000}
                rows={12}
                value={draft.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </label>
            <label>
              Подтверждённые преимущества
              <textarea
                maxLength={4000}
                rows={3}
                value={draft.advantages}
                onChange={(e) => patch({ advantages: e.target.value })}
              />
            </label>
            <details className="seller-details">
              <summary>Альтернативный вариант</summary>
              <textarea
                aria-label="Альтернативный текст"
                rows={6}
                maxLength={10000}
                value={draft.alternative}
                onChange={(e) => patch({ alternative: e.target.value })}
              />
            </details>
            <div className="asset-grid">
              {draft.assetIds.map((id) => (
                <div key={id}>
                  <AssetPreview storeId={storeId} id={id} />
                  <button
                    className="text-link"
                    onClick={() =>
                      patch({
                        assetIds: draft.assetIds.filter((a) => a !== id),
                      })
                    }
                  >
                    Убрать из объявления
                  </button>
                </div>
              ))}
            </div>
            <div className="chat-actions">
              <button
                className="button primary"
                disabled={
                  busy || !draft.title.trim() || !draft.description.trim()
                }
                onClick={() => {
                  if (
                    data.listings.length >= 200 &&
                    !data.listings.some((l) => l.id === draft.id)
                  ) {
                    setMessage(
                      "Лимит 200 объявлений. Упорядочьте сохранённые черновики.",
                    );
                    return;
                  }
                  const saved = {
                    ...draft,
                    updatedAt: new Date().toISOString(),
                  };
                  update((d) => ({
                    ...d,
                    listings: d.listings.some((l) => l.id === draft.id)
                      ? d.listings.map((l) => (l.id === draft.id ? saved : l))
                      : [saved, ...d.listings],
                  }));
                  setMessage("Объявление сохранено в этом магазине.");
                  setDraft(null);
                }}
              >
                Сохранить объявление
              </button>
              <button
                className="button secondary"
                onClick={async () =>
                  setMessage(
                    (await copyText(`${draft.title}\n\n${draft.description}`))
                      ? "Текст скопирован."
                      : "Не удалось скопировать. Выделите текст вручную.",
                  )
                }
              >
                <Copy size={16} />
                Копировать
              </button>
              <button className="text-link" onClick={() => setDraft(null)}>
                Закрыть черновик
              </button>
            </div>
          </section>
        </div>
      )}
      {!data.listings.length && !draft ? (
        <div className="panel empty">
          <FileText size={32} />
          <h2>Ваше первое объявление</h2>
          <p>Добавьте факты о товаре, а затем проверьте и сохраните текст.</p>
        </div>
      ) : (
        <div className="listing-saved-grid">
          {data.listings.map((l) => (
            <article className="panel" key={l.id}>
              <span className="status neutral">Сохранённый черновик</span>
              <h2>{l.title}</h2>
              <p>{l.description.slice(0, 220)}</p>
              <div className="chat-actions">
                <button
                  className="button secondary"
                  onClick={() => {
                    setDraft(structuredClone(l));
                    setMessage("");
                  }}
                >
                  Редактировать объявление
                </button>
                <button className="text-link" onClick={() => setRemove(l)}>
                  Удалить
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {remove && (
        <Modal
          title="Удалить черновик объявления?"
          onClose={() => setRemove(null)}
        >
          <p>
            Текст исчезнет из списка. Исходные медиафайлы сохранятся в локальном
            хранилище.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setRemove(null)}
            >
              Отмена
            </button>
            <button
              className="button danger"
              onClick={() => {
                update((d) => ({
                  ...d,
                  listings: d.listings.filter((l) => l.id !== remove.id),
                }));
                setRemove(null);
              }}
            >
              Удалить объявление
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
