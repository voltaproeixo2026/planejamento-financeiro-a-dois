import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppState } from "@/lib/household";
import { BRL, debtSummary, fmtDate, incomeReceipts, itemsForMonth, toCents, uid, type Freq, type Person } from "@/lib/finance";
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
      <Section title="O casal" desc="Os nomes aparecem em todo o app.">
        <div className="grid gap-3 sm:grid-cols-2">
          {([0, 1] as Person[]).map((p) => (
            <F key={p} label={`Pessoa ${p + 1}`}><Input value={s.names[p]} onChange={(e) => update((st) => { const n = [...st.names] as [string, string]; n[p] = e.target.value; return { ...st, names: n }; })} /></F>
          ))}
        </div>
      </Section>
      <Tabs defaultValue="rendas">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="rendas">Rendas</TabsTrigger><TabsTrigger value="extras">Extras</TabsTrigger>
          <TabsTrigger value="fixas">Contas fixas</TabsTrigger><TabsTrigger value="dividas">Dívidas</TabsTrigger>
        </TabsList>
        <TabsContent value="rendas"><Incomes month={month} /></TabsContent>
        <TabsContent value="extras"><Extras month={month} /></TabsContent>
        <TabsContent value="fixas"><Bills month={month} /></TabsContent>
        <TabsContent value="dividas"><Debts /></TabsContent>
      </Tabs>
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
    <Section title="Renda recorrente" desc="Mensal conta 1×; quinzenal 2× (dia e dia+15); semanal conta quantas vezes o dia da semana cai no mês.">
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

function Bills({ month }: { month: string }) {
  const { s, update } = useAppState();
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ name: "", category: "", amount: "", day: "10", person: "", start: month, end: "" });
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = toCents(f.amount), day = Number(f.day);
    if (!f.name.trim() || amount <= 0) { toast.error("Informe nome e valor maior que zero."); return; }
    if (day < 1 || day > 31) { toast.error("Dia deve estar entre 1 e 31."); return; }
    if (f.end && f.end < f.start) { toast.error("O fim não pode ser antes do início."); return; }
    if (s.bills.some((b) => b.name.toLowerCase() === f.name.trim().toLowerCase() && b.day === day)) { toast.error("Já existe uma conta com esse nome e dia."); return; }
    update((st) => ({ ...st, bills: [...st.bills, { id: uid(), name: f.name.trim(), category: f.category, amount, day, person: f.person === "" ? null : (Number(f.person) as Person), shared: f.person === "", start: f.start, end: f.end || undefined, paid: {} }] }));
    setF({ ...f, name: "", amount: "" }); toast.success("Conta adicionada.");
  };
  const items = itemsForMonth(s, month).filter((i) => i.kind === "bill");
  return (
    <Section title="Contas fixas" desc="Entram automaticamente em cada mês entre início e fim.">
      <form onSubmit={add} className="mb-5 grid gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <F label="Nome"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></F>
        <F label="Categoria"><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></F>
        <F label="Valor (R$)"><Input type="number" min="0" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></F>
        <F label="Vencimento (dia)"><Input type="number" min="1" max="31" value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })} /></F>
        <F label="De quem"><PersonSelect allowNone value={f.person} onChange={(v) => setF({ ...f, person: v })} /></F>
        <F label="Início"><Input type="month" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></F>
        <F label="Fim (opcional)"><Input type="month" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></F>
        <div className="flex items-end"><Button type="submit" className="w-full">Adicionar</Button></div>
      </form>
      {items.length ? <ul className="divide-y">{items.map((i) => {
        const b = s.bills.find((x) => x.id === i.refId)!;
        return (
          <li key={i.key} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div><p className="font-medium">{i.name}</p><p className="text-xs text-muted-foreground">{b.category || "Sem categoria"} · vence {fmtDate(i.date)} · {i.shared ? "Compartilhada" : `Individual de ${s.names[i.person!]}`}</p></div>
            <div className="flex items-center gap-2"><b>{BRL(i.amount)}</b><Status paid={i.paid} overdue={i.date < today} />
              <Button size="sm" variant="outline" onClick={() => togglePaid(update, i, month)}>{i.paid ? "Desfazer" : "Marcar paga"}</Button>
              <Button size="icon" variant="ghost" aria-label="Remover" onClick={() => update((st) => ({ ...st, bills: st.bills.filter((x) => x.id !== b.id) }))}><Trash2 className="h-4 w-4" /></Button></div>
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
    <Section title="Dívidas e parcelamentos" desc="Marque cada parcela como paga — nada é pago automaticamente na virada do mês.">
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
              <p className="text-xs text-muted-foreground">{d.shared ? "Compartilhada" : s.names[d.person!]} · vence dia {d.firstDue.slice(8)} · desde {fmtDate(d.firstDue)}</p></div>
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
