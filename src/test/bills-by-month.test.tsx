import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyState, itemsForMonth, type AppState } from '@/lib/finance';

const household = vi.hoisted(() => ({ state: {} as AppState }));
vi.mock('@/lib/household', () => ({ useAppState: () => ({ s: household.state, update: (fn: (s: AppState) => AppState) => { household.state = fn(household.state); } }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
import { Accounts, Income } from '@/components/app/Accounts';
afterEach(cleanup);
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });

const setup = () => {
  household.state = { ...emptyState(['Bianca', 'Julio']), bills: [{ id: 'agua', name: 'Água', category: 'Casa', amount: 7000, day: 8, person: null, shared: true, start: '2026-10', paid: {} }] };
};
const billsOf = (m: string) => itemsForMonth(household.state, m).filter(i => i.kind === 'bill');

describe('Contas fixas por mês', () => {
  it('lança a mesma conta (mesmo nome e dia) em outro mês sem bloquear', () => {
    household.state = emptyState(['Bianca', 'Julio']);
    const { rerender } = render(<Accounts month="2026-11" />);
    const add = (month: string) => {
      rerender(<Accounts month={month} />);
      const form = screen.getByLabelText('Mês de início').closest('form')!;
      const [name, amount] = Array.from(form.querySelectorAll('input'));
      fireEvent.change(name!, { target: { value: 'Internet' } });
      fireEvent.change(amount!, { target: { value: '100' } });
      fireEvent.submit(form);
    };
    add('2026-11');
    expect(household.state.bills).toHaveLength(1);
    expect(household.state.bills[0]).toMatchObject({ name: 'Internet', start: '2026-11' });
    expect(billsOf('2026-10')).toHaveLength(0);
    expect(billsOf('2026-12')).toHaveLength(1);
  });

  it('repete no próximo mês e permite mudar o valor só daquele mês', () => {
    setup();
    render(<Accounts month="2026-10" />);
    fireEvent.click(screen.getByRole('button', { name: /^Repetir em/ }));
    expect(billsOf('2026-11')[0]?.amount).toBe(7000);
    cleanup();
    render(<Accounts month="2026-11" />);
    expect(screen.queryByText(/repetida de/)).toBeNull(); // lançada de propósito neste mês
    const input = screen.getByLabelText('Valor neste mês (R$)');
    fireEvent.change(input, { target: { value: '95.5' } });
    fireEvent.blur(input);
    expect(billsOf('2026-10')[0]?.amount).toBe(7000);
    expect(billsOf('2026-11')[0]?.amount).toBe(9550);
  });

  it('conta sem lançamento no mês aparece como repetida do último valor', () => {
    setup();
    render(<Accounts month="2026-12" />);
    expect(screen.getByText('repetida de outubro de 2026')).toBeTruthy();
  });

  it('"Parar a partir deste mês" pede confirmação e mantém os meses anteriores', () => {
    setup();
    render(<Accounts month="2026-11" />);
    fireEvent.click(screen.getByRole('button', { name: 'Parar a partir deste mês' }));
    expect(household.state.bills).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(billsOf('2026-10')).toHaveLength(1);
    expect(billsOf('2026-11')).toHaveLength(0);
  });

  it('conta "Só neste mês" não se repete e o guardado de meses anteriores é lançado no mês', () => {
    household.state = emptyState(['Bianca', 'Julio']);
    render(<Accounts month="2026-10" />);
    const form = screen.getByLabelText('Mês de início').closest('form')!;
    const [name, amount] = Array.from(form.querySelectorAll('input'));
    fireEvent.change(name!, { target: { value: 'Financiamento (setembro)' } });
    fireEvent.change(amount!, { target: { value: '800' } });
    fireEvent.change(screen.getByLabelText('Repete?'), { target: { value: 'once' } });
    fireEvent.submit(form);
    expect(household.state.bills[0]).toMatchObject({ start: '2026-10', end: '2026-10', amount: 80000 });
    expect(billsOf('2026-11')).toHaveLength(0);
    cleanup();
    render(<Income month="2026-10" />);
    const carryForm = screen.getByPlaceholderText('Guardado para o financiamento').closest('form')!;
    const [desc, value] = Array.from(carryForm.querySelectorAll('input'));
    fireEvent.change(desc!, { target: { value: 'Guardado de setembro' } });
    fireEvent.change(value!, { target: { value: '800' } });
    fireEvent.submit(carryForm);
    expect(household.state.carry).toMatchObject([{ desc: 'Guardado de setembro', amount: 80000, month: '2026-10' }]);
  });

  it('a categoria da conta fixa é escolhida numa lista pronta', () => {
    household.state = emptyState(['Bianca', 'Julio']);
    render(<Accounts month="2026-10" />);
    const select = screen.getByLabelText('Categoria') as HTMLSelectElement;
    expect(Array.from(select.options).map(o => o.value)).toEqual(expect.arrayContaining(['Casa', 'Entretenimento', 'Veículo', 'Outros']));
    expect(select.value).toBe('Casa');
    const form = select.closest('form')!;
    const [name, amount] = Array.from(form.querySelectorAll('input'));
    fireEvent.change(name!, { target: { value: 'Netflix' } });
    fireEvent.change(amount!, { target: { value: '45' } });
    fireEvent.change(select, { target: { value: 'Entretenimento' } });
    fireEvent.submit(form);
    expect(household.state.bills[0]).toMatchObject({ name: 'Netflix', category: 'Entretenimento' });
  });

  it('a categoria de uma conta já cadastrada pode ser trocada e vale para todos os meses', () => {
    setup();
    render(<Accounts month="2026-10" />);
    const select = screen.getByLabelText('Categoria de Água') as HTMLSelectElement;
    expect(select.value).toBe('Casa');
    fireEvent.change(select, { target: { value: 'Entretenimento' } });
    expect(household.state.bills[0]?.category).toBe('Entretenimento');
    expect(household.state.bills[0]).toMatchObject({ name: 'Água', amount: 7000 });
  });

  it('categoria antiga em texto livre continua aparecendo na lista', () => {
    setup();
    household.state.bills[0]!.category = 'Moradia';
    render(<Accounts month="2026-10" />);
    const select = screen.getByLabelText('Categoria de Água') as HTMLSelectElement;
    expect(select.value).toBe('Moradia');
  });

  it('a aba Contas não tem mais rendas, extras nem guardado; eles ficam na aba Renda', () => {
    setup();
    const contas = render(<Accounts month="2026-10" />);
    expect(screen.queryByText('Quem somos')).toBeNull();
    expect(screen.queryByText('Guardado de meses anteriores')).toBeNull();
    expect(screen.getByText('Contas fixas')).toBeTruthy();
    contas.unmount();
    render(<Income month="2026-10" />);
    expect(screen.getByText('Quem somos')).toBeTruthy();
    expect(screen.getByText('Guardado de meses anteriores')).toBeTruthy();
    expect(screen.queryByText('Contas fixas')).toBeNull();
  });
});
