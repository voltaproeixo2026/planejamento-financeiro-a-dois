import { useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppState } from '@/lib/household';
import { BRL, fmtDate, toCents } from '@/lib/finance';
import { cashflowView } from '@/lib/planning-model';
import { Empty, Section } from './ui-bits';
import { cn } from '@/lib/utils';

export function Cashflow({ month }: { month: string }) {
  const { s, update } = useAppState();
  const cf = cashflowView(s, month);
  const [day, setDay] = useState('01');
  const moves = cf.moves.filter(m => m.date === `${month}-${day}`);
  const dayBalance = cf.points.filter(p => p.date <= `${month}-${day}`).at(-1)?.balance ?? cf.start;
  return <div className="space-y-6">
    <Section title="Saldo da conta conjunta ao longo do mês">
      <div id="flow" className="h-64" role="img" aria-label="Saldo da conta conjunta dia a dia"><ResponsiveContainer><LineChart data={cf.points} margin={{ left: 10, right: 12 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={d => d.slice(8)} /><YAxis width={75} tickFormatter={v => BRL(v)} /><Tooltip formatter={(v: number) => BRL(v)} labelFormatter={d => fmtDate(String(d))} /><Line type="stepAfter" dataKey="balance" name="Saldo" stroke="var(--primary)" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
      <div id="daybox" className="mt-4 border-y py-4"><div className="flex flex-wrap items-center justify-between gap-3"><Label htmlFor="flow-day">Caixa do dia</Label><Input id="flow-day" className="w-auto" type="date" value={`${month}-${day}`} min={`${month}-01`} max={`${month}-31`} onChange={e => { if (e.target.value) setDay(e.target.value.slice(8)); }} /></div><p className="mt-3 text-lg font-semibold">Saldo: {BRL(dayBalance)}</p><ul className="mt-2 space-y-1 text-sm">{moves.length ? moves.map((m, k) => <li key={k}>{m.desc} · {BRL(m.amount)} · {m.status}</li>) : <li className="text-muted-foreground">Sem movimentos neste dia.</li>}</ul><p className="mt-2 text-sm text-muted-foreground">Saldo atual realizado: {BRL(cf.current)} · Saldo final projetado: {BRL(cf.projectedEnd)}</p></div>
      <details className="mt-4"><summary className="cursor-pointer font-medium">Ver todos os movimentos</summary><div className="mt-3 overflow-x-auto">{cf.moves.length ? <table id="evlist" className="w-full min-w-[560px] text-sm"><thead><tr className="border-b text-left"><th className="py-2">Data</th><th>Descrição</th><th>Valor</th><th>Status</th><th>Saldo após</th><th /></tr></thead><tbody>{cf.moves.map((m, k) => {
        const transfer = m.type === 'entrada' && m.status === 'realizado' ? s.transfers.find(t => t.month === month && t.date === m.date && `Transferência de ${s.names[t.person]}` === m.desc && t.amount === m.amount) : undefined;
        return <tr key={k} className="border-b"><td className="py-3">{fmtDate(m.date)}</td><td>{m.desc}</td><td className={cn(m.type === 'entrada' ? 'text-success' : 'text-destructive')}>{m.type === 'entrada' ? '+' : '−'}{BRL(m.amount)}</td><td>{m.status}</td><td>{BRL(m.balance)}</td><td>{transfer && <Button size="icon" variant="ghost" aria-label="Remover transferência" onClick={() => update(st => ({ ...st, transfers: st.transfers.filter(t => t.id !== transfer.id) }))}><Trash2 /></Button>}</td></tr>;
      })}</tbody></table> : <Empty>Sem movimentações neste mês.</Empty>}</div></details>
    </Section>
    <Section title="Colchão para começar o mês"><div className="max-w-xs space-y-2"><Label htmlFor="cushion">Saldo na conta conjunta no dia 1 (R$)</Label><Input id="cushion" type="number" step="0.01" value={(s.cushion[month] ?? 0) / 100} onChange={e => update(st => ({ ...st, cushion: { ...st.cushion, [month]: toCents(e.target.value) } }))} /></div></Section>
  </div>;
}
