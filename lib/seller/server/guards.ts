import { timingSafeEqual } from "node:crypto";
export class RequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function authorized(
  header: string | null,
  expected: string | undefined,
): boolean {
  if (!expected || expected.length < 32 || !header?.startsWith("Bearer "))
    return false;
  const a = Buffer.from(header.slice(7)),
    b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function readJsonBounded(
  request: Request,
  max = 65536,
): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError(400, "Пустой запрос.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new RequestError(413, "Запрос слишком большой. Максимум 64 КБ.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RequestError(400, "Некорректный JSON.");
  }
}
export class WindowLimit {
  private used = 0;
  private until = 0;
  constructor(
    private max: number,
    private windowMs: number,
  ) {}
  take(count = 1, now = Date.now()): boolean {
    if (now >= this.until) {
      this.until = now + this.windowMs;
      this.used = 0;
    }
    if (this.used + count > this.max) return false;
    this.used += count;
    return true;
  }
}
// Process-wide MVP limits: no IP headers are trusted; no unbounded client map.
export const demoLimit = new WindowLimit(60, 60000),
  realMinuteLimit = new WindowLimit(12, 60000),
  realHourLimit = new WindowLimit(60, 3600000);
let active = 0;
export function acquire() {
  if (active >= 2)
    throw new RequestError(
      429,
      "Уже выполняются два сравнения. Попробуйте позже.",
    );
  active++;
  return () => {
    active--;
  };
}

// Next.js may canonicalize request.url to localhost. The browser's Host remains
// the requested authority; do not trust a client-supplied X-Forwarded-Host.
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      url.host === (request.headers.get("host") || new URL(request.url).host)
    );
  } catch {
    return false;
  }
}
