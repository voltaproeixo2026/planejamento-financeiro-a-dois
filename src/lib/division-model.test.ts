import { describe, expect, it } from 'vitest';
import { emptyState, type AppState } from './finance';
import { divisionChoice, divisionControl, divisionView, divisionWeekly } from './planning-model';

const month = '2026-10';
function state(): AppState {
  const s = emptyState(['Bianca', 'Julio']);
  s.incomes = [
    { id: 'a', desc: 'Salário', person: 0, amount: 300000, freq: 'monthly', day: 5, active: true, autonomous: false },
    { id: 'b', desc: 'Serviços', person: 1, amount: 100000, freq: 'monthly', day: 10, active: true, autonomous: true },
  ];
  s.bills = [{ id: 'rent', name: 'Aluguel', category: 'Casa', amount: 200000, day: 15, shared: true, person: null, start: month, paid: {} }];
  return s;
}
describe('Division reference behavior', () => {
  it('allows custom shares from zero through one hundred in one-percent steps', () => {
    expect(divisionControl).toEqual({ min: 0, max: 100, step: 1 });
    expect(divisionChoice(state(), month, 'custom', 0).split).toEqual([0, 100]);
    expect(divisionChoice(state(), month, 'custom', 100).split).toEqual([100, 0]);
  });
  it('divides in half for Meio a meio', () => {
    expect(divisionChoice(state(), month, 'half').split).toEqual([50, 50]);
  });
  it('uses month income including extras for Pela renda', () => {
    const s = state();
    s.extras = [{ id: 'extra', person: 1, desc: 'Extra', amount: 200000, month, date: `${month}-12` }];
    expect(divisionChoice(state(), month, 'prop').split).toEqual([75, 25]);
    expect(divisionChoice(s, month, 'prop').split).toEqual([50, 50]);
  });
  it('updates both account amounts and savings for a custom share', () => {
    const view = divisionView(divisionChoice(state(), month, 'custom', 30), month);
    expect(view.people.map(p => [p.accounts, p.percent, p.savings])).toEqual([[60000, 30, 240000], [140000, 70, -40000]]);
  });
  it('keeps individually owned expenses with their owner', () => {
    const s = state();
    s.bills.push({ ...s.bills[0], id: 'own', name: 'Celular', category: 'Pessoal', amount: 50000, shared: false, person: 0, day: 5, start: month, paid: {} });
    expect(divisionView(s, month).people.map(p => [p.accounts, p.percent, p.savings])).toEqual([[150000, 60, 150000], [100000, 40, 0]]);
  });
  it('turns the commitment bar amber only above ninety percent', () => {
    const s = state();
    s.incomes = s.incomes.map(i => ({ ...i, amount: 100000 }));
    s.bills = s.bills.map(b => ({ ...b, amount: 180000 }));
    expect(divisionView(s, month).people[0]).toMatchObject({ usedPercent: 90, hot: false });
    expect(divisionView(divisionWeekly(s, 0, 1000), month).people[0]).toMatchObject({ usedPercent: 94, hot: true, freeMoney: 4000 });
  });
  it('lists receipts for the whole month with the person and remaining transfer amount', () => {
    const s = state();
    s.transfers = [{ id: 'done', person: 0, date: `${month}-05`, month, amount: 20000 }];
    expect(divisionView(s, month).events.map(e => [e.who, e.day, e.label, e.amount])).toEqual([[0, 5, 'Salário', 80000], [1, 10, 'Serviços', 100000]]);
  });
});