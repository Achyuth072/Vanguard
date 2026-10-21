import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import GlobalCommandPalette from "@/components/GlobalCommandPalette";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Vanguard",
  description: "Personal Career Scouting & Application Cockpit",
  applicationName: "Vanguard",
  appleWebApp: {
    capable: true,
    title: "Vanguard",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/vanguard-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/vanguard-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/vanguard-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#0d0e12",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} font-sans`}
    >
      <body className="min-h-screen bg-background text-foreground font-sans antialiased selection:bg-primary/30 selection:text-foreground">
        {children}
        <GlobalCommandPalette />
      </body>
    </html>
  );
}