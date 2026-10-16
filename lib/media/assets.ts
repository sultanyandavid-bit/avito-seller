import type { Asset } from "./types";
import { LOCAL_WORKSPACE_ID } from "../workspaces/types";
let dbPromise: Promise<IDBDatabase> | undefined;
function database() {
  if (!dbPromise)
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB недоступен в этом браузере."));
        return;
      }
      const request = indexedDB.open("sellerai-media-v1", 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore("assets", {
          keyPath: "id",
        });
        store.createIndex("storeId", "storeId");
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          dbPromise = undefined;
        };
        resolve(request.result);
      };
      request.onerror = () => {
        dbPromise = undefined;
        reject(new Error("Не удалось открыть хранилище файлов."));
      };
      request.onblocked = () => {
        reject(
          new Error(
            "Закройте другие вкладки приложения для обновления хранилища.",
          ),
        );
      };
    });
  return dbPromise;
}
export async function validateMediaFile(file: File, allowVideo = false) {
  if (
    file.size === 0 ||
    file.size >
      (allowVideo && file.type.startsWith("video/") ? 30 : 8) * 1024 * 1024
  )
    throw new Error(
      "Пустой или слишком большой файл. Фото — до 8 МБ, видео — до 30 МБ.",
    );
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const isPng =
    b.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v);
  const isJpeg = b[0] === 255 && b[1] === 216 && b[2] === 255;
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...b.slice(start, end));
  const isWebp = ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  const isMp4 = ascii(4, 8) === "ftyp";
  const isWebm = [26, 69, 223, 163].every((v, i) => b[i] === v);
  const expected = isPng
    ? "image/png"
    : isJpeg
      ? "image/jpeg"
      : isWebp
        ? "image/webp"
        : allowVideo && isMp4
          ? "video/mp4"
          : allowVideo && isWebm
            ? "video/webm"
            : null;
  if (!expected || file.type !== expected)
    throw new Error(
      "Формат файла не подтверждён. Используйте JPEG, PNG, WebP" +
        (allowVideo ? ", MP4 или WebM." : "."),
    );
  return expected.startsWith("image/")
    ? ("image" as const)
    : ("video" as const);
}
export async function putAsset(
  storeId: string,
  blob: Blob,
  name: string,
  type: "image" | "video",
  sourceId?: string,
): Promise<Asset> {
  const db = await database();
  const asset: Asset = {
    id: crypto.randomUUID(),
    storeId,
    workspaceId: LOCAL_WORKSPACE_ID,
    name,
    type,
    mime: blob.type,
    size: blob.size,
    createdAt: new Date().toISOString(),
    blob,
    sourceId,
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("assets", "readwrite");
    tx.objectStore("assets").put(asset);
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(
        new Error(
          "Не удалось сохранить файл. Возможно, хранилище переполнено.",
        ),
      );
    tx.onabort = () => reject(new Error("Сохранение файла прервано."));
  });
  return asset;
}
export async function uploadAsset(
  storeId: string,
  file: File,
  allowVideo = false,
) {
  const type = await validateMediaFile(file, allowVideo);
  if (type === "image") {
    const image = await decodeImage(file);
    image.close();
  }
  return putAsset(storeId, file, file.name, type);
}
export async function getAsset(
  storeId: string,
  id: string,
): Promise<Asset | null> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction("assets", "readonly")
      .objectStore("assets")
      .get(id);
    req.onsuccess = () => {
      const a = req.result as Asset | undefined;
      resolve(
        a?.storeId === storeId && a.workspaceId === LOCAL_WORKSPACE_ID
          ? a
          : null,
      );
    };
    req.onerror = () => reject(new Error("Не удалось прочитать файл."));
  });
}
export async function decodeImage(
  blob: Blob,
): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      const timer = setTimeout(
        () =>
          reject(new Error("Не удалось прочитать изображение за 10 секунд.")),
        10000,
      );
      image.onload = () => {
        clearTimeout(timer);
        resolve(image);
      };
      image.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Файл не является читаемым изображением."));
      };
      image.src = url;
    });
    if (!img.naturalWidth || img.naturalWidth * img.naturalHeight > 25000000)
      throw new Error("Изображение слишком большое: максимум 25 мегапикселей.");
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}
