"use client";
import { useState } from "react";
import { Search, UserRound, Sparkles, Send } from "lucide-react";
import type { Store } from "@/lib/types";
import { money } from "@/lib/demo";
import { demoAssistant, type Reply } from "@/lib/assistant";
import Heading from "./heading";
import ProductArt from "./product-art";
export default function Messages({
  store,
  update,
}: {
  store: Store;
  update: (s: Partial<Store>) => void;
}) {
  const [selected, setSelected] = useState(store.conversations[0]?.id),
    [draft, setDraft] = useState(""),
    [query, setQuery] = useState(""),
    [preview, setPreview] = useState<Reply | null>(null);
  const c = store.conversations.find((c) => c.id === selected),
    p = store.products.find((p) => p.id === c?.productId);
  const change = (patch: Partial<NonNullable<typeof c>>) => {
    if (c)
      update({
        conversations: store.conversations.map((x) =>
          x.id === c.id ? { ...x, ...patch } : x,
        ),
      });
  };
  const send = () => {
    if (!c || !draft.trim()) return;
    change({
      unread: 0,
      messages: [
        ...c.messages,
        {
          id: crypto.randomUUID(),
          role: "seller",
          text: draft.trim(),
          time: new Date().toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Moscow",
          }),
        },
      ],
    });
    setDraft("");
    setPreview(null);
  };
  return (
    <>
      <Heading
        eyebrow="ОБЩЕНИЕ С ПОКУПАТЕЛЯМИ"
        title="Сообщения"
        description="Демонстрационные диалоги. Ответы сохраняются только в этом браузере."
      />
      <div className="messenger panel">
        <div className="dialog-list">
          <label className="search">
            <Search size={16} />
            <input
              placeholder="Поиск диалога…"
              aria-label="Поиск диалога"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {store.conversations
            .filter((x) => x.name.toLowerCase().includes(query.toLowerCase()))
            .map((x, i) => (
              <button
                key={x.id}
                className={`dialog-item ${selected === x.id ? "selected" : ""}`}
                onClick={() => {
                  setSelected(x.id);
                  setDraft("");
                  setPreview(null);
                  update({
                    conversations: store.conversations.map((t) =>
                      t.id === x.id ? { ...t, unread: 0 } : t,
                    ),
                  });
                }}
              >
                <span className={`avatar avatar-${i}`}>{x.name[0]}</span>
                <div>
                  <strong>{x.name}</strong>
                  <p>{x.messages.at(-1)?.text}</p>
                  <small>{x.human ? "Ожидает продавца" : "Демодиалог"}</small>
                </div>
                {x.unread > 0 && <b className="count">{x.unread}</b>}
              </button>
            ))}
        </div>
        {c ? (
          <div className="chat">
            <div className="chat-heading">
              <div>
                <h2>{c.name}</h2>
                <small>
                  {c.human
                    ? "Диалог передан продавцу"
                    : "Демонстрационный покупатель"}
                </small>
              </div>
              <button
                className="button secondary"
                onClick={() => change({ human: !c.human })}
              >
                <UserRound size={16} />
                {c.human ? "Снять передачу" : "Передать человеку"}
              </button>
            </div>
            <div className="chat-product">
              {p ? (
                <>
                  <ProductArt kind={p.visual} small />
                  <div>
                    <strong>{p.name}</strong>
                    <small>
                      {money(p.price)} · {p.stock} шт.
                    </small>
                  </div>
                </>
              ) : (
                <p>Товар удалён из каталога. Переписка сохранена.</p>
              )}
            </div>
            <div className="chat-messages">
              <div className="chat-date">Демонстрационная переписка</div>
              {c.messages.map((m) => (
                <div key={m.id} className={`bubble ${m.role}`}>
                  <small>{m.role === "seller" ? "Вы" : c.name}</small>
                  <p>{m.text}</p>
                  <time>{m.time}</time>
                </div>
              ))}
            </div>
            <div className="composer">
              {preview && (
                <div className="reply-preview">
                  <strong>
                    Предпросмотр ·{" "}
                    {preview.handoff ? "Нужно участие продавца" : "Демоответ"}
                  </strong>
                  <p>{preview.text}</p>
                  <button
                    className="text-link"
                    onClick={() => {
                      setDraft(preview.text);
                      if (preview.handoff) change({ human: true });
                      setPreview(null);
                    }}
                  >
                    Вставить в поле ответа
                  </button>
                </div>
              )}
              <div className="composer-tools">
                <button
                  className="text-link"
                  disabled={!store.ai.enabled || c.human}
                  onClick={async () => {
                    const r = await demoAssistant.preview(
                      c.messages.filter((m) => m.role === "buyer").at(-1)
                        ?.text ?? "",
                      p,
                      store.ai,
                    );
                    setPreview(r);
                  }}
                >
                  <Sparkles size={16} /> Предложить ответ
                </button>
                <small>
                  {c.human
                    ? "Отвечает продавец"
                    : store.ai.enabled
                      ? "Деморежим: отправка вручную"
                      : "Включите демоответы в AI-ассистенте"}
                </small>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <textarea
                  aria-label="Текст ответа"
                  placeholder="Напишите ответ покупателю…"
                  value={draft}
                  maxLength={4000}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                />
                <button
                  className="button primary"
                  disabled={!draft.trim()}
                  type="submit"
                  aria-label="Отправить демоответ"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>
        ) : (
          <p className="empty">Выберите диалог</p>
        )}
      </div>
    </>
  );
}
