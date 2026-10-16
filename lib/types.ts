export const sections = [
  "dashboard",
  "products",
  "messages",
  "assistant",
  "seller",
  "learning",
  "settings",
] as const;
export type Section = (typeof sections)[number];
export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  status: "active" | "draft" | "archived";
  visual: "phone" | "laptop" | "headphones" | "camera" | "box";
};
export type Message = {
  id: string;
  role: "buyer" | "seller";
  text: string;
  time: string;
};
export type Conversation = {
  id: string;
  name: string;
  productId: string;
  unread: number;
  human: boolean;
  messages: Message[];
};
export type AISettings = {
  enabled: boolean;
  style: "friendly" | "business" | "brief" | "expert" | "consultative";
  instructions: string;
};
export type Store = {
  version: 1;
  products: Product[];
  conversations: Conversation[];
  ai: AISettings;
  shopName: string;
  city: string;
};
