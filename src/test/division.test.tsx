import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyState, type AppState } from '@/lib/finance';
import * as models from '@/lib/planning-model';

const household = vi.hoisted(() => ({ state: {} as AppState }));
vi.mock('@/lib/household', () => ({ useAppState: () => {
  const [s, set] = useState(household.state);
  return { s, update: (fn: (st: AppState) => AppState) => set(st => {
    household.state = fn(st); return household.state;
  }) };
} }));
import { Split } from '@/components/app/Split';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('Division interaction', () => {
  it('updates both people immediately at the custom control endpoints and on weekly input', () => {
    household.state = emptyState(['Bianca', 'Julio']);
    household.state.incomes = [{ id: 'salary', desc: 'Salário', person: 0, amount: 300000, freq: 'monthly', day: 5, active: true, autonomous: false }];
    household.state.bills = [{ id: 'rent', name: 'Aluguel', category: 'Casa', amount: 100000, day: 10, shared: true, person: null, start: '2026-10', paid: {} }];
    const model = vi.spyOn(models, 'divisionView');
    render(<Split month="2026-10" />);
    fireEvent.click(screen.getByRole('button', { name: 'Escolher' }));
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } });
    expect(model.mock.results.at(-1)?.value.people.map((p: { accounts: number }) => p.accounts)).toEqual([0, 100000]);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '100' } });
    expect(model.mock.results.at(-1)?.value.people.map((p: { accounts: number }) => p.accounts)).toEqual([100000, 0]);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Bianca' }), { target: { value: '50' } });
    expect(model.mock.results.at(-1)?.value.people[0]).toMatchObject({ freeMoney: 20000, savings: 180000 });
    expect(household.state.weeklyFree).toEqual([5000, 0]);
    fireEvent.click(screen.getByRole('button', { name: 'Meio a meio' }));
    expect(household.state.split).toEqual([50, 50]);
  });

  it('lets each bill have its own payer, including a custom percentage with both parts shown', () => {
    household.state = emptyState(['Bianca', 'Julio']);
    household.state.bills = [{ id: 'card', name: 'Cartão', category: 'Dívidas', amount: 100000, day: 10, shared: true, person: null, start: '2026-10', paid: {} }];
    render(<Split month="2026-10" />);
    fireEvent.change(screen.getByLabelText('Quem paga Cartão'), { target: { value: 'custom' } });
    expect(household.state.bills[0]).toMatchObject({ splitA: 50, shared: false });
    fireEvent.change(screen.getByLabelText('Parte de Bianca (%)'), { target: { value: '30' } });
    expect(household.state.bills[0]?.splitA).toBe(30);
    expect(document.querySelector('.payer-custom')?.textContent).toMatch(/Bianca R\$\s300,00 · Julio R\$\s700,00/);
    expect(document.querySelector('#person-a')?.textContent).toContain('30% das contas');
    fireEvent.change(screen.getByLabelText('Quem paga Cartão'), { target: { value: 'b' } });
    expect(household.state.bills[0]).toMatchObject({ shared: false, person: 1, splitA: undefined });
  });
});

