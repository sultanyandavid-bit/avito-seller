"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  MessagesSquare,
  Sparkles,
  Settings,
  ArrowUpRight,
  ChevronDown,
  ShieldCheck,
  Menu,
  FlaskConical,
} from "lucide-react";
import type { Section, Store } from "@/lib/types";
import { initialStore } from "@/lib/demo";
import { parseStore, STORAGE_KEY } from "@/lib/storage";
import Dashboard from "./dashboard";
import Products from "./products";
import Messages from "./messages";
import Assistant from "./assistant";
import SettingsPanel from "./settings";
import Seller from "./seller";
const nav = [
  { id: "dashboard", label: "Обзор", icon: LayoutDashboard },
  { id: "products", label: "Товары", icon: Package },
  { id: "messages", label: "Сообщения", icon: MessagesSquare },
  { id: "assistant", label: "AI-ассистент", icon: Sparkles },
  { id: "seller", label: "AI-продавец", icon: FlaskConical },
  { id: "settings", label: "Настройки", icon: Settings },
] as const;
export default function Workspace({ section }: { section: Section }) {
  const [store, setStore] = useState<Store>(initialStore),
    [ready, setReady] = useState(false),
    [storageError, setStorageError] = useState(""),
    [mobile, setMobile] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect -- Synchronizing browser-only storage after SSR and reporting storage failures. */
  // Browser storage is an external system; hydrate after mount to keep SSR deterministic.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = parseStore(raw);
        if (saved) setStore(saved);
        else
          setStorageError("Сохранённые данные повреждены. Загружен демонабор.");
      }
    } catch {
      setStorageError(
        "Хранилище браузера недоступно. Изменения сохраняются только до закрытия страницы.",
      );
    }
    setReady(true);
  }, []);
  // Report persistence failures to the user instead of silently losing changes.
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      } catch {
        setStorageError(
          "Не удалось сохранить данные в браузере. Проверьте доступное место.",
        );
      }
    }
  }, [store, ready]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const unread = store.conversations.reduce((n, c) => n + c.unread, 0),
    human = store.conversations.filter((c) => c.human).length;
  const update = (patch: Partial<Store>) =>
    setStore((s) => ({ ...s, ...patch }));
  return (
    <div className="app-shell">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Sparkles size={22} />
          </span>
          <span>
            seller<span className="brand-ai">ai</span>
            <small>ПРОДАВАЙТЕ УМНЕЕ</small>
          </span>
        </Link>
        <Link href="/settings" className="shop">
          <span className="shop-avatar">ТС</span>
          <span>
            {store.shopName}
            <small>Рабочее пространство</small>
          </span>
          <ChevronDown size={15} />
        </Link>
        <div className="nav-label">УПРАВЛЕНИЕ</div>
        <nav>
          {nav.map((n) => (
            <Link
              onClick={() => setMobile(false)}
              key={n.id}
              href={n.id === "dashboard" ? "/" : `/${n.id}`}
              className={section === n.id ? "nav-item active" : "nav-item"}
            >
              <n.icon size={20} />
              {n.label}
              {n.id === "messages" && unread > 0 && (
                <b className="count">{unread}</b>
              )}
              {n.id === "assistant" && <span className="ai-tag">AI</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-note">
            <ShieldCheck size={21} />
            <strong>Безопасный деморежим</strong>
            <p>Знакомьтесь с возможностями на примере вашего магазина.</p>
            <Link href="/settings">
              Об интеграции <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="profile">
            <span className="avatar">ДС</span>
            <span>
              Демо-продавец<small>Локальный профиль</small>
            </span>
            <span className="profile-dot" />
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="scrim"
          aria-label="Закрыть меню"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Открыть меню"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={22} />
            </button>
            Рабочее пространство <span>/</span>
            <strong>{nav.find((n) => n.id === section)?.label}</strong>
          </div>
          <span className="demo-pill">
            <span /> Демо-версия
          </span>
        </header>
        <main>
          {storageError && (
            <div role="alert" className="notice">
              {storageError}
            </div>
          )}
          {!ready ? (
            <div className="loading">Загружаем рабочее пространство…</div>
          ) : (
            <>
              {section === "dashboard" && (
                <Dashboard store={store} unread={unread} human={human} />
              )}
              {section === "products" && (
                <Products store={store} update={update} />
              )}
              {section === "messages" && (
                <Messages store={store} update={update} />
              )}
              {section === "assistant" && (
                <Assistant store={store} update={update} />
              )}
              {section === "seller" && <Seller store={store} />}
              {section === "settings" && (
                <SettingsPanel store={store} update={update} />
              )}
            </>
          )}
        </main>
        <footer>
          AI Avito Seller{" "}
          <span>Все данные демонстрационные · Авито не подключено</span>
          <span>Версия 0.1</span>
        </footer>
      </div>
    </div>
  );
}
