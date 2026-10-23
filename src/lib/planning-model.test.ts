import { describe, expect, it } from 'vitest';
import { emptyState } from './finance';
import { goalView, reserveView, savingsView, debtTotals } from './planning-model';

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