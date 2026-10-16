"use client";
import Select from "../ui/select";
import { useState } from "react";
import { Play, Upload, Plus, Sparkles, Check } from "lucide-react";
import type {
  CompareInput,
  ModelOption,
  Scenario,
  SellerData,
  Turn,
} from "@/lib/seller/types";
import { providerLabels } from "@/lib/seller/types";
import { importConversation } from "@/lib/seller/validation";
import Modal from "../modal";
export type ProviderStatus = {
  id: "yandex" | "deepseek" | "qwen" | "gigachat";
  label: string;
  docs: string;
  configured: boolean;
};
export default function Testing({
  data,
  models,
  providers,
  catalogReady,
  busy,
  onRun,
  onScenario,
  onError,
}: {
  data: SellerData;
  models: ModelOption[];
  providers: ProviderStatus[];
  catalogReady: boolean;
  busy: boolean;
  onRun: (input: CompareInput, token: string) => void;
  onScenario: (s: Scenario) => void;
  onError: (s: string) => void;
}) {
  const [productId, setProductId] = useState(data.products[0]?.id ?? ""),
    [question, setQuestion] = useState(data.scenarios[0]?.question ?? ""),
    [scenarioId, setScenarioId] = useState(""),
    [context, setContext] = useState<Turn[]>([]),
    [mode, setMode] = useState<"demo" | "real">("demo"),
    [keys, setKeys] = useState(["demo:short", "demo:consult"]),
    [token, setToken] = useState(""),
    [save, setSave] = useState(false),
    [name, setName] = useState("");
  const p = data.products.find((p) => p.id === productId) ?? data.products[0];
  const selected = models.filter(
    (m) => keys.includes(m.key) && m.available && m.demo === (mode === "demo"),
  );
  const canRun =
    !!p &&
    question.trim().length > 0 &&
    selected.length > 0 &&
    catalogReady &&
    !busy &&
    (mode === "demo" || token.length >= 32);
  const load = (id: string) => {
    const scenario = data.scenarios.find((s) => s.id === id);
    setScenarioId(id);
    if (scenario) {
      setQuestion(scenario.question);
      setContext(structuredClone(scenario.context));
    }
  };
  async function upload(file: File) {
    try {
      if (file.size > 100000)
        throw new Error("Размер файла не должен превышать 100 КБ.");
      if (!/\.(json|txt)$/i.test(file.name))
        throw new Error("Поддерживаются только TXT и JSON.");
      const turns = importConversation(
        await file.text(),
        /\.json$/i.test(file.name),
      );
      if (turns.at(-1)?.role !== "buyer")
        throw new Error(
          "Последнее сообщение примера должно быть от покупателя.",
        );
      setContext(turns.slice(0, -1));
      setQuestion(turns.at(-1)!.text);
      setScenarioId("");
      onError("");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось загрузить файл.");
    }
  }
  return (
    <div className="seller-testing-grid">
      <section className="panel form-panel seller-input-panel">
        <div className="seller-step">
          <span>1</span>
          <div>
            <h2>Товар и вопрос</h2>
            <p>Один сценарий и одинаковые знания для всех ответов</p>
          </div>
        </div>
        <label>
          Товар из базы знаний
          <Select
            value={p?.id ?? ""}
            onChange={(e) => setProductId(e.target.value)}
          >
            {!data.products.length && (
              <option value="">Сначала добавьте товар в базу знаний</option>
            )}
            {data.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </label>
        <label>
          Сценарий
          <Select
            aria-label="Сценарий"
            value={scenarioId}
            onChange={(e) => load(e.target.value)}
          >
            <option value="">Свой вопрос</option>
            {data.scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </label>
        <label>
          Сообщение покупателя
          <textarea
            maxLength={4000}
            rows={4}
            placeholder="Например: можно отправить доставкой Авито?"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              setScenarioId("");
            }}
          />
        </label>
        <div className="seller-card-actions">
          <button
            disabled={!question.trim() || data.scenarios.length >= 100}
            className="text-link"
            onClick={() => {
              setName("");
              setSave(true);
            }}
          >
            <Plus size={14} />
            Сохранить сценарий
          </button>
          <span className="seller-context-count">
            {context.length} сообщений контекста
          </span>
        </div>
        <details className="seller-details">
          <summary>Контекст и загрузка переписки</summary>
          <p className="muted">
            TXT: одна строка на сообщение с префиксом «Покупатель:» или
            «Продавец:». JSON: массив объектов с role (buyer/seller) и text.
            Последний вопрос покупателя станет текущим сообщением. До 20
            сообщений, 100 КБ. Удалите персональные данные перед загрузкой.
          </p>
          <label className="seller-file">
            <Upload size={16} />
            Загрузить TXT или JSON
            <input
              type="file"
              accept=".txt,.json,text/plain,application/json"
              aria-label="Загрузить переписку"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = "";
              }}
            />
          </label>
          {context.length > 0 && (
            <>
              <div className="seller-context">
                {context.map((t, i) => (
                  <p key={i}>
                    <b>{t.role === "buyer" ? "Покупатель" : "Продавец"}:</b>{" "}
                    {t.text}
                  </p>
                ))}
              </div>
              <button className="text-link" onClick={() => setContext([])}>
                Очистить контекст
              </button>
            </>
          )}
        </details>
      </section>
      <section className="panel form-panel seller-model-panel">
        <div className="seller-step">
          <span>2</span>
          <div>
            <h2>Выберите ответы для сравнения</h2>
            <p>До четырёх вариантов за один запуск</p>
          </div>
        </div>
        <div className="seller-mode" role="group" aria-label="Режим сравнения">
          <button
            className={mode === "demo" ? "selected" : ""}
            onClick={() => {
              setMode("demo");
              setKeys(["demo:short", "demo:consult"]);
            }}
          >
            Демонстрация
          </button>
          <button
            className={mode === "real" ? "selected" : ""}
            onClick={() => {
              setMode("real");
              setKeys([]);
            }}
          >
            Реальные модели
          </button>
        </div>
        {mode === "demo" ? (
          <p className="muted">
            Два варианта одного локального алгоритма для проверки интерфейса.
            Они не представляют Yandex, DeepSeek, Qwen или GigaChat и не
            сравнивают качество нейросетей. Свободные инструкции показываются
            как правила; алгоритм не интерпретирует их как языковая модель.
          </p>
        ) : (
          <p className="muted">
            Доступны только модели, явно настроенные на сервере. API-запросы
            могут расходовать средства. Перед запуском проверьте разрешение
            владельца и тарифы.
          </p>
        )}
        <div className="seller-model-options">
          {models
            .filter((m) => m.demo === (mode === "demo"))
            .map((m) => (
              <label
                key={m.key}
                className={`seller-model-option ${keys.includes(m.key) ? "checked" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={keys.includes(m.key)}
                  disabled={
                    !m.available ||
                    (!keys.includes(m.key) && selected.length >= 4) ||
                    busy
                  }
                  onChange={(e) =>
                    setKeys(
                      e.target.checked
                        ? [...keys, m.key]
                        : keys.filter((k) => k !== m.key),
                    )
                  }
                />
                <span>
                  <strong>{m.label}</strong>
                  <small>
                    {m.demo
                      ? "Локальный тестовый алгоритм"
                      : `${providerLabels[m.provider]} · ${m.modelId}`}
                  </small>
                  {!m.available && <small>{m.reason}</small>}
                </span>
                {m.demo && <span className="status draft">ДЕМО</span>}
              </label>
            ))}
        </div>
        {mode === "real" &&
          models.filter((m) => !m.demo && m.available).length === 0 && (
            <div className="safety-box">
              <Sparkles size={20} />
              <p>
                Реальные модели пока не подключены. Переключитесь на
                демонстрацию, чтобы проверить сценарии бесплатно.
              </p>
            </div>
          )}
        {mode === "real" && models.some((m) => !m.demo && m.available) && (
          <label>
            Код доступа к реальным запросам
            <input
              type="password"
              autoComplete="off"
              value={token}
              maxLength={512}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Код администратора, не API-ключ"
            />
            <small className="muted">
              Используется только в этой вкладке и не сохраняется в браузере.
            </small>
          </label>
        )}
        <button
          className="button primary seller-run-button"
          disabled={!canRun}
          onClick={() => {
            if (p)
              onRun(
                {
                  mode,
                  modelKeys: selected.map((m) => m.key),
                  product: structuredClone(p),
                  scenario: {
                    id: scenarioId || crypto.randomUUID(),
                    name:
                      data.scenarios.find((s) => s.id === scenarioId)?.name ||
                      question.slice(0, 70),
                    question: question.trim(),
                    context: structuredClone(context),
                  },
                },
                token,
              );
          }}
        >
          <Play size={16} />
          {busy
            ? "Сравнение выполняется…"
            : mode === "demo"
              ? "Запустить демосравнение"
              : "Отправить запросы моделям"}
        </button>
        <p className="seller-private">
          <Check size={13} />
          Не отправляет сообщения покупателям
        </p>
        <details className="seller-details">
          <summary>Провайдеры и подключение</summary>
          {providers.map((p) => (
            <div className="seller-provider" key={p.id}>
              <div>
                <strong>{p.label}</strong>
                <span
                  className={`status ${p.configured ? "active" : "neutral"}`}
                >
                  {p.configured ? "Настроен на сервере" : "Не подключено"}
                </span>
              </div>
              <a
                className="text-link"
                href={p.docs}
                target="_blank"
                rel="noreferrer"
              >
                Официальная документация ↗
              </a>
            </div>
          ))}
          <p className="muted">
            Идентификаторы моделей и проверенные тарифы задаёт администратор.
            API-ключи хранятся только в серверных переменных окружения. В
            настройках интерфейса их вводить нельзя.
          </p>
        </details>
      </section>
      {save && (
        <Modal title="Сохранить сценарий" onClose={() => setSave(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) {
                const s = {
                  id: crypto.randomUUID(),
                  name: name.trim(),
                  question: question.trim(),
                  context: structuredClone(context),
                };
                onScenario(s);
                setScenarioId(s.id);
                setSave(false);
              }
            }}
          >
            <label>
              Название сценария
              <input
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className="modal-actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => setSave(false)}
              >
                Отмена
              </button>
              <button className="button primary" type="submit">
                Сохранить сценарий
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
