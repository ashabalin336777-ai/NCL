import { Manrope } from "next/font/google";
import type { Metadata } from "next";

import { Providers } from "@/components/providers";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
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
    <html lang="ru">
      <body className={manrope.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
