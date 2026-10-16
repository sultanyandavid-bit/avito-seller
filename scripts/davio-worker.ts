import { randomUUID } from "node:crypto";
import { db, transaction } from "../lib/davio/server/db";
import { command, renderNext } from "../lib/davio/server/video";
async function main() {
  const token = randomUUID();
  let ffmpeg = false,
    stopping = false;
  try {
    await command(
      process.env.DAVIO_FFMPEG_PATH || "ffmpeg",
      ["-version"],
      5000,
    );
    ffmpeg = true;
  } catch {
    console.error(
      "FFmpeg недоступен. Установите его, затем перезапустите worker.",
    );
    process.exit(1);
  }
  transaction(() => {
    const row = db()
      .prepare("SELECT value FROM runtime WHERE key='worker'")
      .get();
    if (row && Date.now() - JSON.parse(String(row.value)).at < 15000)
      throw new Error("Worker уже запущен. Второй экземпляр не нужен.");
    db()
      .prepare(
        "UPDATE jobs SET status='failed',error='Worker был остановлен. Повторите монтаж.',updated_at=? WHERE status='processing'",
      )
      .run(Date.now());
    db()
      .prepare(
        "INSERT INTO runtime VALUES('worker',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(JSON.stringify({ token, at: Date.now(), ffmpeg }));
  });
  const heartbeat = setInterval(
    () =>
      db()
        .prepare("UPDATE runtime SET value=? WHERE key='worker'")
        .run(JSON.stringify({ token, at: Date.now(), ffmpeg })),
    3000,
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => {
      stopping = true;
    });
  console.log(
    "DAVIO worker: FFmpeg готов, очередь прослушивается. Ctrl+C — безопасная остановка после текущей задачи.",
  );
  while (!stopping) {
    if (!(await renderNext())) await new Promise((r) => setTimeout(r, 1000));
  }
  clearInterval(heartbeat);
  db().prepare("DELETE FROM runtime WHERE key='worker'").run();
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Worker stopped");
  process.exit(1);
});
