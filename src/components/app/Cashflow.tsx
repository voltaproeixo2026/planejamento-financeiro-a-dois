import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppState } from "@/lib/household";
import { BRL, fmtDate, jointCashflow, toCents } from "@/lib/finance";
import { Empty, Section, Stat } from "./ui-bits";
import { cn } from "@/lib/utils";

export function Cashflow({ month }: { month: string }) {
  const { s, update } = useAppState();
  const cf = jointCashflow(s, month);
  const transfers = s.transfers.filter((t) => t.month === month);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Colchão inicial" value={cf.start} />
        <Stat label="Saldo atual" value={cf.current} hint="Só movimentos realizados" />
        <Stat label="Saldo final projetado" value={cf.projectedEnd} tone={cf.projectedEnd < 0 ? "bad" : "good"} hint="Inclui previstos" />
        <Stat label="Menor saldo do mês" value={cf.minBalance} tone={cf.minBalance < 0 ? "bad" : undefined} />
      </div>
      <Section title="Colchão para começar o mês" desc="Saldo da conta conjunta no dia 1º.">
        <div className="max-w-xs space-y-1"><Label className="text-xs">Valor (R$)</Label>
          <Input type="number" step="0.01" value={(s.cushion[month] ?? 0) / 100} onChange={(e) => update((st) => ({ ...st, cushion: { ...st.cushion, [month]: toCents(e.target.value) } }))} /></div>
      </Section>
      <Section title="Saldo da conta conjunta ao longo do mês" desc="Rendas só entram aqui quando transferidas. Despesas individuais ficam de fora.">
        {cf.moves.length ? (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs uppercase text-muted-foreground"><th className="py-2">Data</th><th>Descrição</th><th>Tipo</th><th className="text-right">Valor</th><th>Status</th><th className="text-right">Saldo após</th></tr></thead>
            <tbody>{cf.moves.map((m, k) => (
              <tr key={k} className={cn("border-b last:border-0", m.status === "previsto" && "text-muted-foreground")}>
                <td className="py-2">{fmtDate(m.date)}</td><td>{m.desc}</td><td className="capitalize">{m.type}</td>
                <td className={cn("text-right", m.type === "entrada" ? "text-success" : "text-destructive")}>{m.type === "entrada" ? "+" : "−"}{BRL(m.amount)}</td>
                <td className="capitalize">{m.status}</td><td className={cn("text-right font-medium", m.balance < 0 && "text-destructive")}>{BRL(m.balance)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty>Sem movimentações neste mês.</Empty>}
      </Section>
      <Section title="Transferências realizadas">
        {transfers.length ? <ul className="divide-y">{transfers.map((t) => (
          <li key={t.id} className="flex items-center justify-between py-2"><span>{s.names[t.person]} · {fmtDate(t.date)}</span>
            <span className="flex items-center gap-2"><b>{BRL(t.amount)}</b><Button size="icon" variant="ghost" aria-label="Remover" onClick={() => update((st) => ({ ...st, transfers: st.transfers.filter((x) => x.id !== t.id) }))}><Trash2 className="h-4 w-4" /></Button></span></li>
        ))}</ul> : <Empty>Registre transferências na aba Divisão.</Empty>}
      </Section>
    </div>
  );
}
