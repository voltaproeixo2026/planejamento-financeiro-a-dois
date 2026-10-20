import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/lib/household";
import { addMonths, alerts, BRL, debtSummary, fmtDate, summarize, type Item } from "@/lib/finance";
import { Empty, Section, Stat, Status } from "./ui-bits";

export function togglePaid(update: ReturnType<typeof useAppState>["update"], i: Item, month: string) {
  update((s) => {
    if (i.kind === "bill") {
      return { ...s, bills: s.bills.map((b) => (b.id === i.refId ? { ...b, paid: { ...b.paid, [month]: !b.paid[month] } } : b)) };
    }
    return {
      ...s,
      debts: s.debts.map((d) => {
        if (d.id !== i.refId || i.installment === undefined) return d;
        // Only the next unpaid installment can be paid; undo only the last paid one.
        if (!i.paid && i.installment === d.paidCount) return { ...d, paidCount: d.paidCount + 1 };
        if (i.paid && i.installment === d.paidCount - 1) return { ...d, paidCount: d.paidCount - 1 };
        return d;
      }),
    };
  });
}

export function Dashboard({ month }: { month: string }) {
  const { s, update } = useAppState();
  const today = new Date().toISOString().slice(0, 10);
  const sum = summarize(s, month, { today });
  const next = summarize(s, addMonths(month, 1), { today });
  const al = alerts(s, month, today);
  const upcoming = sum.items.filter((i) => !i.paid).slice(0, 6);
  const debtTotal = s.debts.reduce((a, d) => a + debtSummary(d).remaining, 0);
  const pie = [
    { name: `${s.names[0]} (recorrente)`, value: sum.recurring[0] },
    { name: `${s.names[1]} (recorrente)`, value: sum.recurring[1] },
    { name: "Extras", value: sum.extras[0] + sum.extras[1] },
  ].filter((p) => p.value > 0);
  const colors = ["var(--person-a)", "var(--person-b)", "var(--warning)"];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-hero p-6 text-primary-foreground shadow-soft md:p-8">
        <h1 className="text-3xl md:text-4xl">Olá, casal</h1>
        <p className="mt-1 opacity-90">{s.names[0]} & {s.names[1]} — resumo do mês selecionado</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Entra no mês" value={sum.totalIncome} hint="Rendas previstas + extras" />
        <Stat label="Já saiu" value={sum.paid} hint="Despesas pagas" />
        <Stat label="Falta pagar" value={sum.pending} hint={sum.overdue.length ? `${sum.overdue.length} vencida(s)` : "Pendentes"} tone={sum.overdue.length ? "bad" : "warn"} />
        <Stat label="Sobra prevista" value={sum.leftover} hint="Após despesas e dinheiro livre" tone={sum.leftover >= 0 ? "good" : "bad"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Próximos vencimentos">
          {upcoming.length ? (
            <ul className="divide-y">
              {upcoming.map((i) => (
                <li key={i.key} className="flex items-center justify-between gap-2 py-2.5">
                  <div><p className="font-medium">{i.name}</p><p className="text-xs text-muted-foreground">{fmtDate(i.date)} · {i.shared ? "Compartilhada" : s.names[i.person ?? 0]}</p></div>
                  <div className="flex items-center gap-2"><span className="font-semibold">{BRL(i.amount)}</span><Status paid={i.paid} overdue={i.date < today} />
                    <Button size="sm" variant="outline" onClick={() => togglePaid(update, i, month)}>Pagar</Button></div>
                </li>
              ))}
            </ul>
          ) : <Empty>Nada pendente neste mês. Cadastre contas em “Contas”.</Empty>}
        </Section>

        <Section title="Pontos de atenção">
          {al.length ? (
            <ul className="space-y-2">
              {al.map((a, k) => (
                <li key={k} className="flex gap-2 rounded-lg bg-muted p-3 text-sm">
                  {a.level === "danger" ? <OctagonAlert className="h-4 w-4 shrink-0 text-destructive" /> : a.level === "warn" ? <AlertTriangle className="h-4 w-4 shrink-0 text-warning" /> : <Info className="h-4 w-4 shrink-0 text-primary" />}
                  {a.text}
                </li>
              ))}
            </ul>
          ) : <Empty>Tudo tranquilo por aqui.</Empty>}
        </Section>

        <Section title="Distribuição das receitas">
          {pie.length ? (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-48 w-48"><ResponsiveContainer><PieChart><Pie data={pie} dataKey="value" innerRadius={45} outerRadius={80}>{pie.map((_, k) => <Cell key={k} fill={colors[k]} />)}</Pie><Tooltip formatter={(v: number) => BRL(v)} /></PieChart></ResponsiveContainer></div>
              <ul className="space-y-2 text-sm">{pie.map((p, k) => <li key={p.name} className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: colors[k] }} />{p.name}: <b>{BRL(p.value)}</b></li>)}</ul>
            </div>
          ) : <Empty>Cadastre as rendas para ver o gráfico.</Empty>}
        </Section>

        <Section title="Próximo mês">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted-foreground">Receitas previstas</dt><dd className="text-lg font-semibold">{BRL(next.totalIncome)}</dd></div>
            <div><dt className="text-muted-foreground">Parcelas de dívidas</dt><dd className="text-lg font-semibold">{BRL(next.debtInstallments)}</dd></div>
            <div><dt className="text-muted-foreground">Sobra prevista</dt><dd className={`text-lg font-semibold ${next.leftover < 0 ? "text-destructive" : "text-success"}`}>{BRL(next.leftover)}</dd></div>
            <div><dt className="text-muted-foreground">Dívidas pendentes (total)</dt><dd className="text-lg font-semibold">{BRL(debtTotal)}</dd></div>
          </dl>
        </Section>
      </div>
    </div>
  );
}
