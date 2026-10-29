import type { ReactNode } from "react";

export function ResultSummary({
  label,
  value,
  unit,
  detail,
  actions,
}: {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-primary/20 bg-primary px-5 py-5 text-primary-foreground shadow-lg shadow-primary/10 sm:px-6" aria-live="polite">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground/70">{label}</p>
          <p className="mt-1 font-mono text-3xl font-semibold tracking-tight sm:text-4xl">
            {value}{unit ? <span className="ml-2 text-base font-medium text-primary-foreground/75 sm:text-lg">{unit}</span> : null}
          </p>
          {detail ? <p className="mt-2 max-w-3xl text-sm leading-5 text-primary-foreground/75">{detail}</p> : null}
        </div>
        {actions ? <div className="[&_button]:border-white/25 [&_button]:bg-white/10 [&_button]:text-white [&_button:hover]:bg-white/20">{actions}</div> : null}
      </div>
    </section>
  );
}
