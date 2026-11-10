"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { cls, TASK_TYPE_LUCIDE } from "@/lib/logic";
import type { TaskType } from "@/lib/types";

/** Ícono de un tipo de tarea (limpieza, sábanas, arreglo…). Hereda el color del texto. */
export function TaskIcon({
  type,
  size = 17,
  className,
}: {
  type: TaskType;
  size?: number;
  className?: string;
}) {
  const Icon = TASK_TYPE_LUCIDE[type];
  return (
    <Icon
      size={size}
      className={cls("mr-1 inline-block shrink-0 align-[-3px]", className)}
      aria-hidden
    />
  );
}

/* ───────────── Chiches compartidos de tareas (confeti, cronómetro, tilde, ilustraciones) ───────────── */

/** Vibración sutil en celulares que la soportan. */
export function vibrate(ms = 15) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* sin vibración: no pasa nada */
  }
}

/** "Empezada hace 12 min": texto relativo en minutos. */
export function formatElapsed(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60000));
  if (m < 1) return "hace un momento";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `hace ${h} h ${r} min` : `hace ${h} h`;
}

/** Duración entre dos fechas ISO: "12 min" o "1 h 5 min". */
export function formatDuration(
  fromIso?: string,
  toIso?: string,
): string | null {
  if (!fromIso || !toIso) return null;
  const m = Math.round(
    (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000,
  );
  if (!Number.isFinite(m) || m < 0) return null;
  if (m < 1) return "menos de 1 min";
  if (m < 60) return `${m} min`;
  return m % 60
    ? `${Math.floor(m / 60)} h ${m % 60} min`
    : `${Math.floor(m / 60)} h`;
}

/** Cronómetro en vivo: se actualiza solo cada 30 s sin tocar al resto de la pantalla. */
export function Elapsed({
  since,
  prefix = "Empezada ",
  className,
}: {
  since: string;
  prefix?: string;
  className?: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);
  if (now === null) return null;
  return (
    <span
      className={className}
    >{`${prefix}${formatElapsed(now - new Date(since).getTime())}`}</span>
  );
}

/** Tilde que se dibuja con un trazo cuando el paso se marca. */
export function AnimatedCheck({
  done,
  size = 30,
}: {
  done: boolean;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      className={cls("shrink-0", done ? "text-green-600" : "text-gray-400")}
    >
      <circle
        cx="16"
        cy="16"
        r="13"
        fill="currentColor"
        fillOpacity={done ? 0.15 : 0}
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path
        d="M10 16.5l4.2 4.2L22 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        className="motion-reduce:transition-none"
        style={{
          strokeDashoffset: done ? 0 : 1,
          transition: "stroke-dashoffset 0.35s ease-out",
        }}
      />
    </svg>
  );
}

/** Ilustración sencilla para estados vacíos: olas o escoba. */
export function EmptyArt({
  kind = "olas",
  className,
}: {
  kind?: "olas" | "escoba";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 64"
      width="120"
      height="64"
      aria-hidden
      className={cls("text-accent", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "olas" ? (
        <>
          <path d="M6 22q13-14 26 0t26 0 26 0 26 0" />
          <path d="M6 36q13-14 26 0t26 0 26 0 26 0" strokeOpacity="0.6" />
          <path d="M6 50q13-14 26 0t26 0 26 0 26 0" strokeOpacity="0.3" />
          <circle
            cx="98"
            cy="9"
            r="4"
            fill="currentColor"
            stroke="none"
            fillOpacity="0.5"
          />
        </>
      ) : (
        <>
          <path d="M84 6L54 38" />
          <path
            d="M54 38l-16-3-9 22h30z"
            fill="currentColor"
            fillOpacity="0.15"
          />
          <path
            d="M44 44l-4 12M52 44l-2 12"
            strokeWidth="2"
            strokeOpacity="0.6"
          />
          <circle
            cx="92"
            cy="50"
            r="2.5"
            fill="currentColor"
            stroke="none"
            fillOpacity="0.5"
          />
          <circle
            cx="102"
            cy="42"
            r="1.8"
            fill="currentColor"
            stroke="none"
            fillOpacity="0.4"
          />
          <circle
            cx="82"
            cy="56"
            r="1.8"
            fill="currentColor"
            stroke="none"
            fillOpacity="0.4"
          />
        </>
      )}
    </svg>
  );
}

/* ── Confeti: se dispara con fireConfetti() desde cualquier lado; <ConfettiLayer /> lo dibuja (uno por pantalla). ── */
const CONFETTI_EVENT = "hotel-confetti";
const CONFETTI_COLORS = [
  "#16a34a",
  "#f59e0b",
  "#3b82f6",
  "#ec4899",
  "#a855f7",
  "#ef4444",
  "#14b8a6",
];
interface BurstData {
  msg: string;
  big: boolean;
}

export function fireConfetti(msg = "", big = false) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<BurstData>(CONFETTI_EVENT, { detail: { msg, big } }),
  );
}

export function ConfettiLayer() {
  const [bursts, setBursts] = useState<(BurstData & { id: number })[]>([]);
  const seq = useRef(0);
  useEffect(() => {
    const onFire = (e: Event) => {
      const d = (e as CustomEvent<BurstData>).detail;
      const id = ++seq.current;
      setBursts((b) => [...b, { id, ...d }]);
      window.setTimeout(
        () => setBursts((b) => b.filter((x) => x.id !== id)),
        d.big ? 3300 : 2300,
      );
    };
    window.addEventListener(CONFETTI_EVENT, onFire);
    return () => window.removeEventListener(CONFETTI_EVENT, onFire);
  }, []);
  if (!bursts.length) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {bursts.map((b) => (
        <BurstView key={b.id} msg={b.msg} big={b.big} />
      ))}
    </div>
  );
}

function BurstView({ msg, big }: BurstData) {
  const box = useRef<HTMLDivElement>(null);
  const pieces = useMemo(
    () =>
      Array.from({ length: big ? 70 : 30 }, (_, i) => ({
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        w: 7 + Math.random() * 6,
      })),
    [big],
  );
  useEffect(() => {
    const el = box.current;
    if (!el || typeof el.animate !== "function") return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.querySelectorAll<HTMLElement>("[data-p]").forEach((p) => {
      if (reduce) {
        p.style.display = "none";
        return;
      }
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
      const dist = 120 + Math.random() * (big ? 380 : 240);
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;
      const spin = (Math.random() - 0.5) * 900;
      p.animate(
        [
          { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
          {
            transform: `translate(${dx}px,${dy}px) rotate(${spin / 2}deg)`,
            opacity: 1,
            offset: 0.4,
          },
          {
            transform: `translate(${dx * 1.15}px,${dy + 260 + Math.random() * 220}px) rotate(${spin}deg)`,
            opacity: 0,
          },
        ],
        {
          duration: 1400 + Math.random() * 900,
          easing: "cubic-bezier(.2,.7,.4,1)",
          fill: "forwards",
        },
      );
    });
    el.querySelector<HTMLElement>("[data-m]")?.animate(
      [
        { opacity: 0, transform: "translate(-50%,14px) scale(.9)" },
        { opacity: 1, transform: "translate(-50%,0) scale(1)", offset: 0.15 },
        { opacity: 1, transform: "translate(-50%,0) scale(1)", offset: 0.8 },
        { opacity: 0, transform: "translate(-50%,-8px) scale(1)" },
      ],
      { duration: big ? 3000 : 2000, fill: "forwards" },
    );
  }, [big]);
  return (
    <div ref={box} className="absolute inset-0">
      {pieces.map((p, i) => (
        <span
          key={i}
          data-p
          aria-hidden
          className="absolute left-1/2 top-[40%] opacity-0"
          style={{
            width: p.w,
            height: p.w * 0.45,
            background: p.color,
            borderRadius: 2,
          }}
        />
      ))}
      {msg && (
        <div
          data-m
          role="status"
          className="absolute left-1/2 top-[22%] max-w-[90vw] rounded-full bg-green-700 px-5 py-3 text-center text-[17px] font-semibold text-white opacity-0 shadow-pop"
        >
          {msg}
        </div>
      )}
    </div>
  );
}
