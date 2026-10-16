"use client";
import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
type Theme = "system" | "dark" | "light";
function snapshot(): Theme {
  try {
    const t = localStorage.getItem("davio:theme");
    return t === "dark" || t === "light" ? t : "system";
  } catch {
    return "system";
  }
}
function subscribe(listener: () => void) {
  window.addEventListener("davio-theme", listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener("davio-theme", listener);
    window.removeEventListener("storage", listener);
  };
}
export default function ThemeSwitch() {
  const theme = useSyncExternalStore(
    subscribe,
    snapshot,
    () => "system" as Theme,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  return (
    <button
      type="button"
      className="dv-icon"
      aria-label={`Тема: ${theme === "system" ? "системная" : theme === "dark" ? "тёмная" : "светлая"}. Переключить тему`}
      title="Переключить тему"
      onClick={() => {
        const next: Theme =
          theme === "system" ? "dark" : theme === "dark" ? "light" : "system";
        try {
          localStorage.setItem("davio:theme", next);
          window.dispatchEvent(new Event("davio-theme"));
        } catch {
          document.documentElement.dataset.theme =
            next === "system"
              ? matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light"
              : next;
        }
      }}
    >
      {theme === "dark" ? (
        <Moon size={19} />
      ) : theme === "light" ? (
        <Sun size={19} />
      ) : (
        <Monitor size={19} />
      )}
    </button>
  );
}
