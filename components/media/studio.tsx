"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Film, Upload, Play, StopCircle } from "lucide-react";
import { usePersistentState } from "@/lib/client/use-persistent-state";
import {
  emptyMedia,
  parseMedia,
  jobLabels,
  aspectSizes,
  type MediaJob,
  type Aspect,
} from "@/lib/media/types";
import { getAsset, uploadAsset, putAsset } from "@/lib/media/assets";
import { preparePhoto, recordSlideshow } from "@/lib/media/processors";
import Heading from "../heading";
import {downloadJson} from "@/lib/client/download";
import Select from "../ui/select";
import AssetPreview from "./asset-preview";
export default function MediaStudio({
  kind,
  storeId,
}: {
  kind: "photo" | "video";
  storeId: string;
}) {
  const seed = useMemo(() => emptyMedia(storeId), [storeId]),
    parse = useCallback((raw: string) => parseMedia(raw, storeId), [storeId]);
  const { data, update, ready, error } = usePersistentState(
    `sellerai:media-jobs:v1:${storeId}`,
    seed,
    parse,
  );
  const [mode, setMode] = useState<MediaJob["mode"]>("text"),
    [title, setTitle] = useState(""),
    [prompt, setPrompt] = useState(""),
    [category, setCategory] = useState(""),
    [style, setStyle] = useState("studio"),
    [colors, setColors] = useState(""),
    [environment, setEnvironment] = useState(""),
    [aspect, setAspect] = useState<Aspect>(kind === "photo" ? "1:1" : "9:16"),
    [count, setCount] = useState(1),
    [duration, setDuration] = useState(6),
    [brightness, setBrightness] = useState(1),
    [sources, setSources] = useState<string[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [activeId, setActiveId] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null),
    recovered = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!ready || recovered.current) return;
    recovered.current = true;
    if (
      data.jobs.some((j) => j.status === "processing" || j.status === "queued")
    )
      update((d) => ({
        ...d,
        jobs: d.jobs.map((j) =>
          j.status === "processing" || j.status === "queued"
            ? {
                ...j,
                status: "failed",
                error:
                  "Обработка прервалась при закрытии вкладки. Исходники сохранены.",
                updatedAt: new Date().toISOString(),
              }
            : j,
        ),
      }));
  }, [ready, data.jobs, update]);
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  async function upload(files: FileList) {
    if (sources.length + files.length > 10) {
      setMessage("Максимум 10 исходников.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const ids: string[] = [];
      for (const f of Array.from(files))
        ids.push(
          (await uploadAsset(storeId, f, kind === "video" && mode !== "local"))
            .id,
        );
      setSources((s) => [...s, ...ids]);
      setMessage("Исходники сохранены в этом браузере. Внешней отправки нет.");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Не удалось сохранить исходники.",
      );
    } finally {
      setBusy(false);
    }
  }
  const changeJob = (id: string, patch: Partial<MediaJob>) =>
    update((d) => ({
      ...d,
      jobs: d.jobs.map((j) =>
        j.id === id
          ? { ...j, ...patch, updatedAt: new Date().toISOString() }
          : j,
      ),
    }));
  async function execute(job: MediaJob) {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setActiveId(job.id);
    changeJob(job.id, { status: "processing", progress: 0, error: null });
    try {
      const assets = [];
      for (const id of job.sourceIds) {
        const a = await getAsset(storeId, id);
        if (!a || a.type !== "image")
          throw new Error(
            "Для локальной обработки нужны доступные фотографии этого магазина.",
          );
        assets.push(a);
      }
      if (!assets.length) throw new Error("Сначала добавьте фотографию.");
      const outputIds = [];
      if (job.kind === "photo") {
        for (let i = 0; i < job.count; i++) {
          abort.signal.throwIfAborted();
          const source = assets[i % assets.length];
          const factor = Math.max(
            0.8,
            Math.min(
              1.2,
              job.brightness +
                (job.count > 1 ? (i - (job.count - 1) / 2) * 0.02 : 0),
            ),
          );
          const blob = await preparePhoto(
            source.blob,
            job.aspect,
            factor,
            abort.signal,
          );
          abort.signal.throwIfAborted();
          outputIds.push(
            (
              await putAsset(
                storeId,
                blob,
                `sellerai-photo-${i + 1}.png`,
                "image",
                source.id,
              )
            ).id,
          );
          changeJob(job.id, {
            progress: Math.round(((i + 1) / job.count) * 100),
            outputIds: [...outputIds],
          });
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      } else {
        const blob = await recordSlideshow(
          assets.map((a) => a.blob),
          job.aspect,
          job.duration,
          job.style === "slideshow" ? "" : job.title,
          abort.signal,
          (p) => changeJob(job.id, { progress: p }),
        );
        abort.signal.throwIfAborted();
        outputIds.push(
          (
            await putAsset(
              storeId,
              blob,
              `sellerai-video.${blob.type.includes("mp4") ? "mp4" : "webm"}`,
              "video",
            )
          ).id,
        );
      }
      changeJob(job.id, {
        status: "completed",
        progress: 100,
        outputIds,
        error: null,
      });
      setMessage(
        job.kind === "photo"
          ? "Локальная подготовка фото завершена."
          : "Ролик записан из ваших фотографий. Это монтаж, не AI-генерация.",
      );
    } catch (e) {
      const text = abort.signal.aborted
        ? "Обработка остановлена. Исходники сохранены."
        : e instanceof Error
          ? e.message
          : "Ошибка обработки.";
      changeJob(job.id, { status: "failed", error: text });
      setMessage(text);
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }
  function createJob(copy?: MediaJob) {
    if (busy || !ready) return;
    if (data.jobs.length >= 200) {
      setMessage("Лимит 200 заданий. Экспортируйте и упорядочьте историю.");
      return;
    }
    const now = new Date().toISOString();
    const job: MediaJob = copy
      ? {
          ...copy,
          id: crypto.randomUUID(),
          status: copy.mode === "local" ? "queued" : "waiting_provider",
          progress: 0,
          outputIds: [],
          error: null,
          createdAt: now,
          updatedAt: now,
        }
      : {
          id: crypto.randomUUID(),
          storeId,
          kind,
          mode,
          status: mode === "local" ? "queued" : "waiting_provider",
          sourceIds: [...sources],
          outputIds: [],
          title: title.trim(),
          prompt: prompt.trim(),
          category,
          style,
          colors,
          environment,
          aspect,
          count: kind === "photo" ? count : 1,
          duration,
          brightness,
          progress: 0,
          error: null,
          createdAt: now,
          updatedAt: now,
        };
    if (!job.title) {
      setMessage("Укажите название товара.");
      return;
    }
    if (job.mode === "text" && !job.prompt) {
      setMessage("Добавьте описание товара.");
      return;
    }
    if (job.mode !== "text" && !job.sourceIds.length) {
      setMessage("Добавьте исходники.");
      return;
    }
    update((d) => ({ ...d, jobs: [job, ...d.jobs] }));
    setActiveId(job.id);
    if (job.mode === "local") void execute(job);
    else
      setMessage(
        "Задание сохранено. Генеративный провайдер не подключён: обработка и расходы не начались.",
      );
  }
  const jobs = data.jobs.filter((j) => j.kind === kind),
    active = jobs.find((j) => j.id === activeId);
  return (
    <>
      <Heading
        eyebrow="КОНТЕНТ ДЛЯ ВАШИХ ТОВАРОВ"
        title={kind === "photo" ? "AI-фотостудия" : "AI-видеостудия"}
        description={
          kind === "photo"
            ? "Подготовьте исходники или сохраните задание на будущую генерацию."
            : "Сохраните творческое задание или соберите настоящий ролик из фотографий."
        }
      />
      <div className="notice">
        {kind === "photo" ? <Camera size={23} /> : <Film size={23} />}
        <div>
          <strong>Генеративный провайдер не подключён</strong>
          <p>
            {mode === "local"
              ? kind === "photo"
                ? "Работает локально: вписывание в формат с белыми полями и коррекция яркости. Форма товара, бренд и повреждения не удаляются. Варианты отличаются только освещением, не ракурсом."
                : "Работает локально: последовательный показ фотографий с подписью. Запись идёт в реальном времени; оставьте вкладку видимой. Формат — WebM или MP4 по возможностям браузера."
              : kind === "photo"
                ? "Сохранение задания не создаёт изображения. Генерация до 10 вариантов, удаление или замена фона, ретушь и новые ракурсы требуют отдельного провайдера и разрешения."
                : "Сохранение задания не создаёт AI-видео. Генерация из текста и обработка исходного видео потребуют провайдера. Бесплатный локальный монтаж доступен из фотографий."}
          </p>
        </div>
      </div>
      {(message || error) && (
        <p role="status" className="notice">
          {message || error}
        </p>
      )}
      <div className="media-layout">
        <section className="panel form-panel">
          <h2>Новое задание</h2>
          <label>
            Режим студии
            <Select
              aria-label="Режим студии"
              disabled={busy}
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as MediaJob["mode"]);
                setStyle(e.target.value === "local" ? "captioned" : "studio");
                setSources([]);
              }}
            >
              <option value="text">Создание с нуля · нужен AI</option>
              <option value="sources">Обработка исходников · нужен AI</option>
              <option value="local">
                {kind === "photo"
                  ? "Локальная подготовка фото"
                  : "Монтаж из фотографий"}{" "}
                · работает
              </option>
            </Select>
          </label>
          <label>
            Название товара
            <input
              disabled={busy}
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Описание и задача
            <textarea
              disabled={busy}
              maxLength={4000}
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          {mode !== "local" && (
            <>
              <label>
                Категория
                <input
                  maxLength={100}
                  disabled={busy}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </label>
              <label>
                Желаемый стиль
                <Select
                  disabled={busy}
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                >
                  {[
                    "Студийная фотография",
                    "Lifestyle",
                    "Премиальная съёмка",
                    "Городской фон",
                    "Зимний пейзаж",
                    "Нейтральный фон",
                    "Интерьер",
                    "Маркетплейс",
                  ].map((s, i) => (
                    <option value={i === 0 ? "studio" : s} key={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </label>
              <label>
                Цветовая гамма
                <input
                  maxLength={200}
                  disabled={busy}
                  value={colors}
                  onChange={(e) => setColors(e.target.value)}
                />
              </label>
              <label>
                Окружение
                <input
                  maxLength={200}
                  disabled={busy}
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                />
              </label>
            </>
          )}
          {kind === "video" && mode === "local" && (
            <label>
              Стиль монтажа
              <Select
                aria-label="Стиль монтажа"
                value={style}
                disabled={busy}
                onChange={(e) => setStyle(e.target.value)}
              >
                <option value="captioned">Фотографии с подписью</option>
                <option value="slideshow">Только фотографии</option>
              </Select>
            </label>
          )}
          <div className="form-grid">
            <label>
              Соотношение сторон
              <Select
                aria-label="Соотношение сторон"
                disabled={busy}
                value={aspect}
                onChange={(e) => setAspect(e.target.value as Aspect)}
              >
                {Object.keys(aspectSizes).map((s) => (
                  <option value={s} key={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </label>
            {kind === "photo" ? (
              <label>
                Количество вариантов
                <Select
                  aria-label="Количество вариантов"
                  disabled={busy}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                >
                  {Array.from({ length: 10 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </Select>
              </label>
            ) : (
              <label>
                Длительность, секунд
                <input
                  type="number"
                  min="3"
                  max="30"
                  step="1"
                  disabled={busy}
                  value={duration}
                  onChange={(e) =>
                    setDuration(
                      Math.min(
                        30,
                        Math.max(3, Math.round(Number(e.target.value))),
                      ),
                    )
                  }
                />
              </label>
            )}
          </div>
          {mode === "local" && kind === "photo" && (
            <label>
              Яркость: {Math.round(brightness * 100)}%
              <input
                aria-label="Яркость"
                type="range"
                min="80"
                max="120"
                step="1"
                disabled={busy}
                value={Math.round(brightness * 100)}
                onChange={(e) => setBrightness(Number(e.target.value) / 100)}
              />
            </label>
          )}
          {mode !== "text" && (
            <>
              <label className="media-upload">
                <Upload size={20} />
                <span>
                  {kind === "video" && mode !== "local"
                    ? "Фото или видео"
                    : "Фотографии"}{" "}
                  · до 10 исходников
                </span>
                <input
                  type="file"
                  aria-label="Исходники студии"
                  multiple
                  disabled={busy}
                  accept={
                    kind === "video" && mode !== "local"
                      ? "image/jpeg,image/png,image/webp,video/mp4,video/webm"
                      : "image/jpeg,image/png,image/webp"
                  }
                  onChange={(e) => {
                    if (e.target.files) void upload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <div className="asset-grid">
                {sources.map((id) => (
                  <div key={id}>
                    <AssetPreview storeId={storeId} id={id} />
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={() =>
                        setSources((s) => s.filter((x) => x !== id))
                      }
                    >
                      Убрать исходник
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="media-estimate">
            <strong>Предварительная стоимость</strong>
            <p>
              {mode === "local"
                ? "Бесплатная обработка в вашем браузере, без API-запросов."
                : "Неизвестна: провайдер и тариф не выбраны. Задание только сохраняется."}
            </p>
          </div>
          <button
            className="button primary"
            disabled={!ready || busy || !title.trim()}
            onClick={() => createJob()}
          >
            <Play size={16} />
            {busy
              ? "Обработка…"
              : mode === "local"
                ? "Запустить локально"
                : "Сохранить задание"}
          </button>
          {busy && active?.status === "processing" && (
            <button
              className="button secondary"
              onClick={() => controller.current?.abort()}
            >
              <StopCircle size={17} />
              Остановить
            </button>
          )}
          <p className="muted">
            Файлы остаются в IndexedDB этого браузера. Они не отправляются
            внешним AI. Результаты по одному описанию нельзя выдавать за
            достоверные фотографии конкретного товара.
          </p>
        </section>
        <section className="panel form-panel media-results">
          <div className="panel-heading"><h2>Задания и результаты</h2><button className="text-link" disabled={!jobs.length} onClick={()=>downloadJson(`sellerai-media-jobs-${storeId}.json`,{...data,jobs})}>Экспорт заданий</button></div>
          {!jobs.length ? (
            <div className="empty">
              <Film size={30} />
              <p>Сохраните задание или начните локальную обработку.</p>
            </div>
          ) : (
            <div className="media-jobs">
              {jobs.map((j) => (
                <button
                  key={j.id}
                  className={`media-job ${activeId === j.id ? "selected" : ""}`}
                  onClick={() => setActiveId(j.id)}
                >
                  <span>
                    <strong>{j.title}</strong>
                    <small>
                      {j.mode === "local"
                        ? "Локальная обработка"
                        : "Нужен AI-провайдер"}{" "}
                      · {j.aspect} ·{" "}
                      {j.kind === "photo"
                        ? `${j.count} варианта`
                        : `${j.duration} с`}
                    </small>
                  </span>
                  <span
                    className={`status ${j.status === "completed" ? "active" : j.status === "failed" ? "draft" : "neutral"}`}
                  >
                    {jobLabels[j.status]}
                  </span>
                </button>
              ))}
            </div>
          )}
          {active && (
            <div className="media-active">
              <h3>{active.title}</h3>
              <p className="muted">{active.prompt}</p>
              {active.status === "processing" && (
                <>
                  <progress
                    aria-label="Прогресс обработки"
                    max={100}
                    value={active.progress}
                  />
                  <p role="status">
                    {active.progress}% · реальная локальная обработка
                  </p>
                </>
              )}
              {active.error && (
                <div className="notice seller-error" role="alert">
                  {active.error}
                </div>
              )}
              {active.status === "waiting_provider" && (
                <div className="safety-box">
                  <p>
                    Задание сохранено. Провайдер не подключён; генерация не
                    выполняется, расходы не начались.
                  </p>
                </div>
              )}
              {active.outputIds.length > 0 && (
                <>
                  <h4>
                    {active.kind === "photo" ? "До / После" : "Готовый ролик"}
                  </h4>
                  <div className="asset-grid">
                    {active.kind === "photo" && active.sourceIds[0] && (
                      <AssetPreview
                        storeId={storeId}
                        id={active.sourceIds[0]}
                        label="Исходник · до"
                      />
                    )}
                    {active.outputIds.map((id, i) => (
                      <AssetPreview
                        key={id}
                        storeId={storeId}
                        id={id}
                        download
                        label={`${active.kind === "photo" ? "Локальный вариант" : "Ролик"} ${i + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
              {!busy && (
                <button
                  className="button secondary"
                  onClick={() => createJob(active)}
                >
                  {active.mode === "local"
                    ? "Повторить локальную обработку"
                    : "Создать повторное задание"}
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
