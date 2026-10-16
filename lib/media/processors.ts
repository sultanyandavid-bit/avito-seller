import { aspectSizes, type Aspect } from "./types";
import { decodeImage } from "./assets";
function canvas(aspect: Aspect) {
  const c = document.createElement("canvas");
  [c.width, c.height] = aspectSizes[aspect];
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Браузер не поддерживает Canvas.");
  return { c, ctx };
}
function drawFit(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  w: number,
  h: number,
) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  const scale = Math.min(width / w, height / h);
  ctx.drawImage(
    source,
    (width - w * scale) / 2,
    (height - h * scale) / 2,
    w * scale,
    h * scale,
  );
}
export async function preparePhoto(
  blob: Blob,
  aspect: Aspect,
  brightness: number,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const image = await decodeImage(blob);
  try {
    const { c, ctx } = canvas(aspect);
    drawFit(ctx, image.source, image.width, image.height);
    if (brightness !== 1) {
      const pixels = ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < pixels.data.length; i += 4)
        for (let j = 0; j < 3; j++)
          pixels.data[i + j] = Math.min(
            255,
            Math.round(pixels.data[i + j] * brightness),
          );
      ctx.putImageData(pixels, 0, 0);
    }
    signal.throwIfAborted();
    return await new Promise<Blob>((resolve, reject) =>
      c.toBlob(
        (b) =>
          b
            ? resolve(b)
            : reject(new Error("Не удалось сохранить изображение.")),
        "image/png",
      ),
    );
  } finally {
    image.close();
  }
}
export async function recordSlideshow(
  blobs: Blob[],
  aspect: Aspect,
  duration: number,
  title: string,
  signal: AbortSignal,
  onProgress: (percent: number) => void,
): Promise<Blob> {
  if (
    typeof MediaRecorder === "undefined" ||
    !HTMLCanvasElement.prototype.captureStream
  )
    throw new Error(
      "Локальный видеомонтаж недоступен в этом браузере. Используйте актуальный Chrome.",
    );
  const mime = [
    "video/webm;codecs=vp8",
    "video/webm;codecs=vp9",
    "video/mp4",
  ].find((m) => MediaRecorder.isTypeSupported(m));
  if (!mime)
    throw new Error("Браузер не поддерживает доступный формат записи видео.");
  const images: Awaited<ReturnType<typeof decodeImage>>[] = [];
  try {
    for (const blob of blobs) {
      signal.throwIfAborted();
      images.push(await decodeImage(blob));
    }
    if (!images.length)
      throw new Error("Для монтажа нужна хотя бы одна фотография.");
    const { c, ctx } = canvas(aspect);
    const stream = c.captureStream(25);
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    return await new Promise<Blob>((resolve, reject) => {
      const chunks: Blob[] = [];
      let raf = 0,
        lastProgress = -5,
        done = false;
      const started = performance.now();
      const cleanup = () => {
        cancelAnimationFrame(raf);
        clearTimeout(deadline);
        stream.getTracks().forEach((t) => t.stop());
        signal.removeEventListener("abort", abort);
        document.removeEventListener("visibilitychange", visibility);
      };
      const fail = (message: string) => {
        if (done) return;
        done = true;
        if (recorder.state !== "inactive") recorder.stop();
        cleanup();
        reject(new Error(message));
      };
      const abort = () => fail("Видеомонтаж остановлен.");
      const visibility = () => {
        if (document.hidden)
          fail("Запись прервана: оставьте вкладку открытой и видимой.");
      };
      const deadline = setTimeout(
        () => fail("Браузер не завершил запись вовремя."),
        (duration + 10) * 1000,
      );
      signal.addEventListener("abort", abort, { once: true });
      document.addEventListener("visibilitychange", visibility);
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onerror = () => fail("Ошибка записи видео в браузере.");
      recorder.onstop = () => {
        if (done) return;
        done = true;
        cleanup();
        const result = new Blob(chunks, { type: mime.split(";")[0] });
        if (result.size) resolve(result);
        else reject(new Error("Браузер вернул пустую видеозапись."));
      };
      const render = () => {
        if (done) return;
        const elapsed = performance.now() - started;
        const index = Math.min(
          images.length - 1,
          Math.floor((elapsed / (duration * 1000)) * images.length),
        );
        const img = images[index];
        drawFit(ctx, img.source, img.width, img.height);
        if (title.trim()) {
          ctx.fillStyle = "#153425cc";
          ctx.fillRect(0, c.height - 115, c.width, 115);
          ctx.fillStyle = "#fff";
          ctx.font = "32px Arial";
          ctx.fillText(
            title.trim().slice(0, 65),
            28,
            c.height - 50,
            c.width - 56,
          );
        }
        const percent = Math.min(
          99,
          Math.round((elapsed / (duration * 1000)) * 100),
        );
        if (percent - lastProgress >= 5) {
          onProgress(percent);
          lastProgress = percent;
        }
        if (elapsed >= duration * 1000) {
          recorder.stop();
          return;
        }
        raf = requestAnimationFrame(render);
      };
      if (signal.aborted) {
        abort();
        return;
      }
      recorder.start(200);
      render();
    });
  } finally {
    images.forEach((i) => i.close());
  }
}
