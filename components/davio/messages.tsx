"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Send, Sparkles, Copy, ArrowUpRight, Download } from "lucide-react";
import { api, post } from "@/lib/davio/client";
import type { ChatEntry, ChatMode, Project } from "@/lib/davio/types";
import { copyText } from "@/lib/client/clipboard";
import { downloadJson } from "@/lib/client/download";
const modes = [
  { id: "seller", label: "Продавец", hint: "Подготовить ответ покупателю" },
  { id: "assistant", label: "Помощник", hint: "Разобраться с контентом" },
  { id: "learn", label: "Обучение", hint: "Первые шаги в продажах" },
] as const;
export default function DavioMessages() {
  const [mode, setMode] = useState<ChatMode>("seller"),
    [entries, setEntries] = useState<ChatEntry[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [projectId, setProjectId] = useState(""),
    [question, setQuestion] = useState(""),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    Promise.all([api<ChatEntry[]>("chat"), api<Project[]>("projects")])
      .then(([history, items]) => {
        setEntries(history);
        setProjects(items.filter((p) => !p.archived));
        setReady(true);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [entries.length, mode]);
  return (
    <>
      <div className="dv-page-heading">
        <div>
          <span className="dv-eyebrow">ВАШ ПОМОЩНИК ПО ПРОДАЖАМ</span>
          <h1>Сообщения</h1>
          <p>Один диалоговый инструмент — три способа помочь вашему делу.</p>
        </div>
        <button
          className="dv-button"
          disabled={!entries.length}
          onClick={() => downloadJson("davio-chat.json", entries)}
        >
          <Download size={16} />
          Экспорт истории
        </button>
      </div>
      <section className="dv-card dv-chat">
        <div className="dv-tabs" aria-label="Режим сообщений">
          {modes.map((m) => (
            <button
              className={mode === m.id ? "active" : ""}
              aria-pressed={mode === m.id}
              key={m.id}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="dv-chat-context">
          <label>
            Контекст товара
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">Без проекта</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.data.title || "Новый товар"}
                </option>
              ))}
            </select>
          </label>
          <span className="dv-tag">Демоалгоритм · без AI API</span>
        </div>
        <p className="dv-chat-disclaimer">
          Локальные подсказки, а не ответы нейросети. Покупателям ничего не
          отправляется. Авито не подключено.
        </p>
        {error && (
          <div className="dv-alert" role="alert">
            {error}
          </div>
        )}
        <div
          className="dv-chat-thread"
          role="log"
          aria-label="История сообщений"
          aria-live="polite"
        >
          {!entries.filter((e) => e.mode === mode).length && (
            <div className="dv-empty">
              <Sparkles size={32} />
              <h2>{modes.find((m) => m.id === mode)?.hint}</h2>
              <p>
                Вставьте сообщение покупателя или задайте вопрос.
                <br />
                История сохраняется в вашем аккаунте.
              </p>
            </div>
          )}
          {entries
            .filter((e) => e.mode === mode)
            .map((e) => (
              <div className="dv-exchange" key={e.id}>
                <div className="dv-bubble question">
                  <small>Вы</small>
                  <p>{e.question}</p>
                </div>
                <div className="dv-bubble answer">
                  <small>
                    <Sparkles size={13} />
                    DAVIO · ДЕМО
                  </small>
                  <p>{e.answer}</p>
                  <button
                    className="dv-link"
                    onClick={async () =>
                      setStatus(
                        (await copyText(e.answer))
                          ? "Ответ скопирован. Проверьте и отправьте вручную."
                          : "Не удалось скопировать. Выделите текст вручную.",
                      )
                    }
                  >
                    <Copy size={14} />
                    Копировать черновик
                  </button>
                </div>
              </div>
            ))}
          <div ref={bottom} />
        </div>
        <form
          className="dv-chat-composer"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!question.trim() || busy) return;
            setBusy(true);
            setError("");
            try {
              const entry = await post<ChatEntry>("chat", {
                mode,
                question,
                projectId: projectId || null,
              });
              setEntries((v) => [...v, entry]);
              setQuestion("");
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "Не удалось подготовить ответ.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="dv-sr-only" htmlFor="davio-question">
            Ваше сообщение
          </label>
          <textarea
            id="davio-question"
            placeholder={
              mode === "seller"
                ? "Вставьте сообщение покупателя…"
                : "Чем помочь?"
            }
            rows={2}
            maxLength={4000}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button
            className="dv-button primary"
            disabled={!ready || busy || !question.trim()}
          >
            <Send size={17} />
            <span>{busy ? "Подождите…" : "Подготовить ответ"}</span>
          </button>
        </form>
        {status && (
          <p className="dv-status" role="status">
            {status}
          </p>
        )}
      </section>
      <details className="dv-details dv-legacy-tools">
        <summary>Лаборатория и прежние локальные инструменты</summary>
        <p>
          Дополнительные инструменты хранят свои прежние данные в браузере,
          отдельно от аккаунта DAVIO.
        </p>
        <div className="dv-actions">
          <Link href="/seller" className="dv-button">
            Сравнение моделей <ArrowUpRight size={15} />
          </Link>
          <Link href="/learning" className="dv-button">
            Примеры ответов
          </Link>
          <Link href="/legacy/messages" className="dv-button">
            Демопереписки
          </Link>
          <Link href="/assistant" className="dv-button">
            Прежняя история ассистента
          </Link>
        </div>
      </details>
    </>
  );
}
