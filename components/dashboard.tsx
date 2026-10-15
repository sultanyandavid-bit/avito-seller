"use client";
import Link from "next/link";
import {
  Package,
  MessagesSquare,
  UserRound,
  Clock,
  Plus,
  ArrowRight,
  ArrowUpRight,
  Check,
  TrendingUp,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import type { Store } from "@/lib/types";
import { money } from "@/lib/demo";
import ProductArt from "./product-art";
import Heading from "./heading";
export default function Dashboard({
  store,
  unread,
  human,
}: {
  store: Store;
  unread: number;
  human: number;
}) {
  const stats = [
    {
      label: "Объявления",
      value: store.products.length,
      icon: Package,
      note: `${store.products.filter((p) => p.status === "active").length} активных`,
      color: "mint",
    },
    {
      label: "Новые сообщения",
      value: unread,
      icon: MessagesSquare,
      note: "Ждут вашего ответа",
      color: "blue",
    },
    {
      label: "Активные диалоги",
      value: store.conversations.length,
      icon: UserRound,
      note: "В демомагазине",
      color: "purple",
    },
    {
      label: "Нужен ваш ответ",
      value: human,
      icon: Clock,
      note: "Переданы продавцу",
      color: "orange",
    },
  ];
  return (
    <>
      <Heading
        eyebrow="ВАШ МАГАЗИН ПОД КОНТРОЛЕМ"
        title="Хороший день для продаж"
        description="Все важное о вашем магазине — в одном месте."
      >
        <Link className="button primary" href="/products">
          <Plus size={17} /> Добавить товар
        </Link>
      </Heading>
      <div className="overview-banner">
        <div>
          <span className="mini-label">
            <span /> ДЕМОПРОСТРАНСТВО
          </span>
          <h2>
            Меньше рутины.
            <br />
            Больше возможностей.
          </h2>
          <p>
            Познакомьтесь с вашим новым помощником по продажам.
            <br />
            Настройте AI и попробуйте первый диалог.
          </p>
          <Link href="/assistant">
            Настроить ассистента <ArrowRight size={17} />
          </Link>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="orbit o1" />
          <div className="orbit o2" />
          <div className="orbit o3" />
          <div className="sparkle-tile">
            <Sparkles size={49} strokeWidth={1.5} />
          </div>
          <div className="floating-chip chip-a">
            <Check size={15} /> Ответ готов
          </div>
          <div className="floating-chip chip-b">
            <MessagesSquare size={17} /> Всегда на связи
          </div>
          <span className="star star-a">✧</span>
          <span className="star star-b">✦</span>
        </div>
      </div>
      <div className="stats-grid">
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-top">
              {s.label}
              <span className={`stat-icon ${s.color}`}>
                <s.icon size={18} />
              </span>
            </div>
            <strong>{s.value.toString().padStart(2, "0")}</strong>
            <small>{s.note}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel sales">
          <div className="panel-heading">
            <div>
              <h2>Обзор продаж</h2>
              <p>Демонстрационная статистика магазина</p>
            </div>
            <span className="period">
              За 7 дней <ChevronDown size={13} />
            </span>
          </div>
          <div className="sales-numbers">
            <div>
              <small>Выручка</small>
              <strong>
                186 700 <span>₽</span>
              </strong>
              <em>
                <TrendingUp size={14} /> 18,6% <span>к прошлой неделе</span>
              </em>
            </div>
            <div>
              <small>Продано товаров</small>
              <strong>
                8 <span>шт.</span>
              </strong>
              <em>
                +3 <span>к прошлой неделе</span>
              </em>
            </div>
          </div>
          <div
            className="chart"
            role="img"
            aria-label="Демонстрационная выручка по дням: 12, 19, 14, 28, 21, 34, 58 тысяч рублей"
          >
            <div className="chart-labels">
              <span>60 тыс.</span>
              <span>40 тыс.</span>
              <span>20 тыс.</span>
              <span>0</span>
            </div>
            <div className="bars">
              {[20, 32, 24, 47, 36, 57, 97].map((v, i) => (
                <div className="bar-column" key={i}>
                  <div
                    className={i === 6 ? "bar current" : "bar"}
                    style={{ height: `${v}%` }}
                  />
                  <span>{["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"][i]}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="panel assistant-card">
          <div className="panel-heading">
            <h2>Ваш AI-ассистент</h2>
            <span className="sparkle-icon">
              <Sparkles size={19} />
            </span>
          </div>
          <span className="status neutral">
            <span />{" "}
            {store.ai.enabled ? "Демоответы включены" : "Ожидает настройки"}
          </span>
          <h3>
            Помощник, который
            <br />
            знает ваши товары
          </h3>
          <p>Отвечает на типовые вопросы и передаёт сложные обращения вам.</p>
          <div className="feature-line">
            <Check size={15} /> Только проверенные данные о товаре
          </div>
          <div className="feature-line">
            <Check size={15} /> Контроль остаётся у вас
          </div>
          <Link className="button secondary" href="/assistant">
            Перейти к настройке <ArrowRight size={16} />
          </Link>
          <small>Без подключения внешней AI-модели</small>
        </section>
      </div>
      <div className="dashboard-grid bottom-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Последние диалоги</h2>
            <Link className="text-link" href="/messages">
              Все сообщения <ArrowUpRight size={15} />
            </Link>
          </div>
          {store.conversations.slice(0, 3).map((c, i) => (
            <Link href="/messages" className="conversation-row" key={c.id}>
              <span className={`avatar avatar-${i}`}>{c.name[0]}</span>
              <div>
                <strong>
                  {c.name}
                  {c.human && <span className="tiny-badge">Нужен ответ</span>}
                </strong>
                <p>{c.messages.at(-1)?.text}</p>
              </div>
              <small>
                {c.messages.at(-1)?.time}
                {c.unread > 0 && <b className="unread-dot">{c.unread}</b>}
              </small>
            </Link>
          ))}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Товары в фокусе</h2>
            <Link className="text-link" href="/products">
              Все товары <ArrowUpRight size={15} />
            </Link>
          </div>
          {store.products.slice(0, 3).map((p) => (
            <Link className="focus-product" href="/products" key={p.id}>
              <ProductArt kind={p.visual} small />
              <div>
                <strong>{p.name}</strong>
                <small>{p.stock} шт. в наличии</small>
              </div>
              <b>{money(p.price)}</b>
            </Link>
          ))}
          {!store.products.length && (
            <p className="empty">Добавьте первый товар в каталог.</p>
          )}
        </section>
      </div>
    </>
  );
}
