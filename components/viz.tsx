"use client";
// Piezas visuales compartidas del panel: anillo de progreso, mini gráfico,
// número que cuenta y entrada escalonada. Todo con los colores del tema (acento,
// grises) para que funcione igual en claro y en oscuro. Sin librerías.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { cls } from "@/lib/logic";

/** ¿La persona pidió menos movimiento? */
function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Número que sube hasta su valor al aparecer (0,6 s). Con "menos movimiento" aparece directo. */
export function CountUp({
  value,
  format = (n: number) => String(Math.round(n)),
  duration = 700,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (prefersReducedMotion() || from.current === value) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(a + (value - a) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return (
    <span className={cls("tabular-nums", className)}>{format(shown)}</span>
  );
}

/**
 * Anillo de progreso (0–100). Dentro lleva lo que le pases (el número, un ícono…).
 * `tone` elige el color del arco; por defecto, el acento.
 */
export function Ring({
  value,
  size = 96,
  stroke = 9,
  tone = "accent",
  children,
  label,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "accent" | "green" | "amber" | "red" | "blue";
  children?: React.ReactNode;
  /** Texto para lectores de pantalla ("82% de ocupación"). */
  label?: string;
  className?: string;
}) {
  const id = useId();
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color =
    tone === "green"
      ? "rgb(34 197 94)"
      : tone === "amber"
        ? "rgb(245 158 11)"
        : tone === "red"
          ? "rgb(239 68 68)"
          : tone === "blue"
            ? "rgb(59 130 246)"
            : "rgb(var(--accent))";
  return (
    <div
      className={cls(
        "relative inline-flex shrink-0 items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(var(--gray-200))"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          style={{
            transition: "stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </svg>
      {children !== undefined && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {children}
        </div>
      )}
    </div>
  );
}

/** Mini gráfico de línea con área suave. `data` son números ya calculados (mínimo 2). */
export function Sparkline({
  data,
  width = 120,
  height = 36,
  className,
  tone = "accent",
}: {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  tone?: "accent" | "green" | "red" | "amber";
}) {
  const id = useId();
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = 3;
  const pts = data.map(
    (v, i) =>
      [
        pad + (i * (width - pad * 2)) / (data.length - 1),
        height - pad - ((v - min) / span) * (height - pad * 2),
      ] as const,
  );
  const line = pts
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`;
  const color =
    tone === "green"
      ? "rgb(34 197 94)"
      : tone === "red"
        ? "rgb(239 68 68)"
        : tone === "amber"
          ? "rgb(245 158 11)"
          : "rgb(var(--accent))";
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cls("shrink-0 overflow-visible", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r="3"
        fill={color}
      />
    </svg>
  );
}

/**
 * Entrada escalonada: cada hijo aparece con un pequeño retraso.
 * Uso: <Stagger className="grid ..."> …hijos… </Stagger>  (usa la clase .stagger de globals.css)
 */
export function Stagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cls("stagger", className)}>{children}</div>;
}

/**
 * Olas decorativas (SVG, solo adorno). Ponelas absolutas al pie de una tarjeta o panel.
 * `animated` las desplaza muy despacio.
 */
export function Wave({
  className,
  animated = true,
}: {
  className?: string;
  animated?: boolean;
}) {
  const path = (amp: number, off: number) => {
    let d = `M0,${40 + off}`;
    for (let i = 0; i < 4; i++) {
      const x = i * 300;
      d += ` Q${x + 75},${40 + off - amp} ${x + 150},${40 + off} T${x + 300},${40 + off}`;
    }
    return `${d} V80 H0 Z`;
  };
  return (
    <div
      aria-hidden
      className={cls("pointer-events-none overflow-hidden", className)}
    >
      <svg
        viewBox="0 0 1200 80"
        preserveAspectRatio="none"
        className={cls("h-full w-[200%] max-w-none", animated && "ui-wave-drift")}
      >
        <path d={path(18, 6)} fill="rgb(var(--accent) / 0.12)" />
        <path d={path(12, 20)} fill="rgb(var(--accent) / 0.1)" />
      </svg>
    </div>
  );
}

/**
 * Barras verticales con degradé. `data`: [{ label, value }]. Cada barra es un
 * elemento enfocable con `title` y aria-label con el valor (accesible).
 * `format` da formato al valor (por defecto, número). `height` en px.
 */
export function BarChart({
  data,
  height = 180,
  format = (n: number) => String(Math.round(n)),
  className,
}: {
  data: { label: string; value: number }[];
  height?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div
      className={cls("flex items-end gap-1.5 sm:gap-2", className)}
      style={{ height: height + 28 }}
      role="list"
    >
      {data.map((d, i) => {
        const h = Math.max(3, (d.value / max) * height);
        return (
          <div
            key={`${d.label}-${i}`}
            role="listitem"
            tabIndex={0}
            title={`${d.label}: ${format(d.value)}`}
            aria-label={`${d.label}: ${format(d.value)}`}
            className="group relative flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5 rounded-md outline-offset-2"
          >
            <span className="label-mono pointer-events-none absolute -top-1 z-10 -translate-y-full whitespace-nowrap rounded-md bg-fg px-2 py-1 text-[12.5px] text-[rgb(var(--bg))] opacity-0 shadow-pop transition group-hover:opacity-100 group-focus:opacity-100">
              {format(d.value)}
            </span>
            <div
              className="ui-bar-grow w-full rounded-t-md bg-gradient-to-t from-accent/60 to-accent transition group-hover:brightness-110"
              style={{ height: h, animationDelay: `${i * 40}ms` }}
            />
            <span className="w-full truncate text-center text-[12.5px] text-gray-600">
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const DONUT_COLORS = [
  "rgb(var(--accent))",
  "rgb(34 197 94)",
  "rgb(245 158 11)",
  "rgb(239 68 68)",
  "rgb(139 92 246)",
  "rgb(20 184 166)",
];

/**
 * Dona con leyenda. `data`: [{ label, value, color? }]. `center` va en el hueco.
 * La leyenda muestra cada valor y su porcentaje, así no depende solo del color.
 */
export function Donut({
  data,
  size = 140,
  stroke = 18,
  center,
  format = (n: number) => String(Math.round(n)),
  className,
}: {
  data: { label: string; value: number; color?: string }[];
  size?: number;
  stroke?: number;
  center?: React.ReactNode;
  format?: (n: number) => string;
  className?: string;
}) {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className={cls("flex flex-wrap items-center gap-5", className)}>
      <div
        className="relative shrink-0"
        style={{ width: size, height: size }}
        role="img"
        aria-label={data.map((d) => `${d.label}: ${format(d.value)}`).join(", ")}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--gray-200))" strokeWidth={stroke} />
          {total > 0 &&
            data.map((d, i) => {
              const len = (Math.max(0, d.value) / total) * c;
              const el = (
                <circle
                  key={`${d.label}-${i}`}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={d.color ?? DONUT_COLORS[i % DONUT_COLORS.length]}
                  strokeWidth={stroke}
                  strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
                  strokeDashoffset={-acc}
                />
              );
              acc += len;
              return el;
            })}
        </svg>
        {center !== undefined && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {center}
          </div>
        )}
      </div>
      <ul className="min-w-[140px] flex-1 space-y-1.5">
        {data.map((d, i) => (
          <li key={`${d.label}-${i}`} className="flex items-center gap-2 text-[14px]">
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ background: d.color ?? DONUT_COLORS[i % DONUT_COLORS.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-gray-700">{d.label}</span>
            <span className="num text-[16px] text-fg">{format(d.value)}</span>
            <span className="w-10 text-right text-[13px] text-gray-600">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Medidor semicircular (0–100). Lo que pases en `children` va debajo del arco.
 * `tone` igual que Ring.
 */
export function Gauge({
  value,
  size = 180,
  stroke = 14,
  tone = "accent",
  children,
  label,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "accent" | "green" | "amber" | "red" | "blue";
  children?: React.ReactNode;
  label?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const r = (size - stroke) / 2;
  const half = Math.PI * r;
  const color =
    tone === "green"
      ? "rgb(34 197 94)"
      : tone === "amber"
        ? "rgb(245 158 11)"
        : tone === "red"
          ? "rgb(239 68 68)"
          : tone === "blue"
            ? "rgb(59 130 246)"
            : "rgb(var(--accent))";
  const d = `M${stroke / 2},${size / 2} A${r},${r} 0 0 1 ${size - stroke / 2},${size / 2}`;
  return (
    <div
      className={cls("relative inline-block shrink-0", className)}
      style={{ width: size, height: size / 2 + stroke }}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <svg width={size} height={size / 2 + stroke} viewBox={`0 0 ${size} ${size / 2 + stroke}`} aria-hidden>
        <path d={d} fill="none" stroke="rgb(var(--gray-200))" strokeWidth={stroke} strokeLinecap="round" />
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={half}
          strokeDashoffset={half - (half * pct) / 100}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      {children !== undefined && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center">
          {children}
        </div>
      )}
    </div>
  );
}

const CONFETTI_COLORS = [
  "rgb(var(--accent))",
  "rgb(var(--accent) / 0.55)",
  "rgb(var(--accent-hover))",
  "rgb(34 197 94)",
  "rgb(22 163 74)",
];

/**
 * Confeti de celebración (CSS puro, ~1,6 s, no tapa nada: pointer-events-none).
 * Uso directo: <Confetti run={ok} onDone={() => setOk(false)} />
 * Uso fácil con el hook:
 *   const { fire, node } = useConfetti();
 *   ... fire() al terminar una tarea o dar entrada ...
 *   return <>{node}...</>;
 * Con "menos movimiento" no se muestra nada.
 */
export function Confetti({ run, onDone }: { run: boolean; onDone?: () => void }) {
  const pieces = useMemo(
    () =>
      run
        ? Array.from({ length: 36 }, (_, i) => ({
            left: 4 + Math.random() * 92,
            delay: Math.random() * 0.25,
            w: 6 + Math.random() * 5,
            h: 9 + Math.random() * 8,
            dx: `${Math.round((Math.random() - 0.5) * 160)}px`,
            rot: `${Math.round(240 + Math.random() * 480)}deg`,
            round: i % 4 === 0,
            color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          }))
        : [],
    [run],
  );
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);
  useEffect(() => {
    if (!run) return;
    const id = setTimeout(() => doneRef.current?.(), prefersReducedMotion() ? 0 : 2000);
    return () => clearTimeout(id);
  }, [run]);
  if (!run || prefersReducedMotion()) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="ui-confetti-piece"
          style={
            {
              left: `${p.left}%`,
              width: p.w,
              height: p.h,
              background: p.color,
              borderRadius: p.round ? "9999px" : "2px",
              animationDelay: `${p.delay}s`,
              "--dx": p.dx,
              "--rot": p.rot,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** Dispara el confeti: `fire()` lo lanza y `node` se pone una vez en el JSX de la pantalla. */
export function useConfetti(): { fire: () => void; node: React.ReactNode } {
  const [shot, setShot] = useState(0);
  const [running, setRunning] = useState(false);
  const fire = useCallback(() => {
    setShot((n) => n + 1);
    setRunning(true);
  }, []);
  const stop = useCallback(() => setRunning(false), []);
  return { fire, node: <Confetti key={shot} run={running} onDone={stop} /> };
}
