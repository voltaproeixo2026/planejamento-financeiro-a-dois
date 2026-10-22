import { describe, expect, it } from "vitest";
import { emptyState, splitAmount, summarize, weekdayDates, debtSummary, transferPlan, type AppState } from "./finance";

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
