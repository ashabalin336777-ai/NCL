import { Inter } from "next/font/google";
import type { Metadata } from "next";

import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NeuroCloser — NCL Sales Trainer",
  description: "Тренажёр дожатия сделок с ИИ для менеджеров B2B-продаж электронных компонентов",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html lang="ru" className="dark">
      <body className={inter.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
