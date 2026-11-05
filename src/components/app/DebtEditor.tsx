import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppState } from '@/lib/household';
import { BRL, debtCur, debtSummary, editDebt, newDebt, payerLabel, toCents, type Debt, type Person } from '@/lib/finance';
import { debtSituation, debtSplit } from '@/lib/planning-model';
import { Empty, NativeSelect } from './ui-bits';

interface Draft { name: string; origin: string; owner: string; amount: string; day: string; current: string; start: string; count: string }

const toDraft = (d: Debt, month: string): Draft => ({
  name: d.name, origin: d.origin ?? '', owner: d.splitA !== undefined ? 'custom' : d.shared ? 'both' : String(d.person ?? 0), amount: String(d.amount / 100),
  day: String(Number(d.firstDue.slice(8, 10))), current: String(d.ref ?? debtCur(d, month)), start: d.ref_ym ?? month, count: String(d.installments),
});

/** Validates a draft and returns the saved debt, or an error message. */
function applyDraft(d: Debt, f: Draft): Debt | string {
  const amount = toCents(f.amount), day = Number(f.day), current = Number(f.current), count = Number(f.count);
  if (!f.name.trim()) return 'Informe o nome da dívida.';
  if (amount <= 0) return 'Informe o valor da parcela.';
  if (!Number.isInteger(day) || day < 1 || day > 31) return 'O dia de vencimento deve estar entre 1 e 31.';
  if (!Number.isInteger(count) || count < 1) return 'O total de parcelas deve ser 1 ou mais.';
  if (!Number.isInteger(current) || current < 1 || current > count) return 'O número da parcela deve estar entre 1 e o total de parcelas.';
  if (!/^\d{4}-\d{2}$/.test(f.start)) return 'Escolha o mês em que essa parcela cai.';
  // 'custom' keeps the own split set in the Divisão tab; any other choice replaces it.
  const owner = f.owner === 'custom' ? {} : f.owner === 'both' ? { shared: true, person: null, splitA: undefined } : { shared: false, person: Number(f.owner) as Person, splitA: undefined };
  const patch: Partial<Debt> = { name: f.name.trim(), origin: f.origin.trim(), amount, installments: count, ...owner, firstDue: `${d.firstDue.slice(0, 7)}-${String(day).padStart(2, '0')}` };
  return editDebt(d, patch, f.start, current);
}

function DebtForm({ id, draft, setDraft, names }: { id: string; draft: Draft; setDraft: (d: Draft) => void; names: [string, string] }) {
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const fieldId = (name: string) => `debt-${id}-${name}`;
  return <div className="debt-editor-fields">
    <div><Label htmlFor={fieldId('name')}>Nome</Label><Input id={fieldId('name')} value={draft.name} onChange={e => set({ name: e.target.value })} /></div>
    <div><Label htmlFor={fieldId('origin')}>Onde é a dívida</Label><Input id={fieldId('origin')} placeholder="Ex.: cartão do pai" value={draft.origin} onChange={e => set({ origin: e.target.value })} /></div>
    <div><Label htmlFor={fieldId('owner')}>Responsável</Label><NativeSelect id={fieldId('owner')} value={draft.owner} onChange={e => set({ owner: e.target.value })}><option value="0">{names[0]}</option><option value="1">{names[1]}</option><option value="both">Os dois</option>{draft.owner === 'custom' && <option value="custom">Dividido por % (aba Divisão)</option>}</NativeSelect></div>
    <div><Label htmlFor={fieldId('amount')}>Valor da parcela (R$)</Label><Input id={fieldId('amount')} type="number" min="0" step="0.01" value={draft.amount} onChange={e => set({ amount: e.target.value })} /></div>
    <div><Label htmlFor={fieldId('day')}>Vence no dia</Label><Input id={fieldId('day')} type="number" min="1" max="31" value={draft.day} onChange={e => set({ day: e.target.value })} /></div>
    <div><Label htmlFor={fieldId('current')}>Esta parcela é a número</Label><Input id={fieldId('current')} type="number" min="1" step="1" value={draft.current} onChange={e => set({ current: e.target.value })} /></div>
    <div><Label htmlFor={fieldId('start')}>e cai em</Label><Input id={fieldId('start')} type="month" value={draft.start} onChange={e => set({ start: e.target.value })} /></div>
    <div><Label htmlFor={fieldId('count')}>Total de parcelas</Label><Input id={fieldId('count')} type="number" min="1" step="1" value={draft.count} onChange={e => set({ count: e.target.value })} /></div>
  </div>;
}

const Fact = ({ label, children }: { label: string; children: React.ReactNode }) => <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{children}</dd></div>;

function DebtCard({ d, month }: { d: Debt; month: string }) {
  const { s, update } = useAppState();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const save = () => {
    if (!draft) return;
    const r = applyDraft(d, draft);
    if (typeof r === 'string') { toast.error(r); return; }
    update(st => ({ ...st, debts: st.debts.map(x => x.id === d.id ? r : x) }));
    setDraft(null); toast.success('Dívida salva.');
  };
  const owner = payerLabel(s.names, d, 'Os dois');
  const split = debtSplit(s, d);
  return <article className="debt-editor-card" aria-label={d.name || 'Dívida'}>
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg">{d.name || 'Dívida'}{d.origin && <small className="ml-2 text-sm font-normal text-muted-foreground">{d.origin}</small>}</h2>
      {!draft && <div className="flex gap-1"><Button variant="outline" size="sm" onClick={() => { setDraft(toDraft(d, month)); setConfirmRemove(false); }}><Pencil className="h-4 w-4" />Editar</Button><Button variant="ghost" size="icon" aria-label={`Remover ${d.name || 'dívida'}`} onClick={() => setConfirmRemove(true)}><Trash2 className="h-4 w-4" /></Button></div>}
    </div>
    {draft ? <>
      <DebtForm id={d.id} draft={draft} setDraft={setDraft} names={s.names} />
      <div className="mt-4 flex flex-wrap gap-2"><Button onClick={save}>Salvar</Button><Button variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button></div>
    </> : <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Fact label="Responsável">{owner}</Fact>
      <Fact label="Valor da parcela">{BRL(d.amount)}</Fact>
      <Fact label="Vence no dia">{Number(d.firstDue.slice(8, 10))}</Fact>
      <Fact label="Total de parcelas">{d.installments}</Fact>
      <Fact label="Total da dívida">{BRL(d.amount * d.installments)}</Fact>
      <Fact label="Falta pagar">{BRL(debtSummary(d).remaining)}</Fact>
    </dl>}
    {!draft && split && <table className="mt-4 w-full text-sm" aria-label="Divisão da dívida entre os dois"><thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1 font-normal" /><th className="font-normal">Total</th><th className="font-normal">{s.names[0]} ({split.pctA}%)</th><th className="font-normal">{s.names[1]} ({100 - split.pctA}%)</th></tr></thead><tbody>
      {([['Parcela', d.amount, split.installment], ['Total da dívida', d.amount * d.installments, split.total], ['Falta pagar', debtSummary(d).remaining, split.remaining]] as const).map(([label, all, [a, b]]) => <tr key={label} className="border-t"><th scope="row" className="py-2 text-left font-normal text-muted-foreground">{label}</th><td className="tabular-nums">{BRL(all)}</td><td className="tabular-nums">{BRL(a)}</td><td className="tabular-nums">{BRL(b)}</td></tr>)}
    </tbody></table>}
    {confirmRemove && !draft && <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-muted p-3 text-sm"><span>Remover {d.name || 'esta dívida'} de todos os meses? Isso não pode ser desfeito.</span><Button size="sm" variant="destructive" onClick={() => update(st => ({ ...st, debts: st.debts.filter(x => x.id !== d.id) }))}>Remover</Button><Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>Cancelar</Button></div>}
    <p className="mt-4 border-t pt-3 text-sm text-muted-foreground" aria-live="polite">{debtSituation(d, month)}</p>
  </article>;
}

function NewDebtCard({ month, onClose }: { month: string; onClose: () => void }) {
  const { s, update } = useAppState();
  const base = newDebt(month);
  const [draft, setDraft] = useState<Draft>({ ...toDraft(base, month), amount: '' });
  const save = () => {
    const r = applyDraft(base, draft);
    if (typeof r === 'string') { toast.error(r); return; }
    update(st => ({ ...st, debts: [...st.debts, r] }));
    toast.success('Dívida adicionada.'); onClose();
  };
  return <article className="debt-editor-card" aria-label="Nova dívida">
    <h2 className="mb-4 text-lg">Nova dívida</h2>
    <DebtForm id="new" draft={draft} setDraft={setDraft} names={s.names} />
    <p className="mt-3 text-xs text-muted-foreground">Para uma dívida que começa no mês que vem, use parcela número 1 e escolha esse mês em "e cai em".</p>
    <div className="mt-4 flex flex-wrap gap-2"><Button onClick={save}>Salvar</Button><Button variant="ghost" onClick={onClose}>Cancelar</Button></div>
  </article>;
}

export function DebtEditor({ month }: { month: string }) {
  const { s } = useAppState();
  const [adding, setAdding] = useState(false);
  return <section aria-label="Cadastro de dívidas">
    <div id="debts" className="debt-editor-list">
      {s.debts.map(d => <DebtCard key={d.id} d={d} month={month} />)}
      {!s.debts.length && !adding && <Empty>Nenhuma dívida cadastrada.</Empty>}
      {adding && <NewDebtCard month={month} onClose={() => setAdding(false)} />}
    </div>
    {!adding && <Button className="mt-4" variant="outline" onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Adicionar dívida</Button>}
  </section>;
}
