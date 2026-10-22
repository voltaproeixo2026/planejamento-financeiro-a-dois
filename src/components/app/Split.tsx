import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAppState } from "@/lib/household";
import { BRL, fmtDate, summarize, toCents, transferPlan, uid, weekdayDates, type Person } from "@/lib/finance";
import { Empty, NativeSelect, Section, Stat } from "./ui-bits";

const weekdays = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function Split({ month }: { month: string }) {
  const { s, update } = useAppState();
  const today = new Date().toISOString().slice(0, 10);
  const sum = summarize(s, month, { today });
  const plan = transferPlan(s, month, today);
  const weeks = weekdayDates(month, s.freeWeekday).length;
  const [manual, setManual] = useState({ person: "0", amount: "", date: today });

  const record = (person: Person, amount: number, date: string) => {
    if (amount <= 0) { toast.error("Valor deve ser maior que zero."); return; }
    update((st) => ({ ...st, transfers: [...st.transfers, { id: uid(), person, amount, date, month: date.slice(0, 7) }] }));
    toast.success("Transferência registrada.");
  };

  return (
    <div className="space-y-6">
      <Section title="Divisão das contas compartilhadas" desc="Contas individuais não entram aqui. A soma é sempre 100%.">
        <div className="mb-4 flex items-center gap-4">
          <span className="w-24 text-sm font-medium text-person-a">{s.names[0]} {s.split[0]}%</span>
          <Slider value={[s.split[0]]} min={0} max={100} step={1} onValueChange={([v]) => { const val = v ?? 50; update((st) => ({ ...st, split: [val, 100 - val] })); }} />
          <span className="w-24 text-right text-sm font-medium text-person-b">{s.split[1]}% {s.names[1]}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => update((st) => ({ ...st, split: [50, 50] }))}>50/50</Button>
          <Button size="sm" variant="outline" disabled={sum.recurring[0] + sum.recurring[1] === 0} onClick={() => {
            const t = sum.recurring[0] + sum.recurring[1]; const p = Math.round((sum.recurring[0] / t) * 100);
            update((st) => ({ ...st, split: [p, 100 - p] }));
          }}>Proporcional à renda</Button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Stat label="Compartilhadas no mês" value={sum.sharedTotal} />
          <Stat label={`Parte de ${s.names[0]}`} value={sum.share[0]} hint={`+ individuais ${BRL(sum.individual[0])}`} />
          <Stat label={`Parte de ${s.names[1]}`} value={sum.share[1]} hint={`+ individuais ${BRL(sum.individual[1])}`} />
        </div>
      </Section>

      <Section title="Dinheiro livre por semana" desc={`Fica na conta de cada um, fora da conjunta. Neste mês há ${weeks} ${weekdays[s.freeWeekday]}s — o cálculo usa o calendário real.`}>
        <div className="grid gap-3 sm:grid-cols-3">
          {([0, 1] as Person[]).map((p) => (
            <div key={p} className="space-y-1"><Label className="text-xs">{s.names[p]} (R$/semana)</Label>
              <Input type="number" min="0" step="0.01" value={s.weeklyFree[p] / 100} onChange={(e) => update((st) => { const w = [...st.weeklyFree] as [number, number]; w[p] = Math.max(0, toCents(e.target.value)); return { ...st, weeklyFree: w }; })} />
              <p className="text-xs text-muted-foreground">No mês: {BRL(sum.freeMoney[p])}</p></div>
          ))}
          <div className="space-y-1"><Label className="text-xs">Semana começa na</Label>
            <NativeSelect value={s.freeWeekday} onChange={(e) => update((st) => ({ ...st, freeWeekday: Number(e.target.value) }))}>{weekdays.map((w, i) => <option key={w} value={i}>{w}</option>)}</NativeSelect></div>
        </div>
      </Section>

      <Section title="Quanto transferir em cada recebimento" desc="A parte de cada um é distribuída pelos recebimentos restantes do mês, descontando o que já foi transferido e o colchão da conta.">
        <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
          {([0, 1] as Person[]).map((p) => <p key={p}>{s.names[p]}: já transferiu <b>{BRL(sum.transferred[p])}</b> · falta <b>{BRL(sum.needTransfer[p])}</b></p>)}
        </div>
        {plan.length ? <ul className="divide-y">{plan.map((p, k) => (
          <li key={k} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div><p className="font-medium">{s.names[p.person]} · {fmtDate(p.date)}</p><p className="text-xs text-muted-foreground">{p.reason}</p></div>
            <div className="flex items-center gap-2"><b>{BRL(p.amount)}</b><Button size="sm" onClick={() => record(p.person, p.amount, p.date < today ? today : p.date)}>Marcar como feita</Button></div>
          </li>
        ))}</ul> : <Empty>Nenhuma transferência pendente neste mês.</Empty>}
        <form className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); record(Number(manual.person) as Person, toCents(manual.amount), manual.date); setManual({ ...manual, amount: "" }); }}>
          <NativeSelect value={manual.person} onChange={(e) => setManual({ ...manual, person: e.target.value })}><option value="0">{s.names[0]}</option><option value="1">{s.names[1]}</option></NativeSelect>
          <Input type="number" min="0" step="0.01" placeholder="Valor (R$)" value={manual.amount} onChange={(e) => setManual({ ...manual, amount: e.target.value })} />
          <Input type="date" value={manual.date} onChange={(e) => setManual({ ...manual, date: e.target.value })} />
          <Button type="submit" variant="outline">Registrar outra transferência</Button>
        </form>
      </Section>
    </div>
  );
}
