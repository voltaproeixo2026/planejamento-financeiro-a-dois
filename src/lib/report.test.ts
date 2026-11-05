import { describe, expect, it } from 'vitest';
import { emptyState, newDebt } from './finance';
import { monthReport, reportCsv, reportHtml } from './report';

const month = '2026-10';
const state = () => {
  const s = emptyState(['Bianca', 'Julio']);
  s.incomes = [
    { id: 'f', desc: 'Salário', person: 0, amount: 220000, freq: 'monthly', day: 6, active: true, autonomous: false },
    { id: 'a', desc: 'Autônoma', person: 1, amount: 45000, freq: 'biweekly', day: 10, active: true, autonomous: true },
  ];
  s.extras = [{ id: 'x', desc: 'Personal a mais', person: 1, amount: 30000, month, date: '2026-10-20' }];
  s.carry = [{ id: 'c', desc: 'Guardado para o financiamento', amount: 80000, month }];
  s.bills = [{ id: 'luz', name: 'Luz', category: 'Casa', amount: 30000, day: 15, person: null, shared: true, start: month, paid: { [month]: true } }];
  s.debts = [{ ...newDebt(month), name: 'Cartão', origin: 'do pai', amount: 40000, installments: 4, ref: 1, ref_ym: month, firstDue: '2026-10-12', person: 1, shared: false, paidCount: 1 }];
  return s;
};

describe('Relatório do mês', () => {
  it('soma tudo o que entrou e separa dívidas e contas pagas e pendentes', () => {
    const r = monthReport(state(), month, '2026-10-31');
    expect(r.entradas.map(e => e.desc)).toEqual(expect.arrayContaining(['Salário', 'Autônoma', 'Extra: Personal a mais', 'Guardado de meses anteriores: Guardado para o financiamento']));
    expect(r.entradas.reduce((a, e) => a + e.amount, 0)).toBe(r.totals.entrou);
    expect(r.totals.entrou).toBe(220000 + 90000 + 30000 + 80000);
    expect(r.dividas).toHaveLength(1);
    expect(r.dividas[0]).toMatchObject({ status: 'pago', amount: 40000, who: 'Julio' });
    expect(r.totals.dividasPagas).toBe(40000);
    expect(r.totals.contasPagas).toBe(30000);
    expect(r.totals.aPagar).toBe(0);
    expect(r.debtsNow[0]).toMatchObject({ name: 'Cartão (do pai)', situation: 'Parcela 1 de 4', remaining: 120000 });
  });
  it('gera CSV para o Excel em português e uma página imprimível sem HTML injetado', () => {
    const s = state();
    s.incomes[0]!.desc = '<b>Salário</b>';
    const r = monthReport(s, month, '2026-10-31');
    const csv = reportCsv(r);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Tipo;Data;Descrição;Pessoa;Valor (R$);Situação');
    expect(csv).toContain('Dívida;12/10/2026;Cartão (1/4);Julio;400,00;pago');
    const html = reportHtml(r, s.names);
    expect(html).toContain('Relatório de');
    expect(html).not.toContain('<b>Salário</b>');
    expect(html).toContain('&lt;b&gt;Salário&lt;/b&gt;');
  });
});
