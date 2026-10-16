import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { db, transaction } from "./db";
import { addFile, ownProject, fileFor, takeUsage, usageFor } from "./projects";
import { DavioError } from "../content";
import { publicUser } from "./auth";
import type { DavioUser } from "../types";
export type VideoOptions = {
  sourceIds: string[];
  aspect: "9:16" | "16:9";
  duration: number;
  title: string;
};
export function enqueueVideo(
  user: DavioUser,
  projectId: string,
  raw: Record<string, unknown>,
) {
  const project = ownProject(user, projectId),
    ids = raw.sourceIds;
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 10 ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => typeof id !== "string")
  )
    throw new DavioError(400, "Выберите от 1 до 10 фотографий.");
  if (
    !["9:16", "16:9"].includes(String(raw.aspect)) ||
    ![6, 9, 12, 15, 20, 30].includes(Number(raw.duration))
  )
    throw new DavioError(400, "Проверьте формат и длительность видео.");
  for (const id of ids) {
    const f = fileFor(user, id);
    if (
      !["original", "photo"].includes(String(f.kind)) ||
      !db()
        .prepare(
          "SELECT 1 FROM project_files WHERE project_id=? AND file_id=? AND active=1",
        )
        .get(projectId, id)
    )
      throw new DavioError(400, "Фото не принадлежит этому проекту.");
  }
  const title = String(JSON.parse(String(project.data)).title)
    .replace(/\s+/g, " ")
    .slice(0, 65);
  return transaction(() => {
    if (
      Number(
        db()
          .prepare(
            "SELECT count(*) n FROM jobs WHERE user_id=? AND status IN ('queued','processing')",
          )
          .get(user.id)!.n,
      ) >= 2
    )
      throw new DavioError(
        429,
        "Уже есть две незавершённые задачи. Дождитесь результата.",
      );
    if (!usageFor(user).worker.online)
      throw new DavioError(
        503,
        "Видеомонтаж ожидает worker. Запустите npm run worker в отдельном терминале и повторите.",
      );
    takeUsage(user, "renders");
    const id = randomUUID(),
      now = Date.now();
    const options: VideoOptions = {
      sourceIds: ids,
      aspect: raw.aspect as VideoOptions["aspect"],
      duration: Number(raw.duration),
      title,
    };
    db()
      .prepare(
        "INSERT INTO jobs(id,project_id,user_id,status,options,created_at,updated_at) VALUES(?,?,?,'queued',?,?,?)",
      )
      .run(id, projectId, user.id, JSON.stringify(options), now, now);
    return id;
  });
}
export function command(
  binary: string,
  args: string[],
  timeout = 180000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      stdio: ["ignore", "ignore", "pipe"],
      env: { ...process.env },
      shell: false,
    });
    let error = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Превышено время монтажа."));
    }, timeout);
    child.stderr.on("data", (x: Buffer) => {
      error = (error + x.toString()).slice(-3000);
    });
    child.on("error", () => {
      clearTimeout(timer);
      reject(
        new Error(
          "FFmpeg недоступен. Установите FFmpeg и перезапустите worker.",
        ),
      );
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else
        reject(
          new Error(
            error.includes("No space")
              ? "Недостаточно места для монтажа."
              : "FFmpeg не смог обработать фотографии. Попробуйте другой набор файлов.",
          ),
        );
    });
  });
}
export async function renderNext() {
  const job = transaction(() => {
    const row = db()
      .prepare(
        "SELECT * FROM jobs WHERE status='queued' ORDER BY created_at LIMIT 1",
      )
      .get();
    if (!row) return null;
    db()
      .prepare(
        "UPDATE jobs SET status='processing',progress=5,updated_at=? WHERE id=?",
      )
      .run(Date.now(), String(row.id));
    return row;
  });
  if (!job) return false;
  const dir = await mkdtemp(path.join(os.tmpdir(), "davio-render-"));
  try {
    const user = publicUser(
      db().prepare("SELECT * FROM users WHERE id=?").get(String(job.user_id))!,
    );
    const options = JSON.parse(String(job.options)) as VideoOptions;
    const [width, height] =
      options.aspect === "9:16" ? [1080, 1920] : [1920, 1080];
    const fps = 24,
      frames = Math.round((options.duration / options.sourceIds.length) * fps);
    const binary = process.env.DAVIO_FFMPEG_PATH || "ffmpeg";
    const caption =
      options.title
        .match(/.{1,22}(?:\s|$)|.{1,22}/gu)
        ?.slice(0, 3)
        .join("\n") || "";
    await writeFile(path.join(dir, "caption.txt"), caption);
    for (let i = 0; i < options.sourceIds.length; i++) {
      const source = fileFor(user, options.sourceIds[i]);
      const image = path.join(dir, `source-${i}.png`),
        clip = path.join(dir, `clip-${i}.mp4`);
      await sharp(source.bytes as Uint8Array, { limitInputPixels: 40e6 })
        .rotate()
        .resize(width, height, { fit: "contain", background: "#151719" })
        .png()
        .toFile(image);
      const filter = `zoompan=z='min(zoom+0.0004,1.04)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=${frames}:s=${width}x${height}:fps=${fps},drawbox=x=0:y=ih-330:w=iw:h=330:color=black@0.55:t=fill,drawtext=textfile='${path.join(dir, "caption.txt")}':expansion=none:fontcolor=white:fontsize=40:line_spacing=12:x=70:y=h-270,fade=t=in:st=0:d=0.15,fade=t=out:st=${Math.max(0, frames / fps - 0.15)}:d=0.15,format=yuv420p`;
      await command(binary, [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-threads",
        "1",
        "-i",
        image,
        "-vf",
        filter,
        "-frames:v",
        String(frames),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "22",
        "-threads",
        "1",
        "-an",
        clip,
      ]);
      db()
        .prepare("UPDATE jobs SET progress=?,updated_at=? WHERE id=?")
        .run(
          Math.round(10 + ((i + 1) / options.sourceIds.length) * 75),
          Date.now(),
          String(job.id),
        );
    }
    await writeFile(
      path.join(dir, "clips.txt"),
      options.sourceIds
        .map((_, i) => `file '${path.join(dir, `clip-${i}.mp4`)}'`)
        .join("\n"),
    );
    const out = path.join(dir, "output.mp4");
    await command(binary, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      path.join(dir, "clips.txt"),
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      out,
    ]);
    const bytes = await readFile(out);
    if (bytes.length > 150 * 1024 * 1024)
      throw new Error("Видео слишком большое. Уменьшите длительность.");
    const id = addFile(user, String(job.project_id), {
      bytes,
      name: "davio-video.mp4",
      mime: "video/mp4",
      kind: "video",
      settings: { ...options, codec: "h264", fps, width, height },
    });
    db()
      .prepare(
        "UPDATE jobs SET status='completed',progress=100,output_id=?,updated_at=? WHERE id=?",
      )
      .run(id, Date.now(), String(job.id));
  } catch (e) {
    db()
      .prepare(
        "UPDATE jobs SET status='failed',error=?,updated_at=? WHERE id=?",
      )
      .run(
        e instanceof Error ? e.message : "Не удалось создать видео.",
        Date.now(),
        String(job.id),
      );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  return true;
}
