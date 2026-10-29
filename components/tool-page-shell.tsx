import type { ReactNode } from "react";

type ToolPageShellProps = {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function ToolPageShell({ eyebrow, title, description, children }: ToolPageShellProps) {
  return (
    <div className="space-y-4 pb-8 sm:space-y-5">
      <section className="space-y-1 px-1 py-1 sm:space-y-2">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
      </section>
      {children}
    </div>
  );
}
