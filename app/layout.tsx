import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Tamil } from "next/font/google";
import "./globals.css";

const latin = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-latin",
});

const tamil = Noto_Sans_Tamil({
  subsets: ["tamil", "latin"],
  display: "swap",
  variable: "--font-tamil",
});

export const metadata: Metadata = {
  title: {
    default: "Pazhamozhi AI",
    template: "%s | Pazhamozhi AI",
  },
  description:
    "Describe a situation in Tamil, English, or Tanglish and find the Tamil proverb that fits it.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${latin.variable} ${tamil.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
