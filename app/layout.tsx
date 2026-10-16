import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./refinements.css";
import "./davio.css";
import Pwa from "@/components/davio/pwa";
export const metadata: Metadata = {
  title: "DAVIO — Меньше рутины, больше продаж",
  description:
    "Рабочее пространство продавца: объявления, фотографии, видео и помощник.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "DAVIO", statusBarStyle: "default" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#101214" },
  ],
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('davio:theme');document.documentElement.dataset.theme=t==='dark'||t==='light'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        {children}
        <Pwa />
      </body>
    </html>
  );
}
