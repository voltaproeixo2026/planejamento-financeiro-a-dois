import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyState, type AppState } from '@/lib/finance';
import * as models from '@/lib/planning-model';

const household = vi.hoisted(() => ({ state: {} as AppState }));
vi.mock('@/lib/household', () => ({ useAppState: () => ({ s: household.state }) }));
import { IncomeScenario } from '@/components/app/IncomeScenario';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('Income scenario interaction', () => {
  it('updates the simulated balance immediately when the slider changes without changing household values', () => {
    household.state = emptyState(['Bianca', 'Julio']);
    household.state.incomes = [{ id: 'auto', desc: 'Serviços', person: 1, amount: 200000, freq: 'monthly', day: 10, autonomous: true, active: true }];
    household.state.extras = [{ id: 'extra', desc: 'Extra', person: 1, amount: 100000, month: '2026-10', date: '2026-10-12' }];
    const view = vi.spyOn(models, 'incomeScenarioView');
    render(<IncomeScenario month="2026-10" />);
    expect(view.mock.results.at(-1)?.value.leftover).toBe(140000);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(view.mock.results.at(-1)?.value.leftover).toBe(150000);
    fireEvent.keyDown(slider, { key: 'End' });
    expect(view.mock.results.at(-1)?.value.leftover).toBe(200000);
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(view.mock.results.at(-1)?.value.leftover).toBe(60000);
    expect(household.state.incomes[0]?.amount).toBe(200000);
    expect(household.state.extras[0]?.amount).toBe(100000);
  });
});