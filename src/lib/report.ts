import { BRL, debtCur, debtSummary, fmtDate, incomeReceipts, monthLabel, summarize, type AppState } from './finance';

export interface ReportLine { date: string; desc: string; who: string; amount: number; status?: 'pago' | 'pendente' }
export interface DebtLine { name: string; owner: string; situation: string; remaining: number }
export interface MonthReport {
  month: string; title: string;
  entradas: ReportLine[]; contas: ReportLine[]; dividas: ReportLine[]; debtsNow: DebtLine[];
  totals: { entrou: number; carry: number; contasPagas: number; dividasPagas: number; aPagar: number; livre: number; sobra: number };
}

/** Everything that came in and went out in a month, built from the same calculations the screens use. */
export function monthReport(s: AppState, month: string, today = new Date().toISOString().slice(0, 10)): MonthReport {
  const sum = summarize(s, month, { today });
  const who = (person: number | null, shared: boolean) => (shared || person === null ? 'Casal' : s.names[person as 0 | 1]);
  const entradas: ReportLine[] = [
    ...s.incomes.flatMap((i) => incomeReceipts(i, month).map((r) => ({ date: r.date, desc: i.desc, who: s.names[i.person], amount: r.amount }))),
    ...s.extras.filter((e) => e.month === month).map((e) => ({ date: e.date, desc: `Extra: ${e.desc}`, who: s.names[e.person], amount: e.amount })),
    ...(s.carry ?? []).filter((c) => c.month === month).map((c) => ({ date: `${month}-01`, desc: `Guardado de meses anteriores: ${c.desc}`, who: 'Casal', amount: c.amount })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const toLine = (i: (typeof sum.items)[number]): ReportLine => ({ date: i.date, desc: i.name, who: who(i.person, i.shared), amount: i.amount, status: i.paid ? 'pago' : 'pendente' });
  const contas = sum.items.filter((i) => i.kind === 'bill').map(toLine);
  const dividas = sum.items.filter((i) => i.kind === 'debt').map(toLine);
  const debtsNow: DebtLine[] = s.debts.map((d) => {
    const cur = debtCur(d, month), bal = debtSummary(d);
    const situation = bal.done ? 'Quitada' : cur < 1 ? `Começa em ${monthLabel(d.firstDue.slice(0, 7))}` : cur > d.installments ? 'Parcelas encerradas' : `Parcela ${cur} de ${d.installments}`;
    return { name: d.origin ? `${d.name} (${d.origin})` : d.name, owner: who(d.person, d.shared), situation, remaining: bal.remaining };
  });
  const sumOf = (l: ReportLine[], status?: string) => l.filter((x) => !status || x.status === status).reduce((a, x) => a + x.amount, 0);
  return {
    month, title: `Relatório de ${monthLabel(month)}`, entradas, contas, dividas, debtsNow,
    totals: { entrou: sum.totalIncome + sum.carry, carry: sum.carry, contasPagas: sumOf(contas, 'pago'), dividasPagas: sumOf(dividas, 'pago'), aPagar: sum.pending, livre: sum.freeMoney[0] + sum.freeMoney[1], sobra: sum.leftover },
  };
}

const num = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
const csvCell = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV that opens in Excel in Portuguese (semicolon separator, comma decimals, UTF-8 with BOM). */
export function reportCsv(r: MonthReport): string {
  const rows: string[][] = [['Tipo', 'Data', 'Descrição', 'Pessoa', 'Valor (R$)', 'Situação']];
  for (const l of r.entradas) rows.push(['Entrou', fmtDate(l.date), l.desc, l.who, num(l.amount), '']);
  for (const l of r.dividas) rows.push(['Dívida', fmtDate(l.date), l.desc, l.who, num(l.amount), l.status ?? '']);
  for (const l of r.contas) rows.push(['Conta fixa', fmtDate(l.date), l.desc, l.who, num(l.amount), l.status ?? '']);
  rows.push([], ['Resumo'], ['Entrou no mês', '', '', '', num(r.totals.entrou), ''], ['Dívidas pagas', '', '', '', num(r.totals.dividasPagas), ''], ['Contas pagas', '', '', '', num(r.totals.contasPagas), ''], ['Falta pagar', '', '', '', num(r.totals.aPagar), ''], ['Dinheiro livre', '', '', '', num(r.totals.livre), ''], ['Sobra', '', '', '', num(r.totals.sobra), '']);
  rows.push([], ['Situação das dívidas'], ['Dívida', '', '', 'Responsável', 'Falta pagar (R$)', 'Parcela']);
  for (const d of r.debtsNow) rows.push([d.name, '', '', d.owner, num(d.remaining), d.situation]);
  return `﻿${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
}

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

/** Self-contained printable page (save as PDF from the print dialog). */
export function reportHtml(r: MonthReport, names: [string, string]): string {
  const table = (head: string[], rows: string[][]) => `<table><thead><tr>${head.map((h, i) => `<th${i >= head.length - 2 ? ' class="r"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map((c, i) => `<td${i >= row.length - 2 ? ' class="r"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${head.length}">Nada neste mês.</td></tr>`}</tbody></table>`;
  const lines = (l: ReportLine[]) => l.map((x) => [fmtDate(x.date), x.desc, x.who, x.status ?? '', BRL(x.amount)]);
  const t = r.totals;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(r.title)}</title><style>
body{font-family:system-ui,sans-serif;color:#1d2b28;margin:32px;font-size:13px}h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:24px 0 8px}p.sub{color:#5b6b67;margin:0 0 16px}
table{width:100%;border-collapse:collapse}th,td{padding:6px 8px;border-bottom:1px solid #dfe6e4;text-align:left}th{font-size:12px;color:#5b6b67}.r{text-align:right}
.totals{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.totals div{border:1px solid #dfe6e4;border-radius:8px;padding:10px}.totals b{display:block;font-size:17px;margin-top:4px}
@media print{body{margin:12mm}}</style></head><body>
<h1>${esc(r.title)}</h1><p class="sub">${esc(names[0])} e ${esc(names[1])} · gerado em ${esc(fmtDate(new Date().toISOString().slice(0, 10)))}</p>
<div class="totals"><div>Entrou no mês<b>${BRL(t.entrou)}</b></div><div>Dívidas pagas<b>${BRL(t.dividasPagas)}</b></div><div>Contas pagas<b>${BRL(t.contasPagas)}</b></div><div>Falta pagar<b>${BRL(t.aPagar)}</b></div><div>Dinheiro livre<b>${BRL(t.livre)}</b></div><div>Sobra<b>${BRL(t.sobra)}</b></div></div>
<h2>Dinheiro que entrou</h2>${table(['Data', 'Descrição', 'Pessoa', '', 'Valor'], r.entradas.map((l) => [fmtDate(l.date), l.desc, l.who, '', BRL(l.amount)]))}
<h2>Dívidas do mês</h2>${table(['Data', 'Dívida', 'Pessoa', 'Situação', 'Valor'], lines(r.dividas))}
<h2>Contas fixas</h2>${table(['Data', 'Conta', 'Pessoa', 'Situação', 'Valor'], lines(r.contas))}
<h2>Situação das dívidas</h2>${table(['Dívida', 'Responsável', 'Parcela', 'Falta pagar'], r.debtsNow.map((d) => [d.name, d.owner, d.situation, BRL(d.remaining)]))}
</body></html>`;
}
