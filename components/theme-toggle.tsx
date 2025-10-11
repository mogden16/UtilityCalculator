// components/theme-toggle.tsx
"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const current = document.documentElement.classList.contains("dark");
    setDark(current);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <button
      onClick={toggle}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border hover:bg-muted transition"
      aria-label="Toggle theme"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="text-lg">{dark ? "🌙" : "☀️"}</span>
    </button>
  );
}
