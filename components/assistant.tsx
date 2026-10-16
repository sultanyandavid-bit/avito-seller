"use client";
import { useEffect, useRef, useState } from "react";
import {
  ShieldCheck,
  Sparkles,
  UserRound,
  Check,
  Copy,
  Pencil,
  MessagesSquare,
} from "lucide-react";
import type { Store } from "@/lib/types";
import { demoAssistant } from "@/lib/assistant";
import { chatSeed, parseChatData, type ChatDraft } from "@/lib/learning/chat";
import { usePersistentState } from "@/lib/client/use-persistent-state";
import { copyText } from "@/lib/client/clipboard";
import Select from "./ui/select";
import Heading from "./heading";
export default function Assistant({
  store,
  update,
  storeId = "local-main",
}: {
  store: Store;
  update: (s: Partial<Store>) => void;
  storeId?: string;
}) {
  const [question, setQuestion] = useState(
      "Здравствуйте! Товар есть в наличии?",
    ),
    [productId, setProductId] = useState(store.products[0]?.id ?? ""),
    [editing, setEditing] = useState<string | null>(null),
    [editText, setEditText] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const {
    data,
    update: save,
    ready,
    error,
  } = usePersistentState(
    `sellerai:assistant:v1:${storeId}`,
    chatSeed,
    parseChatData,
  );
  const bottom = useRef<HTMLDivElement>(null);
  const ai = store.ai;
  const drafts = data.drafts.filter((d) => d.productId === productId);
  useEffect(() => {
    bottom.current?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [drafts.length]);
  async function generate() {
    if (!question.trim() || busy || !ready) return;
    setBusy(true);
    setStatus("");
    try {
      const p = store.products.find((p) => p.id === productId);
      const r = await demoAssistant.preview(question, p, ai);
      const d: ChatDraft = {
        id: crypto.randomUUID(),
        productId,
        question: question.trim(),
        original: r.text,
        edited: null,
        handoff: r.handoff,
        createdAt: new Date().toISOString(),
      };
      save((v) => ({ ...v, drafts: [...v.drafts, d].slice(-200) }));
      setQuestion("");
    } catch {
      setStatus("Не удалось подготовить ответ. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="ПОМОЩНИК ПРОДАВЦА"
        title="AI-ассистент"
        description="Проверьте ответ в чате, отредактируйте и решите, что использовать."
      />
      <div className="notice">
        <ShieldCheck size={20} />
        <div>
          <strong>Вы управляете каждым ответом</strong>
          <p>
            Локальный демоалгоритм. Сообщения покупателям не отправляются;
            произвольные инструкции сохраняются для будущей модели.
          </p>
        </div>
      </div>
      {error && (
        <div role="alert" className="notice seller-error">
          {error}
        </div>
      )}
      <div className="assistant-layout">
        <section className="panel form-panel assistant-settings">
          <div className="switch-row">
            <div>
              <h2>Подсказки в сообщениях</h2>
              <p>Только предпросмотр с ручным подтверждением</p>
            </div>
            <button
              className={`switch ${ai.enabled ? "on" : ""}`}
              role="switch"
              aria-checked={ai.enabled}
              aria-label="Демонстрационные автоответы"
              onClick={() => update({ ai: { ...ai, enabled: !ai.enabled } })}
            >
              <span />
            </button>
          </div>
          <label>
            Стиль общения
            <Select
              aria-label="Стиль общения"
              value={ai.style}
              onChange={(e) =>
                update({
                  ai: { ...ai, style: e.target.value as typeof ai.style },
                })
              }
            >
              <option value="friendly">Дружелюбный</option>
              <option value="business">Профессиональный</option>
              <option value="brief">Краткий</option>
              <option value="expert">Экспертный</option>
              <option value="consultative">Консультативный</option>
            </Select>
          </label>
          <label>
            Инструкции для будущей AI-модели
            <textarea
              rows={5}
              maxLength={5000}
              value={ai.instructions}
              onChange={(e) =>
                update({ ai: { ...ai, instructions: e.target.value } })
              }
            />
          </label>
          <div className="safety-box">
            <UserRound size={20} />
            <div>
              <strong>Сложные вопросы — человеку</strong>
              <p>
                Скидки, доставка, возвраты и неизвестные характеристики требуют
                уточнения.
              </p>
            </div>
          </div>
          <span className="saved">
            <Check size={16} />
            Настройки сохраняются в браузере
          </span>
        </section>
        <section className="panel assistant-chat">
          <div className="chat-heading">
            <div>
              <h2>Тестовый диалог</h2>
              <small>Демо · ответы не отправляются</small>
            </div>
            <MessagesSquare size={22} />
          </div>
          <div className="assistant-product">
            <label>
              Товар
              <Select
                aria-label="Товар"
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  setEditing(null);
                  setStatus("");
                }}
              >
                {store.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                {!store.products.length && (
                  <option value="">Товаров пока нет</option>
                )}
              </Select>
            </label>
          </div>
          <div
            className="assistant-thread"
            role="log"
            aria-label="История тестового диалога"
            aria-live="polite"
          >
            {!drafts.length && (
              <div className="chat-welcome">
                <Sparkles size={28} />
                <h3>Давайте начнём с вопроса</h3>
                <p>
                  Уточните наличие, комплектацию или цену. История сохраняется
                  отдельно для каждого товара.
                </p>
              </div>
            )}
            {drafts.map((d) => (
              <div className="assistant-exchange" key={d.id}>
                <div className="bubble buyer">
                  <small>Покупатель</small>
                  <p>{d.question}</p>
                </div>
                <div className="bubble ai-response">
                  <small>
                    <Sparkles size={14} />
                    ДЕМО •{" "}
                    {d.handoff ? "ПЕРЕДАЧА ПРОДАВЦУ" : "ПРЕДЛОЖЕННЫЙ ОТВЕТ"}
                  </small>
                  <p>{d.original}</p>
                  <div className="chat-actions">
                    <button
                      className="text-link"
                      onClick={async () =>
                        setStatus(
                          (await copyText(d.edited ?? d.original))
                            ? "Ответ скопирован"
                            : "Не удалось скопировать. Выделите текст вручную.",
                        )
                      }
                    >
                      <Copy size={15} />
                      Копировать
                    </button>
                    <button
                      className="text-link"
                      onClick={() => {
                        setEditing(d.id);
                        setEditText(d.edited ?? d.original);
                      }}
                    >
                      <Pencil size={15} />
                      Редактировать ответ
                    </button>
                  </div>
                </div>
                {d.edited && editing !== d.id && (
                  <div className="bubble seller">
                    <small>Ваш вариант · не отправлен</small>
                    <p>{d.edited}</p>
                  </div>
                )}
                {editing === d.id && (
                  <form
                    className="chat-edit"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (editText.trim()) {
                        save((v) => ({
                          ...v,
                          drafts: v.drafts.map((t) =>
                            t.id === d.id
                              ? { ...t, edited: editText.trim() }
                              : t,
                          ),
                        }));
                        setEditing(null);
                        setStatus("Ваш вариант сохранён в диалоге");
                      }
                    }}
                  >
                    <label>
                      Ваш вариант ответа
                      <textarea
                        rows={4}
                        required
                        maxLength={8000}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                      />
                    </label>
                    <div className="chat-actions">
                      <button type="submit" className="button primary">
                        Сохранить вариант
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => setEditing(null)}
                      >
                        Отмена
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))}
            <div ref={bottom} />
          </div>
          <form
            className="assistant-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void generate();
            }}
          >
            <label>
              Вопрос покупателя
              <textarea
                rows={2}
                maxLength={4000}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Что спрашивает покупатель?"
              />
            </label>
            <button
              className="button primary"
              disabled={!ready || busy || !question.trim()}
            >
              <Sparkles size={17} />
              {busy ? "Готовим ответ…" : "Предпросмотр ответа"}
            </button>
            <small>
              Демо работает без внешних API. Покупателям ничего не отправляется.
            </small>
          </form>
          <p className="action-status" role="status">
            {status}
          </p>
        </section>
      </div>
    </>
  );
}
