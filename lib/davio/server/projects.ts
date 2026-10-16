import { randomUUID } from "node:crypto";
import { db, transaction } from "./db";
import { DavioError, projectData } from "../content";
import type {
  DavioUser,
  Project,
  ProjectAsset,
  ProjectData,
  VideoJob,
  Plan,
} from "../types";
export function planFor(user: DavioUser): Plan {
  return JSON.parse(
    String(
      db().prepare("SELECT data FROM plans WHERE id=?").get(user.plan)!.data,
    ),
  );
}
export function usageFor(user: DavioUser) {
  const month = new Date().toISOString().slice(0, 7);
  const counts = db()
    .prepare("SELECT kind,count FROM usage WHERE user_id=? AND month=?")
    .all(user.id, month);
  const count = (kind: string) =>
    Number(counts.find((x) => x.kind === kind)?.count || 0);
  const heartbeat = db()
    .prepare("SELECT value FROM runtime WHERE key='worker'")
    .get();
  let worker = { online: false, ffmpeg: false };
  if (heartbeat) {
    const h = JSON.parse(String(heartbeat.value));
    worker = { online: Date.now() - h.at < 15000, ffmpeg: h.ffmpeg === true };
  }
  return {
    projects: Number(
      db()
        .prepare("SELECT count(*) n FROM projects WHERE user_id=?")
        .get(user.id)!.n,
    ),
    storageBytes: Number(
      db()
        .prepare("SELECT coalesce(sum(size),0) n FROM files WHERE user_id=?")
        .get(user.id)!.n,
    ),
    renders: count("renders"),
    texts: count("texts"),
    plan: planFor(user),
    worker,
  };
}
export function takeUsage(user: DavioUser, kind: "renders" | "texts") {
  const month = new Date().toISOString().slice(0, 7),
    p = planFor(user);
  const used = Number(
    db()
      .prepare("SELECT count FROM usage WHERE user_id=? AND month=? AND kind=?")
      .get(user.id, month, kind)?.count || 0,
  );
  if (used >= p[kind])
    throw new DavioError(
      429,
      "Месячный лимит исчерпан. Проверьте лимиты в настройках.",
    );
  db()
    .prepare(
      "INSERT INTO usage VALUES(?,?,?,1) ON CONFLICT(user_id,month,kind) DO UPDATE SET count=count+1",
    )
    .run(user.id, month, kind);
}
export function ownProject(user: DavioUser, id: string) {
  const row = db()
    .prepare("SELECT * FROM projects WHERE id=? AND user_id=?")
    .get(id, user.id);
  if (!row) throw new DavioError(404, "Проект не найден.");
  return row;
}
export function projectView(user: DavioUser, id: string): Project {
  const row = ownProject(user, id);
  const assets = db()
    .prepare(
      `SELECT f.id,f.name,f.mime,f.size,f.kind,f.source_id sourceId,f.settings,f.created_at createdAt FROM files f JOIN project_files pf ON f.id=pf.file_id WHERE pf.project_id=? AND pf.active=1 AND f.user_id=? ORDER BY pf.position,f.created_at`,
    )
    .all(id, user.id)
    .map((r) => ({
      ...r,
      settings: JSON.parse(String(r.settings)),
    })) as unknown as ProjectAsset[];
  return {
    id,
    data: JSON.parse(String(row.data)),
    revision: Number(row.revision),
    archived: row.archived === 1,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    assets,
    jobs: db()
      .prepare(
        "SELECT id,project_id projectId,status,progress,error,output_id outputId,created_at createdAt,updated_at updatedAt FROM jobs WHERE project_id=? AND user_id=? ORDER BY created_at DESC LIMIT 30",
      )
      .all(id, user.id) as unknown as VideoJob[],
  };
}
export function createProject(user: DavioUser, raw: unknown) {
  const data = projectData(raw);
  return transaction(() => {
    const count = Number(
      db()
        .prepare("SELECT count(*) n FROM projects WHERE user_id=?")
        .get(user.id)!.n,
    );
    if (count >= planFor(user).projects)
      throw new DavioError(
        429,
        "Достигнут лимит проектов. Проверьте настройки тарифа.",
      );
    const id = randomUUID(),
      now = Date.now();
    db()
      .prepare("INSERT INTO projects VALUES(?,?,?,1,0,?,?)")
      .run(id, user.id, JSON.stringify(data), now, now);
    db()
      .prepare(
        "INSERT INTO revisions(project_id,revision,data,created_at) VALUES(?,1,?,?)",
      )
      .run(id, JSON.stringify(data), now);
    return projectView(user, id);
  });
}
export function saveProject(
  user: DavioUser,
  id: string,
  raw: unknown,
  revision: unknown,
) {
  const data = projectData(raw);
  return transaction(() => {
    const row = ownProject(user, id);
    if (revision !== row.revision)
      throw new DavioError(
        409,
        "Проект изменён в другой вкладке. Скопируйте свои правки и откройте проект заново.",
      );
    const now = Date.now(),
      next = Number(row.revision) + 1;
    db()
      .prepare("UPDATE projects SET data=?,revision=?,updated_at=? WHERE id=?")
      .run(JSON.stringify(data), next, now, id);
    db()
      .prepare(
        "INSERT INTO revisions(project_id,revision,data,created_at) VALUES(?,?,?,?)",
      )
      .run(id, next, JSON.stringify(data), now);
    return projectView(user, id);
  });
}
export function addFile(
  user: DavioUser,
  projectId: string,
  input: {
    bytes: Buffer;
    name: string;
    mime: string;
    kind: ProjectAsset["kind"];
    sourceId?: string;
    settings?: ProjectAsset["settings"];
  },
) {
  return transaction(() => {
    ownProject(user, projectId);
    const usage = usageFor(user);
    if (
      usage.storageBytes + input.bytes.length >
      usage.plan.storageMB * 1024 * 1024
    )
      throw new DavioError(429, "Недостаточно места в хранилище.");
    if (input.kind === "original") {
      const count = Number(
        db()
          .prepare(
            "SELECT count(*) n FROM project_files pf JOIN files f ON f.id=pf.file_id WHERE pf.project_id=? AND pf.active=1 AND f.kind='original'",
          )
          .get(projectId)!.n,
      );
      if (count >= 10)
        throw new DavioError(400, "Не более 10 исходных фотографий в проекте.");
    }
    if (input.sourceId) {
      const source = db()
        .prepare(
          "SELECT f.id FROM files f JOIN project_files pf ON f.id=pf.file_id WHERE f.id=? AND f.user_id=? AND pf.project_id=?",
        )
        .get(input.sourceId, user.id, projectId);
      if (!source) throw new DavioError(404, "Исходное фото не найдено.");
    }
    const id = randomUUID(),
      now = Date.now();
    db()
      .prepare(
        "INSERT INTO files(id,user_id,name,mime,size,kind,source_id,bytes,created_at,settings) VALUES(?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        id,
        user.id,
        input.name,
        input.mime,
        input.bytes.length,
        input.kind,
        input.sourceId || null,
        input.bytes,
        now,
        JSON.stringify(input.settings || {}),
      );
    db()
      .prepare("INSERT INTO project_files VALUES(?,?,?,1)")
      .run(projectId, id, now);
    db()
      .prepare("UPDATE projects SET updated_at=? WHERE id=?")
      .run(now, projectId);
    return id;
  });
}
export function fileFor(user: DavioUser, id: string) {
  const f = db()
    .prepare("SELECT * FROM files WHERE id=? AND user_id=?")
    .get(id, user.id);
  if (!f) throw new DavioError(404, "Файл не найден.");
  return f;
}
export function duplicateProject(user: DavioUser, id: string) {
  return transaction(() => {
    const original = projectView(user, id);
    const p = createProjectUnnested(user, {
      ...original.data,
      title: `${original.data.title.slice(0, 110)} · копия`,
    });
    db()
      .prepare(
        "INSERT INTO project_files SELECT ?,file_id,position,active FROM project_files WHERE project_id=?",
      )
      .run(p, id);
    return projectView(user, p);
  });
}
function createProjectUnnested(user: DavioUser, data: ProjectData) {
  if (usageFor(user).projects >= planFor(user).projects)
    throw new DavioError(429, "Достигнут лимит проектов.");
  const id = randomUUID(),
    now = Date.now();
  db()
    .prepare("INSERT INTO projects VALUES(?,?,?,1,0,?,?)")
    .run(id, user.id, JSON.stringify(data), now, now);
  db()
    .prepare(
      "INSERT INTO revisions(project_id,revision,data,created_at) VALUES(?,1,?,?)",
    )
    .run(id, JSON.stringify(data), now);
  return id;
}
