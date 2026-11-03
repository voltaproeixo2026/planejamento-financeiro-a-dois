import { describe, expect, it } from "vitest";
import { billsForMonth, compute, debtChanges, debtInfo, flow, forecast, goalMonths, greeting, inputToYm, monthIndex, monthStatus, ymToInput, type Bill, type FinanceState } from "./finance";

// Outubro de 2026 = 2026 * 12 + 9
const NOW = 24321;

const base = (): FinanceState => ({
  method: "prop",
  customPctA: 60,
  weak: 70,
  start: 700,
  weekly: { a: 40, b: 40 },
  incomes: [
    { id: "i1", owner: "a", kind: "fixa", label: "Salário", amount: 2200, day: 7 },
    { id: "i2", owner: "b", kind: "autonoma", label: "Autônoma", amount: 900, day: 15 },
  ],
  bills: [{ id: "b1", name: "Água", cat: "casa", amount: 70, freq: "mensal", day: 8 }],
  debts: [
    { id: "d1", name: "Financiamento", origin: "Banco", owner: "both", amount: 650, total: 48, ref: 12, refYM: NOW, day: 10 },
    { id: "d2", name: "Cartão do pai", origin: "Cartão", owner: "b", amount: 400, total: 10, ref: 9, refYM: NOW, day: 12 },
  ],
  extras: [
    { id: "x1", ym: NOW, owner: "b", label: "Personal a mais", amount: 300, day: 20 },
    { id: "x2", ym: NOW + 1, owner: "b", label: "Outro", amount: 100, day: 5 },
  ],
  goals: [],
});

const r = Math.round;

describe("extras de renda", () => {
  it("somam na renda do mês e só naquele mês", () => {
    const sem = compute({ ...base(), extras: [] }, NOW);
    const com = compute(base(), NOW);
    expect(r(sem.inc)).toBe(3100);
    expect(r(com.inc)).toBe(3400);
    expect(com.incB).toBe(1200);
    expect(r(com.sobra - sem.sobra)).toBe(300);
    expect(r(compute(base(), NOW + 1).inc)).toBe(3200);
    expect(r(compute(base(), NOW + 2).inc)).toBe(3100);
  });

  it("não entram no cenário de mês fraco", () => {
    expect(r(compute(base(), NOW).sobraWeak)).toBe(r(compute({ ...base(), extras: [] }, NOW).sobraWeak));
  });

  it("aparecem no fluxo no dia certo", () => {
    const c = compute(base(), NOW);
    const ex = flow(base(), c).ev.find((e) => e.extra);
    expect(ex?.day).toBe(20);
    expect(r(ex!.amt)).toBe(164);
  });
});

describe("divisão e fluxo", () => {
  it("as partes somam as contas e as transferências fecham com elas", () => {
    const s = base();
    const c = compute(s, NOW);
    expect(r(c.shareA + c.shareB)).toBe(r(c.bills));
    const transfers = flow(s, c).ev.filter((e) => e.who).reduce((t, e) => t + e.amt, 0);
    expect(r(transfers)).toBe(r(c.bills));
  });

  it("dívida de uma pessoa fica só com ela", () => {
    const c = compute({ ...base(), extras: [] }, NOW);
    const sem = compute({ ...base(), extras: [], debts: [base().debts[0]] }, NOW);
    expect(r(c.shareB - sem.shareB)).toBeGreaterThanOrEqual(400);
  });
});

describe("parcelas das dívidas", () => {
  it("avançam todo mês e a última some da conta", () => {
    const s = base();
    expect(compute(s, NOW).debts.map((x) => `${x.cur}/${x.total}`)).toEqual(["12/48", "9/10"]);
    expect(compute(s, NOW + 1).debts.map((x) => x.cur)).toEqual([13, 10]);
    const m2 = compute(s, NOW + 2);
    expect(m2.debts[1].status).toBe("quitada");
    expect(r(m2.debtsMonth)).toBe(650);
  });

  it("uma dívida de 10 parcelas começando na 3ª quita 8 meses depois", () => {
    const d = { ...base().debts[1], ref: 3 };
    expect(debtInfo(d, NOW + 7).status).toBe("ativa");
    expect(debtInfo(d, NOW + 8).status).toBe("quitada");
  });

  it("a previsão aponta quando uma parcela termina", () => {
    const list = forecast(base(), 3, NOW);
    const ch = debtChanges(list);
    expect(ch).toHaveLength(1);
    expect(ch[0]).toMatchObject({ kind: "termina", debtId: "d2", ym: NOW + 2, amount: 400 });
  });
});

describe("contas fixas por mês", () => {
  const bill = (id: string, seriesId: string, ym: number | undefined, amount: number, extra: Partial<Bill> = {}): Bill => ({
    id, seriesId, ym, name: seriesId, cat: "casa", amount, freq: "mensal", day: 8, ...extra,
  });

  it("a conta repete o último valor nos meses seguintes", () => {
    const all = [bill("1", "agua", NOW, 70), bill("2", "agua", NOW + 1, 80)];
    const v = (ym: number) => billsForMonth(all, ym).map((b) => b.amount);
    expect(v(NOW)).toEqual([70]);
    expect(v(NOW + 1)).toEqual([80]);
    expect(v(NOW + 5)).toEqual([80]); // repete o último valor lançado
    expect(v(NOW - 1)).toEqual([]); // antes da primeira vez
  });

  it("a mesma conta pode existir em meses diferentes, com o mesmo nome e dia", () => {
    const all = [bill("1", "agua", NOW, 70), bill("2", "agua", NOW + 1, 90)];
    expect(billsForMonth(all, NOW + 1)).toHaveLength(1);
    expect(billsForMonth(all, NOW + 1)[0].id).toBe("2");
  });

  it("'última vez' para de repetir depois daquele mês", () => {
    const all = [bill("1", "net", NOW, 100), bill("2", "net", NOW + 1, 100, { isLast: true })];
    expect(billsForMonth(all, NOW + 1)).toHaveLength(1);
    expect(billsForMonth(all, NOW + 2)).toHaveLength(0);
  });

  it("contas sem mês (formato antigo) valem sempre", () => {
    const all = [bill("1", "x", undefined, 50)];
    expect(billsForMonth(all, NOW + 7)).toHaveLength(1);
  });

  it("o valor do mês muda o total e a previsão", () => {
    const s: FinanceState = { ...base(), bills: [bill("1", "agua", NOW, 70), bill("2", "agua", NOW + 1, 120)] };
    const c0 = compute(s, NOW), c1 = compute(s, NOW + 1), c2 = compute(s, NOW + 2);
    expect(r(c1.bills - c0.bills)).toBe(50);
    expect(c2.cats.casa).toBe(120); // novembro repete em dezembro (o total muda porque uma dívida termina)
    expect(c0.cats.casa).toBe(70);
    expect(c1.cats.casa).toBe(120);
    const f = flow(s, c1);
    expect(f.ev.find((e) => e.label === "agua")?.amt).toBe(-120);
  });
});

describe("dívida que começa em outro mês", () => {
  const futura = (startYm: number) => ({ ...base().debts[1], id: "d3", ref: 1, refYM: startYm });

  it("não entra nas contas antes do mês de início", () => {
    const s: FinanceState = { ...base(), extras: [], debts: [futura(NOW + 1)] };
    const c0 = compute(s, NOW), c1 = compute(s, NOW + 1);
    expect(c0.debts[0].status).toBe("futura");
    expect(c0.debts[0].startYM).toBe(NOW + 1);
    expect(r(c0.debtsMonth)).toBe(0);
    expect(flow(s, c0).ev.some((e) => e.label.startsWith("Cartão"))).toBe(false);
    expect(c1.debts[0]).toMatchObject({ status: "ativa", cur: 1 });
    expect(r(c1.debtsMonth)).toBe(400);
  });

  it("aparece na previsão como 'começa' e continua contando no que falta pagar", () => {
    const s: FinanceState = { ...base(), extras: [], debts: [futura(NOW + 1)] };
    const ch = debtChanges(forecast(s, 3, NOW));
    expect(ch).toEqual([{ kind: "comeca", ym: NOW + 1, debtId: "d3", name: "Cartão do pai", amount: 400 }]);
    expect(compute(s, NOW).debtsLeft).toBe(4000);
  });

  it("helpers de mês do campo month", () => {
    expect(ymToInput(NOW)).toBe("2026-10");
    expect(inputToYm("2026-11")).toBe(NOW + 1);
    expect(inputToYm("2027-01")).toBe(2027 * 12);
    expect(Number.isNaN(inputToYm(""))).toBe(true);
  });
});

describe("metas e saudação", () => {
  it("goalMonths", () => {
    expect(goalMonths(0, 10)).toBe(0);
    expect(goalMonths(5, 0)).toBeNull();
    expect(goalMonths(1000, 300)).toBe(4);
  });

  it("saudação pelo horário", () => {
    expect(greeting(new Date(2026, 9, 20, 8))).toBe("Bom dia");
    expect(greeting(new Date(2026, 9, 20, 15))).toBe("Boa tarde");
    expect(greeting(new Date(2026, 9, 20, 22))).toBe("Boa noite");
    expect(greeting(new Date(2026, 9, 20, 3))).toBe("Boa noite");
  });

  it("monthIndex", () => {
    expect(monthIndex(new Date(2026, 9, 20))).toBe(NOW);
  });

  it("monthStatus separa o que já venceu do que falta", () => {
    const s = base();
    const f = flow(s, compute(s, NOW));
    const st = monthStatus(f, 20);
    expect(st.paid + st.remaining).toBe(st.total);
    expect(st.paid).toBeGreaterThan(0);
  });
});
