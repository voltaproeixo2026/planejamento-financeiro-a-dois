import { AlertTriangle, Info, OctagonAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppState } from '@/lib/household';
import { addMonths, alerts, BRL, fmtDate, monthLabel, summarize, type AppState, type Item } from '@/lib/finance';
import { allocationView, debtHomeView, debtTotals } from '@/lib/planning-model';
import { Empty, Section, Status } from './ui-bits';
import { Report } from './Report';

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

/** Debt installments are paid in order, so only the next one can be paid and only the last paid one undone. */
export function canToggle(s: AppState, i: Item) {
  if (i.kind === 'bill') return true;
  const d = s.debts.find(x => x.id === i.refId);
  if (!d || i.installment === undefined) return false;
  return i.paid ? i.installment === d.paidCount - 1 : i.installment === d.paidCount;
}

export function Dashboard({ month, onDebts }: { month: string; onDebts?: () => void }) {
  const { s, update } = useAppState();
  const today = new Date().toISOString().slice(0, 10);
  const sum = summarize(s, month, { today });
  const next = summarize(s, addMonths(month, 1), { today });
  const attention = alerts(s, month, today);
  const upcoming = sum.items.filter(i => !i.paid).slice(0, 6);
  const paidItems = sum.items.filter(i => i.paid);
  const allocation = allocationView(s, month);
  const totals = debtTotals(s, month);
  const debts = debtHomeView(s, month);
  return <div className="space-y-6">
    <section id="hello" className="rounded-2xl border bg-card p-5 md:p-6">
      <h1 className="text-3xl">Boa noite, casal</h1>
      <p className="mt-2 text-muted-foreground">{s.names[0]} & {s.names[1]} — Como estão as finanças hoje?</p>
      <dl className="my-6 grid grid-cols-2 gap-5 md:grid-cols-4">
        {[{ label: 'Entra no mês', value: sum.totalIncome }, { label: 'Já saiu', value: sum.paid }, { label: 'Falta pagar', value: sum.pending }, { label: 'Sobra prevista', value: sum.leftover }].map(x => <div key={x.label}><dt className="text-sm text-muted-foreground">{x.label}</dt><dd className="mt-1 text-2xl font-semibold">{BRL(x.value)}</dd></div>)}
      </dl>
      <h2 className="text-lg">Próximos vencimentos</h2>
      {upcoming.length ? <ul className="mt-2 divide-y">{upcoming.map(i => <li key={i.key} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{i.name}</p><p className="text-xs text-muted-foreground">{fmtDate(i.date)} · {i.shared ? 'Compartilhada' : s.names[i.person ?? 0]}</p></div><div className="flex flex-wrap items-center gap-2"><b>{BRL(i.amount)}</b><Status paid={i.paid} overdue={i.date < today} /><Button size="sm" variant="outline" disabled={!canToggle(s, i)} onClick={() => togglePaid(update, i, month)}>Pagar</Button></div></li>)}</ul> : <Empty>Nada pendente neste mês.</Empty>}
      <div id="paid-list" className="mt-6 border-t pt-4">
        <h2 className="text-lg">Já pagas neste mês</h2>
        {paidItems.length ? <><ul className="mt-2 divide-y">{paidItems.map(i => <li key={i.key} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{i.name}</p><p className="text-xs text-muted-foreground">{fmtDate(i.date)} · {i.shared ? 'Compartilhada' : s.names[i.person ?? 0]}</p></div><div className="flex flex-wrap items-center gap-2"><b>{BRL(i.amount)}</b><Status paid /><Button size="sm" variant="ghost" disabled={!canToggle(s, i)} onClick={() => togglePaid(update, i, month)}>Desfazer</Button></div></li>)}</ul><p className="mt-2 text-sm text-muted-foreground">Total pago: {BRL(paidItems.reduce((a, i) => a + i.amount, 0))}</p></> : <p className="mt-2 text-sm text-muted-foreground">Nada foi marcado como pago neste mês ainda.</p>}
      </div>
    </section>
    <Section id="next-card" title="Previsão do próximo mês">
      <dl className="grid grid-cols-2 gap-4"><div><dt className="text-sm text-muted-foreground">Parcelas das dívidas</dt><dd className="mt-2 text-2xl font-semibold">{BRL(next.debtInstallments)}</dd></div><div><dt className="text-sm text-muted-foreground">Sobra prevista</dt><dd className="mt-2 text-2xl font-semibold">{BRL(next.leftover)}</dd></div></dl>
      <Button className="mt-4" variant="outline" onClick={onDebts}>Ver os próximos meses</Button>
    </Section>
    <Section title="Para onde vai a renda">
      {allocation.length ? <><div id="bar" role="img" aria-label="Divisão da renda mensal por categoria" className="summary-income-bar">{allocation.map(g => <i key={g.name} className="summary-category" data-category={g.category} style={{ flexGrow: g.value }} title={`${g.name}: ${BRL(g.value)} (${g.percent}%)`} />)}</div><ul id="legend" className="summary-income-legend">{allocation.map(g => <li key={g.name}><span className="summary-category summary-swatch" data-category={g.category} /><span>{g.name}</span><b className="tabular-nums">{BRL(g.value)}</b><span className="summary-percent tabular-nums">{g.percent}%</span></li>)}</ul></> : <><div id="bar" /><ul id="legend"><li><Empty>Cadastre rendas e contas para ver a distribuição.</Empty></li></ul></>}
    </Section>
    <Section title="Dívidas">
      <ul id="debt-home" className="summary-debts divide-y">{debts.length ? debts.map(d => <li key={d.id}><div className="min-w-0"><b>{d.name}{d.origin && ` · ${d.origin}`}</b><p className="mt-1 text-sm text-muted-foreground">Responsável: {d.owner}</p><p className="mt-1 text-sm text-muted-foreground">{d.status === 'done' ? 'Quitada.' : d.status === 'future' ? `Começa em ${monthLabel(d.firstMonth)}. Ainda não entra nas contas deste mês.` : <>Parcela {d.current} de {d.installments} neste mês. Restam {d.left} (com esta): {BRL(d.remaining)}. Última em {monthLabel(d.lastMonth)}.</>}</p></div><div className="summary-debt-total"><b className="tabular-nums">{BRL(d.total)}</b><span className="block text-xs text-muted-foreground">total da dívida</span></div></li>) : <li><Empty>Nenhuma dívida cadastrada. Adicione na aba Dívidas.</Empty></li>}</ul>
      <div className="mt-4 flex flex-wrap justify-between gap-2 border-t pt-4"><span>Falta pagar no total</span><b>{BRL(totals.remaining)}</b></div>
    </Section>
    <Section title="Pontos de atenção"><ul id="alerts" className="space-y-2">{attention.length ? attention.map((a, k) => <li key={k} className="flex gap-2 rounded-lg bg-muted p-3 text-sm">{a.level === 'danger' ? <OctagonAlert className="h-4 w-4 shrink-0 text-destructive" /> : a.level === 'warn' ? <AlertTriangle className="h-4 w-4 shrink-0 text-warning" /> : <Info className="h-4 w-4 shrink-0 text-primary" />}{a.text}</li>) : <li><Empty>Tudo tranquilo por aqui.</Empty></li>}</ul></Section>
    <Report month={month} />
  </div>;
}
