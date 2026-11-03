/**
 * Lógica de cálculo do Contas do Casal.
 * É um porte fiel da página atual (funções puras, sem tela e sem banco).
 * NÃO reescreva estas funções dentro de componentes: importe daqui.
 *
 * Convenções:
 * - "ym" é o índice do mês: ano * 12 + (mês de 0 a 11). Ex.: outubro de 2026 = 2026 * 12 + 9 = 24321.
 * - O mês é tratado como 30 dias. Dias de vencimento ficam entre 1 e 30.
 * - "a" e "b" são as duas pessoas. Quem é quem vem dos nomes na tabela config.
 */

export type Who = "a" | "b";
export type Owner = Who | "both";
export type Method = "prop" | "half" | "custom";
export type CatKey = "divida" | "casa" | "alim" | "pet" | "outros";
export type Freq = "mensal" | "quinzenal" | "semanal";

export interface Income { id: string; owner: Who; kind: "fixa" | "autonoma"; label: string; amount: number; day: number }
/**
 * Conta fixa de UM mês.
 * - ym: mês a que esta linha se refere.
 * - seriesId: identifica a mesma conta ao longo dos meses (Água de outubro e Água de novembro têm o mesmo seriesId).
 * - isLast: esta é a última vez que a conta aparece (não repete nos meses seguintes).
 * Sem ym, a conta vale para todos os meses (formato antigo).
 */
export interface Bill { id: string; name: string; cat: CatKey; amount: number; freq: Freq; day: number; ym?: number; seriesId?: string; isLast?: boolean }
export interface Debt { id: string; name: string; origin: string; owner: Owner; amount: number; total: number; ref: number; refYM: number; day: number }
export interface Extra { id: string; ym: number; owner: Who; label: string; amount: number; day: number }
export interface Goal { id: string; name: string; target: number; saved: number; share: number }

export interface FinanceState {
  method: Method;
  customPctA: number;
  weak: number; // % da renda autônoma no cenário de mês fraco (30 a 100)
  start: number; // saldo da conta conjunta no dia 1
  weekly: { a: number; b: number }; // dinheiro livre por semana
  incomes: Income[];
  bills: Bill[];
  debts: Debt[];
  extras: Extra[];
  goals: Goal[];
}

export const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
export const num = (v: unknown): number => {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};
export const dayOf = (v: unknown) => clamp(Math.round(num(v)) || 1, 1, 30);

/** Índice do mês de uma data (usa o fuso do aparelho). */
export const monthIndex = (d: Date = new Date()) => d.getFullYear() * 12 + d.getMonth();

export function monthlyOf(b: Pick<Bill, "amount" | "freq">): number {
  const a = num(b.amount);
  return b.freq === "semanal" ? (a * 52) / 12 : b.freq === "quinzenal" ? a * 2 : a;
}

/** Texto do campo <input type="month"> ("2026-11") para o índice do mês, e de volta. */
export const inputToYm = (v: string): number => {
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  return m ? Number(m[1]) * 12 + (Number(m[2]) - 1) : NaN;
};
export const ymToInput = (ym: number): string => `${Math.floor(ym / 12)}-${String((ym % 12) + 1).padStart(2, "0")}`;

/**
 * Contas fixas valendo em um mês.
 * Cada conta (seriesId) usa a linha do próprio mês; se não houver, repete a linha mais recente de um mês anterior.
 * Linhas marcadas como última (isLast) não repetem nos meses seguintes.
 */
export function billsForMonth(all: Bill[], ym: number): Bill[] {
  const best = new Map<string, Bill>();
  for (const b of all || []) {
    const bym = b.ym ?? -Infinity;
    if (bym > ym) continue;
    const key = b.seriesId ?? b.id;
    const cur = best.get(key);
    if (!cur || bym > (cur.ym ?? -Infinity)) best.set(key, b);
  }
  return Array.from(best.values()).filter((b) => !(b.isLast && (b.ym ?? -Infinity) < ym));
}

export function sumIncome(s: Pick<FinanceState, "incomes">, who: Who, autonomaFactor?: number): number {
  return s.incomes
    .filter((i) => i.owner === who)
    .reduce((t, i) => t + num(i.amount) * (autonomaFactor !== undefined && i.kind === "autonoma" ? autonomaFactor : 1), 0);
}

export function extrasOf(s: Pick<FinanceState, "extras">, who: Who, ym: number): number {
  return (s.extras || []).filter((x) => x.owner === who && Number(x.ym) === ym).reduce((t, x) => t + num(x.amount), 0);
}

/** Número da parcela no mês `now`, a partir da parcela de referência e do mês em que ela foi informada. */
export function debtCur(d: Pick<Debt, "ref" | "refYM">, now: number): number {
  const ref = Math.round(num(d.ref)) || 1;
  const r = Number(d.refYM);
  return ref + (now - (Number.isFinite(r) && r > 0 ? r : now));
}

export type DebtStatus = "ativa" | "futura" | "quitada";
export interface DebtInfo {
  total: number; amt: number; cur: number; left: number; active: boolean; status: DebtStatus;
  grand: number; remaining: number; endYM: number; startYM: number;
}
export function debtInfo(d: Debt, now: number): DebtInfo {
  const total = Math.max(1, Math.round(num(d.total)) || 1);
  const amt = num(d.amount);
  const cur = debtCur(d, now);
  const left = cur > total ? 0 : total - Math.max(cur, 1) + 1;
  return {
    total, amt, cur, left,
    active: cur >= 1 && cur <= total,
    status: cur > total ? "quitada" : cur < 1 ? "futura" : "ativa",
    grand: amt * total,
    remaining: amt * left,
    endYM: now + (total - cur),
    startYM: now + (1 - cur),
  };
}

export interface DebtView extends DebtInfo { d: Debt }

export function compute(s: FinanceState, now: number) {
  const debts: DebtView[] = (s.debts || []).map((d) => ({ d, ...debtInfo(d, now) }));
  let dA = 0, dB = 0, dS = 0;
  debts.forEach((x) => {
    if (!x.active) return;
    if (x.d.owner === "a") dA += x.amt;
    else if (x.d.owner === "b") dB += x.amt;
    else dS += x.amt;
  });
  const debtsMonth = dA + dB + dS;
  const debtsLeft = debts.reduce((t, x) => t + x.remaining, 0);
  const monthBills = billsForMonth(s.bills, now);
  const billsGen = monthBills.reduce((t, b) => t + monthlyOf(b), 0);
  const bills = billsGen + debtsMonth;

  const baseA = sumIncome(s, "a"), baseB = sumIncome(s, "b");
  const exA = extrasOf(s, "a", now), exB = extrasOf(s, "b", now);
  const incA = baseA + exA, incB = baseB + exB, inc = incA + incB;

  const shared = billsGen + dS; // contas divididas pela regra escolhida
  const pctS = s.method === "half" ? 0.5 : s.method === "custom" ? clamp(num(s.customPctA), 0, 100) / 100 : inc > 0 ? incA / inc : 0.5;
  const shareA = shared * pctS + dA; // dívidas com responsável ficam só com ele
  const shareB = shared - shared * pctS + dB;
  const pctA = bills > 0 ? shareA / bills : pctS;

  const livreA = (num(s.weekly.a) * 52) / 12, livreB = (num(s.weekly.b) * 52) / 12;
  const sobraA = incA - shareA - livreA, sobraB = incB - shareB - livreB, sobra = sobraA + sobraB;

  // Mês fraco: autônoma reduzida e SEM extras
  const w = clamp(num(s.weak), 0, 100) / 100;
  const sobraWeak = sumIncome(s, "a", w) + sumIncome(s, "b", w) - bills - livreA - livreB;

  const cats: Record<CatKey, number> = { divida: 0, casa: 0, alim: 0, pet: 0, outros: 0 };
  monthBills.forEach((b) => {
    const k: CatKey = cats[b.cat] === undefined ? "outros" : b.cat;
    cats[k] += monthlyOf(b);
  });
  cats.divida += debtsMonth;

  return { now, monthBills, baseA, baseB, exA, exB, bills, incA, incB, inc, pctA, shareA, shareB, livreA, livreB, sobraA, sobraB, sobra, sobraWeak, cats, debts, debtsMonth, debtsLeft };
}
export type Computed = ReturnType<typeof compute>;

export interface FlowEvent { day: number; label: string; amt: number; who?: Who; extra?: boolean; after?: number }

/** Movimentos da conta conjunta no mês (transferências de cada um e contas a pagar) e saldo dia a dia. */
export function flow(s: FinanceState, c: Computed) {
  const ev: FlowEvent[] = [];
  s.incomes.forEach((i) => {
    const amt = num(i.amount);
    const tot = i.owner === "a" ? c.incA : c.incB;
    const share = i.owner === "a" ? c.shareA : c.shareB;
    if (amt > 0 && tot > 0) ev.push({ day: dayOf(i.day), label: i.label || "Renda", who: i.owner, amt: (share * amt) / tot });
  });
  (s.extras || []).forEach((x) => {
    if (Number(x.ym) !== c.now) return;
    const amt = num(x.amount);
    const tot = x.owner === "a" ? c.incA : c.incB;
    const share = x.owner === "a" ? c.shareA : c.shareB;
    if (amt > 0 && tot > 0) ev.push({ day: dayOf(x.day), label: x.label || "Extra", who: x.owner, amt: (share * amt) / tot, extra: true });
  });
  c.monthBills.forEach((b) => {
    const a = num(b.amount);
    if (a <= 0) return;
    const d = dayOf(b.day);
    let days: number[];
    if (b.freq === "semanal") {
      days = [];
      for (let k = ((d - 1) % 7) + 1; k <= 30; k += 7) days.push(k);
    } else if (b.freq === "quinzenal") days = [d, d <= 15 ? d + 15 : d - 15];
    else days = [d];
    days.forEach((x) => ev.push({ day: x, label: b.name || "Conta", amt: -a }));
  });
  c.debts.forEach((x) => {
    if (x.active && x.amt > 0) ev.push({ day: dayOf(x.d.day), label: `${x.d.name || "Dívida"} (${x.cur}/${x.total})`, amt: -x.amt });
  });
  ev.sort((p, q) => p.day - q.day || Number(q.amt > 0) - Number(p.amt > 0));

  const series = (start: number) => {
    const bal = [start];
    let cur = start;
    for (let d = 1; d <= 30; d++) {
      ev.forEach((e) => { if (e.day === d) cur += e.amt; });
      bal.push(cur);
    }
    return bal;
  };
  const bal = series(num(s.start));
  const buffer = Math.max(0, -Math.min(...series(0)));
  let min = Infinity, minDay = 1;
  for (let d = 1; d <= 30; d++) if (bal[d] < min) { min = bal[d]; minDay = d; }
  let cur = num(s.start);
  const list = ev.map((e) => { cur += e.amt; return { ...e, after: cur }; });
  return { ev: list, bal, buffer, min, minDay };
}
export type Flow = ReturnType<typeof flow>;

/** Meses até juntar `remaining` poupando `monthly` por mês. null = não avança. */
export function goalMonths(remaining: number, monthly: number): number | null {
  if (remaining <= 0) return 0;
  if (monthly <= 0) return null;
  return Math.ceil(remaining / monthly);
}

/** Cálculo de n meses a partir de `now` (mês atual = índice 0). */
export function forecast(s: FinanceState, n: number, now: number): Computed[] {
  const out: Computed[] = [];
  for (let k = 0; k < n; k++) out.push(compute(s, now + k));
  return out;
}

export interface DebtChange { kind: "termina" | "comeca"; ym: number; debtId: string; name: string; amount: number }

/** Parcelas que terminam ou começam ao longo da previsão. `ym` é o primeiro mês com a mudança. */
export function debtChanges(list: Computed[]): DebtChange[] {
  const out: DebtChange[] = [];
  for (let k = 1; k < list.length; k++) {
    list[k].debts.forEach((x) => {
      const p = list[k - 1].debts.find((y) => y.d.id === x.d.id);
      if (!p) return;
      if (p.active && !x.active && x.status === "quitada") out.push({ kind: "termina", ym: list[k].now, debtId: x.d.id, name: x.d.name, amount: p.amt });
      else if (!p.active && x.active) out.push({ kind: "comeca", ym: list[k].now, debtId: x.d.id, name: x.d.name, amount: x.amt });
    });
  }
  return out;
}

/** Saudação pela hora do aparelho. */
export function greeting(date: Date = new Date()): string {
  const h = date.getHours();
  return h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";
}

/** Situação do mês até hoje, pelos dias de vencimento (hoje conta como "falta pagar"). */
export function monthStatus(f: Flow, today: number) {
  const td = clamp(today, 1, 30);
  const outs = f.ev.filter((e) => e.amt < 0 && !e.who);
  const paid = outs.filter((e) => e.day < td).reduce((t, e) => t - e.amt, 0);
  const todo = outs.filter((e) => e.day >= td);
  const remaining = todo.reduce((t, e) => t - e.amt, 0);
  return { paid, remaining, todo, total: paid + remaining };
}
