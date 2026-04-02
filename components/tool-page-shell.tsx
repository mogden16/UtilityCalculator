import type { ReactNode } from "react";

type ToolPageShellProps = {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function ToolPageShell({ eyebrow, title, description, children }: ToolPageShellProps) {
  return (
    <div className="space-y-6 pb-8">
      <section className="space-y-3 rounded-3xl border border-border/70 bg-card px-6 py-8 shadow-sm">
        {eyebrow ? <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p> : null}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="max-w-3xl text-base leading-7 text-muted-foreground">{description}</p>
      </section>
      {children}
    </div>
  );
}
