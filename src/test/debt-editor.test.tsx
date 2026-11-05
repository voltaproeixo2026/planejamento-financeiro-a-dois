import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { debtCur, emptyState, newDebt, type AppState, type Debt } from '@/lib/finance';
import * as finance from '@/lib/finance';

const household = vi.hoisted(() => ({ state: {} as AppState }));
vi.mock('@/lib/household', () => ({ useAppState: () => ({ s: household.state, update: (fn: (s: AppState) => AppState) => { household.state = fn(household.state); } }) }));
import { DebtEditor } from '@/components/app/DebtEditor';
import { DebtScreen } from '@/components/app/DebtScreen';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
describe('Debt editing', () => {
  it('adds a debt only when saved, in the existing household JSON', () => {
    household.state = emptyState(['Bianca', 'Julio']);
    render(<DebtEditor month="2026-10" />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar dívida' }));
    expect(household.state.debts).toHaveLength(0);
    fill('Nome', 'Cartão'); fill('Valor da parcela (R$)', '100');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(household.state.debts[0]).toMatchObject({ name: 'Cartão', ref: 1, ref_ym: '2026-10', installments: 10, paidCount: 0, amount: 10000 });
  });
  it('cancelling a new debt discards it', () => {
    household.state = emptyState(['Bianca', 'Julio']);
    render(<DebtEditor month="2026-10" />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar dívida' }));
    fill('Nome', 'Cartão');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(household.state.debts).toHaveLength(0);
  });
  it('shows a saved debt read-only and edits it only after Editar and Salvar', () => {
    household.state = { ...emptyState(['Bianca', 'Julio']), debts: [newDebt('2026-10')] };
    render(<DebtEditor month="2026-10" />);
    expect(screen.queryByLabelText('Nome')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fill('Nome', 'Mecânico'); fill('Esta parcela é a número', '3'); fill('Onde é a dívida', 'Banco'); fill('Responsável', 'both'); fill('Valor da parcela (R$)', '250.50'); fill('Total de parcelas', '12');
    expect(household.state.debts[0]?.name).not.toBe('Mecânico');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    const d = household.state.debts[0];
    expect(d).toMatchObject({ name: 'Mecânico', ref: 3, ref_ym: '2026-10', origin: 'Banco', shared: true, person: null, amount: 25050, installments: 12, total: 300600, paidCount: 0 });
    if (!d) throw new Error('Debt missing');
    expect(debtCur(d, '2026-11')).toBe(4);
  });
  it('keeps the saved debt when editing is cancelled and rejects invalid values', () => {
    household.state = { ...emptyState(['Bianca', 'Julio']), debts: [{ ...newDebt('2026-10'), name: 'Original', amount: 5000 }] };
    render(<DebtEditor month="2026-10" />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fill('Nome', 'Outro'); fill('Valor da parcela (R$)', '0');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(household.state.debts[0]?.name).toBe('Original');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(household.state.debts[0]).toMatchObject({ name: 'Original', amount: 5000 });
  });
  it('lets a debt start in a later month and keeps it out of the current month', () => {
    household.state = { ...emptyState(['Bianca', 'Julio']), debts: [{ ...newDebt('2026-10'), name: 'Cartão', amount: 40000, installments: 10 }] };
    const view = render(<DebtEditor month="2026-10" />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fill('e cai em', '2026-11');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
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
describe('Debt screen totals and installments', () => {
  const state = () => {
    const s = emptyState(['Bianca', 'Julio']);
    const mk = (id: string, owner: 'a' | 'b' | 'both', amount: number): Debt => ({ ...newDebt('2026-10'), id, name: id, amount, installments: 4, total: amount * 4, ref: 1, ref_ym: '2026-10', firstDue: '2026-10-10', shared: owner === 'both', person: owner === 'both' ? null : owner === 'a' ? 0 : 1 });
    s.debts = [mk('cartao', 'b', 10000), mk('carro', 'both', 20000), mk('notebook', 'a', 5000)];
    return s;
  };
  it('totals each person and the couple by the month installments only', () => {
    household.state = state();
    render(<DebtScreen month="2026-10" />);
    const total = (key: string) => document.querySelector(`[data-owner="${key}"]`)?.textContent;
    expect(total('a')).toContain('50,00'); // R$ 50 por mês, não os R$ 200 do total da dívida
    expect(total('b')).toContain('100,00');
    expect(total('both')).toContain('200,00');
    expect(document.querySelector('#debt-owners')!.textContent).toMatch(/Total do mês: R\$\s350,00/);
    expect(document.querySelector('#debt-owners')!.textContent).not.toContain('falta pagar');
  });
  it('lists the month installments and pays them from the debt screen', () => {
    household.state = state();
    const view = render(<DebtScreen month="2026-10" />);
    const list = document.querySelector('#debt-month-list')!;
    expect(list.querySelectorAll('li')).toHaveLength(3);
    fireEvent.click(list.querySelectorAll('button')[0]!);
    expect(household.state.debts.filter(d => d.paidCount === 1)).toHaveLength(1);
    view.rerender(<DebtScreen month="2026-10" />);
    expect(document.querySelector('#debt-month-list')!.textContent).toContain('Desfazer');
  });
});
