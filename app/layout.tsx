import "./globals.css";
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import { SiteNav } from "@/components/site-nav";
import ThemeToggle from "@/components/theme-toggle";
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
  metadataBase: new URL("https://utilitycalc.pages.dev"),
  title: {
    default: "Utility Calculator",
    template: "%s | Utility Calculator",
  },
  description: "Static engineering calculators for thermal demand, gas flow, and utility cost comparisons.",
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
          <header className="safe-top sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-3 py-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-base font-semibold sm:text-lg">Utility Calculator</div>
                  <p className="text-xs text-muted-foreground">
                    Static engineering tools for thermal and utility calculations.
                  </p>
                </div>
                <ThemeToggle />
              </div>
              <SiteNav />
            </div>
          </header>
          <main className="flex-1 p-3">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
          <footer className="border-t border-border/70 px-3 py-6">
            <div className="mx-auto max-w-6xl text-sm text-muted-foreground">
              Deterministic conversions are calculated directly. Load estimation remains a rule-of-thumb workflow and
              should be verified before final design decisions.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
