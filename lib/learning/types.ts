export type FeedbackStatus = "approved" | "edited" | "rejected" | "pending";
export const feedbackLabels: Record<FeedbackStatus, string> = {
  approved: "Одобрен",
  edited: "Исправлен · ждёт одобрения",
  rejected: "Неудачный",
  pending: "Черновик",
};
export type ExampleRevision = {
  correctedReply: string;
  status: FeedbackStatus;
  comment: string;
  changedAt: string;
};
export type TrainingExample = {
  id: string;
  workspaceId: string;
  storeId: string;
  productId: string;
  productName: string;
  question: string;
  originalReply: string;
  correctedReply: string;
  status: FeedbackStatus;
  comment: string;
  createdAt: string;
  updatedAt: string;
  revisions: ExampleRevision[];
};
export type TrainingData = {
  version: 1;
  workspaceId: string;
  storeId: string;
  examples: TrainingExample[];
};
export type ExampleInput = Pick<
  TrainingExample,
  | "productId"
  | "productName"
  | "question"
  | "originalReply"
  | "correctedReply"
  | "status"
  | "comment"
>;
export function trainingKey(storeId: string) {
  return `sellerai:learning:v1:${storeId}`;
}
