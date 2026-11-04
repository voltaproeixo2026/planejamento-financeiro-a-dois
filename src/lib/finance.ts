// Centralized financial model and calculations. All money values are integer cents.

export type Person = 0 | 1;
export type Freq = "monthly" | "biweekly" | "weekly";

export interface Income {
  id: string;
  desc: string;
  person: Person;
  amount: number; // cents per occurrence
  freq: Freq;
  day: number; // monthly/biweekly: day of month (1-31); weekly: weekday 0-6
  active: boolean;
  autonomous: boolean;
}
export interface Extra { id: string; desc: string; amount: number; person: Person; date: string; month: string }
export interface Bill {
  id: string; name: string; category: string; amount: number; day: number;
  person: Person | null; shared: boolean; start: string; end?: string | undefined;
  paid: Record<string, boolean>; // month -> paid
  /** Optional value changes by month ("YYYY-MM" -> cents). A value holds from that month on, until the next change. */
  values?: Record<string, number> | undefined;
}
export interface Debt {
  id: string; name: string; total: number; installments: number; amount: number;
  paidCount: number; firstDue: string; person: Person | null; shared: boolean;
  overrides?: Record<number, number> | undefined; // installment index -> custom amount
  origin?: string;
  ref?: number;
  ref_ym?: string;
}
export interface Transfer { id: string; person: Person; amount: number; date: string; month: string }

export interface AppState {
  names: [string, string];
  incomes: Income[];
  extras: Extra[];
  bills: Bill[];
  debts: Debt[];
  split: [number, number];
  weeklyFree: [number, number];
  freeWeekday: number;
  cushion: Record<string, number>;
  transfers: Transfer[];
  savedReal: number;
  isExample: boolean;
}

export const BRL = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const toCents = (v: string | number) => Math.round(Number(String(v).replace(",", ".")) * 100) || 0;
export const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return d ? `${d}/${m}/${y}` : `${m}/${y}`;
};
const parseMonth = (m: string): [number, number] => {
  const [y, mo] = m.split("-").map(Number);
  return [y ?? 0, mo ?? 1];
};
export const monthLabel = (m: string) => {
  const [y, mo] = parseMonth(m);
  return new Date(y, mo - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};
export const uid = () => Math.random().toString(36).slice(2, 10);

export const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const addMonths = (m: string, n: number) => {
  const [y, mo] = parseMonth(m);
  return ym(new Date(y, mo - 1 + n, 1));
};
export const monthsBetween = (a: string, b: string) => {
  const [ya, ma] = parseMonth(a);
  const [yb, mb] = parseMonth(b);
  return (yb - ya) * 12 + (mb - ma);
};
export const daysIn = (m: string) => {
  const [y, mo] = parseMonth(m);
  return new Date(y, mo, 0).getDate();
};
const iso = (m: string, day: number) => `${m}-${String(Math.min(day, daysIn(m))).padStart(2, "0")}`;

/** Dates in the month on which a given weekday occurs (not assuming 4 per month). */
export function weekdayDates(m: string, weekday: number): string[] {
  const [y, mo] = parseMonth(m);
  const out: string[] = [];
  for (let d = 1; d <= daysIn(m); d++) if (new Date(y, mo - 1, d).getDay() === weekday) out.push(iso(m, d));
  return out;
}

/** Receipt dates and amounts of an income in a month. factor applies to autonomous incomes (simulation). */
export function incomeReceipts(inc: Income, m: string, factor = 1) {
  if (!inc.active) return [];
  const amt = Math.round(inc.amount * (inc.autonomous ? factor : 1));
  if (inc.freq === "monthly") return [{ date: iso(m, inc.day), amount: amt }];
  if (inc.freq === "biweekly") {
    const d2 = inc.day + 15 > daysIn(m) ? inc.day - 15 : inc.day + 15;
    return [inc.day, d2].sort((a, b) => a - b).map((d) => ({ date: iso(m, Math.max(1, d)), amount: amt }));
  }
  return weekdayDates(m, inc.day).map((date) => ({ date, amount: amt }));
}

export interface Item {
  key: string; kind: "bill" | "debt"; refId: string; name: string; date: string;
  amount: number; paid: boolean; shared: boolean; person: Person | null; installment?: number;
}

export function debtInstallment(d: Debt, m: string) {
  const k = debtCur(d, m) - 1;
  if (k < 0 || k >= d.installments) return null;
  return { index: k, amount: d.overrides?.[k] ?? d.amount, paid: k < d.paidCount, date: iso(m, Number(d.firstDue.slice(8, 10))) };
}

/** Optional reference metadata keeps existing debts backwards compatible. */
export function debtCur(d: Debt, month: string) {
  if (d.ref !== undefined && d.ref_ym) return d.ref + monthsBetween(d.ref_ym, month);
  return monthsBetween(d.firstDue.slice(0, 7), month) + 1;
}

export function editDebt(d: Debt, patch: Partial<Debt>, month: string, current?: number): Debt {
  const next = { ...d, ...patch };
  if (current !== undefined) {
    if (!Number.isInteger(current) || current < 1) return d;
    next.ref = current;
    next.ref_ym = month;
    next.firstDue = `${addMonths(month, 1 - current)}-${d.firstDue.slice(8, 10)}`;
  }
  next.total = next.amount * next.installments;
  return next;
}

export function newDebt(month: string): Debt {
  return { id: uid(), name: 'Nova dívida', origin: '', amount: 0, total: 0, installments: 10,
    paidCount: 0, firstDue: `${month}-10`, person: 0, shared: false, ref: 1, ref_ym: month };
}

/** Is the fixed bill in force in month m (from start to end, both included)? */
export const billActive = (b: Bill, m: string) => m >= b.start && !(b.end && m > b.end);

/** Month the bill's value for m was last set in (start month when never changed). */
export function billValueMonth(b: Bill, m: string): string {
  let best = b.start;
  for (const k of Object.keys(b.values ?? {})) if (k <= m && k > best) best = k;
  return best;
}

/** Value of a fixed bill in month m: the last value set at or before m, else the original amount. */
export function billAmount(b: Bill, m: string): number {
  const k = billValueMonth(b, m);
  return b.values?.[k] ?? b.amount;
}

/** Changes only the value of month m (and the following months, until the next change). */
export function setBillMonthValue(b: Bill, m: string, cents: number): Bill {
  const next: Bill = { ...b, values: { ...b.values, [m]: cents } };
  if (m === b.start) next.amount = cents;
  return next;
}

export type RepeatResult = { bill: Bill; status: "created" | "exists" };
/** Launches the bill in the next month with the same name, category and value. A bill that ended this month goes on. */
export function repeatBill(b: Bill, m: string): RepeatResult {
  const next = addMonths(m, 1);
  if (billActive(b, next) && b.values && next in b.values) return { bill: b, status: "exists" };
  const bill: Bill = { ...b, values: { ...b.values, [next]: billAmount(b, m) } };
  if (b.end && b.end < next) bill.end = next;
  return { bill, status: "created" };
}

/** Marks m as the last month of the bill. */
export function lastTimeBill(b: Bill, m: string): Bill {
  return { ...b, end: m, values: Object.fromEntries(Object.entries(b.values ?? {}).filter(([k]) => k <= m)) };
}

/** Stops the bill from month m on. Returns null when nothing would be left (the bill started in m or later). */
export function stopBillFrom(b: Bill, m: string): Bill | null {
  const prev = addMonths(m, -1);
  return prev < b.start ? null : lastTimeBill(b, prev);
}

export function itemsForMonth(s: AppState, m: string): Item[] {
  const items: Item[] = [];
  for (const b of s.bills) {
    if (!billActive(b, m)) continue;
    items.push({ key: `b-${b.id}-${m}`, kind: "bill", refId: b.id, name: b.name, date: iso(m, b.day), amount: billAmount(b, m), paid: !!b.paid[m], shared: b.shared, person: b.person });
  }
  for (const d of s.debts) {
    const i = debtInstallment(d, m);
    if (!i) continue;
    items.push({ key: `d-${d.id}-${m}`, kind: "debt", refId: d.id, name: `${d.name} (${i.index + 1}/${d.installments})`, date: i.date, amount: i.amount, paid: i.paid, shared: d.shared, person: d.person, installment: i.index });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

export function debtSummary(d: Debt) {
  let paid = 0, remaining = 0;
  for (let k = 0; k < d.installments; k++) {
    const a = d.overrides?.[k] ?? d.amount;
    if (k < d.paidCount) paid += a; else remaining += a;
  }
  return { paid, remaining, left: d.installments - d.paidCount, done: d.paidCount >= d.installments };
}

/** Splits an amount by percentages without losing cents. */
export function splitAmount(total: number, pct0: number): [number, number] {
  const a = Math.round((total * pct0) / 100);
  return [a, total - a];
}

export interface MonthSummary {
  income: [number, number]; recurring: [number, number]; extras: [number, number];
  totalIncome: number; items: Item[]; paid: number; pending: number; overdue: Item[];
  sharedTotal: number; share: [number, number]; individual: [number, number];
  freeMoney: [number, number]; leftover: number; debtInstallments: number;
  transferred: [number, number]; needTransfer: [number, number];
}

export function summarize(s: AppState, m: string, opts: { factor?: number | undefined; today?: string | undefined } = {}): MonthSummary {
  const factor = opts.factor ?? 1;
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const recurring: [number, number] = [0, 0];
  for (const inc of s.incomes) for (const r of incomeReceipts(inc, m, factor)) recurring[inc.person] += r.amount;
  const extras: [number, number] = [0, 0];
  if (factor === 1 || opts.factor === undefined) for (const e of s.extras) if (e.month === m) extras[e.person] += e.amount;
  const income: [number, number] = [recurring[0] + extras[0], recurring[1] + extras[1]];
  const items = itemsForMonth(s, m);
  const paid = items.filter((i) => i.paid).reduce((a, i) => a + i.amount, 0);
  const pending = items.filter((i) => !i.paid).reduce((a, i) => a + i.amount, 0);
  const overdue = items.filter((i) => !i.paid && i.date < today);
  const sharedTotal = items.filter((i) => i.shared).reduce((a, i) => a + i.amount, 0);
  const share = splitAmount(sharedTotal, s.split[0]);
  const individual: [number, number] = [0, 0];
  for (const i of items) if (!i.shared && i.person !== null) individual[i.person] += i.amount;
  const weeks = weekdayDates(m, s.freeWeekday).length;
  const freeMoney: [number, number] = [s.weeklyFree[0] * weeks, s.weeklyFree[1] * weeks];
  const totalIncome = income[0] + income[1];
  const leftover = totalIncome - (paid + pending) - freeMoney[0] - freeMoney[1];
  const debtInstallments = items.filter((i) => i.kind === "debt").reduce((a, i) => a + i.amount, 0);
  const transferred: [number, number] = [0, 0];
  for (const t of s.transfers) if (t.month === m) transferred[t.person] += t.amount;
  const cushion = s.cushion[m] ?? 0;
  // Cushion in the joint account reduces what must be transferred, split by the same rule.
  const cushionShare = splitAmount(Math.min(cushion, sharedTotal), s.split[0]);
  const needTransfer: [number, number] = [
    Math.max(0, share[0] - cushionShare[0] - transferred[0]),
    Math.max(0, share[1] - cushionShare[1] - transferred[1]),
  ];
  return { income, recurring, extras, totalIncome, items, paid, pending, overdue, sharedTotal, share, individual, freeMoney, leftover, debtInstallments, transferred, needTransfer };
}

/** Spreads each person's remaining need across their upcoming receipts, proportional to receipt size. */
export function transferPlan(s: AppState, m: string, today = new Date().toISOString().slice(0, 10)) {
  const sum = summarize(s, m, { today });
  const plan: { person: Person; date: string; amount: number; reason: string }[] = [];
  ([0, 1] as Person[]).forEach((p) => {
    let need = sum.needTransfer[p];
    if (need <= 0) return;
    const receipts = s.incomes.filter((i) => i.person === p).flatMap((i) => incomeReceipts(i, m).map((r) => ({ ...r, desc: i.desc })))
      .concat(s.extras.filter((e) => e.person === p && e.month === m).map((e) => ({ date: e.date, amount: e.amount, desc: e.desc })))
      .filter((r) => r.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    if (!receipts.length) {
      plan.push({ person: p, date: today, amount: need, reason: "Nenhum recebimento restante no mês — valor pendente da sua parte." });
      return;
    }
    const total = receipts.reduce((a, r) => a + r.amount, 0);
    receipts.forEach((r, idx) => {
      const amt = idx === receipts.length - 1 ? need : Math.min(need, Math.round((sum.needTransfer[p] * r.amount) / total));
      need -= amt;
      if (amt > 0) plan.push({ person: p, date: r.date, amount: amt, reason: `Parte de ${s.split[p]}% das contas compartilhadas, ao receber "${r.desc}".` });
    });
  });
  return plan.sort((a, b) => a.date.localeCompare(b.date));
}

export interface Move { date: string; desc: string; type: "entrada" | "saída"; amount: number; status: "realizado" | "previsto"; balance: number }

export function jointCashflow(s: AppState, m: string, today = new Date().toISOString().slice(0, 10)) {
  const moves: Omit<Move, "balance">[] = [];
  for (const t of s.transfers.filter((t) => t.month === m))
    moves.push({ date: t.date, desc: `Transferência de ${s.names[t.person]}`, type: "entrada", amount: t.amount, status: "realizado" });
  for (const p of transferPlan(s, m, today))
    moves.push({ date: p.date, desc: `Transferência prevista de ${s.names[p.person]}`, type: "entrada", amount: p.amount, status: "previsto" });
  for (const i of itemsForMonth(s, m).filter((i) => i.shared))
    moves.push({ date: i.date, desc: i.name, type: "saída", amount: i.amount, status: i.paid ? "realizado" : "previsto" });
  moves.sort((a, b) => a.date.localeCompare(b.date) || (a.type === "entrada" ? -1 : 1));
  const start = s.cushion[m] ?? 0;
  let bal = start, current = start;
  const out: Move[] = moves.map((mv) => {
    bal += mv.type === "entrada" ? mv.amount : -mv.amount;
    if (mv.status === "realizado") current += mv.type === "entrada" ? mv.amount : -mv.amount;
    return { ...mv, balance: bal };
  });
  return { start, moves: out, current, projectedEnd: bal, minBalance: Math.min(start, ...out.map((o) => o.balance)) };
}

export function projection(s: AppState, from: string, months: number, factor = 1) {
  return Array.from({ length: months }, (_, i) => {
    const m = addMonths(from, i);
    const sum = summarize(s, m, { factor: factor === 1 ? undefined : factor });
    const debtsLeft = s.debts.reduce((a, d) => {
      let r = 0;
      for (let k = 0; k < d.installments; k++) {
        const due = addMonths(d.firstDue.slice(0, 7), k);
        if (k >= d.paidCount && due > m) r += d.overrides?.[k] ?? d.amount;
      }
      return a + r;
    }, 0);
    return { month: m, income: sum.totalIncome, expenses: sum.paid + sum.pending + sum.freeMoney[0] + sum.freeMoney[1], leftover: sum.leftover, debtsLeft };
  });
}

export function forecast(s: AppState, from: string, count: number) {
  return projection(s, from, count).map((p, k, all) => ({
    ...p, installments: summarize(s, p.month).debtInstallments,
    variation: k === 0 ? null : summarize(s, p.month).debtInstallments - summarize(s, all[k - 1]?.month ?? p.month).debtInstallments,
    debts: s.debts.map(d => ({ id: d.id, current: debtCur(d, p.month), total: d.installments, installment: debtInstallment(d, p.month) })),
  }));
}

export function debtChanges(s: AppState, from: string, count: number) {
  const changes: { id: string; label: 'Termina' | 'Começa'; name: string; month: string; previousMonth: string; amount: number }[] = [];
  for (let k = 1; k < count; k++) {
    const month = addMonths(from, k), previousMonth = addMonths(month, -1);
    for (const d of s.debts) {
      const previous = debtInstallment(d, previousMonth), current = debtInstallment(d, month);
      if (previous && !current) changes.push({ id: `${d.id}-${month}`, label: 'Termina', name: d.name, month, previousMonth, amount: previous.amount });
      else if (!previous && current) changes.push({ id: `${d.id}-${month}`, label: 'Começa', name: d.name, month, previousMonth, amount: current.amount });
    }
  }
  return changes;
}

export function alerts(s: AppState, m: string, today = new Date().toISOString().slice(0, 10)) {
  const out: { level: "danger" | "warn" | "info"; text: string }[] = [];
  const sum = summarize(s, m, { today });
  for (const o of sum.overdue) out.push({ level: "danger", text: `${o.name} venceu em ${fmtDate(o.date)} — ${BRL(o.amount)}` });
  const soon = new Date(today); soon.setDate(soon.getDate() + 5);
  const soonIso = soon.toISOString().slice(0, 10);
  for (const i of sum.items.filter((i) => !i.paid && i.date >= today && i.date <= soonIso))
    out.push({ level: "warn", text: `${i.name} vence em ${fmtDate(i.date)} — ${BRL(i.amount)}` });
  if (sum.leftover < 0) out.push({ level: "danger", text: `Despesas superam as receitas do mês em ${BRL(-sum.leftover)}` });
  const cf = jointCashflow(s, m, today);
  if (cf.minBalance < 0) out.push({ level: "danger", text: `A conta conjunta fica negativa em algum momento do mês (mínimo ${BRL(cf.minBalance)})` });
  ([0, 1] as Person[]).forEach((p) => {
    if (sum.needTransfer[p] > 0) out.push({ level: "info", text: `${s.names[p]} ainda precisa transferir ${BRL(sum.needTransfer[p])} para a conta conjunta` });
  });
  const auto = s.incomes.filter((i) => i.autonomous && i.active);
  if (auto.length) {
    const sim = summarize(s, m, { factor: 0.7 });
    if (sim.leftover < 0) out.push({ level: "warn", text: `Se a renda autônoma vier 30% menor, faltariam ${BRL(-sim.leftover)}` });
  }
  const open = s.debts.filter((d) => !debtSummary(d).done);
  if (open.length) out.push({ level: "info", text: `${open.length} dívida(s) com parcelas futuras — saldo ${BRL(open.reduce((a, d) => a + debtSummary(d).remaining, 0))}` });
  return out;
}

export function exampleState(today = new Date()): AppState {
  const m = ym(today);
  return {
    names: ["Bianca", "Julio"],
    incomes: [
      { id: uid(), desc: "Salário", person: 0, amount: 520000, freq: "monthly", day: 5, active: true, autonomous: false },
      { id: uid(), desc: "Serviços autônomos", person: 1, amount: 220000, freq: "biweekly", day: 10, active: true, autonomous: true },
    ],
    extras: [],
    bills: [
      { id: uid(), name: "Aluguel", category: "Moradia", amount: 220000, day: 10, person: null, shared: true, start: m, paid: {} },
      { id: uid(), name: "Mercado", category: "Alimentação", amount: 120000, day: 15, person: null, shared: true, start: m, paid: {} },
      { id: uid(), name: "Internet", category: "Casa", amount: 12000, day: 20, person: null, shared: true, start: m, paid: {} },
      { id: uid(), name: "Celular Bianca", category: "Pessoal", amount: 6000, day: 12, person: 0, shared: false, start: m, paid: {} },
    ],
    debts: [
      { id: uid(), name: "Geladeira", total: 360000, installments: 10, amount: 36000, paidCount: 3, firstDue: `${addMonths(m, -3)}-08`, person: null, shared: true },
    ],
    split: [50, 50],
    weeklyFree: [15000, 15000],
    freeWeekday: 1,
    cushion: { [m]: 50000 },
    transfers: [],
    savedReal: 0,
    isExample: true,
  };
}

export function emptyState(names: [string, string]): AppState {
  return { names, incomes: [], extras: [], bills: [], debts: [], split: [50, 50], weeklyFree: [0, 0], freeWeekday: 1, cushion: {}, transfers: [], savedReal: 0, isExample: false };
}
