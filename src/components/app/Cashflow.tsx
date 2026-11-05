import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppState } from '@/lib/household';
import { BRL, fmtDate, toCents, ym } from '@/lib/finance';
import { cashflowView, flowDays } from '@/lib/planning-model';
import { Empty, Section } from './ui-bits';
import { FlowChart } from './FlowChart';
import { cn } from '@/lib/utils';

export function Cashflow({ month }: { month: string }) {
  const { s, update } = useAppState();
  const cf = cashflowView(s, month);
  const fd = flowDays(s, month);
  const isCurrent = ym(new Date()) === month;
  const todayDay = isCurrent ? new Date().getDate() : null;
  const [picked, setPicked] = useState<{ month: string; day: number } | null>(null);
  const day = Math.min(fd.days.length - 1, picked?.month === month ? picked.day : (todayDay ?? 1));
  const sel = fd.days[day] ?? fd.days[1]!;
  return <div className="space-y-6">
    <Section title="Saldo da conta conjunta ao longo do mês">
      <FlowChart days={fd.days} selected={day} today={todayDay} onSelect={d => setPicked({ month, day: d })} />
      <div id="daybox" className="mt-4 border-y py-4">
        <p className="flex flex-wrap items-center gap-2 text-lg font-semibold">Dia {day} · saldo {BRL(sel.balance)}{sel.balance < 0 && <span className="rounded bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">No vermelho</span>}</p>
        <ul className="mt-2 space-y-1 text-sm">{sel.moves.length ? sel.moves.map((m, k) => <li key={k} className="flex justify-between gap-3"><span>{m.desc}{m.status === 'previsto' && <span className="text-muted-foreground"> · previsto</span>}</span><b className={cn(m.type === 'entrada' ? 'text-success' : 'text-destructive')}>{m.type === 'entrada' ? '+' : '−'}{BRL(m.amount)}</b></li>) : <li className="text-muted-foreground">Sem movimentos neste dia.</li>}</ul>
        <p className="mt-2 text-sm text-muted-foreground">Toque ou arraste no gráfico para ver outro dia.</p>
      </div>
      <details className="mt-4"><summary className="cursor-pointer font-medium">Ver todos os movimentos</summary><div className="mt-3 overflow-x-auto">{cf.moves.length ? <table id="evlist" className="w-full min-w-[560px] text-sm"><thead><tr className="border-b text-left"><th className="py-2">Data</th><th>Descrição</th><th>Valor</th><th>Status</th><th>Saldo após</th><th /></tr></thead><tbody>{cf.moves.map((m, k) => {
        const transfer = m.type === 'entrada' && m.status === 'realizado' ? s.transfers.find(t => t.month === month && t.date === m.date && `Transferência de ${s.names[t.person]}` === m.desc && t.amount === m.amount) : undefined;
        return <tr key={k} className="border-b"><td className="py-3">{fmtDate(m.date)}</td><td>{m.desc}</td><td className={cn(m.type === 'entrada' ? 'text-success' : 'text-destructive')}>{m.type === 'entrada' ? '+' : '−'}{BRL(m.amount)}</td><td>{m.status}</td><td>{BRL(m.balance)}</td><td>{transfer && <Button size="icon" variant="ghost" aria-label="Remover transferência" onClick={() => update(st => ({ ...st, transfers: st.transfers.filter(t => t.id !== transfer.id) }))}><Trash2 /></Button>}</td></tr>;
      })}</tbody></table> : <Empty>Sem movimentações neste mês.</Empty>}</div></details>
    </Section>
    <Section title="Colchão para começar o mês"><div className="max-w-md space-y-2"><Label htmlFor="cushion">Saldo na conta conjunta no dia 1 (R$)</Label><Input id="cushion" type="number" step="0.01" value={(s.cushion[month] ?? 0) / 100} onChange={e => update(st => ({ ...st, cushion: { ...st.cushion, [month]: toCents(e.target.value) } }))} />
      <p id="buffer" className="text-sm text-muted-foreground">{fd.needed <= 0 ? 'Com as entradas e saídas previstas, a conta não fica negativa.' : <>Para a conta nunca ficar negativa neste mês, o saldo do dia 1 precisa ser de pelo menos <b className="text-foreground">{BRL(fd.needed)}</b>.</>}</p>
      {(s.cushion[month] ?? 0) < fd.needed && <Button type="button" variant="outline" size="sm" onClick={() => update(st => ({ ...st, cushion: { ...st.cushion, [month]: fd.needed } }))}>Usar esse valor</Button>}
      {fd.carry > 0 && <p className="text-sm">Mais <b>{BRL(fd.carry)}</b> guardados de meses anteriores entram no dia 1 (cadastro em Contas).</p>}
      <p className="text-xs text-muted-foreground">Os dias e a conta semanal seguem o calendário real do mês.</p></div></Section>
  </div>;
}
