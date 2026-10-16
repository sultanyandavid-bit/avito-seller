"use client";
import Select from "../ui/select";
import { useState } from "react";
import { Plus, BookOpen } from "lucide-react";
import type { KnowledgeProduct } from "@/lib/seller/types";
import type { Product } from "@/lib/types";
import { money } from "@/lib/demo";
import Modal from "../modal";
export default function Knowledge({
  products,
  catalog,
  onChange,
}: {
  products: KnowledgeProduct[];
  catalog: Product[];
  onChange: (products: KnowledgeProduct[]) => void;
}) {
  const [edit, setEdit] = useState<KnowledgeProduct | null>(null),
    [remove, setRemove] = useState<KnowledgeProduct | null>(null),
    [source, setSource] = useState("");
  const add = () => {
    const p = catalog.find((p) => p.id === source);
    setEdit({
      id: crypto.randomUUID(),
      name: p?.name ?? "",
      category: p?.category ?? "Другое",
      description: p?.description ?? "",
      specifications: "",
      price: p?.price ?? 0,
      stock: p?.stock ?? 0,
      delivery: "",
      discounts: "",
      instructions: "",
    });
  };
  return (
    <>
      <div className="seller-section-heading">
        <div>
          <h2>Знания о ваших товарах</h2>
          <p>
            Только подтверждённые факты. Неизвестное оставляйте пустым —
            продавец уточнит детали.
          </p>
        </div>
        <button
          className="button primary"
          disabled={products.length >= 100}
          onClick={() => {
            setSource("");
            setEdit({
              id: crypto.randomUUID(),
              name: "",
              category: "Другое",
              description: "",
              specifications: "",
              price: 0,
              stock: 0,
              delivery: "",
              discounts: "",
              instructions: "",
            });
          }}
        >
          <Plus size={16} />
          Добавить в базу
        </button>
      </div>
      <div className="seller-import-catalog">
        <label>
          Взять товар из существующего каталога
          <Select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Выберите товар…</option>
            {catalog.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </label>
        <button
          className="button secondary"
          disabled={!source || products.length >= 100}
          onClick={add}
        >
          Создать карточку знаний
        </button>
        <small>
          Создаётся копия. Изменения каталога не синхронизируются автоматически.
        </small>
      </div>
      <div className="seller-knowledge-grid">
        {products.map((p) => (
          <article className="panel seller-knowledge-card" key={p.id}>
            <div className="panel-heading">
              <span className="seller-book-icon">
                <BookOpen size={22} />
              </span>
              <span className="status active">
                {p.stock ? `${p.stock} шт. в наличии` : "Нет в наличии"}
              </span>
            </div>
            <small>{p.category}</small>
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            <strong className="seller-price">{money(p.price)}</strong>
            <dl>
              <dt>Характеристики</dt>
              <dd>{p.specifications || "Не указаны"}</dd>
              <dt>Доставка</dt>
              <dd>{p.delivery || "Требует уточнения"}</dd>
              <dt>Скидки</dt>
              <dd>{p.discounts || "Требуют уточнения"}</dd>
              <dt>Правила продавца</dt>
              <dd>{p.instructions || "Дополнительных правил нет"}</dd>
            </dl>
            <div className="seller-card-actions">
              <button
                className="button secondary"
                onClick={() => setEdit({ ...p })}
              >
                Редактировать знания
              </button>
              <button className="text-link" onClick={() => setRemove(p)}>
                Удалить
              </button>
            </div>
          </article>
        ))}
      </div>
      {!products.length && (
        <div className="panel empty">
          <BookOpen size={30} />
          <h2>Добавьте первый товар</h2>
          <p>Карточка знаний нужна для запуска сравнения.</p>
        </div>
      )}
      {edit && (
        <KnowledgeEditor
          product={edit}
          onClose={() => setEdit(null)}
          onSave={(p) => {
            onChange(
              products.some((x) => x.id === p.id)
                ? products.map((x) => (x.id === p.id ? p : x))
                : [...products, p],
            );
            setEdit(null);
          }}
        />
      )}
      {remove && (
        <Modal title="Удалить карточку знаний?" onClose={() => setRemove(null)}>
          <p>
            «{remove.name}» исчезнет из базы. Снимки товара в истории тестов
            сохранятся.
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
                onChange(products.filter((p) => p.id !== remove.id));
                setRemove(null);
              }}
            >
              Удалить карточку
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function KnowledgeEditor({
  product,
  onSave,
  onClose,
}: {
  product: KnowledgeProduct;
  onSave: (p: KnowledgeProduct) => void;
  onClose: () => void;
}) {
  const [p, setP] = useState(product);
  const patch = (x: Partial<KnowledgeProduct>) => setP((v) => ({ ...v, ...x }));
  return (
    <Modal
      title={product.name ? "Карточка знаний" : "Новая карточка знаний"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (p.name.trim() && p.category.trim() && p.description.trim())
            onSave({
              ...p,
              name: p.name.trim(),
              category: p.category.trim(),
              description: p.description.trim(),
            });
        }}
      >
        <label>
          Название товара
          <input
            required
            maxLength={120}
            value={p.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </label>
        <label>
          Категория
          <input
            required
            maxLength={100}
            value={p.category}
            onChange={(e) => patch({ category: e.target.value })}
          />
        </label>
        <label>
          Описание
          <textarea
            required
            maxLength={2000}
            rows={3}
            value={p.description}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </label>
        <label>
          Характеристики
          <textarea
            maxLength={2500}
            rows={3}
            placeholder="Укажите только подтверждённые характеристики"
            value={p.specifications}
            onChange={(e) => patch({ specifications: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            Цена, ₽
            <input
              type="number"
              required
              min="0"
              max="1000000000"
              step="0.01"
              value={p.price}
              onChange={(e) => patch({ price: Number(e.target.value) })}
            />
          </label>
          <label>
            Наличие, шт.
            <input
              type="number"
              required
              min="0"
              max="1000000"
              step="1"
              value={p.stock}
              onChange={(e) => patch({ stock: Number(e.target.value) })}
            />
          </label>
        </div>
        <label>
          Условия доставки
          <textarea
            maxLength={1500}
            rows={2}
            value={p.delivery}
            onChange={(e) => patch({ delivery: e.target.value })}
          />
        </label>
        <label>
          Допустимые скидки
          <textarea
            maxLength={1500}
            rows={2}
            value={p.discounts}
            onChange={(e) => patch({ discounts: e.target.value })}
          />
        </label>
        <label>
          Инструкции продавца
          <textarea
            maxLength={2000}
            rows={3}
            value={p.instructions}
            onChange={(e) => patch({ instructions: e.target.value })}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="button primary" type="submit">
            Сохранить знания
          </button>
        </div>
      </form>
    </Modal>
  );
}
