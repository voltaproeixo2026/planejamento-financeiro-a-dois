import { useState } from 'react';
import { useAppState } from '@/lib/household';
import { BRL } from '@/lib/finance';
import { incomeScenarioControl, incomeScenarioView } from '@/lib/planning-model';
import { Slider } from '@/components/ui/slider';
import { Section } from './ui-bits';

export function IncomeScenario({ month }: { month: string }) {
  const { s } = useAppState();
  const [factor, setFactor] = useState(incomeScenarioControl.initial);
  const sim = incomeScenarioView(s, month, factor);
  return <Section title="E se a renda autônoma vier menor?">
    <div className="mb-4 flex items-center justify-between"><label htmlFor="weak">A autônoma vem a</label><b>{factor}%</b></div>
    <Slider id="weak" aria-label="Percentual da renda autônoma" value={[factor]} min={incomeScenarioControl.min} max={incomeScenarioControl.max} step={incomeScenarioControl.step} onValueChange={([v]) => setFactor(v ?? incomeScenarioControl.initial)} />
    <p id="weak-out" aria-live="polite" className={`mt-3 text-sm ${sim.leftover < 0 ? 'text-destructive' : 'text-success'}`}>{sim.leftover >= 0 ? <>Nesse mês ainda sobram <b>{BRL(sim.leftover)}</b>, depois de pagar tudo.</> : <>Nesse mês faltam <b>{BRL(-sim.leftover)}</b> para fechar as contas e o dinheiro livre.</>}</p>
    <p className="mt-2 text-sm text-muted-foreground">Nessa simulação os extras do mês não entram.</p>
  </Section>;
}