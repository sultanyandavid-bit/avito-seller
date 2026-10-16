"use client";
import { useEffect, useState } from "react";
import { api, patch } from "@/lib/davio/client";
import { useAccount } from "./shell";
import type { DavioUser, Plan, VideoJob } from "@/lib/davio/types";
type AdminData = {
  users: DavioUser[];
  plans: Plan[];
  jobs: VideoJob[];
  worker: { online: boolean };
  features: Record<string, boolean>;
};
export default function Admin() {
  const { user } = useAccount();
  const [data, setData] = useState<AdminData | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (user.role === "admin")
      api<AdminData>("admin")
        .then(setData)
        .catch((e) => setError(e.message));
  }, [user.role]);
  async function run(path: string, input: unknown) {
    setBusy(true);
    setError("");
    try {
      await patch(path, input);
      setData(await api("admin"));
      setStatus("Изменения сохранены.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка.");
    } finally {
      setBusy(false);
    }
  }
  if (user.role !== "admin")
    return (
      <div className="dv-card dv-empty">
        <h1>Доступ ограничен</h1>
        <p>Административная область доступна только администратору.</p>
      </div>
    );
  return (
    <>
      <div className="dv-page-heading">
        <div>
          <span className="dv-eyebrow">УПРАВЛЕНИЕ ЛОКАЛЬНОЙ УСТАНОВКОЙ</span>
          <h1>Администрирование</h1>
          <p>
            Пользователи, лимиты и задачи. Без доступа к паролям и личным
            материалам.
          </p>
        </div>
      </div>
      {error && (
        <p className="dv-alert" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="dv-status" role="status">
          {status}
        </p>
      )}
      {!data ? (
        <p>Загружаем данные…</p>
      ) : (
        <>
          <div className="dv-editor-grid">
            {data.plans.map((p) => (
              <section className="dv-card dv-form" key={p.id}>
                <h2>{p.label} · лимиты</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run("admin/plans", {
                      ...Object.fromEntries(new FormData(e.currentTarget)),
                      id: p.id,
                    });
                  }}
                >
                  {(
                    [
                      ["projects", "Проекты"],
                      ["storageMB", "Хранилище, МБ"],
                      ["renders", "Видеозадачи в месяц"],
                      ["texts", "Шаблоны в месяц"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        name={key}
                        type="number"
                        min="1"
                        max="10000"
                        defaultValue={p[key]}
                        required
                      />
                    </label>
                  ))}
                  <button className="dv-button primary" disabled={busy}>
                    Сохранить лимиты
                  </button>
                </form>
              </section>
            ))}
          </div>
          <section className="dv-card dv-form">
            <h2>Пользователи · {data.users.length}</h2>
            {data.users.map((u) => (
              <div className="dv-admin-user" key={u.id}>
                <div>
                  <strong>{u.name}</strong>
                  <small>
                    {u.email} · {u.role}
                  </small>
                </div>
                <label>
                  Тариф
                  <select
                    value={u.plan}
                    disabled={busy}
                    onChange={(e) =>
                      void run("admin/users", {
                        id: u.id,
                        plan: e.target.value,
                      })
                    }
                  >
                    <option value="basic">Базовый</option>
                    <option value="pro">PRO</option>
                  </select>
                </label>
              </div>
            ))}
          </section>
          <section className="dv-card dv-form">
            <div className="dv-section-title">
              <h2>Фоновые задачи</h2>
              <span className="dv-tag">
                Worker {data.worker.online ? "на связи" : "не запущен"}
              </span>
            </div>
            {!data.jobs.length ? (
              <p>Задач пока нет.</p>
            ) : (
              data.jobs.map((j) => (
                <div className="dv-job" key={j.id}>
                  <small>{j.id}</small>
                  <strong>
                    {j.status} · {j.progress}%
                  </strong>
                  {j.error && <p>{j.error}</p>}
                </div>
              ))
            )}
            <p className="dv-hint">
              Внешний AI, маркетплейсы и платежи выключены. Настройка секретов
              выполняется только на сервере, не через браузер.
            </p>
            <button
              className="dv-link"
              onClick={() =>
                api<AdminData>("admin")
                  .then(setData)
                  .catch((e) => setError(e.message))
              }
            >
              Обновить
            </button>
          </section>
        </>
      )}
    </>
  );
}
