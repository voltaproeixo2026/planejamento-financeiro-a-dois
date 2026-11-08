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
  it('parcela de uma dívida cadastrada no meio (parcela 3 deste mês) pode ser paga e vai para "Já pagas"', () => {
    const s = emptyState(['Bianca', 'Julio']);
    s.debts = [{ ...newDebt('2026-10'), name: 'Cartão', amount: 10000, installments: 6, ref: 3, ref_ym: '2026-10', firstDue: '2026-08-10', paidCount: 0 }];
    household.state = s;
    const view = render(<Dashboard month="2026-10" />);
    const pay = screen.getByRole('button', { name: 'Pagar' }) as HTMLButtonElement;
    expect(pay.disabled).toBe(false);
    fireEvent.click(pay);
    expect(household.state.debts[0]?.paidCount).toBe(3); // as parcelas 1 e 2 já estavam pagas
    view.rerender(<Dashboard month="2026-10" />);
    expect(within(document.querySelector('#paid-list') as HTMLElement).getByText(/Cartão/)).toBeTruthy();
  });
  it('só a parcela paga mais recente pode ser desfeita', () => {
    const s = emptyState(['Bianca', 'Julio']);
    s.debts = [{ ...newDebt('2026-10'), name: 'Cartão', amount: 10000, installments: 6, ref: 3, ref_ym: '2026-10', firstDue: '2026-08-10', paidCount: 3 }];
    household.state = s;
    const view = render(<Dashboard month="2026-10" />);
    fireEvent.click(within(document.querySelector('#paid-list') as HTMLElement).getByRole('button', { name: 'Desfazer' }));
    expect(household.state.debts[0]?.paidCount).toBe(2);
    cleanup();
    household.state = { ...s, debts: [{ ...s.debts[0]!, paidCount: 5 }] };
    view.unmount();
    render(<Dashboard month="2026-10" />);
    expect((within(document.querySelector('#paid-list') as HTMLElement).getByRole('button', { name: 'Desfazer' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('Resumo não tem mais o cartão "Dívidas"', () => {
    const s = emptyState(['Bianca', 'Julio']);
    s.debts = [{ ...newDebt('2026-10'), name: 'Carro', amount: 10000, installments: 10, ref: 1, ref_ym: '2026-10', firstDue: '2026-10-10', shared: true, person: null }];
    household.state = s;
    render(<Dashboard month="2026-10" />);
    expect(document.querySelector('#debt-home')).toBeNull();
    expect(screen.queryByText('Falta pagar no total')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Dívidas' })).toBeNull();
  });
  it('Próximos vencimentos: contas fixas separadas e dívidas do mesmo cartão numa linha só, com o total', () => {
    const s = emptyState(['Bianca', 'Julio']);
    s.bills = [
      { id: 'luz', name: 'Luz', category: 'Casa', amount: 18000, day: 15, person: null, shared: true, start: '2026-10', paid: {} },
      { id: 'agua', name: 'Água', category: 'Casa', amount: 7000, day: 8, person: null, shared: true, start: '2026-10', paid: {} },
    ];
    const debt = (id: string, name: string, amount: number, origin: string) => ({ ...newDebt('2026-10'), id, name, origin, amount, installments: 6, ref: 1, ref_ym: '2026-10', firstDue: '2026-10-12', shared: true, person: null });
    s.debts = [debt('a', 'Mecânico', 30000, 'Cartão mãe'), debt('b', 'Geladeira', 20000, 'cartão mãe'), debt('c', 'Notebook', 15000, 'Cartão pai'), debt('d', 'Financiamento', 65000, '')];
    household.state = s;
    const view = render(<Dashboard month="2026-10" />);
    const list = () => document.querySelector('#upcoming')!;
    const rows = () => Array.from(list().querySelectorAll('li'));
    expect(rows()).toHaveLength(5); // Água, Luz, Cartão mãe (2 dívidas), Cartão pai, Financiamento
    const mae = rows().find(r => r.textContent!.includes('Cartão mãe'))!;
    expect(mae.textContent).toMatch(/R\$\s500,00/);
    expect(mae.textContent).not.toContain('Mecânico'); // só o nome do cartão e o total
    expect(mae.textContent).not.toContain('Geladeira');
    fireEvent.click(within(mae as HTMLElement).getByRole('button', { name: 'Pagar' }));
    expect(household.state.debts.map(d => d.paidCount)).toEqual([1, 1, 0, 0]);
    view.rerender(<Dashboard month="2026-10" />);
    expect(rows()).toHaveLength(4);
    const paid = document.querySelector('#paid-list')!;
    expect(paid.querySelectorAll('li')).toHaveLength(1);
    expect(paid.textContent).toMatch(/Cartão mãe.*R\$\s500,00/);
  });
});

