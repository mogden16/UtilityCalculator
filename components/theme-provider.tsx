// components/theme-provider.tsx
"use client";

import React, { useEffect, useState } from "react";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // initialize theme from localStorage
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
    const theme = saved ?? (prefersDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
    setMounted(true);
  }, []);
  if (!mounted) return null; // avoid hydration flash
  return <>{children}</>;
}
