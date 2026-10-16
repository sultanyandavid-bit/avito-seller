"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ArrowUpRight,
  Check,
  HardDrive,
  Download,
} from "lucide-react";
import { useAccount } from "./shell";
import { patch, post } from "@/lib/davio/client";
import { marketplaceStatus } from "@/lib/davio/integrations";
export default function DavioSettings() {
  const { user, usage, refresh } = useAccount(),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка запроса.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="dv-page-heading">
        <div>
          <span className="dv-eyebrow">
            ПРОСТРАНСТВО, КОТОРОЕ ПОДСТРАИВАЕТСЯ ПОД ВАС
          </span>
          <h1>Настройки</h1>
          <p>Профиль, лимиты и возможности DAVIO.</p>
        </div>
        {user.role === "admin" && (
          <Link href="/admin" className="dv-button">
            <ShieldCheck size={17} />
            Администрирование
          </Link>
        )}
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
      <div className="dv-editor-grid">
        <div className="dv-stack">
          <section className="dv-card dv-form">
            <h2>Личный профиль</h2>
            <p>{user.email}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(async () => {
                  await patch("profile", { name: f.get("name") });
                  setStatus("Имя сохранено.");
                });
              }}
            >
              <label>
                Ваше имя
                <input
                  name="name"
                  defaultValue={user.name}
                  required
                  maxLength={60}
                />
              </label>
              <button className="dv-button primary" disabled={busy}>
                Сохранить профиль
              </button>
            </form>
            <details className="dv-details">
              <summary>Изменить пароль</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget,
                    f = new FormData(form);
                  void run(async () => {
                    await post("password", Object.fromEntries(f));
                    form.reset();
                    setStatus("Пароль изменён. Остальные сессии завершены.");
                  });
                }}
              >
                <label>
                  Текущий пароль
                  <input
                    name="current"
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={128}
                  />
                </label>
                <label>
                  Новый пароль
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={128}
                  />
                </label>
                <button className="dv-button" disabled={busy}>
                  Изменить пароль
                </button>
              </form>
            </details>
            <small>
              Сессия действует 7 дней. Почтовое подтверждение и восстановление
              пароля по email пока не подключены.
            </small>
          </section>
          <section className="dv-card dv-form">
            <div className="dv-section-title">
              <h2>Хранение и обработка</h2>
              <HardDrive size={19} />
            </div>
            <p>
              Проекты и материалы хранятся на этом сервере. Фото доступны только
              владельцу через защищённые запросы.
            </p>
            <div className="dv-usage-line">
              <span>Проекты</span>
              <strong>
                {usage.projects} / {usage.plan.projects}
              </strong>
            </div>
            <div className="dv-usage-line">
              <span>Хранилище</span>
              <strong>
                {(usage.storageBytes / 1024 / 1024).toFixed(1)} /{" "}
                {usage.plan.storageMB} МБ
              </strong>
            </div>
            <div className="dv-usage-line">
              <span>Шаблоны за месяц</span>
              <strong>
                {usage.texts} / {usage.plan.texts}
              </strong>
            </div>
            <div className="dv-usage-line">
              <span>Видеозадачи за месяц</span>
              <strong>
                {usage.renders} / {usage.plan.renders}
              </strong>
            </div>
            <div className="dv-usage-line">
              <span>FFmpeg worker</span>
              <span className="dv-tag">
                {usage.worker.online ? "На связи" : "Не запущен"}
              </span>
            </div>
            <small>
              Месячные лимиты обновляются по UTC. Учитываются поставленные
              видеозадачи, включая неудачные. Архивные проекты и сохранённые
              файлы занимают место. Скачивайте важные материалы как резервную
              копию.
            </small>
            <button className="dv-link" onClick={() => void refresh()}>
              Обновить состояние
            </button>
          </section>
        </div>
        <div className="dv-stack">
          <section className="dv-card dv-form">
            <div className="dv-section-title">
              <h2>Тариф и возможности</h2>
              <span className="dv-tag">{usage.plan.label}</span>
            </div>
            <div className="dv-plan-options">
              <div>
                <h3>Базовый</h3>
                <p>
                  Текст из фактов, коррекция фото, монтаж, сохранение и экспорт.
                </p>
              </div>
              <div>
                <h3>PRO</h3>
                <p>
                  Настраиваемые увеличенные лимиты. Расширенные AI-функции
                  потребуют отдельного подключения.
                </p>
              </div>
            </div>
            <small>
              Окончательные цены не установлены. Оплата и платёжный провайдер не
              подключены. Тариф назначает администратор локальной установки;
              покупок здесь нет.
            </small>
          </section>
          <section className="dv-card dv-form">
            <h2>Интеграции</h2>
            {marketplaceStatus.map((m) => (
              <div className="dv-usage-line" key={m.id}>
                <strong>{m.label}</strong>
                <span className="dv-tag">Не подключено</span>
              </div>
            ))}
            <p>
              Материалы можно скачать и опубликовать вручную. Автоматической
              публикации и доступа к перепискам нет.
            </p>
            <div className="dv-usage-line">
              <strong>Генеративный AI</strong>
              <span className="dv-tag">Не подключён</span>
            </div>
            <p>
              Базовые функции работают без ключей. Будущие модели подключаются
              на сервере после настройки и разрешения владельца.
            </p>
          </section>
          <section className="dv-card dv-form">
            <Download size={21} />
            <h2>DAVIO на главном экране</h2>
            <p>
              В Chrome откройте меню → «Установить приложение». На iPhone:
              Safari → «Поделиться» → «На экран Домой».
            </p>
            <small>
              Установка доступна через HTTPS или localhost. Без сети доступна
              только страница состояния; серверные проекты и обработка требуют
              соединения.
            </small>
          </section>
        </div>
      </div>
      <details className="dv-details dv-legacy-tools">
        <summary>Существующие локальные инструменты Seller AI</summary>
        <p>
          Работающие инструменты сохранены. Их прежние записи остаются в этом
          браузере и не привязаны к серверному аккаунту. Они не переносятся
          автоматически в проекты DAVIO.
        </p>
        <div className="dv-actions">
          {[
            ["/products", "Каталог товаров"],
            ["/legacy/listings", "Прежние объявления"],
            ["/photo", "Фотостудия"],
            ["/video", "Видеостудия"],
            ["/analytics", "Локальная аналитика"],
            ["/legacy/settings", "Магазины и прежние настройки"],
          ].map(([href, label]) => (
            <Link className="dv-button" href={href} key={href}>
              {label}
              <ArrowUpRight size={15} />
            </Link>
          ))}
        </div>
      </details>
      <div className="dv-capabilities">
        <span>
          <Check size={16} />
          Без платных подключений
        </span>
        <span>
          <Check size={16} />
          Без автоматических отправок
        </span>
        <span>
          <Check size={16} />
          Никаких production-деплоев
        </span>
      </div>
    </>
  );
}
