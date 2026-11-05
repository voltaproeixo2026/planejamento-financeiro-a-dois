import { describe, expect, it } from 'vitest';
import { emptyState, jointCashflow, summarize, type AppState } from './finance';
import { debtOwnerTotals, divisionChoice, divisionControl, divisionView, divisionWeekly, payerRows, setItemPayer } from './planning-model';

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
describe('divisão personalizada por conta', () => {
  const month = '2026-10';
  const people = () => {
    const s = emptyState(['Bianca', 'Julio']);
    s.incomes = [{ id: 'a', desc: 'Salário', person: 0, amount: 300000, freq: 'monthly', day: 5, active: true, autonomous: false }, { id: 'b', desc: 'Autônoma', person: 1, amount: 200000, freq: 'monthly', day: 20, active: true, autonomous: true }];
    s.bills = [
      { id: 'luz', name: 'Luz', category: 'Casa', amount: 30000, day: 10, person: null, shared: true, start: month, paid: {} },
      { id: 'agua', name: 'Água', category: 'Casa', amount: 10000, day: 12, person: null, shared: true, start: month, paid: {} },
    ];
    s.debts = [
      { id: 'cartao', name: 'Cartão', total: 80000, installments: 4, amount: 20000, paidCount: 0, firstDue: '2026-10-05', person: null, shared: true },
      { id: 'fin', name: 'Financiamento', total: 200000, installments: 4, amount: 50000, paidCount: 0, firstDue: '2026-10-08', person: null, shared: true },
    ];
    return s;
  };
  it('cada um paga a parte combinada de cada conta, direto', () => {
    // Bianca: metade do cartão e do financiamento. Julio: contas da casa e a outra metade do cartão e do financiamento.
    let s = people();
    s = setItemPayer(s, { kind: 'bill', refId: 'luz' }, 'b');
    s = setItemPayer(s, { kind: 'bill', refId: 'agua' }, 'b');
    s = setItemPayer(s, { kind: 'debt', refId: 'cartao' }, 'custom', 50);
    s = setItemPayer(s, { kind: 'debt', refId: 'fin' }, 'custom', 50);
    const sum = summarize(s, month);
    expect(sum.individual).toEqual([10000 + 25000, 40000 + 10000 + 25000]);
    expect(sum.sharedTotal).toBe(0);
    expect(sum.share).toEqual([0, 0]);
    expect(sum.paid + sum.pending).toBe(110000);
    const v = divisionView(s, month);
    expect(v.people.map(p => p.accounts)).toEqual([35000, 75000]);
    expect(v.people.map(p => p.percent)).toEqual([32, 68]);
  });
  it('conta personalizada fica fora da conta conjunta e das transferências', () => {
    let s = people();
    s = setItemPayer(s, { kind: 'debt', refId: 'cartao' }, 'custom', 30);
    const sum = summarize(s, month);
    expect(sum.sharedTotal).toBe(30000 + 10000 + 50000);
    expect(jointCashflow(s, month).moves.some(m => m.desc.startsWith('Cartão'))).toBe(false);
    expect(sum.individual).toEqual([6000, 14000]);
  });
  it('voltar para "os dois" devolve a conta ao método geral', () => {
    let s = people();
    s = setItemPayer(s, { kind: 'bill', refId: 'luz' }, 'custom', 20);
    s = setItemPayer(s, { kind: 'bill', refId: 'luz' }, 'default');
    expect(s.bills[0]).toMatchObject({ shared: true, person: null, splitA: undefined });
    expect(summarize(s, month).sharedTotal).toBe(people().bills[0]!.amount + 10000 + 20000 + 50000);
  });
  it('percentual fora de 0 a 100 é ajustado e os centavos não se perdem', () => {
    let s = people();
    s = setItemPayer(s, { kind: 'bill', refId: 'luz' }, 'custom', 140);
    expect(s.bills[0]?.splitA).toBe(100);
    s = setItemPayer(s, { kind: 'bill', refId: 'agua' }, 'custom', 33);
    const row = payerRows(s, month).find(r => r.refId === 'agua')!;
    expect(row.partA + row.partB).toBe(10000);
  });
  it('totais de dívidas por pessoa dividem a dívida personalizada', () => {
    let s = people();
    s = setItemPayer(s, { kind: 'debt', refId: 'cartao' }, 'custom', 50);
    const t = debtOwnerTotals(s, month);
    expect(t[0]!.monthly).toBe(10000);
    expect(t[1]!.monthly).toBe(10000);
    expect(t[2]!.monthly).toBe(50000);
  });
});
