"use client";
import { useEffect, useState } from "react";
export default function Pwa() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return offline ? (
    <div className="dv-offline" role="status">
      Нет соединения. Серверные проекты и обработка недоступны. Сохраните
      несохранённый текст и повторите после подключения.
    </div>
  ) : null;
}
