"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  Plus,
  ArrowRight,
  ImageIcon,
  Film,
  FolderOpen,
  Clock,
  Copy,
  ArchiveRestore,
  Archive,
} from "lucide-react";
import { api, assetUrl, post } from "@/lib/davio/client";
import { emptyProject, type Project } from "@/lib/davio/types";
import { useAccount } from "./shell";
export default function Projects({ home = false }: { home?: boolean }) {
  const router = useRouter();
  const { user, usage, refresh } = useAccount();
  const [items, setItems] = useState<Project[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [archived, setArchived] = useState(false);
  async function load() {
    setItems(await api("projects"));
  }
  useEffect(() => {
    let active = true;
    api<Project[]>("projects")
      .then((value) => {
        if (active) setItems(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function action(run: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await run();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка запроса.");
    } finally {
      setBusy(false);
    }
  }
  const visible = (items || [])
      .filter((p) => p.archived === archived)
      .slice(0, home ? 4 : 1000),
    count = (items || []).filter((p) => !p.archived).length;
  return (
    <>
      <div className="dv-page-heading">
        <div>
          <span className="dv-eyebrow">
            {home
              ? "МЕНЬШЕ РУТИНЫ — БОЛЬШЕ ПРОДАЖ"
              : "ВСЁ ДЛЯ ВАШЕГО ОБЪЯВЛЕНИЯ"}
          </span>
          <h1>{home ? `Добрый день, ${user.name}` : "Объявления"}</h1>
          <p>
            {home
              ? "Какой товар подготовим к продаже сегодня?"
              : "Текст, фотографии и видео сохраняются вместе, а редактируются независимо."}
          </p>
        </div>
        <button
          className="dv-button primary"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              const p = await post<Project>("projects", { data: emptyProject });
              router.push(`/projects/${p.id}`);
            })
          }
        >
          <Plus size={18} />
          Создать объявление
        </button>
      </div>
      {home && (
        <section className="dv-hero">
          <div>
            <span className="dv-tag">ОДИН ТОВАР. ОДНО ПРОСТРАНСТВО.</span>
            <h2>
              От фотографии
              <br />
              до готового объявления.
            </h2>
            <p>
              Добавьте фото и несколько фактов.
              <br />
              DAVIO поможет подготовить всё остальное.
            </p>
            <button
              className="dv-button"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  const p = await post<Project>("projects", {
                    data: emptyProject,
                  });
                  router.push(`/projects/${p.id}`);
                })
              }
            >
              Начать с товара <ArrowRight size={17} />
            </button>
          </div>
          <div className="dv-hero-art" aria-hidden="true">
            <div className="dv-art-card a">
              <ImageIcon size={32} />
              <span>Подготовим фото</span>
            </div>
            <div className="dv-art-card b">
              <Film size={27} />
              <span>Соберём историю товара</span>
            </div>
            <div className="dv-art-stamp">d.</div>
          </div>
        </section>
      )}
      {error && (
        <p className="dv-alert" role="alert">
          {error}
        </p>
      )}
      <div className="dv-metrics">
        <div>
          <span>Проекты</span>
          <strong>{count}</strong>
        </div>
        <div>
          <span>Видеомонтаж за месяц</span>
          <strong>
            {usage.renders}
            <small> / {usage.plan.renders}</small>
          </strong>
        </div>
        <div>
          <span>Обработка</span>
          <strong className="dv-small-value">
            {usage.worker.online ? "Монтаж готов" : "Фото доступны"}
          </strong>
          <small>
            {usage.worker.online
              ? "Видео из ваших фотографий"
              : "Видео пока недоступно"}
          </small>
        </div>
      </div>
      <div className="dv-section-title">
        <h2>{home ? "Последние проекты" : "Ваши проекты"}</h2>
        {home ? (
          <Link className="dv-link" href="/listings">
            Все объявления <ArrowRight size={15} />
          </Link>
        ) : (
          <button className="dv-link" onClick={() => setArchived(!archived)}>
            {archived ? "Активные проекты" : "Архив"}
          </button>
        )}
      </div>
      {items === null ? (
        <div className="dv-empty">Загружаем проекты…</div>
      ) : !visible.length ? (
        <section className="dv-card dv-empty">
          <FolderOpen size={35} />
          <h2>
            {archived
              ? "В архиве пока пусто"
              : "Здесь начнётся история ваших товаров"}
          </h2>
          <p>Создайте объявление, добавьте фото и сохраните первый проект.</p>
        </section>
      ) : (
        <div className="dv-project-grid">
          {visible.map((p) => (
            <article className="dv-card dv-project-card" key={p.id}>
              <Link href={`/projects/${p.id}`} className="dv-project-cover">
                {p.assets.find((a) => a.kind !== "video") ? (
                  <Image
                    unoptimized
                    fill
                    alt=""
                    src={assetUrl(p.assets.find((a) => a.kind !== "video")!.id)}
                  />
                ) : (
                  <ImageIcon size={35} />
                )}
                <span className="dv-tag">
                  {p.archived ? "Архив" : "Черновик"}
                </span>
              </Link>
              <div className="dv-project-info">
                <Link href={`/projects/${p.id}`}>
                  <h3>{p.data.title || "Новый товар"}</h3>
                </Link>
                <p>{p.data.category || "Добавьте категорию"}</p>
                <small>
                  <Clock size={13} />
                  {new Date(p.updatedAt).toLocaleDateString("ru-RU")} ·{" "}
                  {p.assets.filter((a) => a.kind === "original").length} фото
                  {p.assets.some((a) => a.kind === "video") ? " · MP4" : ""}
                </small>
                <div className="dv-actions">
                  <Link href={`/projects/${p.id}`} className="dv-link">
                    Открыть <ArrowRight size={15} />
                  </Link>
                  <button
                    className="dv-icon"
                    disabled={busy}
                    title="Дублировать проект"
                    aria-label={`Дублировать ${p.data.title || "проект"}`}
                    onClick={() =>
                      void action(async () => {
                        await post(`projects/${p.id}/duplicate`);
                        await load();
                      })
                    }
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    className="dv-icon"
                    disabled={busy}
                    title={p.archived ? "Восстановить" : "В архив"}
                    aria-label={p.archived ? "Восстановить проект" : "В архив"}
                    onClick={() =>
                      void action(async () => {
                        await post(`projects/${p.id}/archive`, {
                          archived: !p.archived,
                        });
                        await load();
                      })
                    }
                  >
                    {p.archived ? (
                      <ArchiveRestore size={16} />
                    ) : (
                      <Archive size={16} />
                    )}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {home && (
        <div className="dv-capabilities">
          <span>
            <ImageIcon size={18} />
            Коррекция фото без API
          </span>
          <span>
            <Film size={18} />
            Настоящий монтаж MP4
          </span>
          <span>
            <FolderOpen size={18} />
            Проекты сохраняются на сервере
          </span>
        </div>
      )}
    </>
  );
}
