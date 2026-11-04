import { describe, expect, it } from 'vitest';
import { emptyState } from './finance';
import { goalView, goalMonthsAt, reserveView, savingsView, debtTotals, allocationView, debtHomeView, incomeScenarioControl, incomeScenarioView, flowDays, niceTicks } from './planning-model';

describe('Planning models', () => {
  it('preserves savings after reserving the next-month cushion', () => {
    const s = emptyState(['Bianca', 'Julio']);
    s.incomes = [{ id: 'salary', desc: 'Salário', person: 0, amount: 500000, freq: 'monthly', day: 5, active: true, autonomous: false }];
    s.cushion = { '2026-11': 100000 };
    expect(savingsView(s, '2026-10').potential).toBe(400000);
  });
  it('allocates a goal share without losing whole cent values', () => {
    expect(goalView({ id: 'goal', name: 'Reserva', target: 100000, saved: 20000, share: 50 }, 40000)).toEqual({ allocation: 20000, progress: 20, months: 4 });
  });
  it('does not project completion without a savings allocation', () => {
    expect(goalView({ id: 'goal', name: 'Reserva', target: 100000, saved: 0, share: 0 }, 40000).months).toBeNull();
  });
  it('uses three to six months of fixed bills for the reserve range', () => {
    const s = emptyState(['Bianca', 'Julio']);
    s.bills = [{ id: 'rent', name: 'Aluguel', category: 'Moradia', amount: 100000, day: 5, person: null, shared: true, start: '2026-10', paid: {} }];
    expect(reserveView(s, '2026-10')).toEqual({ minimum: 300000, maximum: 600000, shares: 0 });
  });
  it('keeps paid installments out of remaining debt', () => {
    const s = emptyState(['Bianca', 'Julio']);
    s.debts = [{ id: 'debt', name: 'Geladeira', total: 30000, installments: 3, amount: 10000, paidCount: 1, firstDue: '2026-09-05', person: null, shared: true }];
    expect(debtTotals(s, '2026-10')).toEqual({ monthly: 10000, remaining: 20000 });
  });
});

describe('Summary reference values', () => {
  const month = '2026-10';
  function state() {
    const s = emptyState(['Bianca', 'Julio']);
    s.incomes = [
      { id: 'fixed', desc: 'Salário', person: 0, amount: 300000, freq: 'monthly', day: 5, active: true, autonomous: false },
      { id: 'auto', desc: 'Serviços', person: 1, amount: 200000, freq: 'monthly', day: 10, active: true, autonomous: true },
    ];
    s.extras = [{ id: 'extra', desc: 'Extra', person: 1, amount: 100000, month, date: '2026-10-12' }];
    s.bills = [{ id: 'rent', name: 'Aluguel', category: 'Casa', amount: 100000, day: 5, person: null, shared: true, start: month, paid: {} }];
    return s;
  }
  it('simulates 70% autonomous income without affecting fixed income or adding extras', () => {
    expect(incomeScenarioView(state(), month, 70).leftover).toBe(340000);
  });
  it('still excludes extras at 100% autonomous income', () => {
    const s = state();
    expect(incomeScenarioView(s, month, 100).leftover).toBe(400000);
    expect(s.extras[0]?.amount).toBe(100000);
  });
  it('uses a 30–100% range, 5% steps and a 70% default', () => {
    expect(incomeScenarioControl).toEqual({ min: 30, max: 100, step: 5, initial: 70 });
  });
  it('uses positive leftover as savings and calculates percentages from all segments', () => {
    const s = state();
    s.extras = [];
    expect(allocationView(s, month)).toEqual([
      { name: 'Casa', value: 100000, category: 'casa', percent: 20 },
      { name: 'Poupança', value: 400000, category: 'poup', percent: 80 },
    ]);
  });
  it('does not create a savings segment for a negative leftover', () => {
    const s = state();
    s.incomes = [];
    s.extras = [];
    expect(allocationView(s, month)).toEqual([{ name: 'Casa', value: 100000, category: 'casa', percent: 100 }]);
  });
  it('presents installment, remaining balance including current, final month and original total', () => {
    const s = state();
    s.debts = [{ id: 'debt', name: 'Geladeira', total: 99999, installments: 10, amount: 10000, paidCount: 3, firstDue: '2026-07-05', person: 1, shared: false }];
    expect(debtHomeView(s, month)[0]).toMatchObject({ owner: 'Julio', current: 4, installments: 10, left: 7, remaining: 70000, total: 100000, lastMonth: '2027-04', status: 'active' });
  });
  it('maps all category, free-money and savings values without dropping uncategorized bills', () => {
    const s = state();
    s.bills.push(...['Alimentação', 'Pet', 'Pessoal'].map((category, k) => ({ ...s.bills[0], id: `bill-${k}`, name: category, category, amount: 10000, day: 5, person: null, shared: true, start: month, paid: {} })));
    s.weeklyFree = [1000, 1000];
    s.debts = [{ id: 'debt', name: 'Compra', total: 10000, installments: 1, amount: 10000, paidCount: 0, firstDue: '2026-10-05', person: null, shared: true }];
    expect(allocationView(s, month).map(g => [g.category, g.value])).toEqual([
      ['divida', 10000], ['casa', 100000], ['alim', 10000], ['pet', 10000], ['outros', 10000], ['livre', 8000], ['poup', 452000],
    ]);
  });
});
describe('Mês e Metas', () => {
  const month = '2026-10';
  const st = () => {
    const s = emptyState(['Bianca', 'Julio']);
    s.incomes = [
      { id: 'fixed', desc: 'Salário', person: 0, amount: 300000, freq: 'monthly', day: 5, active: true, autonomous: false },
      { id: 'auto', desc: 'Serviços', person: 1, amount: 100000, freq: 'monthly', day: 20, active: true, autonomous: true },
    ];
    s.bills = [{ id: 'rent', name: 'Aluguel', category: 'Casa', amount: 100000, day: 10, person: null, shared: true, start: month, paid: {} }];
    return s;
  };
  it('daily balance starts at the opening balance and moves on the day of each movement', () => {
    const s = st();
    s.cushion = { [month]: 20000 };
    const f = flowDays(s, month);
    expect(f.days).toHaveLength(32);
    expect(f.days[0]?.balance).toBe(20000);
    expect(f.days[1]?.balance).toBe(20000);
    const rent = f.days[10]!;
    expect(rent.moves.some(m => m.desc === 'Aluguel' && m.type === 'saída')).toBe(true);
    expect(rent.balance).toBeLessThan(f.days[9]!.balance);
  });
  it('suggests the opening balance that keeps the joint account out of the red', () => {
    const s = st();
    s.cushion = { [month]: 0 };
    s.transfers = [];
    const f = flowDays(s, month);
    const s2 = { ...s, cushion: { [month]: f.needed } };
    expect(flowDays(s2, month).minBalance).toBeGreaterThanOrEqual(0);
  });
  it('axis ticks are round values that include zero', () => {
    const t = niceTicks(-130000, 480000);
    expect(t).toContain(0);
    const step = t[1]! - t[0]!;
    expect([1, 2, 2.5, 5, 10].some(m => Number.isInteger(Math.round(Math.log10(step / m) * 1e6) / 1e6))).toBe(true);
    expect(t[0]!).toBeLessThanOrEqual(-130000);
    expect(t.at(-1)!).toBeGreaterThanOrEqual(480000);
  });
  it('savings ignore extras and the weak month is lower than the normal one', () => {
    const s = st();
    const without = savingsView(s, month);
    s.extras = [{ id: 'x', desc: 'Extra', person: 1, amount: 50000, month, date: '2026-10-12' }];
    expect(savingsView(s, month).potential).toBe(without.potential);
    expect(without.weakPotential).toBeLessThan(without.potential);
    const goal = { id: 'g', name: 'Viagem', target: 100000, saved: 0, share: 100 };
    expect(goalMonthsAt(goal, without.weakPotential) ?? Infinity).toBeGreaterThanOrEqual(goalMonthsAt(goal, without.potential) ?? Infinity);
  });
});
