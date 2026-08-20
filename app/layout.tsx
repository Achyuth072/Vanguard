import type { Metadata } from "next";
import { Inter } from "next/font/google";
import GlobalCommandPalette from "@/components/GlobalCommandPalette";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Vanguard",
  description: "Personal Career Scouting & Application Cockpit",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} min-h-screen bg-zinc-950 text-zinc-100 antialiased`}>
        {children}
        <GlobalCommandPalette />
      </body>
    </html>
  );
}