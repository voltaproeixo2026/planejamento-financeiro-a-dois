import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppState } from '@/lib/household';
import { BRL, toCents, uid } from '@/lib/finance';
import { goalMonthsAt, goalView, reserveView, savingsView, type Goal, type GoalState } from '@/lib/planning-model';
import { Empty, Section } from './ui-bits';

export function Planning({ month }: { month: string }) {
  const { s, update } = useAppState();
  const { base, cushion, potential, weakPotential } = savingsView(s, month);
  const goals = (s as GoalState).goals ?? [];
  const reserve = reserveView(s, month);
  const edit = (id: string, patch: Partial<Goal>) => update(st => ({ ...st, goals: ((st as GoalState).goals ?? []).map(g => g.id === id ? { ...g, ...patch } : g) }));
  return <div className="space-y-6">
    <Section title="O que dá para guardar">
      <p className="text-3xl font-semibold text-success">{BRL(potential)}</p>
      <p className="mt-2 text-sm text-muted-foreground">Estimativa do mês sem contar extras, depois das contas, do dinheiro livre e do colchão para o próximo mês ({BRL(cushion)}). Se a renda autônoma vier a 70%: {BRL(weakPotential)}.</p>
      <p className="mt-2 text-sm">Receitas do mês: {BRL(base.totalIncome)} · Já guardado de fato: {BRL(s.savedReal)}</p>
      <div className="mt-4 max-w-xs space-y-1"><Label htmlFor="saved-real">Atualizar valor guardado (R$)</Label><Input id="saved-real" type="number" min="0" step="0.01" value={s.savedReal / 100} onChange={e => update(st => ({ ...st, savedReal: Math.max(0, toCents(e.target.value)) }))} /></div>
    </Section>
    <div id="goals" className="grid gap-4 md:grid-cols-2">{goals.length ? goals.map(g => {
      const view = goalView(g, potential);
      return <Section key={g.id} title={g.name || 'Nova meta'} action={<Button size="icon" variant="ghost" aria-label="Remover meta" onClick={() => update(st => ({ ...st, goals: ((st as GoalState).goals ?? []).filter(x => x.id !== g.id) }))}><Trash2 /></Button>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label htmlFor={`goal-name-${g.id}`}>Nome da meta</Label><Input id={`goal-name-${g.id}`} value={g.name} onChange={e => edit(g.id, { name: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor={`goal-target-${g.id}`}>Valor da meta (R$)</Label><Input id={`goal-target-${g.id}`} type="number" min="0" step="0.01" value={g.target / 100} onChange={e => edit(g.id, { target: Math.max(0, toCents(e.target.value)) })} /></div>
          <div className="space-y-1"><Label htmlFor={`goal-saved-${g.id}`}>Já guardado (R$)</Label><Input id={`goal-saved-${g.id}`} type="number" min="0" step="0.01" value={g.saved / 100} onChange={e => edit(g.id, { saved: Math.max(0, toCents(e.target.value)) })} /></div>
          <div className="space-y-1"><Label htmlFor={`goal-share-${g.id}`}>Parte da poupança (%)</Label><Input id={`goal-share-${g.id}`} type="number" min="0" max="100" value={g.share} onChange={e => edit(g.id, { share: Math.min(100, Math.max(0, Number(e.target.value))) })} /></div>
        </div>
        <progress className="mt-4 h-2 w-full accent-primary" value={view.progress} max={100} />
        <p className="mt-2 text-sm text-muted-foreground">{g.target <= 0 ? 'Defina quanto essa meta precisa.' : view.months === 0 ? 'Meta batida.' : view.months === null ? 'Sem parte da poupança para esta meta ainda.' : `${BRL(view.allocation)} por mês · ${view.months} meses para atingir a meta.`}{view.months !== null && view.months > 0 && <span className="block">No mês fraco: {goalMonthsAt(g, weakPotential) === null ? 'sem sobra suficiente' : `${goalMonthsAt(g, weakPotential)} meses`}.</span>}</p>
      </Section>;
    }) : <Empty>Nenhuma meta cadastrada.</Empty>}</div>
    <Button id="add-goal" variant="outline" onClick={() => update(st => ({ ...st, goals: [...((st as GoalState).goals ?? []), { id: uid(), name: 'Nova meta', target: 0, saved: 0, share: 0 }] }))}><Plus />Adicionar meta</Button>
    <section className="rounded-2xl border bg-card p-5"><p id="goal-hint" className="text-sm text-muted-foreground">{goals.length > 0 && reserve.shares !== 100 && `As partes somam ${reserve.shares}%. Ajuste para fechar 100%. `}Uma reserva de emergência costuma cobrir de 3 a 6 meses de contas fixas: entre {BRL(reserve.minimum)} e {BRL(reserve.maximum)} para vocês.</p></section>
  </div>;
}
