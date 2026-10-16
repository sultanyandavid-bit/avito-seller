"use client";
import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, Check, ArrowRight } from "lucide-react";
import type { Store } from "@/lib/types";
import { initialStore } from "@/lib/demo";
import Heading from "./heading";
import Modal from "./modal";
import { useLocalWorkspace } from "./workspaces/provider";
export default function SettingsPanel({
  store,
  update,
  resetSeed = initialStore,
}: {
  store: Store;
  update: (s: Partial<Store>) => void;
  resetSeed?: Store;
}) {
  const registry = useLocalWorkspace();
  const [newStore, setNewStore] = useState(""),
    [storeError, setStoreError] = useState("");
  const [name, setName] = useState(store.shopName),
    [city, setCity] = useState(store.city),
    [saved, setSaved] = useState(false),
    [reset, setReset] = useState(false);
  return (
    <>
      <Heading
        eyebrow="РАБОЧЕЕ ПРОСТРАНСТВО"
        title="Настройки"
        description="Параметры магазина и будущих интеграций."
      />
      <div className="settings-grid">
        <section className="panel form-panel">
          <h2>Основные настройки</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              update({ shopName: name.trim(), city: city.trim() });
              setSaved(true);
            }}
          >
            <label>
              Название магазина
              <input
                required
                maxLength={60}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                pattern=".*\S.*"
              />
            </label>
            <label>
              Город
              <input
                required
                maxLength={80}
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setSaved(false);
                }}
                pattern=".*\S.*"
              />
            </label>
            <button className="button primary" type="submit">
              Сохранить настройки
            </button>
            {saved && (
              <span className="saved" role="status">
                <Check size={15} /> Сохранено
              </span>
            )}
          </form>
          <hr />
          <h2>Магазины владельца</h2>
          <p className="muted">
            Локальные рабочие пространства в этом браузере. Это не регистрация
            пользователей и не серверная авторизация.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!registry.create(newStore))
                setStoreError(
                  "Укажите название до 60 символов. Максимум 30 магазинов.",
                );
            }}
          >
            <label>
              Название нового магазина
              <input
                required
                maxLength={60}
                value={newStore}
                onChange={(e) => setNewStore(e.target.value)}
              />
            </label>
            <button className="button secondary" type="submit">
              Добавить магазин
            </button>
            {storeError && <p role="alert">{storeError}</p>}
          </form>
          <hr />
          <h2>Демонстрационные данные</h2>
          <p className="muted">
            Сброс удалит ваши локальные изменения и восстановит исходный каталог
            и диалоги.
          </p>
          <button className="button secondary" onClick={() => setReset(true)}>
            Восстановить демоданные
          </button>
        </section>
        <div className="stack">
          <section className="panel form-panel">
            <div className="panel-heading">
              <h2>Интеграция с Авито</h2>
              <span className="status neutral">Не подключено</span>
            </div>
            <div className="integration-logo">
              Авито <span>● ● ● ●</span>
            </div>
            <p className="muted">
              Подключение реального аккаунта не настроено. Приложение не
              обращается к Авито и не выполняет действий от вашего имени.
            </p>
            <div className="safety-box">
              <ShieldCheck size={22} />
              <p>
                Будущая интеграция — только через официальный API, при доступных
                правах и с разрешения владельца аккаунта.
              </p>
            </div>
          </section>
          <section className="panel form-panel">
            <div className="panel-heading">
              <h2>AI-провайдер</h2>
              <span className="status draft">Демо</span>
            </div>
            <p className="muted">
              Локальный алгоритм без внешних запросов и платных сервисов.
              Интерфейс AssistantProvider подготовлен для серверного подключения
              OpenAI API.
            </p>
            <Link className="text-link" href="/assistant">
              Настроить ассистента <ArrowRight size={15} />
            </Link>
          </section>
        </div>
      </div>
      {reset && (
        <Modal title="Восстановить демоданные?" onClose={() => setReset(false)}>
          <p>
            Текущие товары, сообщения и настройки в этом браузере будут заменены
            исходным набором.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setReset(false)}
            >
              Отмена
            </button>
            <button
              className="button danger"
              onClick={() => {
                update(structuredClone(resetSeed));
                setName(resetSeed.shopName);
                setCity(resetSeed.city);
                setSaved(false);
                setReset(false);
              }}
            >
              Восстановить
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
