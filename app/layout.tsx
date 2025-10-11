// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "@/components/theme-provider";
import ThemeToggle from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Energy Pro Toolkit",
  description: "UtilityCalc – conversions, sizing, and rates",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur">
            <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
              <h1 className="text-xl font-semibold tracking-tight">Energy Pro Toolkit</h1>
              <ThemeToggle />
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
