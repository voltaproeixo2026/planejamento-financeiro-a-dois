import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyState } from '@/lib/finance';
import type { GoalState } from '@/lib/planning-model';

const household = vi.hoisted(() => ({ state: {} as GoalState }));
vi.mock('@/lib/household', () => ({ useAppState: () => ({ s: household.state, update: (fn: (s: GoalState) => GoalState) => { household.state = fn(household.state); } }) }));
import { Planning } from '@/components/app/Planning';

afterEach(cleanup);
describe('Goal editing', () => {
  it('adds a goal to the existing household state without changing finances', () => {
    household.state = emptyState(['Bianca', 'Julio']);
    household.state.savedReal = 12300;
    render(<Planning month="2026-10" />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar meta' }));
    expect(household.state.goals).toHaveLength(1);
    expect(household.state.goals?.[0]?.target).toBe(0);
    expect(household.state.savedReal).toBe(12300);
  });
  it('stores an edited goal target in cents', () => {
    household.state = { ...emptyState(['Bianca', 'Julio']), goals: [{ id: 'g', name: 'Reserva', target: 0, saved: 0, share: 100 }] };
    render(<Planning month="2026-10" />);
    fireEvent.change(screen.getByLabelText('Valor da meta (R$)'), { target: { value: '2500.50' } });
    expect(household.state.goals?.[0]?.target).toBe(250050);
  });
});