import { useEffect, useRef, useState } from 'react';
import { BRL } from '@/lib/finance';
import { niceTicks, type FlowDay } from '@/lib/planning-model';

const M = { l: 46, r: 10, t: 14, b: 28 };
const short = (cents: number) => {
  const v = cents / 100, a = Math.abs(v);
  return a >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
};

/** Joint-account balance across the month: step line, negative band, today marker and a selectable day. */
export function FlowChart({ days, selected, today, onSelect }: { days: FlowDay[]; selected: number; today: number | null; onSelect: (day: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(280, Math.round(el.getBoundingClientRect().width) || 640));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = days.length - 1;
  const height = width >= 600 ? 300 : 220;
  const balances = days.map(d => d.balance);
  const ticks = niceTicks(Math.min(...balances), Math.max(...balances));
  const lo = ticks[0] ?? 0, hi = ticks[ticks.length - 1] ?? 1;
  const x = (day: number) => M.l + ((day - 1) / Math.max(1, n - 1)) * (width - M.l - M.r);
  const y = (v: number) => M.t + (1 - (v - lo) / (hi - lo || 1)) * (height - M.t - M.b);
  const zero = y(0);

  let path = `M${x(1)},${y(days[0]?.balance ?? 0)}`;
  let prev = days[0]?.balance ?? 0;
  for (let d = 1; d <= n; d++) {
    const cur = days[d]!.balance;
    if (cur !== prev) path += ` L${x(d)},${y(prev)} L${x(d)},${y(cur)}`;
    prev = cur;
  }
  path += ` L${x(n)},${y(prev)}`;

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.buttons !== 1 && e.type !== 'pointerdown') return;
    const r = e.currentTarget.getBoundingClientRect();
    const day = Math.round(1 + ((e.clientX - r.left - M.l) / (width - M.l - M.r)) * (n - 1));
    if (!Number.isFinite(day)) return;
    onSelect(Math.min(n, Math.max(1, day)));
  };
  const xDays = [1, 5, 10, 15, 20, 25, 30].filter(d => d <= n);
  const min = Math.min(...balances);
  const description = `Saldo da conta conjunta dia a dia. Começa em ${BRL(days[0]?.balance ?? 0)}, termina em ${BRL(prev)}, mínimo ${BRL(min)}.`;

  return (
    <div ref={box} className="w-full" id="flow">
      <svg width={width} height={height} role="img" aria-label={description} onPointerDown={pick} onPointerMove={pick} style={{ touchAction: 'pan-y', display: 'block' }}>
        {ticks.map(v => <g key={v}><line x1={M.l} x2={width - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={v === 0 ? 1.5 : 1} /><text x={M.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--reference-muted)">{short(v)}</text></g>)}
        {lo < 0 && <rect x={M.l} y={zero} width={width - M.l - M.r} height={Math.max(0, height - M.b - zero)} fill="var(--bad)" opacity={0.1} />}
        {xDays.map(d => <text key={d} x={x(d)} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--reference-muted)">{d}</text>)}
        {today !== null && today >= 1 && today <= n && <g><line x1={x(today)} x2={x(today)} y1={M.t} y2={height - M.b} stroke="var(--accent)" strokeOpacity={0.45} strokeWidth={2} /><text x={x(today)} y={M.t - 3} textAnchor="middle" fontSize="10" fill="var(--accent)">hoje</text></g>}
        <line x1={x(selected)} x2={x(selected)} y1={M.t} y2={height - M.b} stroke="var(--reference-muted)" strokeWidth={1} strokeDasharray="4 3" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} />
        {days.filter(d => d.day >= 1 && d.moves.length).map(d => <circle key={d.day} data-testid="flow-dot" cx={x(d.day)} cy={y(d.balance)} r={d.day === selected ? 5.5 : 4} fill={d.inflow > d.outflow ? 'var(--good)' : 'var(--ink2)'} stroke="var(--surface)" strokeWidth={2} />)}
      </svg>
    </div>
  );
}
