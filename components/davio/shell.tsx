"use client";
import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import {
  ArrowUpRight,
  LayoutGrid,
  FileText,
  MessagesSquare,
  Settings,
  LogOut,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import ThemeSwitch from "./theme";
import { api, post } from "@/lib/davio/client";
import type { DavioUser, Usage } from "@/lib/davio/types";
const Account = createContext<{
  user: DavioUser;
  usage: Usage;
  refresh: () => Promise<void>;
} | null>(null);
export function useAccount() {
  const value = useContext(Account);
  if (!value) throw new Error("Аккаунт не загружен.");
  return value;
}
const nav = [
  { id: "home", href: "/", label: "Главная", icon: LayoutGrid },
  { id: "listings", href: "/listings", label: "Объявления", icon: FileText },
  {
    id: "messages",
    href: "/messages",
    label: "Сообщения",
    icon: MessagesSquare,
  },
  { id: "settings", href: "/settings", label: "Настройки", icon: Settings },
];
export default function DavioShell({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<{
      user: DavioUser | null;
      usage: Usage | null;
    } | null>(null),
    [error, setError] = useState("");
  async function refresh() {
    try {
      setSession(await api("session"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Сервер недоступен.");
    }
  }
  useEffect(() => {
    let active = true;
    api<{ user: DavioUser | null; usage: Usage | null }>("session")
      .then((value) => {
        if (active) setSession(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="davio-app">
      <a className="skip-link" href="#davio-main">
        Перейти к содержимому
      </a>
      <aside className="dv-sidebar">
        <Link href="/" className="dv-logo">
          <span className="dv-mark">d.</span>DAVIO
        </Link>
        <p className="dv-slogan">
          Меньше рутины —<br />
          больше продаж.
        </p>
        <nav aria-label="Основная навигация">
          {nav.map((n) => (
            <Link
              key={n.id}
              href={n.href}
              aria-current={active === n.id ? "page" : undefined}
              className={active === n.id ? "dv-nav active" : "dv-nav"}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="dv-sidebar-bottom">
          <span className="dv-tag">
            <span className="dv-dot" />
            Локальное пространство
          </span>
          <p>
            Ваши материалы.
            <br />
            Ваш контроль.
          </p>
          <Link href="/settings">
            Возможности DAVIO <ArrowUpRight size={15} />
          </Link>
        </div>
      </aside>
      <div className="dv-main-shell">
        <header className="dv-topbar">
          <Link href="/" className="dv-mobile-logo">
            DAVIO<span>d.</span>
          </Link>
          <span className="dv-crumb">
            Рабочее пространство <span>/</span>{" "}
            {nav.find((n) => n.id === active)?.label || "Управление"}
          </span>
          <div className="dv-top-actions">
            <ThemeSwitch />
            {session?.user && (
              <>
                <span className="dv-user">{session.user.name}</span>
                <button
                  className="dv-icon"
                  aria-label="Выйти из аккаунта"
                  onClick={async () => {
                    try {
                      await post("logout");
                      setSession({ user: null, usage: null });
                    } catch (e) {
                      setError(String(e));
                    }
                  }}
                >
                  <LogOut size={18} />
                </button>
              </>
            )}
          </div>
        </header>
        <main id="davio-main" className="dv-content" tabIndex={-1}>
          {error ? (
            <div className="dv-alert" role="alert">
              {error}
              <button className="dv-button" onClick={() => void refresh()}>
                Повторить
              </button>
            </div>
          ) : !session ? (
            <div className="dv-empty" role="status">
              Загружаем DAVIO…
            </div>
          ) : session.user && session.usage ? (
            <Account.Provider
              value={{ user: session.user, usage: session.usage, refresh }}
            >
              {children}
            </Account.Provider>
          ) : (
            <AuthPanel onSuccess={refresh} />
          )}
        </main>
        <footer className="dv-footer">
          <span>DAVIO · создано для вашего дела</span>
          <span>Авито не подключено · публикация вручную</span>
        </footer>
      </div>
    </div>
  );
}
function AuthPanel({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [register, setRegister] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="dv-auth">
      <div className="dv-auth-story">
        <span className="dv-eyebrow">ВАШ ЦИФРОВОЙ ПОМОЩНИК</span>
        <h1>
          Товар — ваш.
          <br />
          Рутина — наша.
        </h1>
        <p>
          Фотографии, описание и короткое видео.
          <br />
          Одно объявление — одно рабочее пространство.
        </p>
        <div className="dv-auth-feature">
          <ShieldCheck size={20} />
          <span>
            Начните без платных API.
            <small>
              Текст по вашим фактам, настоящая обработка фото и монтаж MP4.
            </small>
          </span>
        </div>
        <Link href="/legacy/dashboard" className="dv-link">
          Открыть прежние демоинструменты <ArrowUpRight size={17} />
        </Link>
      </div>
      <section className="dv-card dv-auth-form">
        <span className="dv-tag">На этом сервере · без внешних сервисов</span>
        <h2>{register ? "Начнём с вашего пространства" : "С возвращением"}</h2>
        <p>
          Аккаунт защищает проекты и файлы. На другом сервере нужна отдельная
          регистрация.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              await post(
                register ? "register" : "login",
                Object.fromEntries(f),
              );
              await onSuccess();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Не удалось войти.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {register && (
            <label>
              Ваше имя
              <input name="name" autoComplete="name" required maxLength={60} />
            </label>
          )}
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
          <label>
            Пароль
            <input
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              minLength={12}
              maxLength={128}
              required
              placeholder="Не менее 12 символов"
            />
          </label>
          {error && (
            <p className="dv-error" role="alert">
              {error}
            </p>
          )}
          <button className="dv-button primary" disabled={busy}>
            {busy ? "Подождите…" : register ? "Создать аккаунт" : "Войти"}
            <ArrowRight size={17} />
          </button>
        </form>
        <button
          className="dv-link"
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
        >
          {register ? "Уже есть аккаунт? Войти" : "Первый раз? Создать аккаунт"}
        </button>
        <small>
          Почта не проверяется и письма не отправляются. Восстановление пароля
          по email пока недоступно. Сохраните пароль.
        </small>
      </section>
    </div>
  );
}
