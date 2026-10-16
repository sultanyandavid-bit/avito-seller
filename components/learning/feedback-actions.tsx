"use client";
import { useState } from "react";
import { Check, GraduationCap, ThumbsDown } from "lucide-react";
import { useLearning } from "./provider";
import ExampleEditor from "./editor";
import type { ExampleInput, FeedbackStatus } from "@/lib/learning/types";
export default function FeedbackActions({
  product,
  question,
  original,
  corrected,
}: {
  product: { id: string; name: string };
  question: string;
  original: string;
  corrected?: string;
}) {
  const { data, save, ready, error } = useLearning();
  const [edit, setEdit] = useState(false),
    [message, setMessage] = useState("");
  const existing = data.examples.find(
    (e) =>
      e.productId === product.id &&
      e.question === question &&
      e.originalReply === original,
  );
  const value: ExampleInput = existing ?? {
    productId: product.id,
    productName: product.name,
    question,
    originalReply: original,
    correctedReply: corrected ?? original,
    status: "approved",
    comment: "",
  };
  function mark(status: FeedbackStatus) {
    try {
      save(
        {
          ...value,
          status,
          correctedReply:
            status === "approved"
              ? (corrected ?? existing?.correctedReply ?? original)
              : value.correctedReply,
        },
        existing?.id,
      );
      setMessage(
        status === "approved"
          ? "Одобренный пример сохранён в AI-ученике."
          : "Ответ отмечен как неудачный и исключён из поиска.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Не удалось сохранить оценку.",
      );
    }
  }
  return (
    <div className="feedback-actions">
      <div className="chat-actions">
        <button
          className="text-link"
          disabled={
            !ready ||
            (existing?.status === "approved" &&
              existing.correctedReply === (corrected ?? original))
          }
          onClick={() => mark("approved")}
        >
          <Check size={15} />
          {existing?.status === "approved" ? "Одобрено" : "Одобрить ответ"}
        </button>
        <button
          className="text-link"
          disabled={!ready}
          onClick={() => setEdit(true)}
        >
          <GraduationCap size={16} />
          Исправить и обучить
        </button>
        <button
          className="text-link"
          disabled={!ready || existing?.status === "rejected"}
          onClick={() => mark("rejected")}
        >
          <ThumbsDown size={15} />
          Неудачный ответ
        </button>
      </div>
      {(message || error) && (
        <p role="status" className="feedback-status">
          {message || error}
        </p>
      )}
      {edit && (
        <ExampleEditor
          initial={
            existing ?? {
              ...value,
              correctedReply: corrected ?? value.correctedReply,
            }
          }
          products={[product]}
          onClose={() => setEdit(false)}
          onSaved={() => setMessage("Обучающий пример сохранён.")}
        />
      )}
    </div>
  );
}
