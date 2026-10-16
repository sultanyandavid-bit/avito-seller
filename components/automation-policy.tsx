"use client";
import { useCallback, useMemo } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import {
  emptyPolicy,
  parsePolicy,
  allowedScenarios,
  type AutomationPolicy,
} from "@/lib/platform/automation";
import { usePersistentState } from "@/lib/client/use-persistent-state";
import Select from "./ui/select";
export default function AutomationPolicyPanel({
  storeId,
}: {
  storeId: string;
}) {
  const seed = useMemo(() => emptyPolicy(storeId), [storeId]),
    parse = useCallback((raw: string) => parsePolicy(raw, storeId), [storeId]);
  const { data, update, ready, error } = usePersistentState(
    `sellerai:automation:v1:${storeId}`,
    seed,
    parse,
  );
  return (
    <section className="panel automation-panel">
      <div className="automation-heading">
        <div>
          <h2>Как работает ваш AI</h2>
          <p>
            Сбор примеров, помощь с черновиками или подготовка будущих правил.
          </p>
        </div>
        <span className="status neutral">Отправка отключена</span>
      </div>
      <label>
        Режим работы AI
        <Select
          aria-label="Режим работы AI"
          disabled={!ready}
          value={data.mode}
          onChange={(e) =>
            update((d) => ({
              ...d,
              mode: e.target.value as AutomationPolicy["mode"],
            }))
          }
        >
          <option value="learner">AI-ученик · одобренные примеры</option>
          <option value="assistant">
            AI-помощник · подтверждение продавца
          </option>
          <option value="seller">AI-продавец · будущая автоматизация</option>
        </Select>
      </label>
      <p className="muted">
        {data.mode === "learner"
          ? "Собирайте исправления и пояснения в базе примеров."
          : data.mode === "assistant"
            ? "Получайте черновики и самостоятельно решайте, что использовать."
            : "Подготовьте правила. Выбор режима не включает отправку: официального подключения и разрешения нет."}{" "}
        <Link
          className="text-link"
          href={data.mode === "learner" ? "/learning" : "/assistant"}
        >
          {data.mode === "learner" ? "Открыть AI-ученика" : "Открыть помощника"}{" "}
          →
        </Link>
      </p>
      {error && (
        <p role="alert" className="notice seller-error">
          {error}
        </p>
      )}
      <details className="seller-details">
        <summary>Правила будущих автоответов</summary>
        <div className="switch-row">
          <div>
            <h3>Автоматическая отправка</h3>
            <p>
              Недоступна без официальной интеграции и отдельного разрешения.
            </p>
          </div>
          <button
            className="switch"
            role="switch"
            aria-label="Автоматическая отправка"
            aria-checked={false}
            disabled
          >
            <span />
          </button>
        </div>
        <fieldset className="scenario-fieldset">
          <legend>Сценарии для будущего разрешения</legend>
          {Object.entries(allowedScenarios).map(([id, label]) => (
            <label key={id}>
              <input
                type="checkbox"
                checked={data.allowed.includes(
                  id as keyof typeof allowedScenarios,
                )}
                onChange={(e) =>
                  update((d) => ({
                    ...d,
                    allowed: e.target.checked
                      ? [...d.allowed, id as keyof typeof allowedScenarios]
                      : d.allowed.filter((x) => x !== id),
                  }))
                }
              />
              {label}
            </label>
          ))}
        </fieldset>
        <label>
          Минимальный интервал, секунд
          <input
            type="number"
            min="10"
            max="3600"
            value={data.intervalSeconds}
            onChange={(e) =>
              update((d) => ({
                ...d,
                intervalSeconds: Math.max(
                  10,
                  Math.min(3600, Math.round(Number(e.target.value))),
                ),
              }))
            }
          />
        </label>
        <div className="safety-box">
          <ShieldCheck size={21} />
          <p>
            Сложные вопросы передаются человеку. Будущий серверный отправитель
            обязан проверять права, разрешённые сценарии, частоту, дубликаты по
            ID входящего сообщения и ручное вмешательство.
          </p>
        </div>
        <h3>Журнал автоматической отправки</h3>
        <p className="muted">
          Автоматических отправок не было. Исправления и одобрения доступны в
          истории AI-ученика; реальный журнал появится вместе с подключением
          площадки.
        </p>
      </details>
    </section>
  );
}
