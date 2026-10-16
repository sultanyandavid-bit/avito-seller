import { randomUUID } from "node:crypto";
import { db, transaction } from "@/lib/davio/server/db";
import {
  checkOrigin,
  currentUser,
  hashPassword,
  verifyPassword,
  newSession,
  sessionCookie,
  logout,
  rateLimit,
  requireUser,
  publicUser,
} from "@/lib/davio/server/auth";
import {
  createProject,
  duplicateProject,
  projectView,
  ownProject,
  saveProject,
  fileFor,
  usageFor,
  takeUsage,
} from "@/lib/davio/server/projects";
import { mediaSlot } from "@/lib/davio/server/limits";
import { correctPhoto, uploadPhoto } from "@/lib/davio/server/media";
import { enqueueVideo } from "@/lib/davio/server/video";
import { zip } from "@/lib/davio/server/zip";
import {
  DavioError,
  composeDescription,
  assistantAnswer,
} from "@/lib/davio/content";
import { readJsonBounded, RequestError } from "@/lib/seller/server/guards";
import type { ChatMode, Plan } from "@/lib/davio/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};
function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...headers, ...extra } });
}
async function body(request: Request) {
  return (await readJsonBounded(request, 160000)) as Record<string, unknown>;
}
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await context.params,
      route = path.join("/"),
      method = request.method;
    if (method !== "GET") checkOrigin(request);
    if (route === "session" && method === "GET") {
      const user = currentUser(request);
      return json({ user, usage: user ? usageFor(user) : null });
    }
    if (["register", "login"].includes(route) && method === "POST") {
      rateLimit("auth-global", 80, 900000);
      const input = await body(request),
        email = String(input.email || "")
          .trim()
          .toLowerCase(),
        password = String(input.password || "");
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254 ||
        password.length < 12 ||
        password.length > 128
      )
        throw new DavioError(
          400,
          "Укажите email и пароль от 12 до 128 символов.",
        );
      rateLimit(`auth:${email}`, 8, 900000);
      let row = db().prepare("SELECT * FROM users WHERE email=?").get(email);
      if (route === "register") {
        const name = String(input.name || "").trim();
        if (!name || name.length > 60)
          throw new DavioError(400, "Укажите имя до 60 символов.");
        if (row)
          throw new DavioError(
            409,
            "Не удалось создать аккаунт с этими данными. Попробуйте войти.",
          );
        const passwordHash = await hashPassword(password),
          id = randomUUID();
        try {
          db()
            .prepare(
              "INSERT INTO users(id,email,name,password,created_at) VALUES(?,?,?,?,?)",
            )
            .run(id, email, name, passwordHash, Date.now());
        } catch (e) {
          if (String(e).includes("UNIQUE"))
            throw new DavioError(
              409,
              "Не удалось создать аккаунт с этими данными.",
            );
          throw e;
        }
        row = db().prepare("SELECT * FROM users WHERE id=?").get(id);
      } else {
        // Equal-cost password check even for unknown accounts; no password logged.
        const stored = row
          ? String(row.password)
          : "00000000000000000000000000000000:" + "00".repeat(64);
        if (!(await verifyPassword(password, stored)) || !row)
          throw new DavioError(401, "Неверный email или пароль.");
      }
      const user = publicUser(row!);
      return json({ user, usage: usageFor(user) }, 200, {
        "Set-Cookie": sessionCookie(newSession(user.id)),
      });
    }
    if (route === "logout" && method === "POST") {
      logout(request);
      return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
    }
    const user = requireUser(request);
    if (method !== "GET") rateLimit(`write:${user.id}`, 90);
    if (route === "profile" && method === "PATCH") {
      const data = await body(request),
        name = String(data.name || "").trim();
      if (!name || name.length > 60)
        throw new DavioError(400, "Имя — от 1 до 60 символов.");
      db().prepare("UPDATE users SET name=? WHERE id=?").run(name, user.id);
      return json({ user: { ...user, name } });
    }
    if (route === "password" && method === "POST") {
      const data = await body(request);
      rateLimit(`password:${user.id}`, 5, 900000);
      const old = String(data.current || ""),
        password = String(data.password || "");
      if (old.length > 128 || password.length < 12 || password.length > 128)
        throw new DavioError(400, "Новый пароль — от 12 до 128 символов.");
      const row = db()
        .prepare("SELECT password FROM users WHERE id=?")
        .get(user.id)!;
      if (!(await verifyPassword(old, String(row.password))))
        throw new DavioError(400, "Текущий пароль неверен.");
      const hash = await hashPassword(password);
      transaction(() => {
        db()
          .prepare("UPDATE users SET password=? WHERE id=?")
          .run(hash, user.id);
        db().prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
      });
      return json({ ok: true }, 200, {
        "Set-Cookie": sessionCookie(newSession(user.id)),
      });
    }
    if (route === "usage" && method === "GET") return json(usageFor(user));
    if (route === "projects") {
      if (method === "GET") {
        const ids = db()
          .prepare(
            "SELECT id FROM projects WHERE user_id=? ORDER BY updated_at DESC",
          )
          .all(user.id);
        return json(ids.map((x) => projectView(user, String(x.id))));
      }
      if (method === "POST")
        return json(createProject(user, (await body(request)).data), 201);
    }
    if (path[0] === "projects" && path[1]) {
      const id = path[1],
        action = path[2];
      ownProject(user, id);
      if (path.length === 2 && method === "GET")
        return json(projectView(user, id));
      if (path.length === 2 && method === "PATCH") {
        const input = await body(request);
        return json(saveProject(user, id, input.data, input.revision));
      }
      if (action === "duplicate" && method === "POST")
        return json(duplicateProject(user, id), 201);
      if (action === "archive" && method === "POST") {
        const data = await body(request);
        if (typeof data.archived !== "boolean")
          throw new DavioError(400, "Проверьте статус проекта.");
        db()
          .prepare("UPDATE projects SET archived=?,updated_at=? WHERE id=?")
          .run(data.archived ? 1 : 0, Date.now(), id);
        return json(projectView(user, id));
      }
      if (action === "revisions" && method === "GET")
        return json(
          db()
            .prepare(
              "SELECT id,revision,data,created_at createdAt FROM revisions WHERE project_id=? ORDER BY revision DESC LIMIT 30",
            )
            .all(id)
            .map((r) => ({ ...r, data: JSON.parse(String(r.data)) })),
        );
      if (action === "restore" && method === "POST") {
        const input = await body(request),
          rev = db()
            .prepare("SELECT data FROM revisions WHERE project_id=? AND id=?")
            .get(id, Number(input.id));
        if (!rev) throw new DavioError(404, "Версия не найдена.");
        return json(
          saveProject(user, id, JSON.parse(String(rev.data)), input.revision),
        );
      }
      if (action === "photos" && method === "POST") {
        await mediaSlot(() => uploadPhoto(user, id, request));
        return json(projectView(user, id), 201);
      }
      if (action === "correct" && method === "POST") {
        const input = await body(request);
        await mediaSlot(() => correctPhoto(user, id, input));
        return json(projectView(user, id), 201);
      }
      if (action === "assets" && method === "PATCH") {
        const input = await body(request),
          ids = input.ids;
        if (
          !Array.isArray(ids) ||
          ids.length > 10 ||
          new Set(ids).size !== ids.length ||
          ids.some((x) => typeof x !== "string")
        )
          throw new DavioError(400, "Проверьте порядок фотографий.");
        transaction(() => {
          const originals = db()
            .prepare(
              "SELECT f.id FROM project_files pf JOIN files f ON pf.file_id=f.id WHERE pf.project_id=? AND f.kind='original'",
            )
            .all(id)
            .map((f) => String(f.id));
          if (ids.some((x) => !originals.includes(String(x))))
            throw new DavioError(400, "Фото не принадлежит проекту.");
          db()
            .prepare(
              "UPDATE project_files SET active=0 WHERE project_id=? AND file_id IN (SELECT id FROM files WHERE kind='original')",
            )
            .run(id);
          ids.forEach((fileId, i) =>
            db()
              .prepare(
                "UPDATE project_files SET active=1,position=? WHERE project_id=? AND file_id=?",
              )
              .run(i, id, String(fileId)),
          );
        });
        return json(projectView(user, id));
      }
      if (action === "describe" && method === "POST") {
        const input = await body(request);
        const p = projectView(user, id);
        const result = composeDescription(p.data, String(input.action));
        transaction(() => takeUsage(user, "texts"));
        return json(result);
      }
      if (action === "video" && method === "POST") {
        const jobId = enqueueVideo(user, id, await body(request));
        return json({ jobId }, 202);
      }
      if (action === "export" && method === "GET") {
        const p = projectView(user, id),
          total = p.assets.reduce((n, a) => n + a.size, 0);
        if (total > 150 * 1024 * 1024)
          throw new DavioError(
            413,
            "Комплект больше 150 МБ. Скачайте материалы по отдельности.",
          );
        const files = [
          {
            name: "description.txt",
            bytes: Buffer.from(`${p.data.title}\n\n${p.data.description}`),
          },
          {
            name: "project.json",
            bytes: Buffer.from(
              JSON.stringify(
                {
                  format: "davio-project-v1",
                  data: p.data,
                  revision: p.revision,
                  assets: p.assets,
                },
                null,
                2,
              ),
            ),
          },
        ];
        for (const a of p.assets) {
          const f = fileFor(user, a.id),
            ext =
              a.mime === "video/mp4"
                ? "mp4"
                : a.mime === "image/png"
                  ? "png"
                  : a.mime === "image/webp"
                    ? "webp"
                    : "jpg";
          files.push({
            name: `${a.kind}/${a.id}.${ext}`,
            bytes: Buffer.from(f.bytes as Uint8Array),
          });
        }
        return new Response(new Uint8Array(zip(files)), {
          headers: {
            ...headers,
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="davio-${id}.zip"`,
          },
        });
      }
    }
    if (path[0] === "files" && path.length === 2 && method === "GET") {
      const f = fileFor(user, path[1]),
        bytes = Buffer.from(f.bytes as Uint8Array);
      const disposition = new URL(request.url).searchParams.has("download")
        ? "attachment"
        : "inline";
      const range = request.headers.get("range");
      let start = 0,
        end = bytes.length - 1,
        status = 200;
      if (range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(range);
        if (!match)
          return new Response(null, {
            status: 416,
            headers: { ...headers, "Content-Range": `bytes */${bytes.length}` },
          });
        start = Number(match[1]);
        end = match[2] ? Math.min(Number(match[2]), end) : end;
        if (
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start > end ||
          start >= bytes.length
        )
          return new Response(null, {
            status: 416,
            headers: { ...headers, "Content-Range": `bytes */${bytes.length}` },
          });
        status = 206;
      }
      return new Response(new Uint8Array(bytes.subarray(start, end + 1)), {
        status,
        headers: {
          ...headers,
          "Content-Type": String(f.mime),
          "Content-Length": String(end - start + 1),
          "Accept-Ranges": "bytes",
          ...(status === 206
            ? { "Content-Range": `bytes ${start}-${end}/${bytes.length}` }
            : {}),
          "Content-Disposition": `${disposition}; filename="davio-${String(f.id)}.${f.kind === "video" ? "mp4" : f.mime === "image/png" ? "png" : f.mime === "image/webp" ? "webp" : "jpg"}"`,
        },
      });
    }
    if (route === "chat") {
      if (method === "GET")
        return json(
          db()
            .prepare(
              "SELECT id,mode,project_id projectId,question,answer,created_at createdAt FROM chat WHERE user_id=? ORDER BY created_at LIMIT 1000",
            )
            .all(user.id),
        );
      if (method === "POST") {
        const input = await body(request),
          mode = input.mode as ChatMode,
          question = String(input.question || "").trim();
        if (
          !["seller", "assistant", "learn"].includes(mode) ||
          !question ||
          question.length > 4000
        )
          throw new DavioError(400, "Введите сообщение до 4000 символов.");
        if (
          Number(
            db()
              .prepare("SELECT count(*) n FROM chat WHERE user_id=?")
              .get(user.id)!.n,
          ) >= 1000
        )
          throw new DavioError(429, "Лимит 1000 сообщений. История сохранена.");
        const project = input.projectId
          ? projectView(user, String(input.projectId))
          : null;
        const entry = {
          id: randomUUID(),
          mode,
          projectId: project?.id || null,
          question,
          answer: assistantAnswer(mode, question, project?.data),
          createdAt: Date.now(),
        };
        db()
          .prepare("INSERT INTO chat VALUES(?,?,?,?,?,?,?)")
          .run(
            entry.id,
            user.id,
            mode,
            entry.projectId,
            question,
            entry.answer,
            entry.createdAt,
          );
        return json(entry, 201);
      }
    }
    if (path[0] === "admin") {
      if (user.role !== "admin")
        throw new DavioError(403, "Доступ только администратору.");
      if (path.length === 1 && method === "GET")
        return json({
          users: db()
            .prepare(
              "SELECT id,email,name,role,plan,created_at createdAt FROM users ORDER BY created_at DESC LIMIT 500",
            )
            .all(),
          plans: db()
            .prepare("SELECT data FROM plans")
            .all()
            .map((r) => JSON.parse(String(r.data))),
          jobs: db()
            .prepare(
              "SELECT id,status,progress,error,created_at createdAt FROM jobs ORDER BY created_at DESC LIMIT 50",
            )
            .all(),
          worker: usageFor(user).worker,
          features: {
            templates: true,
            photoCorrection: true,
            ffmpeg: true,
            externalAI: false,
            marketplaces: false,
            payments: false,
          },
        });
      if (path[1] === "plans" && method === "PATCH") {
        const input = await body(request);
        if (!["basic", "pro"].includes(String(input.id)))
          throw new DavioError(400, "Неизвестный тариф.");
        const p: Plan = {
          id: input.id as Plan["id"],
          label: input.id === "pro" ? "PRO" : "Базовый",
          projects: Number(input.projects),
          storageMB: Number(input.storageMB),
          renders: Number(input.renders),
          texts: Number(input.texts),
        };
        if (
          ![p.projects, p.storageMB, p.renders, p.texts].every(
            (n) => Number.isInteger(n) && n >= 1 && n <= 10000,
          )
        )
          throw new DavioError(400, "Лимиты — целые числа от 1 до 10000.");
        db()
          .prepare("UPDATE plans SET data=? WHERE id=?")
          .run(JSON.stringify(p), p.id);
        return json(p);
      }
      if (path[1] === "users" && method === "PATCH") {
        const input = await body(request);
        if (!["basic", "pro"].includes(String(input.plan)))
          throw new DavioError(400, "Неизвестный тариф.");
        if (
          !db()
            .prepare("UPDATE users SET plan=? WHERE id=?")
            .run(String(input.plan), String(input.id)).changes
        )
          throw new DavioError(404, "Пользователь не найден.");
        return json({ ok: true });
      }
    }
    throw new DavioError(404, "Действие не найдено.");
  } catch (e) {
    if (e instanceof DavioError || e instanceof RequestError)
      return json({ error: e.message }, e.status);
    console.error(
      "DAVIO request failed:",
      e instanceof Error ? e.name : "UnknownError",
    );
    return json(
      {
        error:
          "Не удалось выполнить действие. Данные не перезаписаны. Повторите позже.",
      },
      500,
    );
  }
}
export { handle as GET, handle as POST, handle as PATCH };
