export type Aspect = "1:1" | "4:3" | "3:4" | "9:16" | "16:9";
export type Asset = {
  id: string;
  storeId: string;
  workspaceId: string;
  name: string;
  type: "image" | "video";
  mime: string;
  size: number;
  createdAt: string;
  blob: Blob;
  sourceId?: string;
};
export type MediaJob = {
  id: string;
  storeId: string;
  kind: "photo" | "video";
  mode: "text" | "sources" | "local";
  status: "waiting_provider" | "queued" | "processing" | "completed" | "failed";
  sourceIds: string[];
  outputIds: string[];
  title: string;
  prompt: string;
  category: string;
  style: string;
  colors: string;
  environment: string;
  aspect: Aspect;
  count: number;
  duration: number;
  brightness: number;
  progress: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};
export type MediaData = { version: 1; storeId: string; jobs: MediaJob[] };
export const aspectSizes: Record<Aspect, [number, number]> = {
  "1:1": [1200, 1200],
  "4:3": [1200, 900],
  "3:4": [900, 1200],
  "9:16": [675, 1200],
  "16:9": [1200, 675],
};
export const jobLabels = {
  waiting_provider: "Ожидает провайдера",
  queued: "В очереди",
  processing: "Обрабатывается локально",
  completed: "Готово",
  failed: "Ошибка",
};
/** Implement behind authenticated server jobs when an approved provider is connected. */
export interface GenerativeMediaProvider {
  readonly id: string;
  readonly kinds: ("photo" | "video")[];
  estimate(job: MediaJob): Promise<{ amount: number; currency: string } | null>;
  generate(
    job: MediaJob,
    sources: Blob[],
    signal: AbortSignal,
  ): Promise<Blob[]>;
}
export function emptyMedia(storeId: string): MediaData {
  return { version: 1, storeId, jobs: [] };
}
export function parseMedia(raw: string, storeId: string): MediaData | null {
  try {
    const x = JSON.parse(raw);
    if (
      x?.version !== 1 ||
      x.storeId !== storeId ||
      !Array.isArray(x.jobs) ||
      x.jobs.length > 200 ||
      !x.jobs.every(
        (j: MediaJob) =>
          j &&
          j.storeId === storeId &&
          typeof j.id === "string" &&
          ["photo", "video"].includes(j.kind) &&
          ["text", "sources", "local"].includes(j.mode) &&
          Object.hasOwn(jobLabels, j.status) &&
          Array.isArray(j.sourceIds) &&
          j.sourceIds.length <= 10 &&
          j.sourceIds.every((id) => typeof id === "string") &&
          Array.isArray(j.outputIds) &&
          j.outputIds.length <= 10 &&
          j.outputIds.every((id) => typeof id === "string") &&
          [
            j.title,
            j.prompt,
            j.category,
            j.style,
            j.colors,
            j.environment,
          ].every((s) => typeof s === "string" && s.length <= 4000) &&
          Object.hasOwn(aspectSizes, j.aspect) &&
          Number.isInteger(j.count) &&
          j.count >= 1 &&
          j.count <= 10 &&
          Number.isInteger(j.duration) &&
          j.duration >= 3 &&
          j.duration <= 30 &&
          Number.isFinite(j.brightness) &&
          j.brightness >= 0.8 &&
          j.brightness <= 1.2 &&
          Number.isFinite(j.progress) &&
          j.progress >= 0 &&
          j.progress <= 100 &&
          (j.error === null || typeof j.error === "string") &&
          Number.isFinite(Date.parse(j.createdAt)) &&
          Number.isFinite(Date.parse(j.updatedAt)),
      )
    )
      return null;
    return x;
  } catch {
    return null;
  }
}
