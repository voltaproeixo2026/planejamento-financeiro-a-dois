import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { addMonths, BRL, monthLabel } from "@/lib/finance";
import { cn } from "@/lib/utils";

export function Stat({ label, value, hint, tone }: { label: string; value: number; hint?: string | undefined; tone?: "good" | "bad" | "warn" | undefined }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-display text-2xl md:text-3xl", tone === "good" && "text-success", tone === "bad" && "text-destructive", tone === "warn" && "text-warning")}>{BRL(value)}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Section({ id, title, desc, children, action }: { id?: string; title: string; desc?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section id={id} className="rounded-2xl border bg-card p-5 shadow-soft md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div><h2 className="text-xl">{title}</h2>{desc && <p className="text-sm text-muted-foreground">{desc}</p>}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Status({ paid, overdue }: { paid: boolean; overdue?: boolean }) {
  if (paid) return <Badge className="bg-success text-success-foreground hover:bg-success">Pago</Badge>;
  if (overdue) return <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive">Vencido</Badge>;
  return <Badge className="bg-warning text-warning-foreground hover:bg-warning">Pendente</Badge>;
}

export function MonthNav({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft /></Button>
      <span className="min-w-36 text-center font-medium capitalize">{monthLabel(month)}</span>
      <Button variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight /></Button>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</p>;
}

export const NativeSelect = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={cn("h-9 w-full rounded-md border border-input bg-background px-3 text-sm", p.className)} />
);
