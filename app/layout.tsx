import type { Metadata } from "next";
import "./globals.css";
import "./refinements.css";
export const metadata: Metadata = {
  title: "Seller AI — рабочее пространство",
  description:
    "Рабочее пространство продавца: товары, диалоги, черновики и одобренные примеры ответов.",
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
