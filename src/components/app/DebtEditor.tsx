import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppState } from '@/lib/household';
import { debtCur, editDebt, newDebt, toCents, type Debt, type Person } from '@/lib/finance';
import { debtSituation } from '@/lib/planning-model';
import { Empty, NativeSelect } from './ui-bits';

export function DebtEditor({ month }: { month: string }) {
  const { s, update } = useAppState();
  const change = (id: string, patch: Partial<Debt>, current?: number, refMonth: string = month) => update(st => ({ ...st, debts: st.debts.map(d => d.id === id ? editDebt(d, patch, refMonth, current) : d) }));
  return <section aria-label="Cadastro de dívidas">
    <div id="debts" className="debt-editor-list">
      {s.debts.map(d => {
        const fieldId = (name: string) => `debt-${d.id}-${name}`;
        return <article key={d.id} className="debt-editor-card" aria-label={d.name || 'Dívida'}>
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg">{d.name || 'Dívida'}</h2><Button variant="ghost" size="icon" aria-label={`Remover ${d.name || 'dívida'}`} onClick={() => update(st => ({ ...st, debts: st.debts.filter(x => x.id !== d.id) }))}><Trash2 className="h-4 w-4" /></Button></div>
          <div className="debt-editor-fields">
            <div><Label htmlFor={fieldId('name')}>Nome</Label><Input id={fieldId('name')} value={d.name} onChange={e => change(d.id, { name: e.target.value })} /></div>
            <div><Label htmlFor={fieldId('origin')}>Onde é a dívida</Label><Input id={fieldId('origin')} placeholder="Ex.: cartão do pai" value={d.origin ?? ''} onChange={e => change(d.id, { origin: e.target.value })} /></div>
            <div><Label htmlFor={fieldId('owner')}>Responsável</Label><NativeSelect id={fieldId('owner')} value={d.shared ? 'both' : String(d.person ?? 0)} onChange={e => change(d.id, e.target.value === 'both' ? { shared: true, person: null } : { shared: false, person: Number(e.target.value) as Person })}><option value="0">{s.names[0]}</option><option value="1">{s.names[1]}</option><option value="both">Os dois</option></NativeSelect></div>
            <div><Label htmlFor={fieldId('amount')}>Valor da parcela (R$)</Label><Input id={fieldId('amount')} type="number" min="0" step="0.01" value={d.amount / 100} onChange={e => { const amount = toCents(e.target.value); if (amount >= 0) change(d.id, { amount }); }} /></div>
            <div><Label htmlFor={fieldId('day')}>Vence no dia</Label><Input id={fieldId('day')} type="number" min="1" max="31" value={Number(d.firstDue.slice(8, 10))} onChange={e => { const day = Number(e.target.value); if (Number.isInteger(day) && day >= 1 && day <= 31) change(d.id, { firstDue: `${d.firstDue.slice(0, 7)}-${String(day).padStart(2, '0')}` }); }} /></div>
            <div><Label htmlFor={fieldId('current')}>Esta parcela é a número</Label><Input id={fieldId('current')} type="number" min="1" step="1" value={d.ref ?? debtCur(d, month)} onChange={e => change(d.id, {}, Number(e.target.value), d.ref_ym ?? month)} /></div>
            <div><Label htmlFor={fieldId('start')}>e cai em</Label><Input id={fieldId('start')} type="month" value={d.ref_ym ?? month} onChange={e => { if (e.target.value) change(d.id, {}, d.ref ?? debtCur(d, month), e.target.value); }} /></div>
            <div><Label htmlFor={fieldId('count')}>Total de parcelas</Label><Input id={fieldId('count')} type="number" min="1" step="1" value={d.installments} onChange={e => { const installments = Number(e.target.value); if (Number.isInteger(installments) && installments >= 1) change(d.id, { installments }); }} /></div>
          </div>
          <p className="mt-4 border-t pt-3 text-sm text-muted-foreground" aria-live="polite">{debtSituation(d, month)}</p>
        </article>;
      })}
      {!s.debts.length && <Empty>Nenhuma dívida cadastrada.</Empty>}
    </div>
    <Button className="mt-4" variant="outline" onClick={() => update(st => ({ ...st, debts: [...st.debts, newDebt(month)] }))}><Plus className="h-4 w-4" />Adicionar dívida</Button>
  </section>;
}