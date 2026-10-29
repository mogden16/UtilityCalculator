import "./globals.css";
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import { AppHeader } from "@/components/app-header";
import { MobileBottomNav } from "@/components/site-nav";
import { ThemeScript } from "@/components/theme-script";

const geistSans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Utility Calculator",
    template: "%s | Utility Calculator",
  },
  description: "Engineering calculators for thermal demand, CHP screening, gas flow, and utility cost comparisons.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <ThemeScript />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="flex min-h-screen flex-col">
          <AppHeader />
          <main className="flex-1 px-3 pb-20 pt-4 sm:px-6 sm:pt-6 lg:pb-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
          <footer className="hidden border-t border-border/70 px-6 py-5 lg:block">
            <div className="mx-auto flex max-w-7xl justify-between gap-6 text-xs text-muted-foreground">
              <span>Preliminary engineering screening. Verify tariff, equipment, and site assumptions before investment.</span>
              <a href="/unit-conversions" className="font-medium text-foreground hover:underline">Quick conversions</a>
            </div>
          </footer>
          <MobileBottomNav />
        </div>
      </body>
    </html>
  );
}
