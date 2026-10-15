"use client";
import { useState } from "react";
import { Plus, Search, Package, X } from "lucide-react";
import type { Store, Product } from "@/lib/types";
import { money } from "@/lib/demo";
import ProductArt from "./product-art";
import Heading from "./heading";
import Modal from "./modal";
const statusLabel = {
  active: "Активно",
  draft: "Черновик",
  archived: "В архиве",
};
export default function Products({
  store,
  update,
}: {
  store: Store;
  update: (s: Partial<Store>) => void;
}) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [editing, setEditing] = useState<Product | null>(null),
    [deleting, setDeleting] = useState<Product | null>(null);
  const visible = store.products.filter(
    (p) =>
      (filter === "all" || p.status === filter) &&
      (p.name + " " + p.category).toLowerCase().includes(query.toLowerCase()),
  );
  const add = () =>
    setEditing({
      id: crypto.randomUUID(),
      name: "",
      description: "",
      price: 0,
      category: "Другое",
      stock: 1,
      status: "draft",
      visual: "box",
    });
  return (
    <>
      <Heading
        eyebrow="КАТАЛОГ МАГАЗИНА"
        title="Товары"
        description="Актуальные цены, наличие и объявления в одном месте."
      >
        <button className="button primary" onClick={add}>
          <Plus size={17} /> Добавить товар
        </button>
      </Heading>
      <div className="toolbar">
        <div className="tabs">
          {[
            ["all", "Все товары"],
            ["active", "Активные"],
            ["draft", "Черновики"],
            ["archived", "Архив"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={filter === id ? "selected" : ""}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Поиск товаров"
            placeholder="Найти товар…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="product-grid">
        {visible.map((p) => (
          <article className="product-card" key={p.id}>
            <div className="product-image">
              <ProductArt kind={p.visual} />
              <span className={`status ${p.status}`}>
                {statusLabel[p.status]}
              </span>
            </div>
            <div className="product-content">
              <small>{p.category}</small>
              <h2>{p.name}</h2>
              <p>{p.description}</p>
              <div className="product-price">
                <strong>{money(p.price)}</strong>
                <span className={p.stock ? "stock" : "no-stock"}>
                  {p.stock ? `${p.stock} шт. в наличии` : "Нет в наличии"}
                </span>
              </div>
              <div className="product-actions">
                <button
                  className="button secondary"
                  onClick={() => setEditing({ ...p })}
                >
                  Редактировать
                </button>
                <button
                  className="icon-button"
                  aria-label={`Удалить ${p.name}`}
                  onClick={() => setDeleting(p)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!visible.length && (
        <div className="panel empty">
          <Package size={32} />
          <h2>Товаров пока нет</h2>
          <p>Измените поиск или добавьте первый товар.</p>
          <button className="button primary" onClick={add}>
            Добавить товар
          </button>
        </div>
      )}
      {editing && (
        <ProductEditor
          product={editing}
          onClose={() => setEditing(null)}
          onSave={(p) => {
            update({
              products: store.products.some((x) => x.id === p.id)
                ? store.products.map((x) => (x.id === p.id ? p : x))
                : [...store.products, p],
            });
            setEditing(null);
          }}
        />
      )}
      {deleting && (
        <Modal title="Удалить товар?" onClose={() => setDeleting(null)}>
          <p>
            «{deleting.name}» будет удалён из демокаталога. Переписки
            сохранятся.
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
                update({
                  products: store.products.filter((p) => p.id !== deleting.id),
                });
                setDeleting(null);
              }}
            >
              Удалить товар
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function ProductEditor({
  product,
  onClose,
  onSave,
}: {
  product: Product;
  onClose: () => void;
  onSave: (p: Product) => void;
}) {
  const [p, setP] = useState(product);
  const patch = (s: Partial<Product>) => setP((v) => ({ ...v, ...s }));
  return (
    <Modal
      title={product.name ? "Редактировать товар" : "Новый товар"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (p.name.trim() && p.description.trim() && p.category.trim())
            onSave({
              ...p,
              name: p.name.trim(),
              description: p.description.trim(),
              category: p.category.trim(),
            });
        }}
      >
        <label>
          Название
          <input
            required
            maxLength={100}
            value={p.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </label>
        <label>
          Описание
          <textarea
            required
            rows={3}
            maxLength={2000}
            value={p.description}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            Цена, ₽
            <input
              required
              type="number"
              min="0"
              max="999999999"
              step="0.01"
              value={p.price}
              onChange={(e) => patch({ price: Number(e.target.value) })}
            />
          </label>
          <label>
            Наличие, шт.
            <input
              required
              type="number"
              min="0"
              max="999999"
              step="1"
              value={p.stock}
              onChange={(e) => patch({ stock: Number(e.target.value) })}
            />
          </label>
        </div>
        <label>
          Категория
          <input
            required
            maxLength={80}
            value={p.category}
            onChange={(e) => patch({ category: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            Статус
            <select
              value={p.status}
              onChange={(e) =>
                patch({ status: e.target.value as Product["status"] })
              }
            >
              <option value="active">Активно</option>
              <option value="draft">Черновик</option>
              <option value="archived">В архиве</option>
            </select>
          </label>
          <label>
            Иллюстрация
            <select
              value={p.visual}
              onChange={(e) =>
                patch({ visual: e.target.value as Product["visual"] })
              }
            >
              <option value="box">Заглушка</option>
              <option value="phone">Смартфон</option>
              <option value="laptop">Ноутбук</option>
              <option value="headphones">Наушники</option>
              <option value="camera">Камера</option>
            </select>
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Отмена
          </button>
          <button className="button primary" type="submit">
            Сохранить товар
          </button>
        </div>
      </form>
    </Modal>
  );
}
