import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Info, OctagonAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppState } from '@/lib/household';
import { addMonths, alerts, BRL, debtSummary, fmtDate, summarize, type Item } from '@/lib/finance';
import { allocationView, debtTotals } from '@/lib/planning-model';
import { Empty, Section, Status } from './ui-bits';
import { IncomeScenario } from './IncomeScenario';

export function togglePaid(update: ReturnType<typeof useAppState>['update'], i: Item, month: string) {
  update((s) => {
    if (i.kind === 'bill') return { ...s, bills: s.bills.map(b => b.id === i.refId ? { ...b, paid: { ...b.paid, [month]: !b.paid[month] } } : b) };
    return { ...s, debts: s.debts.map(d => {
      if (d.id !== i.refId || i.installment === undefined) return d;
      if (!i.paid && i.installment === d.paidCount) return { ...d, paidCount: d.paidCount + 1 };
      if (i.paid && i.installment === d.paidCount - 1) return { ...d, paidCount: d.paidCount - 1 };
      return d;
    }) };
  });
}

export function Dashboard({ month, onDebts }: { month: string; onDebts?: () => void }) {
  const { s, update } = useAppState();
  const today = new Date().toISOString().slice(0, 10);
  const sum = summarize(s, month, { today });
  const next = summarize(s, addMonths(month, 1), { today });
  const attention = alerts(s, month, today);
  const upcoming = sum.items.filter(i => !i.paid).slice(0, 6);
  const allocation = allocationView(s, month);
  const totals = debtTotals(s, month);
  return <div className="space-y-6">
    <section id="hello" className="rounded-2xl border bg-card p-5 md:p-6">
      <h1 className="text-3xl">Boa noite, casal</h1>
      <p className="mt-2 text-muted-foreground">{s.names[0]} & {s.names[1]} — Como estão as finanças hoje?</p>
      <dl className="my-6 grid grid-cols-2 gap-5 md:grid-cols-4">
        {[{ label: 'Entra no mês', value: sum.totalIncome }, { label: 'Já saiu', value: sum.paid }, { label: 'Falta pagar', value: sum.pending }, { label: 'Sobra prevista', value: sum.leftover }].map(x => <div key={x.label}><dt className="text-sm text-muted-foreground">{x.label}</dt><dd className="mt-1 text-2xl font-semibold">{BRL(x.value)}</dd></div>)}
      </dl>
      <h2 className="text-lg">Próximos vencimentos</h2>
      {upcoming.length ? <ul className="mt-2 divide-y">{upcoming.map(i => <li key={i.key} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{i.name}</p><p className="text-xs text-muted-foreground">{fmtDate(i.date)} · {i.shared ? 'Compartilhada' : s.names[i.person ?? 0]}</p></div><div className="flex flex-wrap items-center gap-2"><b>{BRL(i.amount)}</b><Status paid={i.paid} overdue={i.date < today} /><Button size="sm" variant="outline" onClick={() => togglePaid(update, i, month)}>Pagar</Button></div></li>)}</ul> : <Empty>Nada pendente neste mês.</Empty>}
    </section>
    <Section id="next-card" title="Previsão do próximo mês">
      <dl className="grid grid-cols-2 gap-4"><div><dt className="text-sm text-muted-foreground">Parcelas das dívidas</dt><dd className="mt-2 text-2xl font-semibold">{BRL(next.debtInstallments)}</dd></div><div><dt className="text-sm text-muted-foreground">Sobra prevista</dt><dd className="mt-2 text-2xl font-semibold">{BRL(next.leftover)}</dd></div></dl>
      <Button className="mt-4" variant="outline" onClick={onDebts}>Ver os próximos meses</Button>
    </Section>
    <IncomeScenario month={month} />
    <Section title="Para onde vai a renda">
      {allocation.length ? <><div id="bar" role="img" aria-label="Divisão da renda mensal por categoria" className="h-12"><ResponsiveContainer><BarChart layout="vertical" data={[Object.fromEntries(allocation.map(g => [g.name, g.value]))]}><XAxis type="number" hide /><YAxis type="category" hide /><Tooltip formatter={(v: number) => BRL(v)} />{allocation.map(g => <Bar key={g.name} dataKey={g.name} stackId="income" fill={g.color} />)}</BarChart></ResponsiveContainer></div><ul id="legend" className="mt-4 grid gap-3 text-sm sm:grid-cols-2">{allocation.map(g => <li key={g.name} className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full" style={{ background: g.color }} />{g.name}<b className="ml-auto">{BRL(g.value)}</b></li>)}</ul></> : <><div id="bar" /><ul id="legend"><li><Empty>Cadastre rendas e contas para ver a distribuição.</Empty></li></ul></>}
    </Section>
    <Section title="Dívidas">
      <ul id="debt-home" className="divide-y">{s.debts.length ? s.debts.map(d => <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><b>{d.name}</b><p className="text-sm text-muted-foreground">{d.shared ? 'Os dois' : s.names[d.person ?? 0]} · {debtSummary(d).left} parcelas restantes</p></div><b>{BRL(debtSummary(d).remaining)}</b></li>) : <li><Empty>Nenhuma dívida cadastrada. Adicione na aba Dívidas.</Empty></li>}</ul>
      <div className="mt-4 flex flex-wrap justify-between gap-2 border-t pt-4"><span>Falta pagar no total</span><b>{BRL(totals.remaining)}</b></div>
    </Section>
    <Section title="Pontos de atenção"><ul id="alerts" className="space-y-2">{attention.length ? attention.map((a, k) => <li key={k} className="flex gap-2 rounded-lg bg-muted p-3 text-sm">{a.level === 'danger' ? <OctagonAlert className="h-4 w-4 shrink-0 text-destructive" /> : a.level === 'warn' ? <AlertTriangle className="h-4 w-4 shrink-0 text-warning" /> : <Info className="h-4 w-4 shrink-0 text-primary" />}{a.text}</li>) : <li><Empty>Tudo tranquilo por aqui.</Empty></li>}</ul></Section>
  </div>;
}
