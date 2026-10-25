import { describe, expect, it } from 'vitest';
import { debtChanges, debtCur, debtInstallment, editDebt, emptyState, forecast, newDebt } from './finance';

describe('Debt monthly reference and forecast', () => {
  it('stores the edited installment and reference month and advances automatically', () => {
    const d = editDebt(newDebt('2026-10'), {}, '2026-10', 3);
    expect(d.ref).toBe(3);
    expect(d.ref_ym).toBe('2026-10');
    expect(d.firstDue).toBe('2026-08-10');
    expect(debtCur(d, '2026-11')).toBe(4);
    expect(debtInstallment(d, '2026-11')?.index).toBe(3);
  });
  it('keeps actual payment and customized installment data when editing reference', () => {
    const d = { ...newDebt('2026-10'), paidCount: 2, overrides: { 3: 12345 } };
    const edited = editDebt(d, {}, '2026-10', 3);
    expect(edited.paidCount).toBe(2);
    expect(debtInstallment(edited, '2026-11')).toMatchObject({ amount: 12345, paid: false });
  });
  it('supports existing debts without reference metadata', () => {
    const d = newDebt('2026-10');
    delete d.ref; delete d.ref_ym;
    expect(debtCur(d, '2026-12')).toBe(3);
  });
  it('stops charging after the last installment and reports start/end separately', () => {
    const s = emptyState(['Bianca', 'Julio']);
    s.debts = [
      { ...newDebt('2026-10'), id: 'end', amount: 10000, installments: 1 },
      { ...newDebt('2026-11'), id: 'start', amount: 20000, installments: 3 },
    ];
    expect(forecast(s, '2026-10', 3).map(p => p.installments)).toEqual([10000, 20000, 20000]);
    expect(forecast(s, '2026-10', 3).map(p => p.variation)).toEqual([null, 10000, 0]);
    expect(debtChanges(s, '2026-10', 3).map(c => [c.label, c.month, c.amount])).toEqual([['Termina', '2026-11', 10000], ['Começa', '2026-11', 20000]]);
  });
  it('forecasts income and leftover using existing finance formulas and month-specific extras', () => {
    const s = emptyState(['Bianca', 'Julio']);
    s.incomes = [{ id: 'salary', desc: 'Salário', amount: 100000, person: 0, freq: 'monthly', day: 5, active: true, autonomous: false }];
    s.extras = [{ id: 'extra', desc: 'Extra', amount: 50000, person: 0, month: '2026-10', date: '2026-10-05' }];
    s.debts = [{ ...newDebt('2026-10'), amount: 10000 }];
    expect(forecast(s, '2026-10', 3).map(p => [p.income, p.leftover])).toEqual([[150000, 140000], [100000, 90000], [100000, 90000]]);
    expect(forecast(s, '2026-10', 6)).toHaveLength(6);
    expect(forecast(s, '2026-10', 12)).toHaveLength(12);
  });
});