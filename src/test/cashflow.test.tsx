import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyState, type AppState } from '@/lib/finance';

const household = vi.hoisted(() => ({ state: {} as AppState }));
vi.mock('@/lib/household', () => ({ useAppState: () => ({ s: household.state, update: (fn: (s: AppState) => AppState) => { household.state = fn(household.state); } }) }));
import { Cashflow } from '@/components/app/Cashflow';
afterEach(cleanup);
vi.stubGlobal('PointerEvent', MouseEvent);
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });

describe('Mês: gráfico do saldo', () => {
  const setup = () => {
    const s = emptyState(['Bianca', 'Julio']);
    s.bills = [{ id: 'rent', name: 'Aluguel', category: 'Casa', amount: 100000, day: 10, person: null, shared: true, start: '2026-10', paid: {} }];
    s.cushion = { '2026-10': 30000 };
    household.state = s;
  };
  it('mostra o saldo do dia escolhido, avisa quando está no vermelho e sugere o colchão', () => {
    setup();
    const { container } = render(<Cashflow month="2026-10" />);
    expect(container.querySelector('svg[role="img"]')).toBeTruthy();
    expect(screen.getAllByTestId('flow-dot').length).toBeGreaterThan(0);
    const svg = container.querySelector('svg')!;
    svg.getBoundingClientRect = () => ({ left: 0, right: 640, top: 0, bottom: 300, width: 640, height: 300, x: 0, y: 0, toJSON() {} });
    fireEvent.pointerDown(svg, { clientX: 318, clientY: 100, pointerType: 'touch' });
    expect(screen.getByText(/Dia 15 · saldo/)).toBeTruthy();
    expect(screen.getByText('No vermelho')).toBeTruthy();
    expect(screen.getByText(/precisa ser de pelo menos/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Usar esse valor' }));
    expect(household.state.cushion['2026-10']).toBeGreaterThan(30000);
  });
});
