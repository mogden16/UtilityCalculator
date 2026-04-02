type MetricCardProps = {
  label: string;
  value: string;
  detail?: string;
};

export function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 rounded-lg bg-muted/40 px-3 py-2 font-mono text-lg text-foreground">{value}</div>
      {detail ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p> : null}
    </div>
  );
}
