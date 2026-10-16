"use client";
import { useCallback, useEffect, useState, type SetStateAction } from "react";
/** A fixed-key, browser-local repository. Invalid source data is never overwritten. */
export function usePersistentState<T>(
  key: string,
  seed: T,
  parse: (raw: string) => T | null,
) {
  const [data, setData] = useState<T>(seed),
    [ready, setReady] = useState(false),
    [dirty, setDirty] = useState(false),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState("");
  /* eslint-disable react-hooks/set-state-in-effect -- Synchronize a browser-only external store after SSR. */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const saved = parse(raw);
        if (saved === null) {
          setError(
            "Сохранённые данные повреждены или имеют несовместимую структуру. Исходная запись сохранена; изменения этого раздела остаются в памяти.",
          );
          setBlocked(true);
        } else setData(saved);
      }
    } catch {
      setError(
        "Хранилище браузера недоступно. Изменения этого раздела остаются в памяти.",
      );
      setBlocked(true);
    }
    setReady(true);
  }, [key, parse]);
  useEffect(() => {
    if (ready && dirty && !blocked)
      try {
        localStorage.setItem(key, JSON.stringify(data));
        setError("");
      } catch {
        setError(
          "Не удалось сохранить изменения: хранилище переполнено или недоступно. Экспортируйте важные данные.",
        );
      }
  }, [data, ready, dirty, blocked, key]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const update = useCallback((next: SetStateAction<T>) => {
    setData(next);
    setDirty(true);
  }, []);
  return { data, update, ready, error, blocked };
}
