import { useState } from 'react';
import { useAppState } from '@/lib/household';
import { BRL, summarize } from '@/lib/finance';
import { Slider } from '@/components/ui/slider';
import { Section } from './ui-bits';

export function IncomeScenario({ month }: { month: string }) {
  const { s } = useAppState();
  const [factor, setFactor] = useState(70);
  const sim = summarize(s, month, { factor: factor / 100 });
  return <Section title="E se a renda autônoma vier menor?">
    <div className="mb-4 flex items-center justify-between"><label htmlFor="weak">A autônoma vem a</label><b>{factor}%</b></div>
    <Slider id="weak" aria-label="Percentual da renda autônoma" value={[factor]} min={30} max={100} step={5} onValueChange={([v]) => setFactor(v ?? 70)} />
    <p className="mt-3 text-sm">Receitas: {BRL(sim.totalIncome)} · Sobra prevista: <b className={sim.leftover < 0 ? 'text-destructive' : 'text-success'}>{BRL(sim.leftover)}</b></p>
    <p className="mt-2 text-sm text-muted-foreground">Nessa simulação os extras do mês não entram.</p>
  </Section>;
}