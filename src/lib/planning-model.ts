import { addMonths, BRL, carryTotal, clampPct, daysIn, payerLabel, debtCur, debtInstallment, debtSummary, itemsForMonth, jointCashflow, monthLabel, splitAmount, summarize, transferPlan, type AppState, type Debt, type Move, type Person } from './finance';

export interface Goal { id: string; name: string; target: number; saved: number; share: number }
export type GoalState = AppState & { goals?: Goal[] };

export function savingsView(s: AppState, month: string) {
  // Recurring savings: extras are one-off money, so they never count here.
  const noExtras = { ...s, extras: [] };
  const base = summarize(noExtras, month);
  const cushion = s.cushion[addMonths(month, 1)] ?? s.cushion[month] ?? 0;
  const weakBase = summarize(noExtras, month, { factor: incomeScenarioControl.initial / 100 });
  return { base, cushion, potential: Math.max(0, base.leftover - cushion), weakPotential: Math.max(0, weakBase.leftover - cushion) };
}
/** Months to reach a goal at a given monthly savings (null when nothing is allocated). */
export function goalMonthsAt(goal: Goal, monthly: number) {
  const allocation = Math.round(monthly * goal.share / 100);
  const remaining = Math.max(0, goal.target - goal.saved);
  return remaining === 0 ? 0 : allocation > 0 ? Math.ceil(remaining / allocation) : null;
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
      owner: payerLabel(s.names, d, 'Os dois'),
      current: installment ? installment.index + 1 : null,
      installments: d.installments, left: balance.left, remaining: balance.remaining,
      total: d.amount * d.installments, amount: d.amount, split: debtSplit(s, d),
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
  if (current < 1) return `Começa em ${monthLabel(d.firstDue.slice(0, 7))}. Ainda não entra nas contas deste mês.`;
  if (current > d.installments) return `Parcelas encerradas. Falta pagar: ${BRL(balance.remaining)}.`;
  const lastMonth = addMonths(month, d.installments - current);
  return `Parcela ${current} de ${d.installments} neste mês. ${current === d.installments ? 'É a última parcela.' : `Restam ${balance.left} (com esta): ${BRL(balance.remaining)}. Última em ${monthLabel(lastMonth)}.`}`;
}
export function personView(s: AppState, month: string, person: 0 | 1) {
  const sum = summarize(s, month);
  return { ...sum, available: sum.income[person] - sum.share[person] - sum.individual[person] - sum.freeMoney[person] };
}
export type DivisionMethod = 'prop' | 'half' | 'custom';
type DivisionState = AppState & { splitMethod?: DivisionMethod };
export const divisionControl = { min: 0, max: 100, step: 1 };
export function divisionChoice(s: AppState, month: string, method: DivisionMethod, custom = s.split[0]): DivisionState {
  const sum = summarize(s, month);
  const percent = method === 'half' ? 50 : method === 'prop'
    ? sum.totalIncome > 0 ? Math.round(sum.income[0] / sum.totalIncome * 100) : 50
    : Math.min(100, Math.max(0, custom));
  return { ...s, splitMethod: method, split: [percent, 100 - percent] };
}
export function divisionView(s: AppState, month: string) {
  const sum = summarize(s, month);
  const method = (s as DivisionState).splitMethod ?? (s.split[0] === 50 ? 'half' : 'custom');
  const totalBills = sum.sharedTotal + sum.individual[0] + sum.individual[1];
  const people = ([0, 1] as Person[]).map(person => {
    const accounts = sum.share[person] + sum.individual[person];
    const used = sum.income[person] > 0 ? (accounts + sum.freeMoney[person]) / sum.income[person] * 100 : 0;
    return { person, name: s.names[person], accounts,
      percent: Math.round(totalBills > 0 ? accounts / totalBills * 100 : s.split[person]),
      income: sum.income[person], freeMoney: sum.freeMoney[person],
      savings: personView(s, month, person).available,
      usedPercent: Math.round(used), meterPercent: Math.min(100, Math.max(0, Math.round(used))), hot: used > 90,
      weekly: s.weeklyFree[person] / 100 };
  });
  const notes = {
    prop: 'Cada um paga a mesma fatia da própria renda. Assim o aperto é parecido para os dois e quem ganha mais ajuda mais.',
    half: 'Cada um paga metade das contas. Funciona bem quando as rendas são parecidas. Aqui, quem ganha menos sente mais.',
    custom: 'Você escolhe a parte de cada um. Use quando um dos dois já paga algo por fora.',
  };
  const individualDebt = sum.items.some(item => item.kind === 'debt' && !item.shared);
  const events = transferPlan(s, month, `${month}-01`).map(event => ({
    ...event, who: event.person, day: Number(event.date.slice(8, 10)),
    label: event.reason.match(/ao receber "(.*)"\./)?.[1] ?? 'Transferência pendente',
  }));
  return { method, customPercent: s.split[0], people, events,
    note: notes[method] + (individualDebt ? ' As dívidas com um responsável ficam só com ele.' : '') };
}
export function divisionWeekly(s: AppState, person: Person, value: number): AppState {
  const weeklyFree: [number, number] = [...s.weeklyFree];
  weeklyFree[person] = Math.max(0, value);
  return { ...s, weeklyFree };
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
export interface FlowDay { day: number; balance: number; moves: Move[]; inflow: number; outflow: number }
/** Joint-account balance at the end of each day (day 0 is the opening balance). Uses the existing cash-flow moves. */
export function flowDays(s: AppState, month: string) {
  const cf = jointCashflow(s, month);
  const n = daysIn(month);
  const byDay: Move[][] = Array.from({ length: n + 1 }, () => []);
  // Pending transfers of a past month are dated today by the cash-flow model; keep them inside the month shown.
  for (const m of cf.moves) byDay[m.date.startsWith(month) ? Number(m.date.slice(8, 10)) : m.date > month ? n : 1]?.push(m);
  let balance = cf.start;
  const days: FlowDay[] = [{ day: 0, balance, moves: [], inflow: 0, outflow: 0 }];
  for (let d = 1; d <= n; d++) {
    const moves = byDay[d] ?? [];
    const inflow = moves.filter(m => m.type === 'entrada').reduce((a, m) => a + m.amount, 0);
    const outflow = moves.filter(m => m.type === 'saída').reduce((a, m) => a + m.amount, 0);
    balance += inflow - outflow;
    days.push({ day: d, balance, moves, inflow, outflow });
  }
  return { start: cf.start, carry: carryTotal(s, month), days, minBalance: cf.minBalance, needed: (s.cushion[month] ?? 0) + Math.max(0, -cf.minBalance) };
}

/** Round axis values: step chosen among 1, 2, 2.5, 5 and 10 times a power of ten. */
export function niceTicks(min: number, max: number, target = 5): number[] {
  const lo = Math.min(min, 0), hi = Math.max(max, 0);
  const span = hi - lo || 1;
  const raw = span / target, pow = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].map(m => m * pow).find(x => x >= raw) ?? raw);
  const out: number[] = [];
  for (let v = Math.floor(lo / step) * step; ; v += step) {
    out.push(Math.round(v * 100) / 100);
    if (v >= hi - step * 1e-9) break;
  }
  return out;
}

export interface OwnerDebtTotal { key: 'a' | 'b' | 'both'; name: string; monthly: number; remaining: number; count: number }
/** Debt totals for each person and for the couple (debts marked as shared). Remaining includes debts that have not started yet. */
export function debtOwnerTotals(s: AppState, month: string): OwnerDebtTotal[] {
  const monthly = summarize(s, month).items.filter(i => i.kind === 'debt');
  const groups: OwnerDebtTotal[] = [
    { key: 'a', name: s.names[0], monthly: 0, remaining: 0, count: 0 },
    { key: 'b', name: s.names[1], monthly: 0, remaining: 0, count: 0 },
    { key: 'both', name: 'Em conjunto', monthly: 0, remaining: 0, count: 0 },
  ];
  const pick = (shared: boolean, person: Person | null) => groups[shared || person === null ? 2 : person]!;
  const add = (d: Debt, field: 'monthly' | 'remaining', amount: number) => {
    if (d.splitA !== undefined) { const [a, b] = splitAmount(amount, clampPct(d.splitA)); groups[0]![field] += a; groups[1]![field] += b; }
    else pick(d.shared, d.person)[field] += amount;
  };
  for (const d of s.debts) {
    const bal = debtSummary(d);
    add(d, 'remaining', bal.remaining);
    if (!bal.done) { if (d.splitA !== undefined) { groups[0]!.count += 1; groups[1]!.count += 1; } else pick(d.shared, d.person).count += 1; }
  }
  for (const i of monthly) {
    const d = s.debts.find(x => x.id === i.refId);
    if (d) add(d, 'monthly', i.amount);
  }
  return groups;
}

export type PayerMode = 'default' | 'a' | 'b' | 'custom';
export const payerModeOf = (x: { shared: boolean; person: Person | null; splitA?: number | undefined }): PayerMode =>
  x.splitA !== undefined ? 'custom' : x.shared || x.person === null ? 'default' : x.person === 0 ? 'a' : 'b';
/** Sets who pays a bill or debt: both by the chosen method, one person, or an own percentage. Applies to every month of that bill/debt. */
export function setItemPayer(s: AppState, item: { kind: 'bill' | 'debt'; refId: string }, mode: PayerMode, pct = 50): AppState {
  const patch = mode === 'custom' ? { shared: false, person: null, splitA: clampPct(pct) }
    : mode === 'default' ? { shared: true, person: null, splitA: undefined }
    : { shared: false, person: (mode === 'a' ? 0 : 1) as Person, splitA: undefined };
  return item.kind === 'bill'
    ? { ...s, bills: s.bills.map(b => b.id === item.refId ? { ...b, ...patch } : b) }
    : { ...s, debts: s.debts.map(d => d.id === item.refId ? { ...d, ...patch } : d) };
}

export interface PayerRow { key: string; kind: 'bill' | 'debt'; refId: string; name: string; amount: number; mode: PayerMode; pctA: number; partA: number; partB: number }
/** This month's bills and debt installments with who pays each one. */
export function payerRows(s: AppState, month: string): PayerRow[] {
  return summarize(s, month).items.map(i => {
    const raw = i.kind === 'bill' ? s.bills.find(b => b.id === i.refId) : s.debts.find(d => d.id === i.refId);
    const mode = raw ? payerModeOf(raw) : 'default';
    const pctA = clampPct(raw?.splitA ?? 50);
    const [partA, partB] = splitAmount(i.amount, pctA);
    return { key: i.key, kind: i.kind, refId: i.refId, name: i.name, amount: i.amount, mode, pctA, partA, partB };
  });
}

export interface DebtSplit { pctA: number; installment: [number, number]; total: [number, number]; remaining: [number, number] }
/** What each person owes of a debt held together (or with an own split); null when one person owns it alone. */
export function debtSplit(s: AppState, d: Debt): DebtSplit | null {
  if (d.splitA === undefined && !(d.shared || d.person === null)) return null;
  const pctA = d.splitA !== undefined ? clampPct(d.splitA) : s.split[0];
  return { pctA, installment: splitAmount(d.amount, pctA), total: splitAmount(d.amount * d.installments, pctA), remaining: splitAmount(debtSummary(d).remaining, pctA) };
}
