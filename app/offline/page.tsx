import Link from "next/link";
export default function Offline() {
  return (
    <main className="dv-offline-page">
      <span className="dv-mark">d.</span>
      <h1>DAVIO временно без сети</h1>
      <p>
        Подключитесь к интернету или локальному серверу, чтобы открыть проекты и
        продолжить обработку.
      </p>
      <p>
        Ваши материалы остаются на сервере. Эта страница не сохраняет их для
        работы офлайн.
      </p>
      <Link href="/" prefetch={false}>
        Попробовать снова →
      </Link>
    </main>
  );
}
