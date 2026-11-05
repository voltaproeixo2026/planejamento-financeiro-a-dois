import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyState, newDebt, type AppState } from '@/lib/finance';

const household = vi.hoisted(() => ({ state: {} as AppState }));
vi.mock('@/lib/household', () => ({ useAppState: () => ({ s: household.state, update: (fn: (s: AppState) => AppState) => { household.state = fn(household.state); } }) }));
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
import { Dashboard } from '@/components/app/Dashboard';
afterEach(cleanup);

describe('Resumo: contas pagas', () => {
  it('uma conta marcada como paga sai dos vencimentos e aparece em "Já pagas neste mês", com opção de desfazer', () => {
    const s = emptyState(['Bianca', 'Julio']);
    s.bills = [{ id: 'agua', name: 'Água', category: 'Casa', amount: 7000, day: 8, person: null, shared: true, start: '2026-10', paid: {} }];
    household.state = s;
    const view = render(<Dashboard month="2026-10" />);
    fireEvent.click(screen.getByRole('button', { name: 'Pagar' }));
    view.rerender(<Dashboard month="2026-10" />);
    const paid = document.querySelector('#paid-list')!;
    expect(within(paid as HTMLElement).getByText('Água')).toBeTruthy();
    expect(paid.textContent).toContain('Total pago');
    fireEvent.click(within(paid as HTMLElement).getByRole('button', { name: 'Desfazer' }));
    expect(household.state.bills[0]?.paid['2026-10']).toBe(false);
  });
  it('parcela de dívida só pode ser paga na ordem', () => {
    const s = emptyState(['Bianca', 'Julio']);
    s.debts = [{ ...newDebt('2026-10'), name: 'Cartão', amount: 10000, installments: 3, ref: 2, ref_ym: '2026-10', firstDue: '2026-09-10' }];
    household.state = s;
    render(<Dashboard month="2026-10" />);
    expect((screen.getByRole('button', { name: 'Pagar' }) as HTMLButtonElement).disabled).toBe(true); // parcela 1 ainda não foi paga
  });

  it('Resumo mostra o total da dívida em conjunto e a parte de cada um', () => {
    const s = emptyState(['Bianca', 'Julio']);
    s.split = [60, 40];
    s.debts = [{ ...newDebt('2026-10'), name: 'Carro', amount: 10000, installments: 10, ref: 1, ref_ym: '2026-10', firstDue: '2026-10-10', shared: true, person: null }];
    household.state = s;
    render(<Dashboard month="2026-10" />);
    const card = document.querySelector('#debt-home')!.textContent!;
    expect(card).toMatch(/Parcela R\$\s100,00: Bianca R\$\s60,00 · Julio R\$\s40,00/);
    expect(card).toMatch(/R\$\s1\.000,00.*total da dívida.*Bianca R\$\s600,00.*Julio R\$\s400,00/);
  });
});

