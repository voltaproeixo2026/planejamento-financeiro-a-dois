import { addMonths, debtSummary, itemsForMonth, jointCashflow, summarize, type AppState } from './finance';

export interface Goal { id: string; name: string; target: number; saved: number; share: number }
export type GoalState = AppState & { goals?: Goal[] };

export function savingsView(s: AppState, month: string) {
  const base = summarize(s, month);
  const cushion = s.cushion[addMonths(month, 1)] ?? s.cushion[month] ?? 0;
  return { base, cushion, potential: Math.max(0, base.leftover - cushion) };
}
export function goalView(goal: Goal, monthly: number) {
  const allocation = Math.round(monthly * goal.share / 100);
  const remaining = Math.max(0, goal.target - goal.saved);
  return { allocation, progress: goal.target > 0 ? Math.min(100, goal.saved / goal.target * 100) : 0,
    months: remaining === 0 ? 0 : allocation > 0 ? Math.ceil(remaining / allocation) : null };
}
export function debtTotals(s: AppState, month: string) {
  return { monthly: summarize(s, month).debtInstallments, remaining: s.debts.reduce((total, d) => total + debtSummary(d).remaining, 0) };
}
export function allocationView(s: AppState, month: string) {
  const sum = summarize(s, month);
  const groups = [
    { name: 'Dívidas', value: sum.debtInstallments, color: 'var(--c-divida)' },
    ...['Moradia', 'Alimentação', 'Pet', 'Outros'].map((name, index) => ({ name, color: ['var(--c-casa)', 'var(--c-alim)', 'var(--c-pet)', 'var(--c-outros)'][index],
      value: sum.items.filter(i => i.kind === 'bill' && (() => {
        const category = s.bills.find(b => b.id === i.refId)?.category.toLowerCase();
        const group = category === 'moradia' || category === 'casa' ? 'Moradia' : category === 'alimentação' ? 'Alimentação' : category === 'pet' ? 'Pet' : 'Outros';
        return group === name;
      })()).reduce((total, i) => total + i.amount, 0) })),
    { name: 'Dinheiro livre', value: sum.freeMoney[0] + sum.freeMoney[1], color: 'var(--c-livre)' },
    { name: 'Sobra prevista', value: Math.max(0, sum.leftover), color: 'var(--c-poup)' },
  ].filter(g => g.value > 0);
  return groups;
}
export function personView(s: AppState, month: string, person: 0 | 1) {
  const sum = summarize(s, month);
  return { ...sum, available: sum.income[person] - sum.share[person] - sum.individual[person] - sum.freeMoney[person] };
}
export function cashflowView(s: AppState, month: string) {
  const cf = jointCashflow(s, month);
  return { ...cf, points: [{ date: `${month}-01`, balance: cf.start }, ...cf.moves] };
}
export function forecastLines(s: AppState, month: string, count: number) {
  return Array.from({ length: count }, (_, k) => {
    const m = addMonths(month, k);
    const current = summarize(s, m).debtInstallments;
    const previous = summarize(s, addMonths(m, -1)).debtInstallments;
    return { month: m, difference: current - previous };
  }).filter(x => x.difference !== 0);
}
export function reserveView(s: AppState, month: string) {
  const bills = itemsForMonth(s, month).filter(i => i.kind === 'bill').reduce((total, i) => total + i.amount, 0);
  const shares = ((s as GoalState).goals ?? []).reduce((total, g) => total + g.share, 0);
  return { minimum: bills * 3, maximum: bills * 6, shares };
}