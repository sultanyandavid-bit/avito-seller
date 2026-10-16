export type PlanId = "basic" | "pro";
export type DavioUser = {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  plan: PlanId;
};
export type ProjectData = {
  title: string;
  category: string;
  brand: string;
  model: string;
  condition: string;
  facts: string;
  equipment: string;
  defects: string;
  price: number | null;
  extra: string;
  description: string;
  advantages: string;
  style: "brief" | "standard" | "detailed";
};
export const emptyProject: ProjectData = {
  title: "",
  category: "",
  brand: "",
  model: "",
  condition: "",
  facts: "",
  equipment: "",
  defects: "",
  price: null,
  extra: "",
  description: "",
  advantages: "",
  style: "standard",
};
export type ProjectAsset = {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: "original" | "photo" | "video";
  sourceId: string | null;
  settings: Record<string, string | number | boolean | string[]>;
  createdAt: number;
};
export type VideoJob = {
  id: string;
  projectId: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  error: string | null;
  outputId: string | null;
  createdAt: number;
  updatedAt: number;
};
export type Project = {
  id: string;
  data: ProjectData;
  revision: number;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  assets: ProjectAsset[];
  jobs: VideoJob[];
};
export type Revision = {
  id: number;
  revision: number;
  data: ProjectData;
  createdAt: number;
};
export type Plan = {
  id: PlanId;
  label: string;
  projects: number;
  storageMB: number;
  renders: number;
  texts: number;
};
export type Usage = {
  projects: number;
  storageBytes: number;
  renders: number;
  texts: number;
  plan: Plan;
  worker: { online: boolean; ffmpeg: boolean };
};
export type ChatMode = "seller" | "assistant" | "learn";
export type ChatEntry = {
  id: string;
  mode: ChatMode;
  projectId: string | null;
  question: string;
  answer: string;
  createdAt: number;
};
