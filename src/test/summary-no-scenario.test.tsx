import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyState, type AppState } from '@/lib/finance';

const household = vi.hoisted(() => ({ state: {} as AppState }));
vi.mock('@/lib/household', () => ({ useAppState: () => ({ s: household.state, update: () => {} }) }));
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
import { Dashboard } from '@/components/app/Dashboard';
afterEach(cleanup);

describe('Resumo', () => {
  it('não mostra a simulação "E se a renda autônoma vier menor?"', () => {
    household.state = emptyState(['Bianca', 'Julio']);
    render(<Dashboard month="2026-10" />);
    expect(screen.queryByText(/renda autônoma vier menor/i)).toBeNull();
    expect(screen.queryByLabelText('Percentual da renda autônoma')).toBeNull();
    expect(screen.getByText('Para onde vai a renda')).toBeTruthy();
  });
});
