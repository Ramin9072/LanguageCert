import type { Metadata, Viewport } from "next";
import { DM_Sans, Instrument_Serif, Vazirmatn } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const fa = Vazirmatn({ subsets: ["arabic", "latin"], variable: "--font-fa", display: "swap" });
const display = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "WordWise – vocabulary quizzes from your own word list",
  description:
    "Upload your own word list with Persian meanings and example sentences, hear the words in an English accent, and practice with automatic quizzes.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${sans.variable} ${fa.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
