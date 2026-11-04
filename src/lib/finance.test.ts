import { describe, expect, it } from "vitest";
import { debtChanges, debtSummary, editDebt, emptyState, itemsForMonth, lastTimeBill, newDebt, repeatBill, setBillMonthValue, splitAmount, stopBillFrom, summarize, transferPlan, weekdayDates, type AppState, type Bill } from "./finance";

const base = (): AppState => ({ ...emptyState(["Bianca", "Julio"]) });

describe("finance rules", () => {
  it("default split is 50/50 and never loses cents", () => {
    expect(base().split).toEqual([50, 50]);
    expect(splitAmount(1001, 50)).toEqual([501, 500]);
  });
  it("weekly occurrences follow the calendar, not a fixed 4", () => {
    expect(weekdayDates("2026-03", 0).length).toBe(5); // March 2026 has 5 Sundays
    expect(weekdayDates("2026-02", 0).length).toBe(4);
  });
  it("extras count only in their month", () => {
    const s = base();
    s.extras.push({ id: "e", desc: "Bônus", amount: 10000, person: 0, date: "2026-03-10", month: "2026-03" });
    expect(summarize(s, "2026-03").totalIncome).toBe(10000);
    expect(summarize(s, "2026-04").totalIncome).toBe(0);
  });
  it("individual bills are excluded from the shared split", () => {
    const s = base();
    s.bills.push({ id: "a", name: "Aluguel", category: "", amount: 200000, day: 10, person: null, shared: true, start: "2026-01", paid: {} });
    s.bills.push({ id: "b", name: "Celular", category: "", amount: 5000, day: 10, person: 0, shared: false, start: "2026-01", paid: {} });
    const r = summarize(s, "2026-03");
    expect(r.sharedTotal).toBe(200000);
    expect(r.share).toEqual([100000, 100000]);
  });
  it("debt installments appear only within schedule and don't auto-pay", () => {
    const s = base();
    s.debts.push({ id: "d", name: "TV", total: 30000, installments: 3, amount: 10000, paidCount: 0, firstDue: "2026-01-05", person: null, shared: true });
    expect(summarize(s, "2026-02").debtInstallments).toBe(10000);
    expect(summarize(s, "2026-04").debtInstallments).toBe(0);
    expect(debtSummary(s.debts[0]!).remaining).toBe(30000);
  });
  it("transfer plan does not double count transfers already made", () => {
    const s = base();
    s.incomes.push({ id: "i", desc: "Salário", person: 0, amount: 500000, freq: "monthly", day: 25, active: true, autonomous: false });
    s.bills.push({ id: "a", name: "Aluguel", category: "", amount: 200000, day: 28, person: null, shared: true, start: "2026-01", paid: {} });
    s.transfers.push({ id: "t", person: 0, amount: 40000, date: "2026-03-02", month: "2026-03" });
    const plan = transferPlan(s, "2026-03", "2026-03-01").filter((p) => p.person === 0);
    expect(plan.reduce((a, p) => a + p.amount, 0)).toBe(60000);
  });
  it("autonomous income simulation leaves fixed income untouched", () => {
    const s = base();
    s.incomes.push({ id: "f", desc: "Salário", person: 0, amount: 100000, freq: "monthly", day: 5, active: true, autonomous: false });
    s.incomes.push({ id: "a", desc: "Freela", person: 1, amount: 100000, freq: "monthly", day: 5, active: true, autonomous: true });
    expect(summarize(s, "2026-03", { factor: 0.7 }).income).toEqual([100000, 70000]);
  });
});


describe("contas fixas por mês", () => {
  const bill = (extra: Partial<Bill> = {}): Bill => ({ id: "agua", name: "Água", category: "Casa", amount: 7000, day: 8, person: null, shared: true, start: "2026-10", paid: {}, ...extra });
  const state = (b: Bill) => ({ ...emptyState(["A", "B"]), bills: [b] });
  const total = (b: Bill, m: string) => itemsForMonth(state(b), m).filter((i) => i.kind === "bill").reduce((a, i) => a + i.amount, 0);

  it("repete o último valor nos meses seguintes e não aparece antes do início", () => {
    const b = bill();
    expect(total(b, "2026-10")).toBe(7000);
    expect(total(b, "2026-12")).toBe(7000);
    expect(total(b, "2026-09")).toBe(0);
  });

  it("mudar o valor de um mês vale dali em diante e nunca altera os anteriores", () => {
    const b = setBillMonthValue(bill(), "2026-11", 9000);
    expect(total(b, "2026-10")).toBe(7000);
    expect(total(b, "2026-11")).toBe(9000);
    expect(total(b, "2027-02")).toBe(9000);
    const c = setBillMonthValue(b, "2026-12", 8000);
    expect(total(c, "2026-11")).toBe(9000);
    expect(total(c, "2026-12")).toBe(8000);
  });

  it("repetir no próximo mês copia nome, categoria e valor, e pode ser editado depois", () => {
    const r = repeatBill(bill(), "2026-10");
    expect(r.status).toBe("created");
    expect(r.bill).toMatchObject({ name: "Água", category: "Casa" });
    expect(total(r.bill, "2026-11")).toBe(7000);
    expect(total(setBillMonthValue(r.bill, "2026-11", 7500), "2026-11")).toBe(7500);
    expect(repeatBill(r.bill, "2026-10").status).toBe("exists");
  });

  it("repetir uma conta que terminava neste mês estende até o mês seguinte", () => {
    const b = lastTimeBill(bill(), "2026-10");
    expect(total(b, "2026-11")).toBe(0);
    const r = repeatBill(b, "2026-10");
    expect(r.bill.end).toBe("2026-11");
    expect(total(r.bill, "2026-11")).toBe(7000);
    expect(total(r.bill, "2026-12")).toBe(0);
  });

  it("'última vez' e 'parar a partir deste mês' deixam os meses anteriores intactos", () => {
    const b = setBillMonthValue(bill(), "2026-12", 9000);
    const last = lastTimeBill(b, "2026-11");
    expect(total(last, "2026-11")).toBe(7000);
    expect(total(last, "2026-12")).toBe(0);
    const stopped = stopBillFrom(b, "2026-12");
    expect(stopped?.end).toBe("2026-11");
    expect(total(stopped!, "2026-11")).toBe(7000);
    expect(total(stopped!, "2026-12")).toBe(0);
    expect(stopBillFrom(bill(), "2026-10")).toBeNull();
  });

  it("a conta paga é registrada por mês", () => {
    const b = bill({ paid: { "2026-10": true } });
    const items = (m: string) => itemsForMonth(state(b), m).filter((i) => i.kind === "bill");
    expect(items("2026-10")[0]?.paid).toBe(true);
    expect(items("2026-11")[0]?.paid).toBe(false);
  });
});

describe("dívida que começa em outro mês", () => {
  it("só entra nas contas a partir do mês de início", () => {
    const d = editDebt(newDebt("2026-11"), { name: "Cartão", amount: 40000, installments: 10, person: null, shared: true }, "2026-11", 1);
    const s = { ...emptyState(["A", "B"]), debts: [d] };
    expect(summarize(s, "2026-10").debtInstallments).toBe(0);
    expect(itemsForMonth(s, "2026-10")).toHaveLength(0);
    expect(summarize(s, "2026-11").debtInstallments).toBe(40000);
    expect(summarize(s, "2026-12").debtInstallments).toBe(40000);
    expect(debtChanges(s, "2026-10", 3)).toMatchObject([{ label: "Começa", month: "2026-11", amount: 40000 }]);
    expect(debtSummary(d).remaining).toBe(400000);
  });
});
