import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAppState } from "@/lib/household";
import { BRL, addMonths, billActive, billValueMonth, debtSummary, fmtDate, incomeReceipts, itemsForMonth, lastTimeBill, monthLabel, repeatBill, setBillMonthValue, stopBillFrom, toCents, uid, type Bill, type Freq, type Person } from "@/lib/finance";
import { Empty, NativeSelect, Section, Status } from "./ui-bits";
import { togglePaid } from "./Dashboard";

const F = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const freqLabel: Record<Freq, string> = { monthly: "Mensal", biweekly: "Quinzenal", weekly: "Semanal" };

function PersonSelect({ value, onChange, allowNone }: { value: string; onChange: (v: string) => void; allowNone?: boolean }) {
  const { s } = useAppState();
  return <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>{allowNone && <option value="">Casal (compartilhada)</option>}<option value="0">{s.names[0]}</option><option value="1">{s.names[1]}</option></NativeSelect>;
}

export function Accounts({ month }: { month: string }) {
  const { s, update } = useAppState();
  return (
    <div className="space-y-6">
      <Section title="Quem somos" desc="Os nomes aparecem em todo o app.">
        <div className="grid gap-3 sm:grid-cols-2">
          {([0, 1] as Person[]).map((p) => (
            <F key={p} label={`Pessoa ${p + 1}`}><Input value={s.names[p]} onChange={(e) => update((st) => { const n = [...st.names] as [string, string]; n[p] = e.target.value; return { ...st, names: n }; })} /></F>
          ))}
        </div>
      </Section>
      <Incomes month={month} />
      <Extras month={month} />
      <Bills month={month} />
    </div>
  );
}

function Incomes({ month }: { month: string }) {
  const { s, update } = useAppState();
  const [f, setF] = useState({ desc: "", person: "0", amount: "", freq: "monthly" as Freq, day: "5", autonomous: false });
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = toCents(f.amount), day = Number(f.day);
    if (!f.desc.trim() || amount <= 0) { toast.error("Informe descrição e valor maior que zero."); return; }
    if (f.freq !== "weekly" && (day < 1 || day > 31)) { toast.error("Dia deve estar entre 1 e 31."); return; }
    update((st) => ({ ...st, incomes: [...st.incomes, { id: uid(), desc: f.desc.trim(), person: Number(f.person) as Person, amount, freq: f.freq, day, active: true, autonomous: f.autonomous }] }));
    setF({ ...f, desc: "", amount: "" }); toast.success("Renda adicionada.");
  };
  return (
    <Section title="Rendas que se repetem" desc="Mensal conta 1×; quinzenal 2× (dia e dia+15); semanal conta quantas vezes o dia da semana cai no mês.">
      <form onSubmit={add} className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <F label="Descrição"><Input value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} placeholder="Salário" /></F>
        <F label="Pessoa"><PersonSelect value={f.person} onChange={(v) => setF({ ...f, person: v })} /></F>
        <F label="Valor (R$)"><Input type="number" min="0" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></F>
        <F label="Frequência"><NativeSelect value={f.freq} onChange={(e) => setF({ ...f, freq: e.target.value as Freq, day: e.target.value === "weekly" ? "5" : f.day })}>{Object.entries(freqLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></F>
        <F label={f.freq === "weekly" ? "Dia da semana" : "Dia do mês"}>{f.freq === "weekly" ? <NativeSelect value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })}>{weekdays.map((w, i) => <option key={w} value={i}>{w}</option>)}</NativeSelect> : <Input type="number" min="1" max="31" value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })} />}</F>
        <F label="Autônoma?"><div className="flex h-9 items-center"><Switch checked={f.autonomous} onCheckedChange={(v) => setF({ ...f, autonomous: v })} /></div></F>
        <div className="flex items-end"><Button type="submit" className="w-full">Adicionar</Button></div>
      </form>
      {s.incomes.length ? (
        <ul className="divide-y">
          {s.incomes.map((i) => {
            const monthly = incomeReceipts({ ...i, active: true }, month).reduce((a, r) => a + r.amount, 0);
            return (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div><p className="font-medium">{i.desc} {i.autonomous && <span className="ml-1 rounded bg-accent px-1.5 py-0.5 text-xs">autônoma</span>}</p>
                  <p className="text-xs text-muted-foreground">{s.names[i.person]} · {freqLabel[i.freq]} · {BRL(i.amount)} por recebimento · no mês: {BRL(monthly)}</p></div>
                <div className="flex items-center gap-3"><Label className="flex items-center gap-2 text-xs">Ativa<Switch checked={i.active} onCheckedChange={(v) => update((st) => ({ ...st, incomes: st.incomes.map((x) => x.id === i.id ? { ...x, active: v } : x) }))} /></Label>
                  <Button size="icon" variant="ghost" aria-label="Remover" onClick={() => update((st) => ({ ...st, incomes: st.incomes.filter((x) => x.id !== i.id) }))}><Trash2 className="h-4 w-4" /></Button></div>
              </li>
            );
          })}
        </ul>
      ) : <Empty>Cadastre a primeira renda acima.</Empty>}
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        {([0, 1] as Person[]).map((p) => <p key={p}>{s.names[p]}: <b>{BRL(s.incomes.filter((i) => i.person === p).reduce((a, i) => a + incomeReceipts(i, month).reduce((x, r) => x + r.amount, 0), 0))}</b>/mês</p>)}
        <p>Casal: <b>{BRL(s.incomes.reduce((a, i) => a + incomeReceipts(i, month).reduce((x, r) => x + r.amount, 0), 0))}</b>/mês</p>
      </div>
    </Section>
  );
}

function Extras({ month }: { month: string }) {
  const { s, update } = useAppState();
  const [f, setF] = useState({ desc: "", amount: "", person: "0", date: `${month}-15` });
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = toCents(f.amount);
    if (!f.desc.trim() || amount <= 0 || !f.date) { toast.error("Preencha descrição, valor e data."); return; }
    update((st) => ({ ...st, extras: [...st.extras, { id: uid(), desc: f.desc.trim(), amount, person: Number(f.person) as Person, date: f.date, month: f.date.slice(0, 7) }] }));
    setF({ ...f, desc: "", amount: "" }); toast.success("Extra registrado.");
  };
  const list = s.extras.filter((e) => e.month === month);
  return (
    <Section title="Extras do mês" desc="Contam só no mês de referência — nunca viram renda recorrente.">
      <form onSubmit={add} className="mb-5 grid gap-3 sm:grid-cols-5">
        <F label="Descrição"><Input value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} /></F>
        <F label="Valor (R$)"><Input type="number" min="0" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></F>
        <F label="Quem recebeu"><PersonSelect value={f.person} onChange={(v) => setF({ ...f, person: v })} /></F>
        <F label="Data"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></F>
        <div className="flex items-end"><Button type="submit" className="w-full">Adicionar</Button></div>
      </form>
      {list.length ? <ul className="divide-y">{list.map((e) => (
        <li key={e.id} className="flex items-center justify-between py-3"><div><p className="font-medium">{e.desc}</p><p className="text-xs text-muted-foreground">{s.names[e.person]} · {fmtDate(e.date)}</p></div>
          <div className="flex items-center gap-2"><b>{BRL(e.amount)}</b><Button size="icon" variant="ghost" aria-label="Remover" onClick={() => update((st) => ({ ...st, extras: st.extras.filter((x) => x.id !== e.id) }))}><Trash2 className="h-4 w-4" /></Button></div></li>
      ))}</ul> : <Empty>Nenhum extra neste mês.</Empty>}
    </Section>
  );
}

function BillValue({ id, cents, onCommit }: { id: string; cents: number; onCommit: (cents: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const c = toCents(draft);
    setDraft(null);
    if (draft.trim() === "" || c <= 0) { toast.error("Informe um valor maior que zero."); return; }
    if (c !== cents) onCommit(c);
  };
  return (
    <Input id={id} aria-label="Valor neste mês (R$)" className="h-8 w-28 text-right" type="number" min="0" step="0.01"
      value={draft ?? String(cents / 100)} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
  );
}

type Pending = { id: string; kind: "stop" | "delete" } | null;

function Bills({ month }: { month: string }) {
  const { s, update } = useAppState();
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ name: "", category: "", amount: "", day: "10", person: "" });
  const [dup, setDup] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const items = itemsForMonth(s, month).filter((i) => i.kind === "bill");
  const next = addMonths(month, 1);
  const patchBill = (id: string, fn: (b: Bill) => Bill) => update((st) => ({ ...st, bills: st.bills.map((b) => (b.id === id ? fn(b) : b)) }));

  const create = () => {
    const amount = toCents(f.amount), day = Number(f.day);
    update((st) => ({ ...st, bills: [...st.bills, { id: uid(), name: f.name.trim(), category: f.category, amount, day, person: f.person === "" ? null : (Number(f.person) as Person), shared: f.person === "", start: month, paid: {} }] }));
    setF({ ...f, name: "", amount: "" }); setDup(false); toast.success(`Conta adicionada em ${monthLabel(month)}. Ela se repete nos meses seguintes.`);
  };
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = toCents(f.amount), day = Number(f.day);
    if (!f.name.trim() || amount <= 0) { toast.error("Informe nome e valor maior que zero."); return; }
    if (!Number.isInteger(day) || day < 1 || day > 31) { toast.error("Dia deve estar entre 1 e 31."); return; }
    // Same name and day in other months is normal (the bill repeats every month). Only warn about the same name in this month.
    if (!dup && items.some((i) => i.name.trim().toLowerCase() === f.name.trim().toLowerCase())) { setDup(true); return; }
    create();
  };
  const repeat = (b: Bill) => {
    const r = repeatBill(b, month);
    if (r.status === "exists") { toast.info(`${b.name} já está lançada em ${monthLabel(next)}.`); return; }
    patchBill(b.id, () => r.bill); toast.success(`${b.name} lançada em ${monthLabel(next)}. Ajuste o valor lá, se mudar.`);
  };
  const repeatAll = () => {
    let n = 0;
    update((st) => ({ ...st, bills: st.bills.map((b) => { if (!billActive(b, month)) return b; const r = repeatBill(b, month); if (r.status === "created") n++; return r.bill; }) }));
    toast.success(`Contas lançadas em ${monthLabel(next)}.`);
  };
  return (
    <Section title="Contas fixas" desc={`Mostrando ${monthLabel(month)}. Toda conta se repete nos meses seguintes com o último valor, e você muda o valor só do mês em que ele mudar.`}
      action={items.length ? <Button size="sm" variant="outline" onClick={repeatAll}>Repetir todas em {monthLabel(next)}</Button> : undefined}>
      <form onSubmit={add} className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <F label="Nome"><Input value={f.name} onChange={(e) => { setF({ ...f, name: e.target.value }); setDup(false); }} /></F>
        <F label="Categoria"><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></F>
        <F label="Valor (R$)"><Input type="number" min="0" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></F>
        <F label="Vencimento (dia)"><Input type="number" min="1" max="31" value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })} /></F>
        <F label="De quem"><PersonSelect allowNone value={f.person} onChange={(v) => setF({ ...f, person: v })} /></F>
        <F label="Começa em"><Input readOnly value={monthLabel(month)} className="capitalize" aria-label="Mês de início" /></F>
        <div className="flex items-end"><Button type="submit" className="w-full">Adicionar</Button></div>
      </form>
      {dup && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-muted p-3 text-sm">
        <span>Já existe uma conta com esse nome em {monthLabel(month)}. Lançar mesmo assim?</span>
        <Button size="sm" onClick={create}>Lançar mesmo assim</Button><Button size="sm" variant="ghost" onClick={() => setDup(false)}>Cancelar</Button>
      </div>}
      {items.length ? <ul className="divide-y">{items.map((i) => {
        const b = s.bills.find((x) => x.id === i.refId);
        if (!b) return null;
        const source = billValueMonth(b, month);
        const repeated = source !== month;
        const last = b.end === month;
        const confirming = pending?.id === b.id ? pending.kind : null;
        return (
          <li key={i.key} className="space-y-2 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{i.name}
                  {repeated && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">repetida de {monthLabel(source)}</span>}
                  {last && <span className="ml-2 rounded bg-warning px-1.5 py-0.5 text-xs font-normal text-warning-foreground">última vez</span>}
                </p>
                <p className="text-xs text-muted-foreground">{b.category || "Sem categoria"} · vence {fmtDate(i.date)} · {i.shared ? "Compartilhada" : `Individual de ${s.names[i.person ?? 0]}`}{b.end && !last ? ` · até ${monthLabel(b.end)}` : ""}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <BillValue key={`${b.id}-${month}-${i.amount}`} id={`bill-value-${b.id}`} cents={i.amount} onCommit={(c) => patchBill(b.id, (x) => setBillMonthValue(x, month, c))} />
                <Status paid={i.paid} overdue={i.date < today} />
                <Button size="sm" variant="outline" onClick={() => togglePaid(update, i, month)}>{i.paid ? "Desfazer" : "Marcar paga"}</Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => repeat(b)}>Repetir em {monthLabel(next)}</Button>
              {!last && <Button size="sm" variant="ghost" onClick={() => { patchBill(b.id, (x) => lastTimeBill(x, month)); toast.success(`${b.name}: última vez em ${monthLabel(month)}.`); }}>Última vez neste mês</Button>}
              <Button size="sm" variant="ghost" onClick={() => setPending({ id: b.id, kind: "stop" })}>Parar a partir deste mês</Button>
              <Button size="sm" variant="ghost" className="text-destructive" aria-label={`Apagar ${b.name} em todos os meses`} onClick={() => setPending({ id: b.id, kind: "delete" })}><Trash2 className="h-4 w-4" />Apagar em todos os meses</Button>
            </div>
            {confirming && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg bg-muted p-3 text-sm">
              <span>{confirming === "stop" ? `${b.name} deixa de aparecer a partir de ${monthLabel(month)}. Os meses anteriores continuam como estão.` : `${b.name} some de todos os meses, inclusive dos anteriores. Isso não pode ser desfeito.`}</span>
              <Button size="sm" variant="destructive" onClick={() => {
                update((st) => ({ ...st, bills: confirming === "delete" ? st.bills.filter((x) => x.id !== b.id) : st.bills.flatMap((x) => { if (x.id !== b.id) return [x]; const r = stopBillFrom(x, month); return r ? [r] : []; }) }));
                setPending(null); toast.success(confirming === "delete" ? "Conta apagada." : "Conta encerrada.");
              }}>Confirmar</Button>
              <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Cancelar</Button>
            </div>}
          </li>
        );
      })}</ul> : <Empty>Nenhuma conta fixa neste mês.</Empty>}
    </Section>
  );
}

export function Debts() {
  const { s, update } = useAppState();
  const [f, setF] = useState({ name: "", total: "", installments: "", amount: "", paidCount: "0", firstDue: new Date().toISOString().slice(0, 10), person: "" });
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(f.installments), amount = toCents(f.amount), paid = Number(f.paidCount);
    if (!f.name.trim() || n < 1 || amount <= 0) { toast.error("Informe nome, parcelas e valor da parcela."); return; }
    if (paid < 0 || paid > n) { toast.error("Parcelas pagas inválidas."); return; }
    update((st) => ({ ...st, debts: [...st.debts, { id: uid(), name: f.name.trim(), total: toCents(f.total) || amount * n, installments: n, amount, paidCount: paid, firstDue: f.firstDue, person: f.person === "" ? null : (Number(f.person) as Person), shared: f.person === "" }] }));
    setF({ ...f, name: "", total: "", installments: "", amount: "" }); toast.success("Dívida adicionada.");
  };
  return (
    <Section id="debts" title="Dívidas e parcelamentos" desc="Marque cada parcela como paga — nada é pago automaticamente na virada do mês.">
      <form onSubmit={add} className="mb-5 grid gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <F label="Nome"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></F>
        <F label="Total contratado"><Input type="number" min="0" step="0.01" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} placeholder="opcional" /></F>
        <F label="Nº de parcelas"><Input type="number" min="1" value={f.installments} onChange={(e) => setF({ ...f, installments: e.target.value })} /></F>
        <F label="Valor parcela"><Input type="number" min="0" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></F>
        <F label="Já pagas"><Input type="number" min="0" value={f.paidCount} onChange={(e) => setF({ ...f, paidCount: e.target.value })} /></F>
        <F label="1º vencimento"><Input type="date" value={f.firstDue} onChange={(e) => setF({ ...f, firstDue: e.target.value })} /></F>
        <F label="De quem"><PersonSelect allowNone value={f.person} onChange={(v) => setF({ ...f, person: v })} /></F>
        <div className="flex items-end"><Button type="submit" className="w-full">Adicionar</Button></div>
      </form>
      {s.debts.length ? <div className="grid gap-3 md:grid-cols-2">{s.debts.map((d) => {
        const sm = debtSummary(d);
        const pct = Math.round((d.paidCount / d.installments) * 100);
        return (
          <div key={d.id} className="rounded-xl border p-4">
            <div className="flex items-start justify-between"><div><p className="font-semibold">{d.name} {sm.done && <span className="ml-1 rounded bg-success px-1.5 py-0.5 text-xs text-success-foreground">quitada</span>}</p>
              <p className="text-xs text-muted-foreground">{d.shared ? "Compartilhada" : s.names[d.person ?? 0]} · vence dia {d.firstDue.slice(8)} · desde {fmtDate(d.firstDue)}</p></div>
              <Button size="icon" variant="ghost" aria-label="Remover" onClick={() => update((st) => ({ ...st, debts: st.debts.filter((x) => x.id !== d.id) }))}><Trash2 className="h-4 w-4" /></Button></div>
            <div className="my-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
            <dl className="grid grid-cols-2 gap-1 text-sm">
              <dt className="text-muted-foreground">Contratado</dt><dd className="text-right">{BRL(d.total)}</dd>
              <dt className="text-muted-foreground">Já pago</dt><dd className="text-right">{BRL(sm.paid)}</dd>
              <dt className="text-muted-foreground">Saldo restante</dt><dd className="text-right font-semibold">{BRL(sm.remaining)}</dd>
              <dt className="text-muted-foreground">Parcelas</dt><dd className="text-right">{d.paidCount}/{d.installments} ({sm.left} restantes)</dd>
            </dl>
            {!sm.done && <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => update((st) => ({ ...st, debts: st.debts.map((x) => x.id === d.id ? { ...x, paidCount: x.paidCount + 1 } : x) }))}>Pagar próxima parcela</Button>
              <Button size="sm" variant="outline" onClick={() => {
                const v = prompt("Novo valor da próxima parcela (R$) — ex.: juros ou antecipação");
                if (v === null) return; const c = toCents(v); if (c < 0) { toast.error("Valor inválido."); return; }
                update((st) => ({ ...st, debts: st.debts.map((x) => x.id === d.id ? { ...x, overrides: { ...x.overrides, [x.paidCount]: c } } : x) }));
              }}>Ajustar próxima</Button>
            </div>}
          </div>
        );
      })}</div> : <Empty>Nenhuma dívida cadastrada.</Empty>}
    </Section>
  );
}
