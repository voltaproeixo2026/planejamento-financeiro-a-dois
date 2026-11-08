import { AlertTriangle, Info, OctagonAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAppState } from '@/lib/household';
import { addMonths, alerts, BRL, fmtDate, monthLabel, payerLabel, summarize, type AppState, type Item } from '@/lib/finance';
import { allocationView } from '@/lib/planning-model';
import { Empty, Section, Status } from './ui-bits';
import { Report } from './Report';

/**
 * Marks a bill or a debt installment as paid (or undoes it).
 * Debt payments are a counter of paid installments, so paying this month's installment also counts the earlier ones as paid
 * (a debt registered mid-way already has them paid). Only the latest paid installment can be undone.
 */
export function togglePaid(update: ReturnType<typeof useAppState>['update'], i: Item, month: string, s?: AppState) {
  if (s && i.kind === 'debt' && !i.paid && i.installment !== undefined) {
    const d = s.debts.find(x => x.id === i.refId);
    if (d && i.installment + 1 - d.paidCount > 1) toast.info(`${d.name}: as parcelas de ${d.paidCount + 1} a ${i.installment + 1} foram marcadas como pagas.`);
  }
  update((st) => {
    if (i.kind === 'bill') return { ...st, bills: st.bills.map(b => b.id === i.refId ? { ...b, paid: { ...b.paid, [month]: !b.paid[month] } } : b) };
    return { ...st, debts: st.debts.map(d => {
      if (d.id !== i.refId || i.installment === undefined) return d;
      if (!i.paid) return { ...d, paidCount: Math.max(d.paidCount, i.installment + 1) };
      if (i.installment === d.paidCount - 1) return { ...d, paidCount: d.paidCount - 1 };
      return d;
    }) };
  });
}

/** Any unpaid item can be paid; a paid debt installment can be undone only when it is the latest one paid. */
export function canToggle(s: AppState, i: Item) {
  if (i.kind === 'bill' || !i.paid) return true;
  const d = s.debts.find(x => x.id === i.refId);
  return !!d && i.installment === d.paidCount - 1;
}

export interface Row { key: string; name: string; date: string; amount: number; items: Item[]; who: string }
/** Fixed bills stay on their own line; debts that share the same "Onde é a dívida" (for example "Cartão mãe") become one line with the total. */
export function groupRows(s: AppState, items: Item[]): Row[] {
  const rows: Row[] = [];
  const byOrigin = new Map<string, Row>();
  for (const i of items) {
    const d = i.kind === 'debt' ? s.debts.find(x => x.id === i.refId) : undefined;
    const origin = d?.origin?.trim();
    if (!origin) { rows.push({ key: i.key, name: i.name, date: i.date, amount: i.amount, items: [i], who: payerLabel(s.names, i) }); continue; }
    const k = origin.toLowerCase();
    let r = byOrigin.get(k);
    if (!r) { r = { key: `origin-${k}`, name: origin, date: i.date, amount: 0, items: [], who: '' }; byOrigin.set(k, r); rows.push(r); }
    r.items.push(i); r.amount += i.amount; if (i.date < r.date) r.date = i.date;
  }
  for (const r of rows) if (byOrigin.has(r.key.replace('origin-', ''))) {
    const who = new Set(r.items.map(i => payerLabel(s.names, i)));
    r.who = who.size === 1 ? [...who][0]! : 'Vários';
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function Dashboard({ month, onDebts }: { month: string; onDebts?: () => void }) {
  const { s, update } = useAppState();
  const today = new Date().toISOString().slice(0, 10);
  const sum = summarize(s, month, { today });
  const next = summarize(s, addMonths(month, 1), { today });
  const attention = alerts(s, month, today);
  const upcoming = groupRows(s, sum.items.filter(i => !i.paid)).slice(0, 6);
  const paidItems = sum.items.filter(i => i.paid);
  const paidRows = groupRows(s, paidItems);
  const allocation = allocationView(s, month);
  return <div className="space-y-6">
    <section id="hello" className="rounded-2xl border bg-card p-5 md:p-6">
      <h1 className="text-3xl">Boa noite, casal</h1>
      <p className="mt-2 text-muted-foreground">{s.names[0]} & {s.names[1]} — Como estão as finanças hoje?</p>
      <dl className="my-6 grid grid-cols-2 gap-5 md:grid-cols-4">
        {[{ label: 'Entra no mês', value: sum.totalIncome }, { label: 'Já saiu', value: sum.paid }, { label: 'Falta pagar', value: sum.pending }, { label: 'Sobra prevista', value: sum.leftover }].map(x => <div key={x.label}><dt className="text-sm text-muted-foreground">{x.label}</dt><dd className="mt-1 text-2xl font-semibold">{BRL(x.value)}</dd></div>)}
      </dl>
      <h2 className="text-lg">Próximos vencimentos</h2>
      {upcoming.length ? <ul id="upcoming" className="mt-2 divide-y">{upcoming.map(r => <li key={r.key} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{fmtDate(r.date)} · {r.who}</p></div><div className="flex flex-wrap items-center gap-2"><b>{BRL(r.amount)}</b><Status paid={false} overdue={r.date < today} /><Button size="sm" variant="outline" onClick={() => r.items.forEach(i => togglePaid(update, i, month, s))}>Pagar</Button></div></li>)}</ul> : <Empty>Nada pendente neste mês.</Empty>}
      <div id="paid-list" className="mt-6 border-t pt-4">
        <h2 className="text-lg">Já pagas neste mês</h2>
        {paidItems.length ? <><ul className="mt-2 divide-y">{paidRows.map(r => <li key={r.key} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{fmtDate(r.date)} · {r.who}</p></div><div className="flex flex-wrap items-center gap-2"><b>{BRL(r.amount)}</b><Status paid /><Button size="sm" variant="ghost" disabled={!r.items.every(i => canToggle(s, i))} onClick={() => r.items.forEach(i => togglePaid(update, i, month, s))}>Desfazer</Button></div></li>)}</ul><p className="mt-2 text-sm text-muted-foreground">Total pago: {BRL(paidItems.reduce((a, i) => a + i.amount, 0))}</p></> : <p className="mt-2 text-sm text-muted-foreground">Nada foi marcado como pago neste mês ainda.</p>}
      </div>
    </section>
    <Section id="next-card" title="Previsão do próximo mês">
      <dl className="grid grid-cols-2 gap-4"><div><dt className="text-sm text-muted-foreground">Parcelas das dívidas</dt><dd className="mt-2 text-2xl font-semibold">{BRL(next.debtInstallments)}</dd></div><div><dt className="text-sm text-muted-foreground">Sobra prevista</dt><dd className="mt-2 text-2xl font-semibold">{BRL(next.leftover)}</dd></div></dl>
      <Button className="mt-4" variant="outline" onClick={onDebts}>Ver os próximos meses</Button>
    </Section>
    <Section title="Para onde vai a renda">
      {allocation.length ? <><div id="bar" role="img" aria-label="Divisão da renda mensal por categoria" className="summary-income-bar">{allocation.map(g => <i key={g.name} className="summary-category" data-category={g.category} style={{ flexGrow: g.value, background: g.color }} title={`${g.name}: ${BRL(g.value)} (${g.percent}%)`} />)}</div><ul id="legend" className="summary-income-legend">{allocation.map(g => <li key={g.name}><span className="summary-category summary-swatch" data-category={g.category} style={{ background: g.color }} /><span>{g.name}</span><b className="tabular-nums">{BRL(g.value)}</b><span className="summary-percent tabular-nums">{g.percent}%</span></li>)}</ul></> : <><div id="bar" /><ul id="legend"><li><Empty>Cadastre rendas e contas para ver a distribuição.</Empty></li></ul></>}
    </Section>
    <Section title="Pontos de atenção"><ul id="alerts" className="space-y-2">{attention.length ? attention.map((a, k) => <li key={k} className="flex gap-2 rounded-lg bg-muted p-3 text-sm">{a.level === 'danger' ? <OctagonAlert className="h-4 w-4 shrink-0 text-destructive" /> : a.level === 'warn' ? <AlertTriangle className="h-4 w-4 shrink-0 text-warning" /> : <Info className="h-4 w-4 shrink-0 text-primary" />}{a.text}</li>) : <li><Empty>Tudo tranquilo por aqui.</Empty></li>}</ul></Section>
    <Report month={month} />
  </div>;
}
