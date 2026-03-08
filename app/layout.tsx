import "./globals.css";
import type { Metadata, Viewport } from "next";


export const metadata: Metadata = {
  title: "UtilityCalc – Energy & Utility Toolkit",
  description: "Convert, estimate, and analyze energy loads and rates with UtilityCalc.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* ✅ PWA + iOS Home Screen support */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="UtilityCalc" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="min-h-screen flex flex-col">
          <header className="safe-top sticky top-0 z-50 flex items-center justify-between border-b bg-background p-3">
            <span className="text-base font-semibold sm:text-lg">UtilityCalculator</span>
            <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
              Convert, compare, and estimate energy loads
            </span>
            <ThemeToggle />
