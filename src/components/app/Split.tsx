import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppState } from "@/lib/household";
import { BRL, toCents } from "@/lib/finance";
import { divisionChoice, divisionControl, divisionView, divisionWeekly, payerRows, setItemPayer, type DivisionMethod, type PayerMode } from "@/lib/planning-model";
import { NativeSelect } from "./ui-bits";

export function Split({ month }: { month: string }) {
  const { s, update } = useAppState();
  const view = divisionView(s, month);
  const rows = payerRows(s, month);
  const own = rows.filter(row => row.mode !== 'default').length;
  const methods: { id: DivisionMethod; label: string }[] = [
    { id: 'prop', label: 'Pela renda' }, { id: 'half', label: 'Meio a meio' }, { id: 'custom', label: 'Escolher' },
  ];

  return (
    <div className="division-screen" id="tab-divisao">
      <section className="card wide">
        <h2>Como dividir as contas</h2>
        <div className="seg" id="method" role="group" aria-label="Forma de dividir">
          {methods.map(method => <Button key={method.id} variant="ghost" type="button" data-m={method.id}
            aria-pressed={view.method === method.id} onClick={() => update(st => divisionChoice(st, month, method.id))}>{method.label}</Button>)}
        </div>
        <div id="custom-box" hidden={view.method !== 'custom'}>
          <div className="rangehead"><label htmlFor="custom-pct" id="custom-label">Parte de {s.names[0]}</label><b className="num" id="custom-val">{view.customPercent}%</b></div>
          <input type="range" id="custom-pct" {...divisionControl} value={view.customPercent}
            onChange={event => update(st => divisionChoice(st, month, 'custom', Number(event.target.value)))} />
        </div>
        <p className="small" id="method-note">{view.note}</p>
      </section>
      <div className="people wide">{view.people.map(person => <section className="card person" id={person.person === 0 ? 'person-a' : 'person-b'} key={person.person}>
        <h2>{person.name}</h2>
        <p className="num">{BRL(person.accounts)}</p>
        <p className="small">paga {person.percent}% das contas</p>
        <div className={`meter${person.hot ? ' hot' : ''}`} role="img" aria-label={`Renda comprometida de ${person.name}: ${person.usedPercent}%`}>
          <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 10" aria-hidden="true"><rect width={person.meterPercent} height="10" /></svg>
        </div>
        <p className="small meter-caption">{person.usedPercent}% da renda</p>
        <p className={`left${person.savings < 0 ? ' neg' : ''}`}><span className="small">Sobra</span><b>{BRL(person.savings)}</b></p>
        <details className="more"><summary>Ver detalhes</summary>
          <dl className="kv"><dt>Renda no mês</dt><dd>{BRL(person.income)}</dd><dt>Dinheiro livre no mês</dt><dd>{BRL(person.freeMoney)}</dd></dl>
        </details>
      </section>)}</div>
      <section className="card wide">
        <h2>Quanto transferir em cada recebimento</h2>
        <ul className="plan" id="plan">{view.events.length ? view.events.map((event, index) => <li key={`${event.who}-${event.date}-${index}`}>
          <span className="d">Dia {event.day}</span><span>{s.names[event.who]}<span className="small receipt-label">{event.label}</span></span><span className="v">{BRL(event.amount)}</span>
        </li>) : <li className="small">Cadastre as rendas na aba Contas.</li>}</ul>
      </section>
      <section className="card wide">
        <h2>Dinheiro livre por semana</h2>
        <div className="grid2">{view.people.map(person => <label className="fld" key={person.person}>
          <span id={person.person === 0 ? 'wk-a-l' : 'wk-b-l'}>{person.name}</span><div className="money">
            <Input className="in" id={person.person === 0 ? 'wk-a' : 'wk-b'} type="number" inputMode="decimal" min="0" step="5"
              value={person.weekly} onChange={event => update(st => divisionWeekly(st, person.person, toCents(event.target.value)))} />
          </div></label>)}</div>
        <p className="small section-caption">Fica com cada um e não entra na divisão das contas.</p>
      </section>
      <details className="card wide payers" id="payers">
        <summary><span>Quem paga cada conta</span><span className="small">{own ? `${own} com divisão própria` : 'todas pelo método acima'}</span></summary>
        <p className="small section-caption">Em "Personalizado" cada um paga a sua parte direto, fora da conta conjunta. Vale para todos os meses da conta.</p>
        {rows.length ? <ul className="payer-list">{rows.map(row => <li key={row.key} className={`payer-row${row.mode === 'default' ? '' : ' own'}`}>
          <div className="payer-name"><b>{row.name}</b><span className="small">{BRL(row.amount)}</span></div>
          <NativeSelect aria-label={`Quem paga ${row.name}`} value={row.mode} onChange={event => update(st => setItemPayer(st, row, event.target.value as PayerMode, row.pctA))}>
            <option value="default">Os dois</option><option value="a">Só {s.names[0]}</option><option value="b">Só {s.names[1]}</option><option value="custom">Personalizado</option>
          </NativeSelect>
          {row.mode === 'custom' && <div className="payer-custom">
            <label className="small" htmlFor={`pct-${row.key}`}>Parte de {s.names[0]} (%)</label>
            <Input id={`pct-${row.key}`} className="in" type="number" inputMode="numeric" min="0" max="100" step="1" value={row.pctA}
              onChange={event => update(st => setItemPayer(st, row, 'custom', Number(event.target.value)))} />
            <span className="small">{s.names[0]} {BRL(row.partA)} · {s.names[1]} {BRL(row.partB)}</span>
          </div>}
        </li>)}</ul> : <p className="small">Nenhuma conta ou parcela neste mês.</p>}
      </details>
    </div>
  );
}
