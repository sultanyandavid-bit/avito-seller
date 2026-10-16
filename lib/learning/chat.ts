export type ChatDraft = {
  id: string;
  productId: string;
  question: string;
  original: string;
  edited: string | null;
  handoff: boolean;
  createdAt: string;
};
export type ChatData = { version: 1; drafts: ChatDraft[] };
export const chatSeed: ChatData = { version: 1, drafts: [] };
export function parseChatData(raw: string): ChatData | null {
  try {
    const x = JSON.parse(raw);
    if (
      x?.version !== 1 ||
      !Array.isArray(x.drafts) ||
      x.drafts.length > 200 ||
      !x.drafts.every(
        (d: ChatDraft) =>
          d &&
          typeof d.id === "string" &&
          typeof d.productId === "string" &&
          typeof d.question === "string" &&
          d.question.length <= 4000 &&
          typeof d.original === "string" &&
          d.original.length <= 8000 &&
          (d.edited === null ||
            (typeof d.edited === "string" && d.edited.length <= 8000)) &&
          typeof d.handoff === "boolean" &&
          typeof d.createdAt === "string" &&
          Number.isFinite(Date.parse(d.createdAt)),
      )
    )
      return null;
    return x;
  } catch {
    return null;
  }
}
