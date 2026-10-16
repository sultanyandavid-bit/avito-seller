import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import {DatabaseSync} from "node:sqlite";
import { db } from "../lib/davio/server/db";
import { emptyProject, type DavioUser } from "../lib/davio/types";
import {
  composeDescription,
  assistantAnswer,
  projectData,
} from "../lib/davio/content";
import {
  hashPassword,
  verifyPassword,
  newSession,
  currentUser,
  digest,
  rateLimit,
  checkOrigin,
} from "../lib/davio/server/auth";
import {
  createProject,
  saveProject,
  projectView,
  fileFor,
  addFile,
  duplicateProject,
  usageFor,
} from "../lib/davio/server/projects";
import { correctPhoto } from "../lib/davio/server/media";
import { enqueueVideo, renderNext } from "../lib/davio/server/video";
import { zip } from "../lib/davio/server/zip";
const dir = mkdtempSync(path.join(os.tmpdir(), "davio-test-"));
process.env.DAVIO_DATA_DIR = dir;
const legacyDb=new DatabaseSync(path.join(dir,"davio.sqlite"));
legacyDb.exec("PRAGMA foreign_keys=OFF; CREATE TABLE files(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,kind TEXT NOT NULL,source_id TEXT REFERENCES files(id),bytes BLOB NOT NULL,created_at INTEGER NOT NULL)");
legacyDb.prepare("INSERT INTO files VALUES('legacy-file','alice','legacy.png','image/png',4,'original',NULL,?,1)").run(Buffer.from([1,2,3,4]));
legacyDb.close();

const alice: DavioUser = {
    id: "alice",
    name: "Alice",
    email: "alice@example.test",
    role: "user",
    plan: "basic",
  },
  bob: DavioUser = { ...alice, id: "bob", email: "bob@example.test" };
for (const u of [alice, bob])
  db()
    .prepare(
      "INSERT INTO users(id,email,name,password,created_at) VALUES(?,?,?,'unused',?)",
    )
    .run(u.id, u.email, u.name, Date.now());
after(() => {
  db().close();
  rmSync(dir, { recursive: true, force: true });
});
test("additive media settings migration preserves existing private file bytes",()=>{const f=fileFor(alice,"legacy-file");assert.deepEqual(Buffer.from(f.bytes as Uint8Array),Buffer.from([1,2,3,4]));assert.equal(f.settings,"{}");assert.equal(db().prepare("PRAGMA foreign_key_check").all().length,0);});
test("passwords use independent salted scrypt hashes and verification rejects wrong passwords", async () => {
  const p = "long safe password";
  const a = await hashPassword(p),
    b = await hashPassword(p);
  assert.notEqual(a, b);
  assert.equal(await verifyPassword(p, a), true);
  assert.equal(await verifyPassword("wrong password", a), false);
});
test("opaque sessions are hashed, expire and cannot cross an origin", () => {
  const token = newSession(alice.id);
  assert.notEqual(digest(token), token);
  const request = new Request("http://localhost:3000/api/davio/session", {
    headers: { cookie: `davio_session=${token}` },
  });
  assert.equal(currentUser(request)?.id, alice.id);
  db().prepare("UPDATE sessions SET expires=0 WHERE hash=?").run(digest(token));
  assert.equal(currentUser(request), null);
  assert.throws(
    () =>
      checkOrigin(
        new Request("http://localhost:3000/x", {
          headers: { origin: "https://attacker.test" },
        }),
      ),
    /DAVIO/,
  );
  checkOrigin(
    new Request("http://localhost:3000/x", {
      headers: { origin: "http://localhost:3000" },
    }),
  );
});
test("templates never infer facts and styles provide different real structures", () => {
  const data = {
    ...emptyProject,
    title: "Велосипед",
    facts: "Рама 19 дюймов",
    defects: "Царапины",
    equipment: "Только велосипед",
  };
  const result = composeDescription(data);
  assert.match(result.description, /Царапины/);
  assert.doesNotMatch(result.description, /алюмин|доставк|новый/);
  assert.match(result.recommendations, /цену/);
  assert.notEqual(
    composeDescription({ ...data, style: "brief" }).description,
    composeDescription({ ...data, style: "detailed" }).description,
  );
  assert.match(
    assistantAnswer("seller", "Сделаете скидку?", data),
    /без подтверждения/,
  );
  assert.throws(() => projectData({ ...emptyProject, price: NaN }));
});
test("project saves are versioned, conflicts stop and user boundaries hold", () => {
  const p = createProject(alice, { ...emptyProject, title: "Свой товар" });
  assert.throws(() => projectView(bob, p.id), /не найден/);
  const next = saveProject(
    alice,
    p.id,
    { ...p.data, description: "Только факты" },
    1,
  );
  assert.equal(next.revision, 2);
  assert.throws(() => saveProject(alice, p.id, p.data, 1), /другой вкладке/);
  assert.equal(projectView(alice, p.id).data.description, "Только факты");
  assert.equal(
    db()
      .prepare("SELECT count(*) n FROM revisions WHERE project_id=?")
      .get(p.id)!.n,
    2,
  );
});
test("photo correction preserves original bytes and independent project text; duplicate shares only owner's assets", async () => {
  const p = createProject(alice, {
      ...emptyProject,
      title: "Фото",
      description: "Мой текст",
    }),
    bytes = await sharp({
      create: { width: 200, height: 120, channels: 3, background: "#68767a" },
    })
      .png()
      .toBuffer();
  const original = addFile(alice, p.id, {
    bytes,
    name: "original.png",
    mime: "image/png",
    kind: "original",
  });
  const output = await correctPhoto(alice, p.id, {
    sourceId: original,
    brightness: 1.1,
    contrast: 1.1,
    warmth: 1,
    aspect: "1:1",
    fit: "contain",
    width: 800,
    quality: 90,
  });
  const image = await sharp(
    fileFor(alice, output).bytes as Uint8Array,
  ).metadata();
  assert.equal(image.width, 800);
  assert.equal(image.height, 800);
  assert.equal(image.format, "jpeg");
  assert.equal(
    projectView(alice, p.id).assets.find((a) => a.id === output)?.settings
      .width,
    800,
  );
  assert.deepEqual(
    Buffer.from(fileFor(alice, original).bytes as Uint8Array),
    bytes,
  );
  assert.throws(() => fileFor(bob, original), /не найден/);
  assert.equal(projectView(alice, p.id).data.description, "Мой текст");
  const copy = duplicateProject(alice, p.id);
  assert.notEqual(copy.id, p.id);
  assert.equal(copy.assets.length, 2);
  assert.equal(copy.assets.find((a) => a.id === output)?.sourceId, original);
  const other = createProject(alice, emptyProject);
  await assert.rejects(
    () => correctPhoto(alice, other.id, { sourceId: original }),
    /исходную/,
  );
});
test("limits are enforced centrally and failed requests do not change counters", () => {
  rateLimit("test", 1);
  assert.throws(() => rateLimit("test", 1), /много запросов/);
  const old = usageFor(bob).plan;
  db()
    .prepare("UPDATE plans SET data=? WHERE id='basic'")
    .run(JSON.stringify({ ...old, projects: 1 }));
  createProject(bob, emptyProject);
  assert.throws(() => createProject(bob, emptyProject), /лимит/);
  db()
    .prepare("UPDATE plans SET data=? WHERE id='basic'")
    .run(JSON.stringify(old));
});
test("ZIP contains valid UTF-8 entries and exact bytes", () => {
  const archive = path.join(dir, "check.zip");
  writeFileSync(
    archive,
    zip([
      { name: "description.txt", bytes: Buffer.from("Привет, товар!") },
      { name: "photos/image.bin", bytes: Buffer.from([1, 2, 3, 4]) },
    ]),
  );
  execFileSync("python3", [
    "-c",
    "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert z.read('description.txt').decode()=='Привет, товар!'; assert z.read('photos/image.bin')==bytes([1,2,3,4])",
    archive,
  ]);
});
test(
  "FFmpeg worker creates a true 1080x1920 H.264 MP4 and keeps photos and text",
  { timeout: 180000 },
  async () => {
    const p = createProject(alice, {
        ...emptyProject,
        title: "Настоящий товар",
        description: "Оставить текст",
      }),
      bytes = await sharp({
        create: { width: 360, height: 240, channels: 3, background: "#657e6d" },
      })
        .png()
        .toBuffer();
    const original = addFile(alice, p.id, {
      bytes,
      name: "source.png",
      mime: "image/png",
      kind: "original",
    });
    assert.throws(
      () =>
        enqueueVideo(alice, p.id, {
          sourceIds: [original],
          aspect: "9:16",
          duration: 6,
        }),
      /worker/,
    );
    db()
      .prepare("INSERT OR REPLACE INTO runtime VALUES('worker',?)")
      .run(JSON.stringify({ at: Date.now(), ffmpeg: true }));
    const job = enqueueVideo(alice, p.id, {
      sourceIds: [original],
      aspect: "9:16",
      duration: 6,
    });
    await renderNext();
    const state = projectView(alice, p.id);
    assert.equal(
      state.jobs.find((j) => j.id === job)?.status,
      "completed",
      state.jobs[0]?.error || "",
    );
    const video = state.assets.find((a) => a.kind === "video")!;
    assert.ok(video);
    assert.equal(video.settings.codec, "h264");
    const output = path.join(dir, "actual.mp4");
    writeFileSync(
      output,
      Buffer.from(fileFor(alice, video.id).bytes as Uint8Array),
    );
    const info = JSON.parse(
      execFileSync(
        "ffprobe",
        ["-v", "quiet", "-show_streams", "-show_format", "-of", "json", output],
        { encoding: "utf8" },
      ),
    );
    assert.equal(info.streams[0].codec_name, "h264");
    assert.equal(info.streams[0].width, 1080);
    assert.equal(info.streams[0].height, 1920);
    assert.ok(Number(info.format.duration) >= 5.9);
    assert.equal(state.data.description, "Оставить текст");
    assert.ok(state.assets.find((a) => a.id === original));
  },
);
