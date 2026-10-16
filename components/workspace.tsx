"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  LayoutDashboard,
  Package,
  MessagesSquare,
  Sparkles,
  Settings,
  ArrowUpRight,
  GraduationCap,
  ShieldCheck,
  Menu,
  FlaskConical,
  X,
} from "lucide-react";
import type { Section, Store } from "@/lib/types";
import { initialStore } from "@/lib/demo";
import { parseStore, STORAGE_KEY } from "@/lib/storage";
import Dashboard from "./dashboard";
import Products from "./products";
import Messages from "./messages";
import Assistant from "./assistant";
import SettingsPanel from "./settings";
const Seller = dynamic(() => import("./seller"), {
  loading: () => <p className="loading">Загружаем AI-продавца…</p>,
});
const Learning = dynamic(() => import("./learning"), {
  loading: () => <p className="loading">Загружаем AI-ученика…</p>,
});
import {
  LocalWorkspaceProvider,
  useLocalWorkspace,
} from "./workspaces/provider";
import { LearningProvider } from "./learning/provider";
import Select from "./ui/select";
import { MAIN_STORE_ID, scopedKey } from "@/lib/workspaces/types";
import { usePersistentState } from "@/lib/client/use-persistent-state";
import { useMobile } from "@/lib/client/use-mobile";
const nav = [
  { id: "dashboard", label: "Обзор", icon: LayoutDashboard },
  { id: "products", label: "Товары", icon: Package },
  { id: "messages", label: "Сообщения", icon: MessagesSquare },
  { id: "assistant", label: "AI-ассистент", icon: Sparkles },
  { id: "learning", label: "AI-ученик", icon: GraduationCap },
  { id: "seller", label: "AI-продавец", icon: FlaskConical },
  { id: "settings", label: "Настройки", icon: Settings },
] as const;
export default function Workspace({ section }: { section: Section }) {
  return (
    <LocalWorkspaceProvider>
      <WorkspaceGate section={section} />
    </LocalWorkspaceProvider>
  );
}
function WorkspaceGate({ section }: { section: Section }) {
  const { workspace, ready } = useLocalWorkspace();
  if (!ready) return <main className="loading">Загружаем магазины…</main>;
  const current = workspace.stores.find(
    (s) => s.id === workspace.activeStoreId,
  )!;
  return (
    <LearningProvider key={current.id} storeId={current.id}>
      <WorkspaceContent
        section={section}
        storeId={current.id}
        initialName={current.name}
      />
    </LearningProvider>
  );
}
function WorkspaceContent({
  section,
  storeId,
  initialName,
}: {
  section: Section;
  storeId: string;
  initialName: string;
}) {
  const registry = useLocalWorkspace();
  const seed: Store =
    storeId === MAIN_STORE_ID
      ? initialStore
      : {
          ...initialStore,
          shopName: initialName,
          products: [],
          conversations: [],
        };
  const {
    data: store,
    update: setStore,
    ready,
    error: storageError,
  } = usePersistentState(scopedKey(STORAGE_KEY, storeId), seed, parseStore);
  const [mobile, setMobile] = useState(false);
  const isMobile = useMobile();
  const sidebarRef = useRef<HTMLElement>(null),
    menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobile || !isMobile) return;
    sidebarRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, [mobile, isMobile]);
  const closeMenu = () => {
    setMobile(false);
    menuRef.current?.focus();
  };
  const unread = store.conversations.reduce((n, c) => n + c.unread, 0),
    human = store.conversations.filter((c) => c.human).length;
  const update = (patch: Partial<Store>) => {
    setStore((s) => ({ ...s, ...patch }));
    if (patch.shopName) registry.rename(storeId, patch.shopName);
  };
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Перейти к содержимому
      </a>
      <aside
        id="workspace-navigation"
        ref={sidebarRef}
        inert={isMobile && !mobile}
        onKeyDown={(e) => {
          if (!mobile || !isMobile) return;
          if (e.key === "Escape") {
            e.preventDefault();
            closeMenu();
          }
          if (e.key === "Tab") {
            const nodes = sidebarRef.current?.querySelectorAll<HTMLElement>(
              "a[href],button:not(:disabled),select",
            );
            if (!nodes?.length) return;
            const first = nodes[0],
              last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
        className={mobile ? "sidebar open" : "sidebar"}
      >
        <button
          className="icon-button sidebar-close"
          aria-label="Закрыть меню"
          onClick={closeMenu}
        >
          <X size={21} />
        </button>
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Sparkles size={22} />
          </span>
          <span>
            seller<span className="brand-ai">ai</span>
            <small>ПРОДАВАЙТЕ УМНЕЕ</small>
          </span>
        </Link>
        <div className="shop-picker">
          <label>
            Ваш магазин
            <Select
              aria-label="Выбор магазина"
              value={storeId}
              onChange={(e) => registry.choose(e.target.value)}
            >
              {registry.workspace.stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id === storeId ? store.shopName : s.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="nav-label">УПРАВЛЕНИЕ</div>
        <nav>
          {nav.map((n) => (
            <Link
              onClick={() => setMobile(false)}
              key={n.id}
              href={n.id === "dashboard" ? "/" : `/${n.id}`}
              aria-current={section === n.id ? "page" : undefined}
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
          aria-label="Закрыть навигацию"
          onClick={closeMenu}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              ref={menuRef}
              className="icon-button mobile-menu"
              aria-label="Открыть меню"
              aria-controls="workspace-navigation"
              aria-expanded={mobile}
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
        <main id="main-content" tabIndex={-1}>
          {(storageError || registry.error) && (
            <div role="alert" className="notice">
              {storageError || registry.error}
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
                <Assistant store={store} update={update} storeId={storeId} />
              )}
              {section === "learning" && (
                <Learning store={store} storeId={storeId} />
              )}
              {section === "seller" && (
                <Seller store={store} storeId={storeId} />
              )}
              {section === "settings" && (
                <SettingsPanel store={store} update={update} resetSeed={seed} />
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
