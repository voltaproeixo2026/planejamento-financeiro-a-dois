import { useState } from 'react';
import { useAppState } from '@/lib/household';
import { BRL, monthLabel, projection } from '@/lib/finance';
import { debtTotals, forecastLines } from '@/lib/planning-model';
import { Button } from '@/components/ui/button';
import { Debts } from './Accounts';
import { Section } from './ui-bits';

export function DebtScreen({ month }: { month: string }) {
  const { s } = useAppState();
  const [range, setRange] = useState(3);
  const totals = debtTotals(s, month);
  const rows = projection(s, month, range);
  const changes = forecastLines(s, month, range);
  return <div className="space-y-6">
    <Section title="Resumo das dívidas"><dl className="grid grid-cols-2 gap-3"><div><dt>Parcelas deste mês</dt><dd className="mt-2 text-2xl font-semibold">{BRL(totals.monthly)}</dd></div><div><dt>Falta pagar</dt><dd className="mt-2 text-2xl font-semibold">{BRL(totals.remaining)}</dd></div></dl></Section>
    <Section title="Próximos meses">
      <div id="fc-range" role="group" aria-label="Quantidade de meses" className="mb-4 flex gap-2">{[3, 6, 12].map(n => <Button key={n} variant={n === range ? 'default' : 'outline'} aria-pressed={n === range} onClick={() => setRange(n)}>{n} meses</Button>)}</div>
      <ul id="fc-lines" className="mb-4 space-y-2 text-sm">{changes.length ? changes.map(c => <li key={c.month}>{monthLabel(c.month)}: parcelas {c.difference > 0 ? 'aumentam' : 'diminuem'} em {BRL(Math.abs(c.difference))}.</li>) : <li>Nenhuma mudança nas parcelas neste período.</li>}</ul>
      <div className="overflow-x-auto"><table id="fc" className="w-full min-w-[520px] text-sm"><thead><tr className="border-b text-left"><th className="py-2">Mês</th><th>Receitas</th><th>Despesas</th><th>Sobra</th><th>Dívidas restantes</th></tr></thead><tbody>{rows.map(p => <tr key={p.month} className="border-b"><td className="py-3">{monthLabel(p.month)}</td><td>{BRL(p.income)}</td><td>{BRL(p.expenses)}</td><td>{BRL(p.leftover)}</td><td>{BRL(p.debtsLeft)}</td></tr>)}</tbody></table></div>
      <p className="mt-3 text-sm text-muted-foreground">Contas fixas e dinheiro livre seguem iguais. Extras entram só nos meses em que foram lançados.</p>
    </Section>
    <Debts />
  </div>;
}