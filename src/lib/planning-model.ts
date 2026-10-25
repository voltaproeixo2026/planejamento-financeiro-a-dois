import { addMonths, BRL, debtCur, debtInstallment, debtSummary, itemsForMonth, jointCashflow, monthLabel, summarize, type AppState, type Debt } from './finance';

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
    { name: 'Dívidas', value: sum.debtInstallments, category: 'divida' },
    ...['Casa', 'Alimentação', 'Pet', 'Outros'].map((name, index) => ({ name, category: ['casa', 'alim', 'pet', 'outros'][index],
      value: sum.items.filter(i => i.kind === 'bill' && (() => {
        const category = s.bills.find(b => b.id === i.refId)?.category.toLowerCase();
        const group = category === 'moradia' || category === 'casa' ? 'Casa' : category === 'alimentação' || category === 'alim' ? 'Alimentação' : category === 'pet' ? 'Pet' : 'Outros';
        return group === name;
      })()).reduce((total, i) => total + i.amount, 0) })),
    { name: 'Dinheiro livre', value: sum.freeMoney[0] + sum.freeMoney[1], category: 'livre' },
    { name: 'Poupança', value: Math.max(0, sum.leftover), category: 'poup' },
  ].filter(g => g.value > 0);
  const total = groups.reduce((value, group) => value + group.value, 0);
  return groups.map(group => ({ ...group, percent: Math.round(group.value / total * 100) }));
}

export const incomeScenarioControl = { min: 30, max: 100, step: 5, initial: 70 };
export function incomeScenarioView(s: AppState, month: string, percent: number) {
  // Explicitly omit extras even at 100%; summarize normally includes them at factor=1.
  return summarize({ ...s, extras: [] }, month, { factor: percent / 100 });
}

export function debtHomeView(s: AppState, month: string) {
  return s.debts.map(d => {
    const installment = debtInstallment(d, month);
    const balance = debtSummary(d);
    const status = balance.done || month > addMonths(d.firstDue.slice(0, 7), d.installments - 1) ? 'done' : installment ? 'active' : 'future';
    return {
      id: d.id, name: d.name, origin: d.origin,
      owner: d.shared ? 'Os dois' : s.names[d.person ?? 0],
      current: installment ? installment.index + 1 : null,
      installments: d.installments, left: balance.left, remaining: balance.remaining,
      total: d.amount * d.installments,
      firstMonth: d.firstDue.slice(0, 7), lastMonth: addMonths(d.firstDue.slice(0, 7), d.installments - 1), status,
    };
  }).sort((a, b) => {
    const order: Record<string, number> = { active: 0, future: 1, done: 2 };
    return (order[a.status] ?? 0) - (order[b.status] ?? 0);
  });
}
export function debtSituation(d: Debt, month: string) {
  const current = debtCur(d, month), balance = debtSummary(d);
  if (balance.done) return 'Quitada.';
  if (current < 1) return `Começa em ${monthLabel(d.firstDue.slice(0, 7))}.`;
  if (current > d.installments) return `Parcelas encerradas. Falta pagar: ${BRL(balance.remaining)}.`;
  const lastMonth = addMonths(month, d.installments - current);
  return `Parcela ${current} de ${d.installments} neste mês. ${current === d.installments ? 'É a última parcela.' : `Restam ${balance.left} (com esta): ${BRL(balance.remaining)}. Última em ${monthLabel(lastMonth)}.`}`;
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