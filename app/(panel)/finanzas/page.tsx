"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Flame,
  HandCoins,
  Medal,
  PieChart,
  Percent,
  Receipt,
  Trophy,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useApp } from "@/components/AppProvider";
import {
  Avatar,
  Button,
  Card,
  Empty,
  PageHeader,
  Select,
  Table,
} from "@/components/ui";
import { CountUp, Gauge, Ring, Sparkline } from "@/components/viz";
import {
  addDays,
  daysInMonth,
  fmtDate,
  MONTHS,
  parseISO,
  toISO,
  today,
} from "@/lib/dates";
import { CHARGE_LABEL, folio, isActive, money } from "@/lib/logic";
import type { Charge, ChargeCategory, Payment, Reservation } from "@/lib/types";

/** Pasa a true un instante después de aparecer: dispara las animaciones de entrada de los gráficos. */
function useEntered() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return on;
}

function EmptyChart({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return <Empty icon={Icon}>{children}</Empty>;
}

/** Barras verticales con degradé de acento, esquinas redondeadas y tooltip. */
function Bars({
  data,
  format,
  height = 190,
  highlight,
}: {
  data: { label: string; value: number; tip?: string }[];
  format: (n: number) => string;
  height?: number;
  highlight?: string;
}) {
  const on = useEntered();
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.reduce(
    (a, b) => (b.value > a.value ? b : a),
    data[0] ?? { label: "", value: 0 },
  );
  const wide = data.length > 16;
  return (
    <div className="overflow-x-auto px-4 pb-4 pt-8">
      <div className={wide ? "min-w-[560px]" : ""}>
        <div className="relative flex items-end gap-1.5" style={{ height }}>
          {[0.5, 1].map((g) => (
            <div
              key={g}
              className="pointer-events-none absolute inset-x-0 border-t border-dashed border-gray-300/80"
              style={{ bottom: height * g }}
            >
              <span className="label-mono absolute -top-5 left-0 text-[12px] tabular-nums text-gray-600">
                {format(max * g)}
              </span>
            </div>
          ))}
          {data.map((d, i) => (
            <div
              key={d.label}
              tabIndex={0}
              className="group relative flex h-full flex-1 items-end justify-center rounded-t-md outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <div
                className={`w-full max-w-[44px] rounded-t-[8px] bg-gradient-to-t shadow-sm transition-[height,opacity] duration-700 ease-out motion-reduce:transition-none ${d.label === highlight ? "from-accent/80 to-accent" : "from-accent/35 to-accent/70 group-hover:from-accent/60 group-hover:to-accent group-focus:to-accent"}`}
                style={{
                  height: on ? `${(d.value / max) * 100}%` : 0,
                  minHeight: on && d.value ? 3 : 0,
                  transitionDelay: `${Math.min(i, 20) * 25}ms`,
                }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[14px] text-white shadow-pop group-hover:block group-focus:block">
                {d.tip ?? d.label}: <b>{format(d.value)}</b>
              </div>
              {d === peak && d.value > 0 && (
                <span
                  className="num pointer-events-none absolute whitespace-nowrap text-[15px] tabular-nums text-fg"
                  style={{ bottom: `calc(${(d.value / max) * 100}% + 4px)` }}
                >
                  {format(d.value)}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1.5 border-t border-gray-300 pt-2">
          {data.map((d) => (
            <div
              key={d.label}
              className="min-w-0 flex-1 truncate text-center text-[13px] font-medium tabular-nums text-gray-600"
            >
              {d.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Área con la línea del ACUMULADO: cómo se fue sumando lo vendido día a día. Al pasar el mouse o enfocar, muestra el valor. */
function AreaChart({
  data,
  format,
  height = 220,
  totalDays,
  todayIdx,
  summary,
}: {
  data: { label: string; value: number; tip: string }[];
  format: (n: number) => string;
  height?: number;
  totalDays: number;
  todayIdx?: number;
  summary: string;
}) {
  const on = useEntered();
  const W = 600;
  const max = Math.max(1, ...data.map((d) => d.value));
  const xOf = (i: number) => ((i + 0.5) / totalDays) * W;
  const pts = data.map(
    (d, i) => [xOf(i), height - (d.value / max) * (height - 12) - 6] as const,
  );
  const smooth = pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M${x.toFixed(1)},${y.toFixed(1)}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return `${acc} C${cx.toFixed(1)},${py.toFixed(1)} ${cx.toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
  }, "");
  const last = pts[pts.length - 1];
  const area = last
    ? `${smooth} L${last[0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`
    : "";
  const colPct = 100 / totalDays;
  return (
    <div className="overflow-x-auto px-4 pb-4 pt-8">
      <div className="min-w-[560px]" role="group" aria-label={summary}>
        <div className="relative" style={{ height }}>
          {[0.5, 1].map((g) => (
            <div
              key={g}
              className="pointer-events-none absolute inset-x-0 border-t border-dashed border-gray-300/80"
              style={{ bottom: (height - 12) * g + 6 }}
            >
              <span className="label-mono absolute -top-5 left-0 text-[12px] tabular-nums text-gray-600">
                {format(max * g)}
              </span>
            </div>
          ))}
          {todayIdx !== undefined && (
            <div
              className="pointer-events-none absolute inset-y-0 border-l-2 border-dashed border-accent/60"
              style={{ left: `${(todayIdx + 0.5) * colPct}%` }}
            >
              <span className="label-mono absolute -top-6 left-1/2 -translate-x-1/2 rounded-md bg-accent px-1.5 text-[12.5px] text-accent-fg">
                Hoy
              </span>
            </div>
          )}
          <svg
            viewBox={`0 0 ${W} ${height}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
            aria-hidden
          >
            <defs>
              <linearGradient id="fin-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0.4" />
                <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <g style={{ opacity: on ? 1 : 0, transition: "opacity 0.8s ease-out" }}>
              <path d={area} fill="url(#fin-area)" />
              <path
                d={smooth}
                fill="none"
                stroke="rgb(var(--accent))"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </svg>
          <div className="absolute inset-y-0 left-0 flex" style={{ width: `${data.length * colPct}%` }}>
            {data.map((d, i) => {
              const edge =
                i < 3
                  ? "left-0"
                  : i > data.length - 4 && data.length > 6
                    ? "right-0"
                    : "left-1/2 -translate-x-1/2";
              return (
                <div
                  key={d.label}
                  tabIndex={0}
                  aria-label={d.tip}
                  className="group relative h-full flex-1 outline-none focus-visible:bg-accent/10"
                >
                  <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px bg-accent/40 group-hover:block group-focus:block" />
                  <span
                    className={`pointer-events-none absolute left-1/2 h-3 w-3 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-panel bg-accent shadow ${i === data.length - 1 ? "block" : "hidden group-hover:block group-focus:block"}`}
                    style={{ bottom: `${height - pts[i][1]}px` }}
                  />
                  <div
                    className={`pointer-events-none absolute top-0 z-10 hidden whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[14px] text-white shadow-pop group-hover:block group-focus:block ${edge}`}
                  >
                    {d.tip}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-1 flex border-t border-gray-300 pt-2">
          {Array.from({ length: totalDays }, (_, i) => (
            <div
              key={i}
              className="min-w-0 flex-1 truncate text-center text-[13px] font-medium tabular-nums text-gray-600"
            >
              {i % 3 === 0 ? i + 1 : ""}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Mapa de calor del mes: cada día un cuadradito, más fuerte cuanto más lleno estuvo el hotel. */
function Heatmap({
  year,
  month,
  occ,
  todayDay,
}: {
  year: number;
  month: number;
  occ: { label: string; value: number }[];
  todayDay?: number;
}) {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: (null | { day: number; pct: number })[] = [
    ...Array.from({ length: lead }, () => null),
    ...occ.map((o, i) => ({ day: i + 1, pct: o.value })),
  ];
  const shade = (pct: number) =>
    `rgb(var(--accent) / ${(0.07 + 0.93 * (pct / 100)).toFixed(2)})`;
  return (
    <div className="p-4 sm:p-5">
      <div className="mx-auto grid max-w-[560px] grid-cols-7 gap-1.5 sm:gap-2">
        {["L", "M", "M", "J", "V", "S", "D"].map((w, i) => (
          <div
            key={i}
            className="label-mono pb-1 text-center text-[12.5px] text-gray-600"
            aria-hidden
          >
            {w}
          </div>
        ))}
        {cells.map((c, i) =>
          c === null ? (
            <div key={`e${i}`} aria-hidden />
          ) : (
            <div
              key={c.day}
              tabIndex={0}
              aria-label={`Día ${c.day}: ${c.pct}% ocupado`}
              className={`group relative flex aspect-square min-h-[36px] items-center justify-center rounded-lg text-[14px] font-semibold tabular-nums outline-none transition-transform duration-150 hover:scale-105 focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none ${c.pct > 55 ? "text-accent-fg" : "text-fg"} ${c.day === todayDay ? "ring-2 ring-fg ring-offset-2 ring-offset-panel" : ""}`}
              style={{ backgroundColor: shade(c.pct) }}
            >
              {c.day}
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[14px] font-normal text-white shadow-pop group-hover:block group-focus:block">
                Día {c.day}: <b>{c.pct}%</b> ocupado
              </span>
            </div>
          ),
        )}
      </div>
      <div className="mx-auto mt-4 flex max-w-[560px] flex-wrap items-center gap-2 text-[13.5px] text-gray-600">
        <span>Vacío</span>
        <span className="flex gap-1" aria-hidden>
          {[0, 25, 50, 75, 100].map((p) => (
            <span
              key={p}
              className="h-3.5 w-6 rounded"
              style={{ backgroundColor: shade(p) }}
            />
          ))}
        </span>
        <span>Lleno</span>
        {todayDay !== undefined && (
          <span className="ml-auto">El cuadrado con borde es hoy</span>
        )}
      </div>
    </div>
  );
}

/** Barras horizontales (ranking) con degradé. */
function HBars({
  rows,
  format,
}: {
  rows: { label: string; value: number }[];
  format: (n: number) => string;
}) {
  const on = useEntered();
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <ul className="stagger space-y-4 p-4 sm:p-5">
      {rows.map((r, i) => (
        <li key={r.label} className="group">
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-[15px]">
            <span className="min-w-0 font-medium text-fg">{r.label}</span>
            <span className="ml-auto flex items-baseline gap-2 whitespace-nowrap tabular-nums text-fg">
              <b className="num text-[18px]">{format(r.value)}</b>
              <span className="w-10 text-right text-[13.5px] text-gray-600">
                {Math.round((r.value / total) * 100)}%
              </span>
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-gray-200/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent/50 to-accent transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{
                width: on ? `${(r.value / max) * 100}%` : 0,
                transitionDelay: `${i * 60}ms`,
              }}
            />
          </div>
        </li>
      ))}
      {!rows.length && (
        <li>
          <EmptyChart icon={BarChart3}>
            Todavía no hay datos en este mes.
          </EmptyChart>
        </li>
      )}
    </ul>
  );
}

const DONUT_TONES = [1, 0.75, 0.55, 0.38, 0.25];

/** Dona con el total en el centro. Al pasar el mouse o enfocar una parte de la lista, se resalta ese sector. */
function Donut({
  rows,
  format,
  total,
  empty,
}: {
  rows: { label: string; value: number }[];
  format: (n: number) => string;
  total: number;
  empty: string;
}) {
  const on = useEntered();
  const [act, setAct] = useState<number | null>(null);
  const sum = rows.reduce((s, r) => s + r.value, 0) || 1;
  const size = 168;
  const stroke = 24;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arcs = rows.reduce<{ len: number; start: number }[]>((acc, row) => {
    const start = acc.length
      ? acc[acc.length - 1].start + acc[acc.length - 1].len
      : 0;
    return [...acc, { len: (row.value / sum) * c, start }];
  }, []);
  if (!rows.length) return <EmptyChart icon={PieChart}>{empty}</EmptyChart>;
  const shown = act === null ? null : rows[act];
  return (
    <div className="flex flex-col items-center gap-5 p-4">
      <div
        className="relative shrink-0"
        style={{ width: size, height: size }}
        role="img"
        aria-label={rows.map((x) => `${x.label} ${format(x.value)}`).join(", ")}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-hidden
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgb(var(--gray-200))"
            strokeWidth={stroke}
          />
          {rows.map((row, i) => (
            <circle
              key={row.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="rgb(var(--accent))"
              strokeOpacity={
                act === null || act === i
                  ? DONUT_TONES[i % DONUT_TONES.length]
                  : 0.12
              }
              strokeWidth={act === i ? stroke + 6 : stroke}
              strokeDasharray={`${on ? Math.max(0, arcs[i].len - 2) : 0} ${c}`}
              strokeDashoffset={-arcs[i].start}
              onMouseEnter={() => setAct(i)}
              onMouseLeave={() => setAct(null)}
              style={{
                transition: `stroke-dasharray 0.9s cubic-bezier(0.22, 1, 0.36, 1) ${i * 120}ms, stroke-opacity 0.2s, stroke-width 0.2s`,
              }}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="label-mono max-w-full truncate text-[12.5px] text-gray-600">
            {shown ? shown.label : "Total"}
          </span>
          <span className="num text-[21px] leading-tight tabular-nums text-fg">
            {format(shown ? shown.value : total)}
          </span>
          {shown && (
            <span className="text-[13.5px] text-gray-600">
              {Math.round((shown.value / sum) * 100)}%
            </span>
          )}
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {rows.map((row, i) => (
          <li
            key={row.label}
            tabIndex={0}
            onMouseEnter={() => setAct(i)}
            onMouseLeave={() => setAct(null)}
            onFocus={() => setAct(i)}
            onBlur={() => setAct(null)}
            className={`flex min-h-[40px] items-center gap-3 rounded-lg px-2 text-[15px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/50 motion-reduce:transition-none ${act === i ? "bg-accent/10" : ""}`}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-sm bg-accent"
              style={{ opacity: DONUT_TONES[i % DONUT_TONES.length] }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate font-medium text-fg">
              {row.label}
            </span>
            <span className="flex items-baseline whitespace-nowrap text-right tabular-nums">
              <b className="num text-[17px] text-fg">
                {format(row.value)}
              </b>
              <span className="w-10 text-[13.5px] text-gray-600">
                {Math.round((row.value / sum) * 100)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Flechita de variación contra el mes anterior. No se muestra si no hay datos del mes anterior. */
function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (!(prev > 0)) return null;
  const p = Math.round(((cur - prev) / prev) * 100);
  const up = p >= 0;
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] leading-5">
      <span
        className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded-full px-2 py-0.5 font-semibold tabular-nums ring-1 ring-inset ${up ? "bg-green-50 text-green-700 ring-green-200" : "bg-red-50 text-red-700 ring-red-200"}`}
      >
        {up ? (
          <ArrowUp size={14} strokeWidth={2.5} aria-hidden />
        ) : (
          <ArrowDown size={14} strokeWidth={2.5} aria-hidden />
        )}
        {Math.abs(p)}%
      </span>
      <span className="opacity-80">
        {up ? "más" : "menos"} que el mes anterior
      </span>
    </span>
  );
}

const MEDALS = ["#E9B949", "#A8B0BA", "#C98A55"];
const PODIUM_H = [128, 92, 68];

/** Podio de los 3 que más gastaron y lista del resto. */
function Podium({
  top,
  format,
}: {
  top: [string, { name: string; value: number; stays: number }][];
  format: (n: number) => string;
}) {
  const on = useEntered();
  const podium = [1, 0, 2].filter((i) => top[i]);
  const rest = top.slice(3);
  return (
    <div className="p-4">
      <div className="flex items-end justify-center gap-2 sm:gap-4">
        {podium.map((i) => {
          const [id, g] = top[i];
          return (
            <div
              key={id}
              className="flex min-w-0 flex-1 flex-col items-center text-center"
              style={{ maxWidth: 170 }}
            >
              <span
                className="mb-1 flex h-9 w-9 items-center justify-center rounded-full text-[#1a1a1a] shadow"
                style={{ backgroundColor: MEDALS[i] }}
                role="img"
                aria-label={`Puesto ${i + 1}`}
              >
                <Medal size={20} aria-hidden />
              </span>
              <Avatar name={g.name} size={i === 0 ? 56 : 46} />
              <Link
                href={`/huespedes?g=${id}`}
                className="mt-1.5 line-clamp-2 w-full break-words text-[15px] font-semibold leading-tight underline-offset-4 hover:text-accent hover:underline"
              >
                {g.name}
              </Link>
              <b className="num mt-0.5 text-[17px] tabular-nums text-fg">
                {format(g.value)}
              </b>
              <span className="mb-2 text-[13.5px] text-gray-600">
                {g.stays} {g.stays === 1 ? "vez" : "veces"}
              </span>
              <div
                className="flex w-full items-start justify-center rounded-t-xl bg-gradient-to-t from-accent/70 to-accent pt-2 transition-[height] duration-700 ease-out motion-reduce:transition-none"
                style={{
                  height: on ? PODIUM_H[i] : 0,
                  transitionDelay: `${i * 120}ms`,
                }}
              >
                <span className="num text-[30px] leading-none text-accent-fg">
                  {i + 1}°
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {rest.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-200/60 border-t border-gray-200/80">
          {rest.map(([id, g], k) => (
            <li
              key={id}
              className="flex min-h-[48px] items-center gap-3 py-2 text-[15px]"
            >
              <span className="num w-7 shrink-0 text-center text-[17px] tabular-nums text-gray-600">
                {k + 4}°
              </span>
              <Avatar name={g.name} size={34} />
              <Link
                href={`/huespedes?g=${id}`}
                className="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:text-accent hover:underline"
              >
                {g.name}
              </Link>
              <span className="hidden whitespace-nowrap text-[13.5px] text-gray-600 min-[420px]:inline">
                {g.stays} {g.stays === 1 ? "vez" : "veces"}
              </span>
              <b className="num min-w-[84px] whitespace-nowrap text-right text-[17px] tabular-nums">{format(g.value)}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Dato destacado con ícono. */
function Highlight({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex min-w-[250px] items-center gap-3 rounded-2xl border border-gray-200/80 bg-panel p-4 shadow-card">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-inset ring-accent/20">
        <Icon size={22} aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="label-mono text-[12.5px] text-gray-600">{label}</div>
        <div className="num truncate text-[22px] leading-tight tabular-nums text-fg">
          {value}
        </div>
        <div className="truncate text-[14px] text-gray-600">{sub}</div>
      </div>
    </div>
  );
}

/** Ficha de panel con ícono en recuadro de acento suave. */
function Tile({
  icon: Icon,
  label,
  sub,
  tone = "accent",
  delta,
  children,
}: {
  icon: React.ElementType;
  label: string;
  sub: string;
  tone?: "accent" | "red";
  delta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-panel p-5 shadow-card">
      <span
        className={
          tone === "red"
            ? "flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-700 ring-1 ring-inset ring-red-200"
            : "flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-inset ring-accent/20"
        }
      >
        <Icon size={20} aria-hidden />
      </span>
      <div className="label-mono mt-3 text-[12.5px] text-gray-600">{label}</div>
      <div
        className={`num mt-1.5 text-[30px] leading-none tabular-nums ${tone === "red" ? "text-red-700" : "text-fg"}`}
      >
        {children}
      </div>
      <div className="mt-2 text-[14px] leading-snug text-gray-600">{sub}</div>
      {delta && <div className="mt-2.5">{delta}</div>}
    </div>
  );
}

interface MonthSrc {
  reservations: Reservation[];
  charges: Charge[];
  payments: Payment[];
  roomCount: number;
}

/** Números de un mes (mismos cálculos de siempre; se usa para el mes elegido y el anterior). */
function calcMonth(src: MonthSrc, year: number, month: number) {
  const days = daysInMonth(year, month);
  const mStart = toISO(new Date(year, month, 1));
  const mEnd = addDays(mStart, days);
  const rooms = src.roomCount || 1;
  const occ = new Array(days).fill(0);
  const daily = new Array(days).fill(0);
  let lodging = 0,
    roomNights = 0,
    resCount = 0;
  const bySource = new Map<string, number>();
  for (const r of src.reservations) {
    if (!isActive(r) || r.checkIn >= mEnd || r.checkOut <= mStart) continue;
    resCount++;
    for (
      let d = r.checkIn < mStart ? mStart : r.checkIn;
      d < r.checkOut && d < mEnd;
      d = addDays(d, 1)
    ) {
      const i = Math.round(
        (parseISO(d).getTime() - parseISO(mStart).getTime()) / 86400000,
      );
      occ[i]++;
      daily[i] += r.rate;
      lodging += r.rate;
      roomNights++;
      bySource.set(r.source, (bySource.get(r.source) ?? 0) + r.rate);
    }
  }
  const byCat = new Map<ChargeCategory, number>();
  let extras = 0;
  for (const c of src.charges)
    if (c.date >= mStart && c.date < mEnd) {
      byCat.set(c.category, (byCat.get(c.category) ?? 0) + c.amount);
      extras += c.amount;
      const i = Math.round(
        (parseISO(c.date).getTime() - parseISO(mStart).getTime()) / 86400000,
      );
      if (i >= 0 && i < days) daily[i] += c.amount;
    }
  const byMethod = new Map<string, number>();
  let cobrado = 0;
  for (const p of src.payments)
    if (p.date >= mStart && p.date < mEnd) {
      byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount);
      cobrado += p.amount;
    }
  const available = rooms * days;
  const occPct = (roomNights / available) * 100;
  const adr = roomNights ? lodging / roomNights : 0;
  const revpar = lodging / available;
  return {
    occ: occ.map((n, i) => ({
      label: String(i + 1),
      value: Math.round((n / rooms) * 100),
      tip: `${i + 1}/${month + 1} · ${n} habitaciones ocupadas`,
    })),
    daily: daily as number[],
    lodging,
    extras,
    cobrado,
    resCount,
    occPct,
    adr,
    revpar,
    bySource: [...bySource.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
    byCat: [
      { label: "Alojamiento", value: lodging },
      ...[...byCat.entries()].map(([k, value]) => ({
        label: CHARGE_LABEL[k],
        value,
      })),
    ].sort((a, b) => b.value - a.value),
    byMethod: [...byMethod.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
  };
}

export default function FinanzasPage() {
  const { data, idx } = useApp();
  const t = today();
  const now = parseISO(t);
  const [ym, setYm] = useState(`${now.getFullYear()}-${now.getMonth()}`);
  const [year, month] = ym.split("-").map(Number);
  const days = daysInMonth(year, month);
  const mStart = toISO(new Date(year, month, 1));
  const cur = data.settings[0]?.currency ?? "$";
  const fm = (n: number) => money(n, cur);
  const short = (n: number) =>
    n >= 1e6
      ? `${(n / 1e6).toFixed(1)}M`
      : n >= 1e3
        ? `${Math.round(n / 1e3)}k`
        : String(Math.round(n));

  const m = useMemo(
    () =>
      calcMonth(
        {
          reservations: data.reservations,
          charges: data.charges,
          payments: data.payments,
          roomCount: data.rooms.length,
        },
        year,
        month,
      ),
    [data.reservations, data.charges, data.payments, data.rooms.length, year, month],
  );
  const prev = useMemo(() => {
    const p = calcMonth(
      {
        reservations: data.reservations,
        charges: data.charges,
        payments: data.payments,
        roomCount: data.rooms.length,
      },
      month === 0 ? year - 1 : year,
      month === 0 ? 11 : month - 1,
    );
    return { sold: p.lodging + p.extras, cobrado: p.cobrado, occPct: p.occPct };
  }, [data.reservations, data.charges, data.payments, data.rooms.length, year, month]);

  // Cobranzas de los últimos 6 meses
  const last6 = useMemo(() => {
    const out: { label: string; value: number; tip: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - i, 1);
      const key = toISO(d).slice(0, 7);
      const v = data.payments.reduce(
        (s, p) => (p.date.slice(0, 7) === key ? s + p.amount : s),
        0,
      );
      out.push({
        label: MONTHS[d.getMonth()].slice(0, 3),
        value: v,
        tip: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      });
    }
    return out;
  }, [data.payments, year, month]);

  const receivables = useMemo(
    () =>
      data.reservations
        .filter((r) => r.status === "checkout" || r.status === "checkin")
        .map((r) => ({ r, f: folio(r, idx) }))
        .filter((x) => x.f.balance > 1)
        .sort((a, b) => b.f.balance - a.f.balance),
    [data.reservations, idx],
  );
  const receivableTotal = receivables.reduce((s, x) => s + x.f.balance, 0);

  const topGuests = useMemo(() => {
    const m2 = new Map<
      string,
      { name: string; value: number; stays: number }
    >();
    for (const r of data.reservations) {
      if (r.status !== "checkout" && r.status !== "checkin") continue;
      const cur2 = m2.get(r.guestId) ?? {
        name: r.guestName,
        value: 0,
        stays: 0,
      };
      cur2.value += folio(r, idx).total;
      cur2.stays++;
      m2.set(r.guestId, cur2);
    }
    return [...m2.entries()]
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 8);
  }, [data.reservations, idx]);

  const months = Array.from(
    { length: 13 },
    (_, i) => new Date(now.getFullYear(), now.getMonth() - 9 + i, 1),
  );
  const monthPos = months.findIndex(
    (d) => d.getFullYear() === year && d.getMonth() === month,
  );
  const goMonth = (delta: number) => {
    const d = months[monthPos + delta];
    if (d) setYm(`${d.getFullYear()}-${d.getMonth()}`);
  };
  const sold = m.lodging + m.extras;
  const isThisMonth = t.slice(0, 7) === mStart.slice(0, 7);
  const todayIdx = isThisMonth ? now.getDate() - 1 : undefined;
  const paidPct = sold > 0 ? Math.min(100, (m.cobrado / sold) * 100) : 0;

  // Acumulado de lo vendido (si es el mes en curso, solo hasta hoy)
  const cumul = useMemo(() => {
    const upTo = todayIdx !== undefined ? todayIdx + 1 : days;
    let acc = 0;
    return m.daily.slice(0, upTo).map((v, i) => {
      acc += v;
      return {
        label: String(i + 1),
        value: acc,
        tip: `Día ${i + 1}: lleva vendido ${fm(acc)} (ese día ${fm(v)})`,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.daily, todayIdx, days, cur]);

  const bestDay = m.daily.reduce((a, v, i) => (v > m.daily[a] ? i : a), 0);
  const busiest = m.occ.reduce((a, o, i) => (o.value > m.occ[a].value ? i : a), 0);
  const ticket = m.resCount ? sold / m.resCount : 0;

  function exportCSV() {
    const rows = [
      ["Concepto", "Valor"],
      ["Mes", `${MONTHS[month]} ${year}`],
      ["Ventas de hospedaje", String(Math.round(m.lodging))],
      ["Gastos extra (consumos)", String(Math.round(m.extras))],
      ["Se cobró", String(Math.round(m.cobrado))],
      ["Habitaciones ocupadas (%)", m.occPct.toFixed(1)],
      ["Precio promedio por noche", String(Math.round(m.adr))],
      ["Ingreso por habitación disponible", String(Math.round(m.revpar))],
      ...m.bySource.map((x) => [
        `Por dónde llegó: ${x.label}`,
        String(Math.round(x.value)),
      ]),
      ...m.byMethod.map((x) => [
        `Cobrado con ${x.label}`,
        String(Math.round(x.value)),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }),
    );
    a.download = `finanzas-${year}-${String(month + 1).padStart(2, "0")}.csv`;
    a.click();
  }

  const arrowCls =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-panel/60 text-fg transition hover:border-gray-400 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-10";

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
      <div className="aurora">
        <PageHeader
          title={
            <>
              Plata y <span className="serif-accent">resultados</span> del hotel
            </>
          }
          subtitle="Acá ves cuánto se vendió y cuánto se cobró en el mes, cuántas habitaciones estuvieron ocupadas y quién todavía debe plata. Elegí el mes en la lista de arriba."
          actions={
            <>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <button
                  type="button"
                  className={arrowCls}
                  aria-label="Mes anterior"
                  disabled={monthPos <= 0}
                  onClick={() => goMonth(-1)}
                >
                  <ChevronLeft size={20} aria-hidden />
                </button>
                <Select
                  value={ym}
                  onChange={(e) => setYm(e.target.value)}
                  className="w-full min-w-0 flex-1 text-[15px] sm:w-[190px] sm:flex-none"
                >
                  {months.map((d) => (
                    <option
                      key={d.toISOString()}
                      value={`${d.getFullYear()}-${d.getMonth()}`}
                    >
                      {MONTHS[d.getMonth()]} {d.getFullYear()}
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  className={arrowCls}
                  aria-label="Mes siguiente"
                  disabled={monthPos < 0 || monthPos >= months.length - 1}
                  onClick={() => goMonth(1)}
                >
                  <ChevronRight size={20} aria-hidden />
                </button>
              </div>
              <Button className="w-full sm:w-auto" onClick={exportCSV}>
                <Download size={15} aria-hidden /> Bajar planilla (Excel)
              </Button>
            </>
          }
        />
        <div className="mb-4 flex items-center gap-2 text-[15px] font-medium text-gray-700">
          <CalendarDays size={18} className="text-accent" aria-hidden />
          <span className="num text-[20px] uppercase leading-none tracking-wide text-fg">
            {MONTHS[month]} {year}
          </span>
          {isThisMonth && (
            <span
              className="pulse-dot ml-1 h-2.5 w-2.5 rounded-full bg-accent"
              aria-hidden
            />
          )}
        </div>
      </div>

      {/* key = mes: al cambiar de mes todo vuelve a entrar con la animación escalonada */}
      <div key={ym} className="stagger space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="hero-card flex flex-col justify-between gap-4 rounded-2xl p-5 sm:col-span-2">
            <div className="flex items-center gap-2 text-[15px] font-medium opacity-90">
              <TrendingUp size={18} aria-hidden /> Vendido en el mes
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="num min-w-0 text-[40px] leading-none tabular-nums sm:text-[56px]">
                <CountUp value={sold} format={fm} />
              </div>
              <div className="shrink-0 rounded-xl bg-white/90 px-2 py-1.5">
                <Sparkline data={m.daily} width={150} height={44} />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[14px] opacity-95">
              <span>{fm(m.extras)} son gastos extra (consumos)</span>
              <Delta cur={sold} prev={prev.sold} />
            </div>
          </div>
          <Tile
            icon={Wallet}
            label="Se cobró en el mes"
            sub="plata que ya entró"
            delta={<Delta cur={m.cobrado} prev={prev.cobrado} />}
          >
            <CountUp value={m.cobrado} format={fm} />
          </Tile>
          <div className="flex items-center gap-4 rounded-2xl border border-gray-200/80 bg-panel p-5 shadow-card">
            <Ring
              value={m.occPct}
              size={84}
              stroke={9}
              label={`${m.occPct.toFixed(1)}% de habitaciones ocupadas`}
            >
              <span className="num text-[20px] tabular-nums">{Math.round(m.occPct)}%</span>
            </Ring>
            <div className="min-w-0">
              <div className="label-mono flex items-center gap-1.5 text-[12.5px] text-gray-600">
                <Percent size={14} aria-hidden /> Habitaciones ocupadas
              </div>
              <div className="mt-1 text-[14px] leading-snug text-gray-600">
                promedio del mes sobre todas las habitaciones
              </div>
              <div className="mt-2.5">
                <Delta cur={m.occPct} prev={prev.occPct} />
              </div>
            </div>
          </div>
          <Tile
            icon={BedDouble}
            label="Precio promedio por noche"
            sub="lo que se cobra en promedio por habitación y noche"
          >
            <CountUp value={m.adr} format={fm} />
          </Tile>
          <Tile
            icon={BedDouble}
            label="Ingreso por habitación disponible"
            sub="lo vendido, repartido entre todas las habitaciones y días del mes"
          >
            <CountUp value={m.revpar} format={fm} />
          </Tile>
          <Tile
            icon={HandCoins}
            tone="red"
            label="Falta cobrar"
            sub={`${receivables.length} cuentas con deuda`}
          >
            <CountUp value={receivableTotal} format={fm} />
          </Tile>
        </div>

        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
          <Highlight
            icon={Trophy}
            label="Mejor día de ventas"
            value={m.daily[bestDay] > 0 ? fm(m.daily[bestDay]) : "Sin ventas"}
            sub={
              m.daily[bestDay] > 0
                ? `${bestDay + 1} de ${MONTHS[month]}`
                : "todavía no hay datos"
            }
          />
          <Highlight
            icon={Flame}
            label="Día más lleno"
            value={m.occ[busiest]?.value > 0 ? `${m.occ[busiest].value}% ocupado` : "Sin ocupación"}
            sub={
              m.occ[busiest]?.value > 0
                ? `${busiest + 1} de ${MONTHS[month]}`
                : "todavía no hay datos"
            }
          />
          <Highlight
            icon={Receipt}
            label="Ticket promedio"
            value={m.resCount ? fm(ticket) : "Sin reservas"}
            sub={
              m.resCount
                ? `por reserva (${m.resCount} en el mes)`
                : "todavía no hay datos"
            }
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
          <Card
            icon={TrendingUp}
            title={`Cómo se fue sumando lo vendido · ${MONTHS[month]} ${year}`}
          >
            {sold > 0 ? (
              <AreaChart
                data={cumul}
                format={short}
                totalDays={days}
                todayIdx={todayIdx}
                summary={`Lo vendido en el mes sumó ${fm(sold)}`}
              />
            ) : (
              <EmptyChart icon={BarChart3}>Todavía no hay ventas en este mes.</EmptyChart>
            )}
          </Card>
          <Card icon={Percent} title="Cómo viene el mes">
            <div className="grid grid-cols-1 place-content-center gap-6 p-4 min-[420px]:grid-cols-2 sm:p-5 xl:grid-cols-1">
              <div className="flex flex-col items-center gap-2">
                <Gauge
                  value={m.occPct}
                  size={170}
                  label={`${m.occPct.toFixed(1)}% de habitaciones ocupadas`}
                >
                  <span className="num text-[28px] leading-none tabular-nums">{Math.round(m.occPct)}%</span>
                </Gauge>
                <span className="label-mono text-center text-[12.5px] text-gray-600">Habitaciones ocupadas</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Gauge
                  value={paidPct}
                  size={170}
                  tone="green"
                  label={`Se cobró el ${Math.round(paidPct)}% de lo vendido`}
                >
                  <span className="num text-[28px] leading-none tabular-nums">{Math.round(paidPct)}%</span>
                </Gauge>
                <span className="label-mono text-center text-[12.5px] text-gray-600">Cobrado de lo vendido</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-2">
          <Card
            icon={CalendarDays}
            title={`Habitaciones ocupadas cada día · ${MONTHS[month]} ${year}`}
          >
            <Heatmap
              year={year}
              month={month}
              occ={m.occ}
              todayDay={isThisMonth ? now.getDate() : undefined}
            />
          </Card>
          <Card icon={Wallet} title="Lo que se cobró en los últimos 6 meses">
            <Bars
              data={last6}
              format={short}
              highlight={MONTHS[month].slice(0, 3)}
            />
          </Card>
        </div>

        <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Card icon={PieChart} title="Ventas de hospedaje, según por dónde llegó la reserva">
            <Donut
              rows={m.bySource}
              format={fm}
              total={m.lodging}
              empty="Todavía no hay datos en este mes."
            />
          </Card>
          <Card icon={BarChart3} title="Ventas, según el tipo">
            <HBars rows={m.byCat} format={fm} />
          </Card>
          <Card icon={PieChart} title="Lo que se cobró, según cómo pagaron">
            <Donut
              rows={m.byMethod}
              format={fm}
              total={m.cobrado}
              empty="Todavía no se cobró nada en este mes."
            />
          </Card>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-2">
          <Card
            icon={HandCoins}
            title={`Plata que falta cobrar (${receivables.length})`}
          >
            {receivables.length > 0 ? (
              <Table
                head={[
                  "Huésped",
                  "Habitación",
                  "Salida",
                  <span key="d" className="block text-right">
                    Debe
                  </span>,
                ]}
              >
                {receivables.slice(0, 15).map(({ r, f }) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 text-[15px]">
                      <span className="flex min-w-[170px] items-center gap-3">
                        <Avatar name={r.guestName} size={32} />
                        <span className="min-w-0">
                          <Link
                            href={`/facturacion?r=${r.id}`}
                            className="font-medium underline-offset-4 hover:text-accent hover:underline"
                          >
                            {r.guestName}
                          </Link>
                          {r.status === "checkin" && (
                            <span className="block text-[13px] leading-tight text-green-700">
                              está en el hotel
                            </span>
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[15px] tabular-nums">
                      {idx.roomById.get(r.roomId)?.number}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-[14.5px] tabular-nums text-gray-700">
                      {fmtDate(r.checkOut)}
                    </td>
                    <td className="num whitespace-nowrap px-4 py-2.5 text-right text-[18px] tabular-nums text-red-700">
                      {fm(f.balance)}
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Empty icon={CheckCircle2}>Nadie debe plata por ahora.</Empty>
            )}
          </Card>
          <Card icon={Users} title="Huéspedes que más gastaron (en total)">
            {topGuests.length > 0 ? (
              <Podium top={topGuests} format={fm} />
            ) : (
              <Empty icon={Users}>Todavía no hay huéspedes con estadías.</Empty>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
