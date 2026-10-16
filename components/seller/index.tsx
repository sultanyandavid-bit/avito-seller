"use client";
import { useEffect, useRef, useState } from "react";
import {
  FlaskConical,
  BookOpen,
  History as HistoryIcon,
  ShieldCheck,
} from "lucide-react";
import type { Store } from "@/lib/types";
import { sellerSeed, sellerStorageKey } from "@/lib/seller/data";
import {
  demoModels,
  providerDocs,
  providerLabels,
  type SellerData,
  type ModelOption,
  type CompareInput,
  type TestRun,
  type Review,
  type Scenario,
  type Result,
} from "@/lib/seller/types";
import { parseSellerData } from "@/lib/seller/validation";
import Heading from "../heading";
import AutomationPolicyPanel from "../automation-policy";
import { MAIN_STORE_ID, scopedKey } from "@/lib/workspaces/types";
import Knowledge from "./knowledge";
import Results from "./results";
import History from "./history";
import Testing, { type ProviderStatus } from "./testing";
const tabs = [
  { id: "testing", label: "Тестирование AI", icon: FlaskConical },
  { id: "knowledge", label: "База знаний", icon: BookOpen },
  { id: "history", label: "История тестов", icon: HistoryIcon },
] as const;
export default function Seller({
  store,
  storeId = MAIN_STORE_ID,
}: {
  store: Store;
  storeId?: string;
}) {
  const storageKey = scopedKey(sellerStorageKey, storeId);
  const seed =
    storeId === MAIN_STORE_ID
      ? sellerSeed
      : { ...sellerSeed, products: [], runs: [] };
  const [data, setData] = useState<SellerData>(seed),
    [ready, setReady] = useState(false),
    [blocked, setBlocked] = useState(false),
    [tab, setTab] = useState<(typeof tabs)[number]["id"]>("testing"),
    [models, setModels] = useState<ModelOption[]>(demoModels),
    [providers, setProviders] = useState<ProviderStatus[]>(
      (Object.keys(providerDocs) as ProviderStatus["id"][]).map((id) => ({
        id,
        label: providerLabels[id],
        docs: providerDocs[id],
        configured: false,
      })),
    ),
    [catalogReady, setCatalogReady] = useState(false),
    [error, setError] = useState(""),
    [storageError, setStorageError] = useState(""),
    [busy, setBusy] = useState(false),
    [activeId, setActiveId] = useState<string | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  /* eslint-disable react-hooks/set-state-in-effect -- Hydrate browser-only persisted lab state after SSR. */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = parseSellerData(raw);
        if (saved) setData(saved);
        else {
          setBlocked(true);
          setStorageError(
            "Данные AI-продавца повреждены. Исходная запись сохранена; изменения остаются в памяти.",
          );
        }
      }
    } catch {
      setBlocked(true);
      setStorageError(
        "Хранилище недоступно. Тесты будут доступны только до закрытия страницы.",
      );
    }
    setReady(true);
  }, [storageKey]);
  useEffect(() => {
    if (ready && !blocked) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch {
        setStorageError(
          "Не удалось сохранить базу или историю. Экспортируйте тесты, чтобы не потерять изменения.",
        );
      }
    }
  }, [data, ready, blocked, storageKey]);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/seller/providers", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const catalog = await r.json();
        setModels(catalog.models);
        setProviders(catalog.providers);
        if (catalog.warning) setError(catalog.warning);
        setCatalogReady(true);
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(
            "Не удалось загрузить список моделей. Проверьте соединение и перезагрузите страницу.",
          );
      });
    return () => {
      controller.abort();
      inFlight.current?.abort();
    };
  }, []);
  const active = data.runs.find((r) => r.id === activeId);
  const review = (id: string, next: Review) =>
    setData((s) => ({
      ...s,
      runs: s.runs.map((r) =>
        r.id === activeId
          ? {
              ...r,
              results: r.results.map((t) =>
                t.id === id ? { ...t, review: next } : t,
              ),
            }
          : r,
      ),
    }));
  async function run(input: CompareInput, token: string) {
    if (inFlight.current) return;
    if (data.runs.length >= 50) {
      setError(
        "История содержит 50 тестов. Экспортируйте её и очистите вручную, прежде чем запускать следующий тест.",
      );
      return;
    }
    setError("");
    setBusy(true);
    const controller = new AbortController();
    inFlight.current = controller;
    const started = performance.now();
    const timer = setTimeout(() => controller.abort(), 25000);
    const runId = crypto.randomUUID();
    const pending: TestRun = {
      id: runId,
      createdAt: new Date().toISOString(),
      product: structuredClone(input.product),
      scenario: structuredClone(input.scenario),
      results: models
        .filter((m) => input.modelKeys.includes(m.key))
        .map((model) => ({
          id: crypto.randomUUID(),
          model,
          text: null,
          error:
            "Запрос ещё не завершён или был прерван. Результат и расходы неизвестны.",
          handoff: null,
          inputTokens: null,
          outputTokens: null,
          cost: null,
          durationMs: 0,
          review: { scores: {}, comment: "" },
        })),
    };
    setData((s) => ({ ...s, runs: [pending, ...s.runs] }));
    setActiveId(runId);
    try {
      const response = await fetch("/api/seller/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(input.mode === "real"
            ? { Authorization: `Bearer ${token}` }
            : {}),
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Не удалось запустить сравнение.");
      setData((s) => ({
        ...s,
        runs: s.runs.map((r) =>
          r.id === runId ? { ...r, results: payload.results as Result[] } : r,
        ),
      }));
    } catch (e) {
      const message = controller.signal.aborted
        ? "Ожидание ответа прервано. При реальном API расход мог быть учтён провайдером."
        : e instanceof Error
          ? e.message
          : "Не удалось выполнить запрос.";
      setError(message);
      setData((s) => ({
        ...s,
        runs: s.runs.map((r) =>
          r.id === runId
            ? {
                ...r,
                results: r.results.map((t) => ({
                  ...t,
                  error: message,
                  durationMs: Math.round(performance.now() - started),
                })),
              }
            : r,
        ),
      }));
    } finally {
      clearTimeout(timer);
      inFlight.current = null;
      setBusy(false);
    }
  }
  const saveScenario = (s: Scenario) =>
    setData((d) => ({ ...d, scenarios: [...d.scenarios, s].slice(0, 100) }));
  return (
    <div className="seller-lab">
      <Heading
        eyebrow="ЛАБОРАТОРИЯ ПРОДАЖ"
        title="AI-продавец"
        description="Проверьте, как помощник общается с вашими покупателями."
      />
      <AutomationPolicyPanel storeId={storeId} />
      <div
        className="seller-tabs"
        role="tablist"
        aria-label="Разделы AI-продавца"
      >
        {tabs.map((t) => (
          <button
            id={`seller-tab-${t.id}`}
            aria-controls={`seller-panel-${t.id}`}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "selected" : ""}
            key={t.id}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={17} />
            {t.label}
          </button>
        ))}
      </div>
      {storageError && (
        <div className="notice seller-error" role="alert">
          {storageError}
        </div>
      )}
      {error && (
        <div className="notice seller-error" role="alert">
          {error}
          <button
            aria-label="Скрыть ошибку"
            className="icon-button"
            onClick={() => setError("")}
          >
            ×
          </button>
        </div>
      )}
      {!ready ? (
        <p className="loading">Загружаем базу знаний…</p>
      ) : (
        <div
          id={`seller-panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`seller-tab-${tab}`}
        >
          {tab === "testing" && (
            <>
              <div className="notice seller-intro">
                <ShieldCheck size={20} />
                <div>
                  <strong>Начните бесплатно — с демонстрации</strong>
                  <p>
                    Выберите товар, напишите вопрос и сравните тестовые
                    варианты. Реальные нейросети и платные API по умолчанию
                    выключены.
                  </p>
                </div>
              </div>
              <Testing
                data={data}
                models={models}
                providers={providers}
                catalogReady={catalogReady}
                busy={busy}
                onRun={run}
                onScenario={saveScenario}
                onError={setError}
              />
              {active && !busy && <Results run={active} onReview={review} />}
              <div role="status" aria-live="polite">
                {busy && (
                  <p className="seller-running">
                    Готовим ответы на одинаковых данных…
                  </p>
                )}
              </div>
            </>
          )}
          {tab === "knowledge" && (
            <Knowledge
              products={data.products}
              catalog={store.products}
              onChange={(products) => setData((s) => ({ ...s, products }))}
            />
          )}
          {tab === "history" && (
            <>
              <History
                runs={data.runs}
                busy={busy}
                onOpen={setActiveId}
                onClear={() => {
                  setData((s) => ({ ...s, runs: [] }));
                  setActiveId(null);
                }}
              />
              {active && <Results run={active} onReview={review} />}
            </>
          )}
        </div>
      )}
      <p className="seller-local-note">
        Тестовое пространство · данные хранятся в этом браузере · оценки
        субъективны · Авито не подключено
      </p>
    </div>
  );
}
