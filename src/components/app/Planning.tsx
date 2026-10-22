import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAppState } from "@/lib/household";
import { addMonths, BRL, monthLabel, projection, summarize, toCents } from "@/lib/finance";
import { Section, Stat } from "./ui-bits";

export function Planning({ month }: { month: string }) {
  const { s, update } = useAppState();
  const [factor, setFactor] = useState(70);
  const proj = projection(s, month, 6);
  const base = summarize(s, month);
  const sim = summarize(s, month, { factor: factor / 100 });
  const hasAuto = s.incomes.some((i) => i.autonomous && i.active);
  const nextCushion = s.cushion[addMonths(month, 1)] ?? s.cushion[month] ?? 0;
  const potential = Math.max(0, base.leftover - nextCushion);
  const short = (m: string) => monthLabel(m).replace(" de ", "/").slice(0, 8);

  return (
    <div className="space-y-6">
      <Section title="Previsão dos próximos meses" desc="Valores previstos — não são movimentações realizadas. Extras entram só no mês cadastrado.">
        <div className="h-64"><ResponsiveContainer><BarChart data={proj.map((p) => ({ ...p, name: short(p.month) }))}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" fontSize={12} /><YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 100000)}k`} />
          <Tooltip formatter={(v: number) => BRL(v)} /><Legend />
          <Bar dataKey="income" name="Receitas" fill="var(--primary)" radius={4} /><Bar dataKey="expenses" name="Despesas" fill="var(--person-a)" radius={4} />
        </BarChart></ResponsiveContainer></div>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs uppercase text-muted-foreground"><th className="py-2">Mês</th><th className="text-right">Receitas</th><th className="text-right">Despesas</th><th className="text-right">Sobra</th><th className="text-right">Dívidas restantes</th></tr></thead>
          <tbody>{proj.map((p) => <tr key={p.month} className="border-b last:border-0"><td className="py-2 capitalize">{monthLabel(p.month)}</td><td className="text-right">{BRL(p.income)}</td><td className="text-right">{BRL(p.expenses)}</td><td className={`text-right font-medium ${p.leftover < 0 ? "text-destructive" : "text-success"}`}>{BRL(p.leftover)}</td><td className="text-right">{BRL(p.debtsLeft)}</td></tr>)}</tbody>
        </table></div>
      </Section>

      <Section title="E se a renda autônoma vier menor?" desc="Cenário hipotético — não altera seus dados. Extras não entram na simulação."
        action={<Button size="sm" variant="outline" onClick={() => setFactor(100)}>Restaurar original</Button>}>
        {hasAuto ? <>
          <div className="mb-5 flex items-center gap-4"><span className="w-16 text-sm font-semibold">{factor}%</span><Slider value={[factor]} min={0} max={150} step={5} onValueChange={([v]) => setFactor(v ?? 100)} /></div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Receitas (simulado)" value={sim.totalIncome} hint={`Real: ${BRL(base.recurring[0] + base.recurring[1])}`} />
            <Stat label="Despesas" value={sim.paid + sim.pending + sim.freeMoney[0] + sim.freeMoney[1]} />
            <Stat label="Sobra simulada" value={sim.leftover} tone={sim.leftover < 0 ? "bad" : "good"} />
            <Stat label="Diferença" value={sim.leftover - (base.leftover - base.extras[0] - base.extras[1])} tone="warn" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Parte de cada um nas compartilhadas continua {BRL(sim.share[0])} ({s.names[0]}) e {BRL(sim.share[1])} ({s.names[1]}). Renda que sobra para {s.names[1]} após a parte dele: {BRL(sim.income[1] - sim.share[1] - sim.individual[1] - sim.freeMoney[1])}.</p>
        </> : <p className="text-sm text-muted-foreground">Marque uma renda como “autônoma” em Contas → Rendas para simular.</p>}
      </Section>

      <Section title="O que dá para guardar">
        <div className="grid gap-3 md:grid-cols-3">
          <Stat label="Potencial de economia" value={potential} hint="Estimativa — ainda não é dinheiro guardado" tone="good" />
          <Stat label="Já guardado de fato" value={s.savedReal} />
          <div className="space-y-1 rounded-2xl border p-5"><Label className="text-xs">Atualizar valor guardado (R$)</Label>
            <Input type="number" min="0" step="0.01" value={s.savedReal / 100} onChange={(e) => update((st) => ({ ...st, savedReal: Math.max(0, toCents(e.target.value)) }))} /></div>
        </div>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Receitas do mês (rendas + extras): {BRL(base.totalIncome)}</li>
          <li>Contas fixas e parcelas (pagas e a pagar): −{BRL(base.paid + base.pending)}</li>
          <li>Dinheiro livre semanal dos dois: −{BRL(base.freeMoney[0] + base.freeMoney[1])}</li>
          <li>Colchão reservado para começar o próximo mês: −{BRL(nextCushion)}</li>
        </ul>
      </Section>
    </div>
  );
}
