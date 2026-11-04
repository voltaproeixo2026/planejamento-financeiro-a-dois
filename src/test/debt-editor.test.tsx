import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { debtCur, emptyState, newDebt, type AppState } from '@/lib/finance';
import * as finance from '@/lib/finance';

const household = vi.hoisted(() => ({ state: {} as AppState }));
vi.mock('@/lib/household', () => ({ useAppState: () => ({ s: household.state, update: (fn: (s: AppState) => AppState) => { household.state = fn(household.state); } }) }));
import { DebtEditor } from '@/components/app/DebtEditor';
import { DebtScreen } from '@/components/app/DebtScreen';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('Debt editing', () => {
  it('adds a debt in the existing household JSON', () => {
    household.state = emptyState(['Bianca', 'Julio']);
    render(<DebtEditor month="2026-10" />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar dívida' }));
    expect(household.state.debts[0]).toMatchObject({ ref: 1, ref_ym: '2026-10', installments: 10, paidCount: 0 });
  });
  it('stores current installment reference and edited origin, owner, amount and count', () => {
    household.state = { ...emptyState(['Bianca', 'Julio']), debts: [newDebt('2026-10')] };
    render(<DebtEditor month="2026-10" />);
    fireEvent.change(screen.getByLabelText('Esta parcela é a número'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Onde é a dívida'), { target: { value: 'Banco' } });
    fireEvent.change(screen.getByLabelText('Responsável'), { target: { value: 'both' } });
    fireEvent.change(screen.getByLabelText('Valor da parcela (R$)'), { target: { value: '250.50' } });
    fireEvent.change(screen.getByLabelText('Total de parcelas'), { target: { value: '12' } });
    const d = household.state.debts[0];
    expect(d).toMatchObject({ ref: 3, ref_ym: '2026-10', origin: 'Banco', shared: true, person: null, amount: 25050, installments: 12, total: 300600, paidCount: 0 });
    if (!d) throw new Error('Debt missing');
    expect(debtCur(d, '2026-11')).toBe(4);
  });
  it('lets a debt start in a later month and keeps it out of the current month', () => {
    household.state = { ...emptyState(['Bianca', 'Julio']), debts: [{ ...newDebt('2026-10'), amount: 40000, installments: 10 }] };
    const view = render(<DebtEditor month="2026-10" />);
    fireEvent.change(screen.getByLabelText('e cai em'), { target: { value: '2026-11' } });
    const d = household.state.debts[0];
    if (!d) throw new Error('Debt missing');
    expect(d).toMatchObject({ ref: 1, ref_ym: '2026-11' });
    expect(debtCur(d, '2026-10')).toBe(0);
    expect(debtCur(d, '2026-11')).toBe(1);
    view.rerender(<DebtEditor month="2026-10" />);
    expect(screen.getByText(/Ainda não entra nas contas deste mês/)).toBeTruthy();
  });
  it('switches the forecast from three to six and twelve months immediately', () => {
    household.state = { ...emptyState(['Bianca', 'Julio']), debts: [newDebt('2026-10')] };
    const calculate = vi.spyOn(finance, 'forecast');
    render(<DebtScreen month="2026-10" />);
    expect(calculate.mock.results.at(-1)?.value).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: '6 meses' }));
    expect(calculate.mock.results.at(-1)?.value).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: '12 meses' }));
    expect(calculate.mock.results.at(-1)?.value).toHaveLength(12);
  });
});