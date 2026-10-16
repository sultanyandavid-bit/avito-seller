import type { Metadata } from "next";
import "./globals.css";
import "./refinements.css";
export const metadata: Metadata = {
  title: "AI Avito Seller — рабочее пространство",
  description:
    "Демонстрационный помощник продавца: товары, диалоги и AI-ассистент.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
