import { useState } from 'react';
import { useAppState } from '@/lib/household';
import { BRL, debtChanges, fmtDate, forecast, monthLabel, payerLabel, summarize } from '@/lib/finance';
import { debtOrigins, debtPersonShares, debtSplit, debtTotals, filterDebts } from '@/lib/planning-model';
import { Button } from '@/components/ui/button';
import { DebtEditor } from './DebtEditor';
import { canToggle, groupRows, togglePaid } from './Dashboard';
import { Status } from './ui-bits';

export function DebtScreen({ month }: { month: string }) {
  const { s, update } = useAppState();
  const [range, setRange] = useState(3);
  const [fOrigin, setFOrigin] = useState('all');
  const [fOwner, setFOwner] = useState<'all' | 'a' | 'b' | 'both'>('all');
  const totals = debtTotals(s, month);
  const shares = debtPersonShares(s, month);
  const installments = summarize(s, month).items.filter(i => i.kind === 'debt');
  const today = new Date().toISOString().slice(0, 10);
  const origins = debtOrigins(s);
  const filtered = filterDebts(s, month, { origin: fOrigin, owner: fOwner });
  const rows = forecast(s, month, range);
  const changes = debtChanges(s, month, range);
  return <div className="debt-screen space-y-6">
    <section aria-label="Resumo das dívidas"><dl className="debt-top-numbers"><div><dt>Parcelas deste mês</dt><dd id="debt-month">{BRL(totals.monthly)}</dd></div></dl></section>
    <section id="debt-owners" aria-label="Parcelas do mês por pessoa">
      <h2 className="mb-4 text-xl">Quanto cada um deve em {monthLabel(month)}</h2>
      <div className="grid gap-3 sm:grid-cols-3">{shares.people.map(p => <div key={p.key} className="rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">{p.name}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums" data-owner={p.key}>{BRL(p.total)}</p>
        <p className="text-xs text-muted-foreground">Individual: {BRL(p.individual)} · Metade do conjunto: {BRL(p.joint)}</p>
      </div>)}
      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">Em conjunto (total)</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums" data-owner="both">{BRL(shares.jointTotal)}</p>
        <p className="text-xs text-muted-foreground">já dividido entre os dois ao lado</p>
      </div></div>
      <p className="mt-2 text-sm text-muted-foreground">Total do mês: <b>{BRL(shares.total)}</b>. Só as parcelas de {monthLabel(month)}. O valor de cada um soma o que é só dele e a parte dele nas dívidas em conjunto.</p>
    </section>
    <section id="debt-filter" aria-label="Filtrar dívidas">
      <h2 className="mb-2 text-xl">Filtrar dívidas</h2>
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Onde é a dívida<select aria-label="Onde é a dívida" className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={fOrigin} onChange={e => setFOrigin(e.target.value)}><option value="all">Todas</option>{origins.map(o => <option key={o} value={o}>{o}</option>)}</select></label>
        <label className="text-sm">Responsável<select aria-label="Responsável" className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={fOwner} onChange={e => setFOwner(e.target.value as 'all' | 'a' | 'b' | 'both')}><option value="all">Todos</option><option value="a">{s.names[0]}</option><option value="b">{s.names[1]}</option><option value="both">Em conjunto</option></select></label>
      </div>
      {filtered.rows.length ? <ul className="divide-y">{filtered.rows.map(r => <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.label} · {r.owner}</p></div><div className="text-right"><b className="tabular-nums">{BRL(r.share)}</b>{r.share !== r.installment && <p className="text-xs text-muted-foreground">de {BRL(r.installment)}</p>}</div></li>)}</ul> : <p className="text-sm text-muted-foreground">Nenhuma parcela com esse filtro em {monthLabel(month)}.</p>}
      <p id="debt-filter-total" className="mt-2 text-sm text-muted-foreground">Total em {monthLabel(month)}: <b>{BRL(filtered.total)}</b>{fOwner === 'a' || fOwner === 'b' ? ` (individuais + a parte de ${s.names[fOwner === 'a' ? 0 : 1]} nas dívidas em conjunto)` : ''}</p>
    </section>
    <section id="debt-month-list" aria-label="Parcelas do mês">
      <h2 className="mb-2 text-xl">Parcelas de {monthLabel(month)}</h2>
      {installments.length ? <ul className="divide-y">{groupRows(s, installments).map(r => {
        const allPaid = r.items.every(i => i.paid);
        const undoable = r.items.filter(i => i.paid && canToggle(s, i));
        const single = r.items.length === 1 && !r.key.startsWith('origin-') ? r.items[0]! : null;
        const sp = single ? (() => { const d = s.debts.find(x => x.id === single.refId); return d && debtSplit(s, d); })() : null;
        const blocked = allPaid && !undoable.length;
        return <li key={r.key} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{fmtDate(r.date)} · {single ? payerLabel(s.names, single, 'Em conjunto') : r.who === 'Compartilhada' ? 'Em conjunto' : r.who}</p>{sp ? <p className="text-xs text-muted-foreground">{s.names[0]} {BRL(sp.installment[0])} · {s.names[1]} {BRL(sp.installment[1])}</p> : null}</div><div className="flex flex-wrap items-center gap-2"><b className="tabular-nums">{BRL(r.amount)}</b><Status paid={allPaid} overdue={r.date < today} /><Button size="sm" variant="outline" disabled={blocked} title={blocked ? 'Desfaça primeiro a parcela paga mais recente' : undefined} onClick={() => (allPaid ? undoable : r.items.filter(i => !i.paid)).forEach(i => togglePaid(update, i, month, s))}>{allPaid ? 'Desfazer' : 'Pagar'}</Button></div></li>;
      })}</ul> : <p className="text-sm text-muted-foreground">Nenhuma parcela neste mês.</p>}
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