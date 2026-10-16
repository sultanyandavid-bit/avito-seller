import { randomBytes, scrypt, createHash, timingSafeEqual } from "node:crypto";
import { db, transaction } from "./db";
import type { DavioUser } from "../types";
import { DavioError } from "../content";
export const cookieName = "davio_session";
export function digest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 32768, maxmem: 64 * 1024 * 1024 },
      (e, key) => (e ? reject(e) : resolve(key)),
    ),
  );
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, key] = stored.split(":");
  const actual = await derive(password, salt);
  const expected = Buffer.from(key, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function rateLimit(key: string, max: number, window = 60000) {
  transaction(() => {
    const now = Date.now();
    db().prepare("DELETE FROM rate_limits WHERE until<?").run(now);
    const r = db().prepare("SELECT * FROM rate_limits WHERE key=?").get(key) as
      { until: number; count: number } | undefined;
    if (r && r.count >= max)
      throw new DavioError(
        429,
        "Слишком много запросов. Подождите и повторите.",
      );
    db()
      .prepare(
        "INSERT INTO rate_limits VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET count=count+1",
      )
      .run(key, now + window);
  });
}
export function publicUser(row: Record<string, unknown>): DavioUser {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    role: row.role as DavioUser["role"],
    plan: row.plan as DavioUser["plan"],
  };
}
export function currentUser(request: Request): DavioUser | null {
  const token = (request.headers.get("cookie") || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = db()
    .prepare(
      "SELECT u.* FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.hash=? AND s.expires>?",
    )
    .get(digest(token), Date.now());
  return row ? publicUser(row) : null;
}
export function requireUser(request: Request) {
  const user = currentUser(request);
  if (!user) throw new DavioError(401, "Войдите в аккаунт DAVIO.");
  return user;
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const expected =
    process.env.DAVIO_APP_ORIGIN ||
    `${url.protocol}//${request.headers.get("host") || url.host}`;
  if (!origin || origin !== expected)
    throw new DavioError(403, "Запрос должен выполняться из DAVIO.");
}
export function sessionCookie(token: string, maxAge = 604800) {
  const secure = process.env.DAVIO_APP_ORIGIN?.startsWith("https://")
    ? "; Secure"
    : "";
  return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
export function newSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  db().prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
  db()
    .prepare("INSERT INTO sessions VALUES(?,?,?)")
    .run(digest(token), userId, Date.now() + 604800000);
  return token;
}
export function logout(request: Request) {
  const token = (request.headers.get("cookie") || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (token)
    db().prepare("DELETE FROM sessions WHERE hash=?").run(digest(token));
}
