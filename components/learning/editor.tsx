"use client";
import { useState } from "react";
import Modal from "../modal";
import Select from "../ui/select";
import {
  feedbackLabels,
  type ExampleInput,
  type TrainingExample,
} from "@/lib/learning/types";
import { useLearning } from "./provider";
export type LearningProduct = { id: string; name: string };
export default function ExampleEditor({
  initial,
  products,
  onClose,
  onSaved,
}: {
  initial?: ExampleInput | TrainingExample;
  products: LearningProduct[];
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { save, ready } = useLearning();
  const [value, setValue] = useState<ExampleInput>(
      initial ?? {
        productId: products[0]?.id ?? "",
        productName: products[0]?.name ?? "",
        question: "",
        originalReply: "",
        correctedReply: "",
        status: "approved",
        comment: "",
      },
    ),
    [error, setError] = useState("");
  const id = initial && "id" in initial ? initial.id : undefined;
  const patch = (x: Partial<ExampleInput>) => setValue((v) => ({ ...v, ...x }));
  return (
    <Modal
      title={id ? "Изменить обучающий пример" : "Сохранить обучающий пример"}
      onClose={onClose}
    >
      <p>
        Одобряйте только проверенные ответы. Сохранение примера не переобучает
        модель и ничего не отправляет покупателю.
      </p>
      {error && (
        <div className="notice seller-error" role="alert">
          {error}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            save(value, id);
            onSaved?.();
            onClose();
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Не удалось сохранить пример.",
            );
          }
        }}
      >
        {initial ? (
          <div className="example-product">
            <small>Товар</small>
            <strong>{value.productName}</strong>
          </div>
        ) : (
          <label>
            Товар примера
            <Select
              aria-label="Товар примера"
              required
              value={value.productId}
              onChange={(e) =>
                patch({
                  productId: e.target.value,
                  productName:
                    products.find((p) => p.id === e.target.value)?.name ?? "",
                })
              }
            >
              {!products.length && (
                <option value="">Сначала добавьте товар</option>
              )}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </label>
        )}
        <label>
          Вопрос покупателя
          <input
            required
            readOnly={!!id}
            maxLength={4000}
            value={value.question}
            onChange={(e) => patch({ question: e.target.value })}
          />
        </label>
        <label>
          Первоначальный ответ
          <textarea
            rows={3}
            maxLength={8000}
            readOnly={!!id || !!initial}
            value={value.originalReply}
            onChange={(e) => patch({ originalReply: e.target.value })}
          />
        </label>
        <label>
          Исправленный или собственный ответ
          <textarea
            rows={5}
            required={value.status === "approved"}
            maxLength={8000}
            value={value.correctedReply}
            onChange={(e) => patch({ correctedReply: e.target.value })}
          />
        </label>
        <label>
          Статус примера
          <Select
            aria-label="Статус примера"
            value={value.status}
            onChange={(e) =>
              patch({ status: e.target.value as ExampleInput["status"] })
            }
          >
            {Object.entries(feedbackLabels).map(([id, label]) => (
              <option value={id} key={id}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label>
          Пояснение для AI
          <textarea
            maxLength={2000}
            rows={3}
            value={value.comment}
            onChange={(e) => patch({ comment: e.target.value })}
            placeholder="Что стоит учитывать в похожих вопросах?"
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Отмена
          </button>
          <button
            type="submit"
            disabled={!ready || !value.productId}
            className="button primary"
          >
            Сохранить пример
          </button>
        </div>
      </form>
    </Modal>
  );
}
