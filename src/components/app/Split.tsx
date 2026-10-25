import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppState } from "@/lib/household";
import { BRL, toCents } from "@/lib/finance";
import { divisionChoice, divisionControl, divisionView, divisionWeekly, type DivisionMethod } from "@/lib/planning-model";

export function Split({ month }: { month: string }) {
  const { s, update } = useAppState();
  const view = divisionView(s, month);
  const methods: { id: DivisionMethod; label: string }[] = [
    { id: 'prop', label: 'Pela renda' }, { id: 'half', label: 'Meio a meio' }, { id: 'custom', label: 'Escolher' },
  ];

  return (
    <div className="division-screen" id="tab-divisao">
      <section className="card">
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
      {view.people.map(person => <section className="card person" id={person.person === 0 ? 'person-a' : 'person-b'} key={person.person}>
        <header><h2>{person.name}</h2><span className="small">paga {person.percent}% das contas</span></header>
        <p className="num">{BRL(person.accounts)}<span className="small account-caption"> por mês nas contas</span></p>
        <div><div className={`meter${person.hot ? ' hot' : ''}`} role="img" aria-label={`Renda comprometida de ${person.name}: ${person.usedPercent}%`}>
          <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 10" aria-hidden="true"><rect width={person.meterPercent} height="10" /></svg>
        </div><p className="small meter-caption">Contas e dinheiro livre usam {person.usedPercent}% da renda.</p></div>
        <dl className="kv"><dt>Renda no mês</dt><dd>{BRL(person.income)}</dd><dt>Dinheiro livre no mês</dt><dd>{BRL(person.freeMoney)}</dd><dt>Sobra para poupar</dt><dd>{BRL(person.savings)}</dd></dl>
      </section>)}
      <section className="card">
        <h2>Dinheiro livre por semana</h2>
        <p className="small section-caption">Fica na conta de cada um e não entra na divisão das contas.</p>
        <div className="grid2">{view.people.map(person => <label className="fld" key={person.person}>
          <span id={person.person === 0 ? 'wk-a-l' : 'wk-b-l'}>{person.name}</span><div className="money">
            <Input className="in" id={person.person === 0 ? 'wk-a' : 'wk-b'} type="number" inputMode="decimal" min="0" step="5"
              value={person.weekly} onChange={event => update(st => divisionWeekly(st, person.person, toCents(event.target.value)))} />
          </div></label>)}</div>
      </section>
      <section className="card wide">
        <h2>Quanto transferir em cada recebimento</h2>
        <p className="small section-caption">Para a conta conjunta, no dia em que o dinheiro cai.</p>
        <ul className="plan" id="plan">{view.events.length ? view.events.map((event, index) => <li key={`${event.who}-${event.date}-${index}`}>
          <span className="d">Dia {event.day}</span><span>{s.names[event.who]}<span className="small receipt-label">{event.label}</span></span><span className="v">{BRL(event.amount)}</span>
        </li>) : <li className="small">Cadastre as rendas na aba Contas.</li>}</ul>
      </section>
    </div>
  );
}
