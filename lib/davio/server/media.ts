import sharp from "sharp";
import { DavioError } from "../content";
import type { DavioUser } from "../types";
import { addFile, fileFor, ownProject } from "./projects";
import { db } from "./db";
export async function uploadPhoto(
  user: DavioUser,
  projectId: string,
  request: Request,
) {
  const length = Number(request.headers.get("content-length"));
  if (!Number.isFinite(length) || length < 1 || length > 16 * 1024 * 1024)
    throw new DavioError(413, "Фото — до 15 МБ. Загрузите по одному файлу.");
  const form = await request.formData(),
    file = form.get("file");
  if (
    !(file instanceof File) ||
    file.size < 1 ||
    file.size > 15 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    throw new DavioError(
      400,
      "Поддерживаются JPEG, PNG и WEBP до 15 МБ. HEIC сначала конвертируйте в JPEG.",
    );
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const meta = await sharp(bytes, {
      limitInputPixels: 40e6,
      animated: false,
    }).metadata();
    if (
      !["jpeg", "png", "webp"].includes(meta.format || "") ||
      !meta.width ||
      !meta.height ||
      (meta.pages || 1) > 1
    )
      throw new Error();
    await sharp(bytes, { limitInputPixels: 40e6 }).resize(8, 8).toBuffer();
    const mime = meta.format === "jpeg" ? "image/jpeg" : `image/${meta.format}`;
    if (mime !== file.type) throw new Error();
  } catch {
    throw new DavioError(
      400,
      "Файл повреждён, содержит анимацию или его формат не соответствует расширению.",
    );
  }
  return addFile(user, projectId, {
    bytes,
    name: file.name.slice(0, 120),
    mime: file.type,
    kind: "original",
  });
}
export async function correctPhoto(
  user: DavioUser,
  projectId: string,
  input: Record<string, unknown>,
) {
  ownProject(user, projectId);
  const source = fileFor(user, String(input.sourceId));
  if (
    source.kind !== "original" ||
    !db()
      .prepare(
        "SELECT 1 FROM project_files WHERE project_id=? AND file_id=? AND active=1",
      )
      .get(projectId, String(input.sourceId))
  )
    throw new DavioError(400, "Выберите исходную фотографию проекта.");
  const brightness = Number(input.brightness ?? 1),
    contrast = Number(input.contrast ?? 1),
    warmth = Number(input.warmth ?? 1),
    width = Number(input.width ?? 1600),
    quality = Number(input.quality ?? 90);
  if (
    !Number.isFinite(brightness) ||
    brightness < 0.8 ||
    brightness > 1.2 ||
    !Number.isFinite(contrast) ||
    contrast < 0.8 ||
    contrast > 1.2 ||
    !Number.isFinite(warmth) ||
    warmth < 0.9 ||
    warmth > 1.1 ||
    ![800, 1200, 1600, 2400].includes(width) ||
    !Number.isInteger(quality) ||
    quality < 70 ||
    quality > 95
  )
    throw new DavioError(400, "Проверьте параметры коррекции.");
  const aspects: Record<string, number> = {
    "1:1": 1,
    "4:3": 4 / 3,
    "3:4": 3 / 4,
    "9:16": 9 / 16,
    "16:9": 16 / 9,
  };
  const aspect = String(input.aspect || "original");
  if (aspect !== "original" && !aspects[aspect])
    throw new DavioError(400, "Неизвестный формат кадра.");
  if (input.fit !== "contain" && input.fit !== "cover")
    throw new DavioError(400, "Выберите способ кадрирования.");
  let image = sharp(source.bytes as Uint8Array, { limitInputPixels: 40e6 })
    .rotate()
    .resize({
      width,
      height:
        aspect === "original" ? undefined : Math.round(width / aspects[aspect]),
      fit: input.fit as "cover" | "contain",
      background: "#f2f2f2",
      withoutEnlargement: aspect === "original",
    })
    .modulate({ brightness })
    .linear(contrast, 128 * (1 - contrast))
    .recomb([
      [warmth, 0, 0],
      [0, 1, 0],
      [0, 0, 2 - warmth],
    ]);
  if (input.sharpen === true) image = image.sharpen({ sigma: 0.5 });
  const bytes = await image.jpeg({ quality }).toBuffer();
  return addFile(user, projectId, {
    bytes,
    name: `photo-${Date.now()}.jpg`,
    mime: "image/jpeg",
    kind: "photo",
    sourceId: String(source.id),
    settings: {
      brightness,
      contrast,
      warmth,
      width,
      quality,
      aspect,
      fit: String(input.fit),
      sharpen: input.sharpen === true,
    },
  });
}
