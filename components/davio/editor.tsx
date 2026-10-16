"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Upload,
  ImageIcon,
  FileText,
  Film,
  Download,
  Save,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
  Copy,
  Check,
  RotateCcw,
} from "lucide-react";
import { api, assetUrl, post, patch } from "@/lib/davio/client";
import {
  emptyProject,
  type Project,
  type ProjectData,
  type Revision,
} from "@/lib/davio/types";
import { copyText } from "@/lib/client/clipboard";
import { useAccount } from "./shell";
type Tab = "details" | "text" | "photo" | "video" | "export";
const tabs = [
  { id: "details", label: "Товар", icon: ImageIcon },
  { id: "text", label: "Описание", icon: FileText },
  { id: "photo", label: "Фотографии", icon: Sparkles },
  { id: "video", label: "Видео", icon: Film },
  { id: "export", label: "Экспорт", icon: Download },
] as const;
export default function ProjectEditor({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null),
    [draft, setDraft] = useState<ProjectData>({ ...emptyProject }),
    [savedData, setSavedData] = useState<ProjectData>({ ...emptyProject }),
    [editingRevision, setEditingRevision] = useState(1),
    [tab, setTab] = useState<Tab>("details"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [drag, setDrag] = useState(false),
    [selected, setSelected] = useState(""),
    [revisions, setRevisions] = useState<Revision[]>([]),
    [showVersions, setShowVersions] = useState(false);
  const [brightness, setBrightness] = useState(1),
    [contrast, setContrast] = useState(1),
    [warmth, setWarmth] = useState(1),
    [sharpen, setSharpen] = useState(false),
    [aspect, setAspect] = useState("original"),
    [fit, setFit] = useState("contain"),
    [width, setWidth] = useState(1600),
    [quality, setQuality] = useState(90);
  const [videoAspect, setVideoAspect] = useState("9:16"),
    [duration, setDuration] = useState(9),
    [videoIds, setVideoIds] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const { usage, refresh } = useAccount();
  const base = `projects/${id}`;
  const dirty =
    !!project && JSON.stringify(draft) !== JSON.stringify(savedData);
  useEffect(() => {
    let active = true;
    api<Project>(`projects/${id}`)
      .then((p) => {
        if (active) {
          setProject(p);
          setDraft(p.data);
          setSavedData(p.data);
          setEditingRevision(p.revision);
          setSelected(p.assets.find((a) => a.kind === "original")?.id || "");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    const navigate = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !anchor ||
        anchor.download ||
        anchor.target === "_blank" ||
        anchor.hash ||
        anchor.href.includes("/api/")
      )
        return;
      const url = new URL(anchor.href);
      if (
        url.origin === location.origin &&
        url.pathname !== location.pathname &&
        !confirm("Есть несохранённые изменения текста. Выйти без сохранения?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", handler);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", handler);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
  const processing = project?.jobs.some(
    (j) => j.status === "queued" || j.status === "processing",
  );
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => {
      api<Project>(`projects/${id}`)
        .then(setProject)
        .catch((e) => setError(e.message));
    }, 2000);
    return () => clearInterval(timer);
  }, [processing, id]);
  const originals = project?.assets.filter((a) => a.kind === "original") || [],
    photos = project?.assets.filter((a) => a.kind === "photo") || [],
    videos = project?.assets.filter((a) => a.kind === "video") || [];
  const source = originals.find((a) => a.id === selected) || originals[0],
    after = photos.filter((a) => a.sourceId === source?.id).at(-1);
  function change<K extends keyof ProjectData>(key: K, value: ProjectData[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось выполнить действие.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!project) throw new Error("Проект ещё не загружен.");
    const p = await patch<Project>(base, {
      data: draft,
      revision: editingRevision,
    });
    setProject(p);
    setDraft(p.data);
    setSavedData(p.data);
    setEditingRevision(p.revision);
    return p;
  }
  async function upload(files: File[]) {
    if (!project || !files.length) return;
    if (originals.length + files.length > 10) {
      setError(
        "Не более 10 исходных фото. Уберите ненужные фотографии из проекта.",
      );
      return;
    }
    await run(async () => {
      let last: Project | undefined;
      try {
        for (let i = 0; i < files.length; i++) {
          setStatus(`Загружаем фото ${i + 1} из ${files.length}…`);
          const data = new FormData();
          data.append("file", files[i]);
          last = await api<Project>(`${base}/photos`, {
            method: "POST",
            body: data,
          });
          setProject(last);
        }
      } finally {
        if (last) {
          setSelected(
            last.assets.filter((a) => a.kind === "original").at(-1)?.id || "",
          );
          await refresh();
        }
      }
      setStatus("Фотографии сохранены. Исходники доступны отдельно.");
    });
  }
  async function movePhoto(from: number, to: number) {
    const ids = originals.map((a) => a.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];
    await run(async () => {
      setProject(await patch<Project>(`${base}/assets`, { ids }));
      setStatus("Порядок фотографий сохранён.");
    });
  }
  const descriptionAction = (action: string) =>
    run(async () => {
      await save();
      const result = await post<{
        description: string;
        advantages: string;
        recommendations: string;
      }>(`${base}/describe`, { action });
      setDraft((d) => ({
        ...d,
        description: result.description,
        advantages: result.advantages,
      }));
      setStatus(
        `Локальный шаблон готов. ${result.recommendations} Нажмите «Сохранить».`,
      );
      await refresh();
    });
  if (!project)
    return (
      <div className="dv-empty">
        {error ? <p role="alert">{error}</p> : "Загружаем проект…"}
      </div>
    );
  return (
    <>
      <Link className="dv-link dv-back" href="/listings">
        <ArrowLeft size={16} />
        Все объявления
      </Link>
      <div className="dv-page-heading dv-editor-heading">
        <div>
          <span className="dv-eyebrow">ПРОЕКТ ОБЪЯВЛЕНИЯ · ЧЕРНОВИК</span>
          <h1>{draft.title || "Новый товар"}</h1>
          <p>
            {dirty ? "Есть несохранённые правки текста" : "Изменения сохранены"}{" "}
            · Фото и видео сохраняются отдельно
          </p>
        </div>
        <button
          className="dv-button primary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await save();
              setStatus("Проект сохранён.");
            })
          }
        >
          {busy ? <span className="dv-spinner" /> : <Save size={17} />}Сохранить
        </button>
      </div>
      <fieldset disabled={busy} className="dv-editor-fields">
        <legend className="dv-sr-only">Редактор объявления</legend>
        <div className="dv-tabs" aria-label="Разделы редактора">
          {tabs.map((t) => (
            <button
              className={tab === t.id ? "active" : ""}
              key={t.id}
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={17} />
              {t.label}
            </button>
          ))}
        </div>
        {error && (
          <div className="dv-alert" role="alert">
            {error}
          </div>
        )}
        {status && (
          <div className="dv-status" role="status">
            <Check size={17} />
            {status}
          </div>
        )}
        {tab === "details" && (
          <div className="dv-editor-grid">
            <section className="dv-card dv-form">
              <div className="dv-section-title">
                <h2>Сначала — ваш товар</h2>
                <span className="dv-tag">Авито · ручная публикация</span>
              </div>
              <label>
                Название товара
                <input
                  value={draft.title}
                  maxLength={120}
                  placeholder="Например, горный велосипед"
                  onChange={(e) => change("title", e.target.value)}
                />
              </label>
              <div className="dv-field-grid">
                <label>
                  Категория
                  <input
                    value={draft.category}
                    maxLength={100}
                    placeholder="Велосипеды"
                    onChange={(e) => change("category", e.target.value)}
                  />
                </label>
                <label>
                  Цена, ₽
                  <input
                    type="number"
                    min="0"
                    max="1000000000"
                    value={draft.price ?? ""}
                    onChange={(e) =>
                      change(
                        "price",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                  />
                </label>
              </div>
              <label>
                Что важно знать о товаре
                <textarea
                  rows={4}
                  value={draft.facts}
                  maxLength={5000}
                  placeholder="Только подтверждённые факты: размер, материалы, особенности"
                  onChange={(e) => change("facts", e.target.value)}
                />
              </label>
              <label>
                Состояние
                <input
                  value={draft.condition}
                  maxLength={200}
                  placeholder="Б/у, следы эксплуатации…"
                  onChange={(e) => change("condition", e.target.value)}
                />
              </label>
              <details className="dv-details">
                <summary>Бренд, модель, комплектация и другие детали</summary>
                <div className="dv-field-grid">
                  <label>
                    Бренд
                    <input
                      value={draft.brand}
                      maxLength={100}
                      onChange={(e) => change("brand", e.target.value)}
                    />
                  </label>
                  <label>
                    Модель
                    <input
                      value={draft.model}
                      maxLength={100}
                      onChange={(e) => change("model", e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Комплектация
                  <textarea
                    value={draft.equipment}
                    rows={2}
                    maxLength={3000}
                    onChange={(e) => change("equipment", e.target.value)}
                  />
                </label>
                <label>
                  Дефекты и особенности
                  <textarea
                    value={draft.defects}
                    rows={2}
                    maxLength={3000}
                    placeholder="Укажите известные дефекты. Не скрывайте их на фото."
                    onChange={(e) => change("defects", e.target.value)}
                  />
                </label>
                <label>
                  Условия доставки и дополнительная информация
                  <textarea
                    rows={3}
                    maxLength={5000}
                    value={draft.extra}
                    onChange={(e) => change("extra", e.target.value)}
                  />
                </label>
              </details>
              <div className="dv-actions">
                <button
                  className="dv-button primary"
                  disabled={busy || !draft.title.trim()}
                  onClick={() => {
                    setTab("text");
                    void descriptionAction("generate");
                  }}
                >
                  <Sparkles size={17} />
                  Создать описание
                </button>
                <span className="dv-hint">
                  Без API · только из ваших фактов
                </span>
              </div>
            </section>
            <section className="dv-card dv-form">
              <div className="dv-section-title">
                <h2>Фотографии</h2>
                <small>{originals.length} / 10</small>
              </div>
              <div
                className={`dv-upload ${drag ? "drag" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  void upload(Array.from(e.dataTransfer.files));
                }}
              >
                <Upload size={28} />
                <h3>Добавьте фотографии товара</h3>
                <p>Перетащите сюда или выберите файлы</p>
                <button
                  className="dv-button"
                  disabled={busy || originals.length >= 10}
                  onClick={() => input.current?.click()}
                >
                  Выбрать фотографии
                </button>
                <small>
                  JPEG, PNG, WEBP · до 15 МБ каждое
                  <br />
                  HEIC предварительно конвертируйте в JPEG
                </small>
                <input
                  ref={input}
                  aria-label="Фотографии товара"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    void upload(Array.from(e.target.files || []));
                    e.target.value = "";
                  }}
                />
              </div>
              <div className="dv-photo-grid">
                {originals.map((a, i) => (
                  <div className="dv-photo-item" key={a.id}>
                    <Image
                      unoptimized
                      width={1600}
                      height={1200}
                      alt={`Фото товара ${i + 1}`}
                      src={assetUrl(a.id)}
                    />
                    {i === 0 && <span className="dv-tag">Основное</span>}
                    <div className="dv-actions">
                      <button
                        className="dv-icon"
                        aria-label={`Фото ${i + 1} влево`}
                        disabled={busy || i === 0}
                        onClick={() => void movePhoto(i, i - 1)}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        className="dv-icon"
                        aria-label={`Фото ${i + 1} вправо`}
                        disabled={busy || i === originals.length - 1}
                        onClick={() => void movePhoto(i, i + 1)}
                      >
                        <ChevronRight size={16} />
                      </button>
                      <button
                        className="dv-icon"
                        aria-label={`Убрать фото ${i + 1}`}
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            setProject(
                              await patch<Project>(`${base}/assets`, {
                                ids: originals
                                  .filter((x) => x.id !== a.id)
                                  .map((x) => x.id),
                              }),
                            );
                            setStatus(
                              "Фото убрано из объявления. Исходный файл сохранён на сервере.",
                            );
                          })
                        }
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="dv-hint">
                Распознавание товара по фото и генеративные фоны требуют
                отдельного AI-провайдера. Сейчас доступна настоящая базовая
                коррекция.
              </p>
            </section>
          </div>
        )}
        {tab === "text" && (
          <div className="dv-editor-grid">
            <section className="dv-card dv-form">
              <span className="dv-tag">Локальный шаблон · без нейросети</span>
              <h2>Объявление вашим голосом</h2>
              <p>
                Структурируем только введённые факты. Неизвестные характеристики
                не добавляются. Результат можно редактировать.
              </p>
              <label>
                Стиль
                <select
                  value={draft.style}
                  onChange={(e) =>
                    change("style", e.target.value as ProjectData["style"])
                  }
                >
                  <option value="brief">Краткий</option>
                  <option value="standard">Стандартный</option>
                  <option value="detailed">Подробный</option>
                </select>
              </label>
              <div className="dv-actions">
                <button
                  className="dv-button primary"
                  disabled={busy}
                  onClick={() => void descriptionAction("generate")}
                >
                  <Sparkles size={17} />
                  Сгенерировать
                </button>
                <button
                  className="dv-button"
                  disabled={busy}
                  onClick={() => void descriptionAction("rewrite")}
                >
                  Переписать
                </button>
                <button
                  className="dv-button"
                  disabled={busy}
                  onClick={() => void descriptionAction("shorten")}
                >
                  Сделать короче
                </button>
                <button
                  className="dv-button"
                  disabled={busy}
                  onClick={() => void descriptionAction("improve")}
                >
                  Улучшить структуру
                </button>
              </div>
              <small>
                Эти действия заново собирают текст из полей товара. Ручные
                правки текущего описания предварительно сохраняются как версия.
                Фото и видео не пересоздаются.
              </small>
              <details
                className="dv-details"
                open={showVersions}
                onToggle={(e) => setShowVersions(e.currentTarget.open)}
              >
                <summary
                  onClick={() => {
                    api<Revision[]>(`${base}/revisions`)
                      .then(setRevisions)
                      .catch((e) => setError(e.message));
                  }}
                >
                  История версий текста
                </summary>
                <p className="dv-hint">
                  Восстановление касается полей товара и текста. Материалы
                  сохраняются.
                </p>
                {revisions.map((r) => (
                  <div className="dv-revision" key={r.id}>
                    <span>
                      Версия {r.revision}
                      <small>
                        {new Date(r.createdAt).toLocaleString("ru-RU")}
                      </small>
                    </span>
                    <button
                      className="dv-icon"
                      disabled={busy || r.revision === project.revision}
                      aria-label={`Восстановить версию ${r.revision}`}
                      onClick={() => {
                        if (
                          confirm(
                            "Восстановить текст этой версии? Текущие несохранённые правки будут заменены.",
                          )
                        )
                          void run(async () => {
                            const p = await post<Project>(`${base}/restore`, {
                              id: r.id,
                              revision: editingRevision,
                            });
                            setProject(p);
                            setDraft(p.data);
                            setSavedData(p.data);
                            setEditingRevision(p.revision);
                            setStatus(
                              "Текст восстановлен. Фото и видео сохранены.",
                            );
                            setRevisions(await api(`${base}/revisions`));
                          });
                      }}
                    >
                      <RotateCcw size={16} />
                    </button>
                  </div>
                ))}
              </details>
            </section>
            <section className="dv-card dv-form">
              <label>
                Заголовок объявления
                <input
                  value={draft.title}
                  maxLength={120}
                  onChange={(e) => change("title", e.target.value)}
                />
              </label>
              <label>
                Описание объявления
                <textarea
                  rows={14}
                  maxLength={10000}
                  value={draft.description}
                  onChange={(e) => change("description", e.target.value)}
                />
              </label>
              <label>
                Подтверждённые преимущества
                <textarea
                  rows={3}
                  maxLength={5000}
                  value={draft.advantages}
                  onChange={(e) => change("advantages", e.target.value)}
                />
              </label>
              <button
                className="dv-button"
                onClick={async () =>
                  setStatus(
                    (await copyText(`${draft.title}\n\n${draft.description}`))
                      ? "Текст скопирован."
                      : "Не удалось скопировать. Выделите текст вручную.",
                  )
                }
              >
                <Copy size={16} />
                Копировать текст
              </button>
            </section>
          </div>
        )}
        {tab === "photo" && (
          <div className="dv-editor-grid">
            <section className="dv-card dv-form">
              <h2>Подготовить фотографии</h2>
              <p>
                Базовая коррекция через Sharp. Цвет, дефекты и реальное
                состояние товара должны оставаться достоверными.
              </p>
              {!source ? (
                <p>Сначала загрузите фото на вкладке «Товар».</p>
              ) : (
                <>
                  <label>
                    Исходная фотография
                    <select
                      value={source.id}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      {originals.map((a, i) => (
                        <option key={a.id} value={a.id}>
                          {i + 1}. {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Яркость · {brightness.toFixed(2)}
                    <input
                      type="range"
                      min="0.8"
                      max="1.2"
                      step="0.01"
                      value={brightness}
                      onChange={(e) => setBrightness(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Контраст · {contrast.toFixed(2)}
                    <input
                      type="range"
                      min="0.8"
                      max="1.2"
                      step="0.01"
                      value={contrast}
                      onChange={(e) => setContrast(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Баланс цвета · {warmth.toFixed(2)}
                    <input
                      type="range"
                      min="0.9"
                      max="1.1"
                      step="0.01"
                      value={warmth}
                      onChange={(e) => setWarmth(Number(e.target.value))}
                    />
                  </label>
                  <label className="dv-checkbox">
                    <input
                      type="checkbox"
                      checked={sharpen}
                      onChange={(e) => setSharpen(e.target.checked)}
                    />
                    Мягкое повышение резкости
                  </label>
                  <details className="dv-details">
                    <summary>Кадрирование, размер и качество</summary>
                    <label>
                      Соотношение сторон
                      <select
                        value={aspect}
                        onChange={(e) => setAspect(e.target.value)}
                      >
                        {["original", "1:1", "4:3", "3:4", "9:16", "16:9"].map(
                          (v) => (
                            <option key={v} value={v}>
                              {v === "original" ? "Как в оригинале" : v}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <label>
                      Кадрирование
                      <select
                        value={fit}
                        onChange={(e) => setFit(e.target.value)}
                      >
                        <option value="contain">Товар целиком с полями</option>
                        <option value="cover">
                          Заполнить кадр с обрезкой краёв
                        </option>
                      </select>
                    </label>
                    <label>
                      Ширина, px
                      <select
                        value={width}
                        onChange={(e) => setWidth(Number(e.target.value))}
                      >
                        {[800, 1200, 1600, 2400].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Качество JPEG · {quality}
                      <input
                        type="range"
                        min="70"
                        max="95"
                        value={quality}
                        onChange={(e) => setQuality(Number(e.target.value))}
                      />
                    </label>
                  </details>
                  <button
                    className="dv-button primary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        setProject(
                          await post<Project>(`${base}/correct`, {
                            sourceId: source.id,
                            brightness,
                            contrast,
                            warmth,
                            sharpen,
                            aspect,
                            fit,
                            width,
                            quality,
                          }),
                        );
                        setStatus(
                          "Обработанная версия сохранена отдельно. Оригинал не изменён.",
                        );
                        await refresh();
                      })
                    }
                  >
                    <Sparkles size={17} />
                    Обработать фотографию
                  </button>
                  <small>
                    Удаление фона, надписей и создание новых сцен пока
                    недоступны. Новые ракурсы не генерируются.
                  </small>
                </>
              )}
            </section>
            <section className="dv-card dv-form">
              <h2>До / После</h2>
              {after && (
                <details className="dv-details">
                  <summary>Параметры сохранённой обработки</summary>
                  <p>
                    Яркость: {String(after.settings.brightness ?? "неизвестна")}
                    ; контраст:{" "}
                    {String(after.settings.contrast ?? "неизвестен")}; баланс:{" "}
                    {String(after.settings.warmth ?? "неизвестен")}; ширина:{" "}
                    {String(after.settings.width ?? "неизвестна")} px; качество
                    JPEG: {String(after.settings.quality ?? "неизвестно")}.
                    Параметры также включены в project.json при экспорте.
                  </p>
                </details>
              )}
              <div className="dv-compare">
                {source && (
                  <figure>
                    <Image
                      unoptimized
                      width={1600}
                      height={1200}
                      alt="Оригинал"
                      src={assetUrl(source.id)}
                    />
                    <figcaption>Оригинал</figcaption>
                  </figure>
                )}
                {after ? (
                  <figure>
                    <Image
                      unoptimized
                      width={1600}
                      height={1200}
                      alt="Обработанная версия"
                      src={assetUrl(after.id)}
                    />
                    <figcaption>Обработано · JPEG</figcaption>
                  </figure>
                ) : (
                  <div className="dv-empty">
                    <ImageIcon size={27} />
                    <p>После обработки появится результат</p>
                  </div>
                )}
              </div>
              {after && (
                <a
                  className="dv-button"
                  href={assetUrl(after.id, true)}
                  download
                >
                  <Download size={16} />
                  Скачать результат
                </a>
              )}
              {photos.length > 0 && (
                <details className="dv-details">
                  <summary>Все обработанные версии · {photos.length}</summary>
                  <div className="dv-photo-grid">
                    {photos.map((a) => (
                      <a key={a.id} href={assetUrl(a.id, true)} download>
                        <Image
                          unoptimized
                          width={1600}
                          height={1200}
                          alt="Обработанное фото"
                          src={assetUrl(a.id)}
                        />
                        <small>Скачать JPEG</small>
                      </a>
                    ))}
                  </div>
                </details>
              )}
            </section>
          </div>
        )}
        {tab === "video" && (
          <div className="dv-editor-grid">
            <section className="dv-card dv-form">
              <span className="dv-tag">Реальный монтаж · FFmpeg</span>
              <h2>Короткая история вашего товара</h2>
              <p>
                Плавное приближение, мягкие затемнения между кадрами и название
                товара. Без генерации вымышленных сцен.
              </p>
              <div className="dv-field-grid">
                <label>
                  Формат
                  <select
                    value={videoAspect}
                    onChange={(e) => setVideoAspect(e.target.value)}
                  >
                    <option value="9:16">Вертикальный · 1080 × 1920</option>
                    <option value="16:9">Горизонтальный · 1920 × 1080</option>
                  </select>
                </label>
                <label>
                  Длительность
                  <select
                    aria-label="Длительность"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  >
                    {[6, 9, 12, 15, 20, 30].map((n) => (
                      <option key={n} value={n}>
                        {n} секунд
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <details className="dv-details">
                <summary>Выбрать фотографии для монтажа</summary>
                <p className="dv-hint">
                  По умолчанию — все исходники в заданном порядке. Отметьте до
                  10 фото; порядок — как в списке.
                </p>
                {[...originals, ...photos].map((a) => (
                  <label className="dv-checkbox" key={a.id}>
                    <input
                      type="checkbox"
                      checked={videoIds.includes(a.id)}
                      onChange={(e) =>
                        setVideoIds((ids) =>
                          e.target.checked
                            ? [...ids, a.id]
                            : ids.filter((id) => id !== a.id),
                        )
                      }
                    />
                    {a.kind === "photo" ? "Обработанное: " : ""}
                    {a.name}
                  </label>
                ))}
              </details>
              <button
                className="dv-button primary"
                disabled={
                  busy || !originals.length || !draft.title.trim() || processing
                }
                onClick={() =>
                  void run(async () => {
                    await save();
                    await post(`${base}/video`, {
                      sourceIds: videoIds.length
                        ? videoIds
                        : originals.map((a) => a.id),
                      aspect: videoAspect,
                      duration,
                    });
                    setProject(await api<Project>(base));
                    await refresh();
                    setStatus(
                      "Задача поставлена в очередь. Можно перейти в другой раздел — worker продолжит работу.",
                    );
                  })
                }
              >
                <Film size={17} />
                Создать MP4
              </button>
              <small>
                H.264 · 24 кадра/с · без звуковой дорожки. Музыка и озвучивание
                в этой версии не подключены.
              </small>
              {!usage.worker.online && (
                <div className="dv-alert">
                  Для монтажа запустите <code>npm run worker</code> во втором
                  терминале. Готовое видео будет сохранено в проекте.
                </div>
              )}
              <div className="dv-job-list">
                {project.jobs.map((j) => (
                  <div className="dv-job" key={j.id}>
                    <div>
                      <strong>
                        {
                          {
                            queued: "Ожидает",
                            processing: "Обрабатывается",
                            completed: "Готово",
                            failed: "Ошибка",
                          }[j.status]
                        }
                      </strong>
                      <small>
                        {new Date(j.createdAt).toLocaleString("ru-RU")}
                      </small>
                    </div>
                    {j.status === "processing" ? (
                      <progress
                        max="100"
                        value={j.progress}
                        aria-label="Прогресс монтажа"
                      />
                    ) : null}
                    {j.error && (
                      <p className="dv-error">
                        {j.error} Выберите фото и повторите монтаж.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
            <section className="dv-card dv-form">
              <h2>Готовые видео</h2>
              {!videos.length ? (
                <div className="dv-empty">
                  <Film size={35} />
                  <p>Здесь появится настоящий файл MP4</p>
                  <small>Предпросмотр не заменяет рендер</small>
                </div>
              ) : (
                videos.map((a) => (
                  <div key={a.id} className="dv-video-result">
                    <video
                      controls
                      playsInline
                      preload="metadata"
                      src={assetUrl(a.id)}
                    />
                    <a
                      className="dv-button"
                      href={assetUrl(a.id, true)}
                      download
                    >
                      <Download size={16} />
                      Скачать MP4
                    </a>
                  </div>
                ))
              )}
            </section>
          </div>
        )}
        {tab === "export" && (
          <section className="dv-card dv-form">
            <span className="dv-tag">ПУБЛИКАЦИЯ ПОД ВАШИМ КОНТРОЛЕМ</span>
            <h2>Всё готово к следующему шагу</h2>
            <p>
              Скачайте комплект или отдельные материалы и загрузите на Авито
              вручную. Подключений к аккаунтам и автоматических публикаций нет.
            </p>
            <div className="dv-actions">
              <button
                className="dv-button primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await save();
                    const response = await fetch(`/api/davio/${base}/export`);
                    if (!response.ok) {
                      const x = await response.json();
                      throw new Error(x.error);
                    }
                    const blob = await response.blob(),
                      url = URL.createObjectURL(blob),
                      link = document.createElement("a");
                    link.href = url;
                    link.download = `davio-${id}.zip`;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 30000);
                    setStatus(
                      "Комплект скачан: текст, метаданные и материалы проекта.",
                    );
                  })
                }
              >
                <Download size={17} />
                Скачать комплект ZIP
              </button>
              <button
                className="dv-button"
                onClick={async () =>
                  setStatus(
                    (await copyText(draft.title))
                      ? "Заголовок скопирован."
                      : "Не удалось скопировать.",
                  )
                }
              >
                <Copy size={16} />
                Заголовок
              </button>
              <button
                className="dv-button"
                onClick={async () =>
                  setStatus(
                    (await copyText(draft.description))
                      ? "Описание скопировано."
                      : "Не удалось скопировать.",
                  )
                }
              >
                <Copy size={16} />
                Описание
              </button>
            </div>
            <div className="dv-export-list">
              {project.assets.map((a, i) => (
                <a
                  key={a.id}
                  href={assetUrl(a.id, true)}
                  download
                  className="dv-export-item"
                >
                  {a.kind === "video" ? (
                    <Film size={18} />
                  ) : (
                    <ImageIcon size={18} />
                  )}
                  <span>
                    {a.kind === "original"
                      ? "Исходник"
                      : a.kind === "photo"
                        ? "Обработанное фото"
                        : "Видео MP4"}{" "}
                    · {i + 1}
                    <small>
                      {a.name} · {(a.size / 1024 / 1024).toFixed(2)} МБ
                    </small>
                  </span>
                  <Download size={17} />
                </a>
              ))}
            </div>
            <p className="dv-hint">
              ZIP ограничен 150 МБ. Более крупные материалы скачивайте по
              отдельности. Экспорт содержит метаданные, но автоматический импорт
              ZIP пока не реализован.
            </p>
          </section>
        )}
      </fieldset>
    </>
  );
}
