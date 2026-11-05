import { Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppState } from '@/lib/household';
import { BRL, monthLabel } from '@/lib/finance';
import { monthReport, reportCsv, reportHtml } from '@/lib/report';
import { Section } from './ui-bits';

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Prints through a hidden frame so pop-up blockers do not get in the way; the print dialog can save as PDF. */
function print(html: string) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) { frame.remove(); return; }
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => { frame.contentWindow?.focus(); frame.contentWindow?.print(); setTimeout(() => frame.remove(), 2000); }, 200);
}

export function Report({ month }: { month: string }) {
  const { s } = useAppState();
  const r = monthReport(s, month);
  const t = r.totals;
  return <Section id="report" title="Relatório do mês" desc={`Tudo o que entrou e as dívidas e contas de ${monthLabel(month)}, para guardar ou imprimir.`}>
    <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {[['Entrou no mês', t.entrou], ['Dívidas pagas', t.dividasPagas], ['Contas pagas', t.contasPagas], ['Falta pagar', t.aPagar]].map(([label, value]) => <div key={label as string}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{BRL(value as number)}</dd></div>)}
    </dl>
    <div className="mt-4 flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => download(`relatorio-${month}.csv`, reportCsv(r), 'text/csv;charset=utf-8')}><Download className="h-4 w-4" />Baixar planilha (Excel)</Button>
      <Button variant="outline" onClick={() => print(reportHtml(r, s.names))}><Printer className="h-4 w-4" />Imprimir ou salvar em PDF</Button>
    </div>
  </Section>;
}
