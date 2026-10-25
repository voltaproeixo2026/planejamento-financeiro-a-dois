import { useState } from 'react';
import { useAppState } from '@/lib/household';
import { BRL, debtChanges, forecast, monthLabel } from '@/lib/finance';
import { debtTotals } from '@/lib/planning-model';
import { Button } from '@/components/ui/button';
import { DebtEditor } from './DebtEditor';

export function DebtScreen({ month }: { month: string }) {
  const { s } = useAppState();
  const [range, setRange] = useState(3);
  const totals = debtTotals(s, month);
  const rows = forecast(s, month, range);
  const changes = debtChanges(s, month, range);
  return <div className="debt-screen space-y-6">
    <section aria-label="Resumo das dívidas"><dl className="debt-top-numbers"><div><dt>Parcelas deste mês</dt><dd id="debt-month">{BRL(totals.monthly)}</dd></div><div><dt>Falta pagar</dt><dd id="debt-left">{BRL(totals.remaining)}</dd></div></dl></section>
    <section>
      <h2 className="mb-4 text-xl">Próximos meses</h2>
      <div id="fc-range" role="group" aria-label="Quantidade de meses" className="mb-4 flex gap-2">{[3, 6, 12].map(n => <Button key={n} variant={n === range ? 'default' : 'outline'} aria-pressed={n === range} onClick={() => setRange(n)}>{n} meses</Button>)}</div>
      <ul id="fc-lines" className="debt-change-lines">{changes.length ? changes.map(c => <li key={c.id}><span className={c.label === 'Termina' ? 'debt-pill debt-pill-good' : 'debt-pill debt-pill-warn'}>{c.label}</span><span>{c.label === 'Termina' ? <>{c.name} termina em {monthLabel(c.previousMonth)}. A partir de {monthLabel(c.month)} libera {BRL(c.amount)} por mês.</> : <>{c.name} começa em {monthLabel(c.month)}: {BRL(c.amount)} por mês.</>}</span></li>) : <li>Nenhuma parcela começa ou termina neste período.</li>}</ul>
      <div className="debt-forecast-scroll" tabIndex={0} role="region" aria-label="Previsão mensal das dívidas"><table id="fc" className="debt-forecast-table"><caption className="sr-only">Previsão de {range} meses</caption><thead><tr><th scope="col">Dívida</th>{rows.map(p => <th key={p.month} scope="col" data-current={p.month === month}>{monthLabel(p.month)}{p.month === month && <small>este mês</small>}</th>)}</tr></thead><tbody>{s.debts.map(d => <tr key={d.id}><th scope="row">{d.name || 'Dívida'}{d.origin && <small>{d.origin}</small>}</th>{rows.map(p => {
        const cell = p.debts.find(x => x.id === d.id);
        return <td key={p.month} data-current={p.month === month}>{cell?.installment ? <>{BRL(cell.installment.amount)}<small className={cell.current === cell.total ? 'text-success' : ''}>{cell.current === cell.total ? 'última parcela' : `${cell.current}/${cell.total}`}</small></> : <small>{cell && cell.current < 1 ? 'começa depois' : 'parcelas encerradas'}</small>}</td>;
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