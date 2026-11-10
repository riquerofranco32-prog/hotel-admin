"use client";
import { AlertCircle, BedDouble, Check, CheckCircle2, Moon, Sun, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cls } from "@/lib/logic";
import { CountUp, Ring, Sparkline, Wave } from "./viz";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "success";
  size?: "sm" | "md";
}) {
  return (
    <button
      {...props}
      className={cls(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition duration-150 active:translate-y-[0.5px] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
        size === "sm" ? "h-10 px-3 text-sm sm:h-9" : "h-11 px-4 text-[15px] sm:h-10",
        variant === "primary" &&
          "btn-primary bg-accent text-accent-fg shadow-btn hover:bg-accent-hover",
        variant === "secondary" &&
          "border border-gray-300 bg-panel/60 text-fg hover:border-gray-400 hover:bg-gray-100 active:bg-gray-200",
        variant === "danger" && "bg-red-700 text-white shadow-sm hover:bg-red-800",
        variant === "success" && "bg-green-700 text-white shadow-sm hover:bg-green-800",
        variant === "ghost" && "text-gray-700 hover:bg-gray-100 hover:text-fg active:bg-gray-200",
        className,
      )}
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cls(
        "h-11 rounded-lg px-3 sm:h-10 border border-gray-300 bg-[rgb(var(--well))] text-base text-fg outline-none transition placeholder:text-gray-500 hover:border-gray-400 focus:border-accent focus:ring-4 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60 sm:text-[15px]",
        !/\bw-/.test(props.className ?? "") && "w-full",
        props.className,
      )}
    />
  );
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={cls(
        "w-full rounded-lg px-3 py-2.5 leading-relaxed border border-gray-300 bg-[rgb(var(--well))] text-base text-fg outline-none transition placeholder:text-gray-500 hover:border-gray-400 focus:border-accent focus:ring-4 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60 sm:text-[15px]",
        props.className,
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cls(
        "h-11 rounded-lg px-3 sm:h-10 border border-gray-300 bg-[rgb(var(--well))] text-base text-fg outline-none transition placeholder:text-gray-500 hover:border-gray-400 focus:border-accent focus:ring-4 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60 sm:text-[15px]",
        !/\bw-/.test(props.className ?? "") && "w-full",
        props.className,
      )}
    />
  );
}

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={cls("block", className)}>
      <span className="mb-1.5 block text-sm font-semibold text-gray-800">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-[13px] leading-snug text-gray-600">{hint}</span>}
    </label>
  );
}

export function Badge({
  children,
  className,
  dot = true,
}: {
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cls(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-semibold leading-5 ring-1 ring-inset ring-black/5 shadow-[inset_0_1px_0_rgb(255_255_255/0.45)]",
        className,
      )}
    >
      {dot && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  title,
  actions,
  icon: Icon,
  count,
  variant = "default",
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** "hero": relleno de acento con brillo; "glass": cristal translúcido. */
  variant?: "default" | "hero" | "glass";
  /** Se eleva al pasar el mouse (para tarjetas clickeables). */
  interactive?: boolean;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ElementType;
  count?: React.ReactNode;
}) {
  return (
    <section
      className={cls(
        "rounded-xl border shadow-card",
        variant === "hero"
          ? "hero-card border-transparent"
          : variant === "glass"
            ? "glass border-gray-200/60"
            : "border-gray-200/80 bg-panel",
        interactive && "lift",
        className,
      )}
    >
      {(title || actions) && (
        <header className={cls("flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3.5 sm:px-5", variant === "hero" ? "border-white/20" : "border-gray-200/70 bg-panel-2/40")}>
          <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold tracking-tight text-fg">
            {Icon && (
              <span className={cls("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", variant === "hero" ? "bg-white/20" : "bg-accent/10 text-accent")}>
                <Icon size={16} aria-hidden />
              </span>
            )}
            <span>{title}</span>
            {count !== undefined && count !== null && (
              <span className="label-mono rounded-full bg-gray-100 px-2 py-px text-[12.5px] font-normal tracking-normal text-gray-600 ring-1 ring-inset ring-gray-200">{count}</span>
            )}
          </h2>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "gray",
  icon: Icon,
  href,
  filled = false,
  ring,
  spark,
  countUp = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "gray" | "green" | "blue" | "red" | "orange" | "purple" | "indigo";
  icon?: React.ElementType;
  href?: string;
  /** Tarjeta rellena de acento: para lo que pide atención. */
  filled?: boolean;
  /** 0–100: muestra un anillo chico a la derecha. */
  ring?: number;
  /** Serie de números: muestra un mini gráfico debajo. */
  spark?: number[];
  /** Anima el número hasta su valor (solo si `value` es numérico). */
  countUp?: boolean;
}) {
  const tones = {
    gray: "bg-gray-100 text-gray-600",
    green: "bg-green-50 text-green-600",
    blue: "bg-blue-50 text-blue-600",
    red: "bg-red-50 text-red-600",
    orange: "bg-orange-50 text-orange-600",
    purple: "bg-purple-50 text-purple-600",
    indigo: "bg-indigo-50 text-indigo-600",
  };
  const body = (
    <div
      className={cls(
        "flex h-full items-start gap-3 rounded-xl border px-4 py-4 shadow-card",
        filled ? "hero-card border-transparent" : "border-gray-200/80 bg-panel",
        href && "lift",
      )}
    >
      {Icon && (
        <span
          className={cls(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            filled ? "bg-white/20 text-accent-fg" : tones[tone],
          )}
        >
          <Icon size={20} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div
          className={cls("label-mono line-clamp-2 text-[12.5px] font-medium leading-snug", filled ? "text-accent-fg" : "text-gray-600")}
          title={label}
        >
          {label}
        </div>
        <div
          className={cls(
            "num mt-1.5 whitespace-nowrap leading-none tabular-nums",
            filled ? "text-accent-fg" : "text-fg",
            String(value).length > 11 ? "text-2xl" : String(value).length > 8 ? "text-3xl" : "text-[34px]",
          )}
        >
          {countUp && typeof value === "number" ? <CountUp value={value} /> : value}
        </div>
        {spark && spark.length > 1 && (
          <Sparkline data={spark} width={110} height={28} className="mt-2" />
        )}
        {sub && (
          <div className={cls("mt-1.5 line-clamp-2 text-[13px]", filled ? "text-accent-fg" : "text-gray-600")}>{sub}</div>
        )}
      </div>
      {ring !== undefined && (
        <Ring value={ring} size={52} stroke={6} label={`${Math.round(ring)}%`} />
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Avatar({
  name,
  className,
  size = 32,
}: {
  name: string;
  className?: string;
  size?: number;
}) {
  const palette = [
    "bg-rose-500",
    "bg-sky-600",
    "bg-emerald-600",
    "bg-amber-500",
    "bg-violet-600",
    "bg-teal-600",
    "bg-fuchsia-600",
    "bg-slate-700",
  ];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const ini = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={cls(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        palette[h % palette.length],
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      title={name}
    >
      {ini}
    </span>
  );
}

export function Progress({
  value,
  tone = "bg-accent",
}: {
  value: number;
  tone?: string;
}) {
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-gray-200/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]"
      role="progressbar"
      aria-valuenow={Math.round(Math.max(0, Math.min(100, value)))}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cls("ui-fill h-full rounded-full transition-[width] duration-500", tone, tone === "bg-accent" && "bg-gradient-to-r from-accent/70 to-accent")}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  accent,
}: {
  title: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
  /** Etiqueta mono arriba del título. */
  eyebrow?: React.ReactNode;
  /** Palabra final en serif itálica de acento. */
  accent?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="label-mono mb-2 text-[12.5px] text-gray-600">{eyebrow}</p>}
        <h1 className="display text-balance text-[26px] text-fg md:text-[34px]">
          {title}
          {accent && (
            <>
              {" "}
              <span className="serif-accent">{accent}</span>
            </>
          )}
        </h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-gray-600">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="ui-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-start sm:overflow-y-auto sm:p-4 sm:pt-[6vh]"
      onMouseDown={onClose}
    >
      <div
        className={cls(
          "ui-pop flex max-h-[94dvh] w-full flex-col rounded-t-2xl bg-panel shadow-pop sm:max-h-[88vh] sm:rounded-2xl",
          wide ? "max-w-3xl" : "max-w-lg",
        )}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="relative flex shrink-0 items-center justify-between gap-3 border-b border-gray-200/70 bg-gradient-to-b from-accent/[0.06] to-transparent py-3 pl-5 pr-3 before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-gradient-to-r before:from-accent before:to-transparent">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 hover:text-fg"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 rounded-b-2xl border-t border-gray-200/70 bg-panel-2/60 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="ui-overlay fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <aside
        className="ui-drawer flex h-full w-full max-w-md flex-col bg-panel shadow-pop max-sm:max-w-none"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="relative flex shrink-0 items-center justify-between gap-3 border-b border-gray-200/70 bg-gradient-to-b from-accent/[0.06] to-transparent py-3 pl-5 pr-3 before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-gradient-to-r before:from-accent before:to-transparent">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 hover:text-fg"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </aside>
    </div>
  );
}

export function Empty({
  children,
  icon: Icon,
  title,
}: {
  children?: React.ReactNode;
  icon?: React.ElementType;
  title?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center text-[15px] text-gray-600">
      {Icon && (
        <span className="relative mb-5 flex h-24 w-24 items-center justify-center" aria-hidden>
          <svg viewBox="0 0 96 96" className="absolute inset-0 h-full w-full text-accent">
            <circle cx="48" cy="48" r="46" fill="none" stroke="currentColor" strokeOpacity="0.12" />
            <circle cx="48" cy="48" r="34" fill="none" stroke="currentColor" strokeOpacity="0.2" />
            <path d="M14 64c8-6 14-6 22 0s14 6 22 0 14-6 22 0" fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-gray-300 bg-panel text-accent shadow-card">
            <Icon size={22} />
          </span>
        </span>
      )}
      {title && <p className="mb-1 text-base font-semibold text-fg">{title}</p>}
      {children}
    </div>
  );
}

export function Table({
  head,
  children,
  stickyHead = false,
}: {
  head: React.ReactNode[];
  children: React.ReactNode;
  /** Encabezado que queda fijo al desplazar (limita el alto a 70vh). */
  stickyHead?: boolean;
}) {
  return (
    <div className={cls("overflow-x-auto", stickyHead && "max-h-[70vh] overflow-y-auto")}>
      <table className={cls("ui-table w-full text-sm", stickyHead && "ui-table-sticky")}>
        <thead>
          <tr className="label-mono border-b border-gray-200 bg-panel-2/60 text-left text-[12.5px] font-medium text-gray-600">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200/60">{children}</tbody>
      </table>
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: React.ReactNode }[];
}) {
  return (
    <div className="no-scrollbar inline-flex max-w-full overflow-x-auto rounded-xl border border-gray-200 bg-[rgb(var(--well))] p-1" role="group">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          onClick={() => onChange(it.value)}
          aria-pressed={value === it.value}
          className={cls(
            "min-h-11 shrink-0 whitespace-nowrap rounded-lg px-4 text-[15px] font-medium transition sm:min-h-10",
            value === it.value
              ? "bg-panel font-semibold text-accent shadow-card ring-1 ring-inset ring-accent/30 [box-shadow:var(--shadow-card),0_6px_16px_-8px_rgb(var(--accent)/0.5)]"
              : "text-gray-600 hover:bg-panel/60 hover:text-fg",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** Tecla (atajo de teclado). */
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-gray-300 bg-panel px-1.5 py-px font-mono text-[12.5px] text-gray-600">{children}</kbd>
  );
}

let toastFn: ((msg: string, tone?: "ok" | "error" | "live") => void) | null =
  null;
export function toast(msg: string, tone: "ok" | "error" | "live" = "ok") {
  toastFn?.(msg, tone);
}
export function Toaster() {
  const [items, setItems] = useState<
    { id: number; msg: string; tone: "ok" | "error" | "live" }[]
  >([]);
  useEffect(() => {
    toastFn = (msg, tone = "ok") => {
      const id = Date.now() + Math.random();
      setItems((x) => [...x.slice(-3), { id, msg, tone }]);
      setTimeout(
        () => setItems((x) => x.filter((i) => i.id !== id)),
        tone === "live" ? 6000 : 3500,
      );
    };
    return () => {
      toastFn = null;
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex flex-col gap-2 sm:inset-x-auto sm:bottom-4 sm:right-4">
      {items.map((i) => (
        <div
          key={i.id}
          className={cls(
            "ui-pop relative w-full overflow-hidden rounded-xl px-4 py-3 text-[15px] leading-snug shadow-pop sm:max-w-sm",
            i.tone === "error" ? "bg-red-700 text-white" : "border border-gray-300 bg-panel text-fg",
          )}
        >
          {i.tone === "live" && (
            <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          )}
          {i.tone === "ok" && (
            <CheckCircle2 size={18} className="mr-2 inline-block align-[-4px] text-accent" aria-hidden />
          )}
          {i.tone === "error" && <AlertCircle size={18} className="mr-2 inline-block align-[-4px]" aria-hidden />}
          {i.msg.replace(/\s*[\u2714\u2705\u{1F389}]\ufe0f?/gu, "").trim()}
          <span
            aria-hidden
            className={cls("ui-toast-bar absolute inset-x-0 bottom-0 h-[3px]", i.tone === "error" ? "bg-white/60" : "bg-accent")}
            style={{ animationDuration: i.tone === "live" ? "6000ms" : "3500ms" }}
          />
        </div>
      ))}
    </div>
  );
}

/** Tema claro/oscuro: se guarda en el navegador; sin elección, sigue al sistema (ver app/layout.tsx). */
export const THEME_KEY = "hotel-theme";
export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(
    () => setDark(document.documentElement.classList.contains("dark")),
    [],
  );
  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {}
    setDark(next);
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className={cls(
        "flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 bg-panel/60 text-gray-600 transition hover:bg-gray-100 hover:text-fg sm:h-10 sm:w-10",
        className,
      )}
      title={dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      aria-label={dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
    >
      <span className="theme-icon flex" key={dark ? "sun" : "moon"}>
        {dark ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} />}
      </span>
    </button>
  );
}

/** Bloque que se ve mientras carga algo (mismo brillo que el panel de Se7en). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cls("ui-skeleton rounded-lg", className)} />
  );
}

/* ─── Color de acento elegible ─────────────────────────────────────────────── */
export const ACCENT_KEY = "hotel-accent";
export const ACCENTS = [
  { id: "azul", name: "Azul marino", color: "rgb(29 78 216)" },
  { id: "coral", name: "Coral", color: "rgb(224 86 60)" },
  { id: "dorado", name: "Dorado", color: "rgb(217 150 20)" },
  { id: "violeta", name: "Violeta", color: "rgb(124 58 237)" },
  { id: "esmeralda", name: "Esmeralda", color: "rgb(16 160 110)" },
] as const;
export type AccentId = (typeof ACCENTS)[number]["id"];

/** Botón de la barra superior que abre 5 muestras de color. Se guarda en localStorage y se aplica con data-accent en <html>. */
export function AccentPicker({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [accent, setAccent] = useState<AccentId>("azul");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const found = ACCENTS.find((a) => a.id === document.documentElement.dataset.accent);
    if (found) setAccent(found.id);
  }, []);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  function pick(id: AccentId) {
    document.documentElement.dataset.accent = id;
    try {
      localStorage.setItem(ACCENT_KEY, id);
    } catch {}
    setAccent(id);
  }
  const current = ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0];
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Elegir el color del panel"
        aria-expanded={open}
        title="Color del panel"
        className={cls(
          "flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 bg-panel/60 transition hover:bg-gray-100 sm:h-10 sm:w-10",
          className,
        )}
      >
        <span className="h-5 w-5 rounded-full bg-accent ring-2 ring-panel" />
      </button>
      {open && (
        <div className="ui-pop fixed inset-x-3 top-[4.25rem] z-30 rounded-xl border border-gray-200 bg-panel p-4 shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[290px]">
          <p className="mb-3 text-[15px] font-semibold">Color del panel</p>
          <div role="radiogroup" aria-label="Color del panel" className="flex justify-between gap-1">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={a.id === accent}
                aria-label={a.name}
                title={a.name}
                onClick={() => pick(a.id)}
                style={{ background: a.color }}
                className={cls(
                  "flex h-11 w-11 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-panel transition motion-safe:hover:scale-110",
                  a.id === accent ? "ring-2 ring-fg" : "ring-0",
                )}
              >
                {a.id === accent && <Check size={20} strokeWidth={3} />}
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-[14px] text-gray-700">{current.name}</p>
        </div>
      )}
    </div>
  );
}

/** Botón flotante redondo (acción principal de una pantalla). En celular queda abajo a la derecha, sobre el borde seguro. */
export function Fab({
  icon: Icon,
  label,
  onClick,
  href,
  className,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  href?: string;
  className?: string;
}) {
  const cn = cls(
    "group fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-hover text-accent-fg shadow-[0_12px_30px_-8px_rgb(var(--accent)/0.75)] transition duration-200 hover:shadow-[0_16px_36px_-8px_rgb(var(--accent)/0.9)] motion-safe:hover:scale-105 motion-safe:active:scale-95 lg:bottom-6 lg:right-6",
    className,
  );
  const inner = (
    <>
      <Icon size={24} aria-hidden />
      <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg bg-fg px-3 py-1.5 text-[14px] font-semibold text-panel opacity-0 shadow-pop transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
        {label}
      </span>
    </>
  );
  return href ? (
    <Link href={href} aria-label={label} className={cn}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} className={cn}>
      {inner}
    </button>
  );
}

/** Pantalla de carga: logo con anillo que gira y olas. */
export function HotelLoader({ text = "Cargando el hotel…" }: { text?: string }) {
  return (
    <div role="status" className="relative flex h-screen flex-col items-center justify-center gap-5 overflow-hidden">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <svg viewBox="0 0 96 96" aria-hidden className="absolute inset-0 h-full w-full animate-spin text-accent [animation-duration:1.4s]">
          <circle cx="48" cy="48" r="44" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="4" />
          <circle cx="48" cy="48" r="44" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="70 210" />
        </svg>
        <span className="logo-grad flex h-14 w-14 items-center justify-center rounded-2xl text-accent-fg">
          <BedDouble size={26} />
        </span>
      </div>
      <Wave className="h-8 w-44 rounded-full" />
      <span className="text-[15px] text-gray-600">{text}</span>
    </div>
  );
}
