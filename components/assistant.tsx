"use client";
import { useState } from "react";
import { ShieldCheck, Sparkles, UserRound, Check } from "lucide-react";
import type { Store } from "@/lib/types";
import { demoAssistant, type Reply } from "@/lib/assistant";
import Heading from "./heading";
export default function Assistant({
  store,
  update,
}: {
  store: Store;
  update: (s: Partial<Store>) => void;
}) {
  const [question, setQuestion] = useState(
      "Здравствуйте! Товар есть в наличии?",
    ),
    [productId, setProductId] = useState(store.products[0]?.id ?? ""),
    [reply, setReply] = useState<Reply | null>(null);
  const ai = store.ai;
  return (
    <>
      <Heading
        eyebrow="ИНТЕЛЛЕКТУАЛЬНЫЙ ПРОДАВЕЦ"
        title="AI-ассистент"
        description="Настройте помощника и проверьте ответы до начала работы."
      />
      <div className="notice">
        <ShieldCheck size={20} />
        <div>
          <strong>Вы управляете каждым ответом</strong>
          <p>
            Демонстрационный алгоритм работает без AI-модели. Ответы не
            отправляются автоматически. Инструкции сохраняются для будущего
            провайдера и пока не влияют на алгоритм.
          </p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel form-panel">
          <div className="switch-row">
            <div>
              <h2>Демонстрационные автоответы</h2>
              <p>Включает подсказки в разделе сообщений</p>
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
            <select
              value={ai.style}
              onChange={(e) =>
                update({
                  ai: { ...ai, style: e.target.value as typeof ai.style },
                })
              }
            >
              <option value="friendly">Дружелюбный</option>
              <option value="business">Деловой</option>
              <option value="brief">Краткий</option>
            </select>
          </label>
          <label>
            Инструкции для будущей AI-модели
            <textarea
              rows={6}
              value={ai.instructions}
              maxLength={5000}
              onChange={(e) =>
                update({ ai: { ...ai, instructions: e.target.value } })
              }
            />
          </label>
          <div className="safety-box">
            <UserRound size={19} />
            <div>
              <strong>Сложные вопросы — человеку</strong>
              <p>
                Скидки, оплата, доставка, возвраты и неизвестные факты требуют
                участия продавца.
              </p>
            </div>
          </div>
          <span className="saved">
            <Check size={15} /> Настройки сохраняются в браузере
          </span>
        </section>
        <section className="panel form-panel">
          <div className="panel-heading">
            <h2>Попробуйте диалог</h2>
            <Sparkles size={20} />
          </div>
          <label>
            Товар
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setReply(null);
              }}
            >
              {store.products.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
              {!store.products.length && <option value="">Нет товаров</option>}
            </select>
          </label>
          <label>
            Вопрос покупателя
            <textarea
              rows={3}
              value={question}
              maxLength={1000}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>
          <button
            className="button primary"
            disabled={!question.trim()}
            onClick={async () =>
              setReply(
                await demoAssistant.preview(
                  question,
                  store.products.find((p) => p.id === productId),
                  ai,
                ),
              )
            }
          >
            <Sparkles size={17} /> Предпросмотр ответа
          </button>
          {reply && (
            <div className="ai-response" aria-live="polite">
              <span className="mini-label">
                ДЕМО •{" "}
                {reply.handoff ? "ПЕРЕДАЧА ПРОДАВЦУ" : "ПРЕДЛОЖЕННЫЙ ОТВЕТ"}
              </span>
              <p>{reply.text}</p>
            </div>
          )}
          <p className="muted">
            Предпросмотр доступен даже при выключенных подсказках. Ничего не
            отправляется покупателям.
          </p>
        </section>
      </div>
    </>
  );
}
