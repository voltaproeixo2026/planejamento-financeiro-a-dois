import { useState } from 'react';
import { useAppState } from '@/lib/household';
import { BRL, debtChanges, fmtDate, forecast, monthLabel, payerLabel, summarize } from '@/lib/finance';
import { debtOwnerTotals, debtSplit, debtTotals } from '@/lib/planning-model';
import { Button } from '@/components/ui/button';
import { DebtEditor } from './DebtEditor';
import { canToggle, togglePaid } from './Dashboard';
import { Status } from './ui-bits';

export function DebtScreen({ month }: { month: string }) {
  const { s, update } = useAppState();
  const [range, setRange] = useState(3);
  const totals = debtTotals(s, month);
  const owners = debtOwnerTotals(s, month);
  const installments = summarize(s, month).items.filter(i => i.kind === 'debt');
  const today = new Date().toISOString().slice(0, 10);
  const rows = forecast(s, month, range);
  const changes = debtChanges(s, month, range);
  return <div className="debt-screen space-y-6">
    <section aria-label="Resumo das dívidas"><dl className="debt-top-numbers"><div><dt>Parcelas deste mês</dt><dd id="debt-month">{BRL(totals.monthly)}</dd></div></dl></section>
    <section id="debt-owners" aria-label="Parcelas do mês por pessoa">
      <h2 className="mb-4 text-xl">Quanto cada um deve em {monthLabel(month)}</h2>
      <div className="grid gap-3 sm:grid-cols-3">{owners.map(o => <div key={o.key} className="rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">{o.name}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums" data-owner={o.key}>{BRL(o.monthly)}</p>
        <p className="text-xs text-muted-foreground">em parcelas neste mês</p>
      </div>)}</div>
      <p className="mt-2 text-sm text-muted-foreground">Total do mês: <b>{BRL(owners.reduce((a, o) => a + o.monthly, 0))}</b>. Só as parcelas de {monthLabel(month)}. Dívidas marcadas como "Os dois" ficam em conjunto.</p>
    </section>
    <section id="debt-month-list" aria-label="Parcelas do mês">
      <h2 className="mb-2 text-xl">Parcelas de {monthLabel(month)}</h2>
      {installments.length ? <ul className="divide-y">{installments.map(i => <li key={i.key} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{i.name}</p><p className="text-xs text-muted-foreground">{fmtDate(i.date)} · {payerLabel(s.names, i, 'Em conjunto')}</p>{(() => { const d = s.debts.find(x => x.id === i.refId); const sp = d && debtSplit(s, d); return sp ? <p className="text-xs text-muted-foreground">{s.names[0]} {BRL(sp.installment[0])} · {s.names[1]} {BRL(sp.installment[1])}</p> : null; })()}</div><div className="flex flex-wrap items-center gap-2"><b className="tabular-nums">{BRL(i.amount)}</b><Status paid={i.paid} overdue={i.date < today} /><Button size="sm" variant="outline" disabled={!canToggle(s, i)} title={canToggle(s, i) ? undefined : 'Desfaça primeiro a parcela paga mais recente'} onClick={() => togglePaid(update, i, month, s)}>{i.paid ? 'Desfazer' : 'Pagar'}</Button></div></li>)}</ul> : <p className="text-sm text-muted-foreground">Nenhuma parcela neste mês.</p>}
    </section>
    <section>
      <h2 className="mb-4 text-xl">Próximos meses</h2>
      <div id="fc-range" role="group" aria-label="Quantidade de meses" className="mb-4 flex gap-2">{[3, 6, 12].map(n => <Button key={n} variant={n === range ? 'default' : 'outline'} aria-pressed={n === range} onClick={() => setRange(n)}>{n} meses</Button>)}</div>
      <ul id="fc-lines" className="debt-change-lines">{changes.length ? changes.map(c => <li key={c.id}><span className={c.label === 'Termina' ? 'debt-pill debt-pill-good' : 'debt-pill debt-pill-warn'}>{c.label}</span><span>{c.label === 'Termina' ? <>{c.name} termina em {monthLabel(c.previousMonth)}. A partir de {monthLabel(c.month)} libera {BRL(c.amount)} por mês.</> : <>{c.name} começa em {monthLabel(c.month)}: {BRL(c.amount)} por mês.</>}</span></li>) : <li>Nenhuma parcela começa ou termina neste período.</li>}</ul>
      <div className="debt-forecast-scroll" tabIndex={0} role="region" aria-label="Previsão mensal das dívidas"><table id="fc" className="debt-forecast-table"><caption className="sr-only">Previsão de {range} meses</caption><thead><tr><th scope="col">Dívida</th>{rows.map(p => <th key={p.month} scope="col" data-current={p.month === month}>{monthLabel(p.month)}{p.month === month && <small>este mês</small>}</th>)}</tr></thead><tbody>{s.debts.map(d => <tr key={d.id}><th scope="row">{d.name || 'Dívida'}{d.origin && <small>{d.origin}</small>}</th>{rows.map(p => {
        const cell = p.debts.find(x => x.id === d.id);
        return <td key={p.month} data-current={p.month === month}>{cell?.installment ? <>{BRL(cell.installment.amount)}<small className={cell.current === cell.total ? 'text-success' : ''}>{cell.current === cell.total ? 'última parcela' : `${cell.current}/${cell.total}`}</small></> : <small>{cell && cell.current < 1 ? '—' : 'parcelas encerradas'}</small>}</td>;
      })}</tr>)}</tbody><tfoot>
        <tr><th scope="row">Parcelas no mês</th>{rows.map(p => <td key={p.month} data-current={p.month === month}>{BRL(p.installments)}</td>)}</tr>
        <tr><th scope="row">Variação</th>{rows.map(p => <td key={p.month} data-current={p.month === month} className={p.variation && p.variation < 0 ? 'text-success' : p.variation && p.variation > 0 ? 'text-destructive' : ''}>{p.variation === null ? '—' : p.variation === 0 ? 'igual' : `${p.variation > 0 ? '+' : '−'}${BRL(Math.abs(p.variation))}`}</td>)}</tr>
        <tr><th scope="row">Renda prevista</th>{rows.map(p => <td key={p.month} data-current={p.month === month}>{BRL(p.income)}</td>)}</tr>
        <tr><th scope="row">Sobra prevista</th>{rows.map(p => <td key={p.month} data-current={p.month === month} className={p.leftover < 0 ? 'text-destructive' : ''}>{BRL(p.leftover)}</td>)}</tr>
      </tfoot></table></div>
      <p className="mt-3 text-sm text-muted-foreground">Contas fixas e dinheiro livre seguem iguais. Extras entram só nos meses em que foram lançados.</p>
    </section>
    <DebtEditor month={month} />
  </div>;
}