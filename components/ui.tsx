"use client";
import { AlertCircle, CheckCircle2, Moon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cls } from "@/lib/logic";

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
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
        size === "sm" ? "h-10 px-3 text-sm sm:h-9" : "h-11 px-4 text-[15px] sm:h-10",
        variant === "primary" &&
          "bg-accent text-accent-fg shadow-btn hover:bg-accent-hover",
        variant === "secondary" &&
          "border border-gray-300 bg-white text-gray-800 shadow-card hover:border-gray-400 hover:bg-gray-50 active:bg-gray-100",
        variant === "danger" && "bg-red-700 text-white shadow-sm hover:bg-red-800",
        variant === "success" && "bg-green-700 text-white shadow-sm hover:bg-green-800",
        variant === "ghost" && "text-gray-700 hover:bg-gray-100 active:bg-gray-200",
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
        "h-11 rounded-lg px-3 sm:h-10 border border-gray-300 bg-white text-base outline-none transition placeholder:text-gray-500 hover:border-gray-400 focus:border-accent focus:ring-4 focus:ring-accent/25 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 sm:text-[15px]",
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
        "w-full rounded-lg px-3 py-2.5 leading-relaxed border border-gray-300 bg-white text-base outline-none transition placeholder:text-gray-500 hover:border-gray-400 focus:border-accent focus:ring-4 focus:ring-accent/25 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 sm:text-[15px]",
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
        "h-11 rounded-lg px-3 sm:h-10 border border-gray-300 bg-white text-base outline-none transition placeholder:text-gray-500 hover:border-gray-400 focus:border-accent focus:ring-4 focus:ring-accent/25 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 sm:text-[15px]",
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
      <span className="mb-1.5 block text-sm font-semibold text-gray-700">
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
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cls(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-semibold leading-5 ring-1 ring-inset ring-black/5",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  title,
  actions,
}: {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section
      className={cls(
        "rounded-2xl border border-gray-200/80 bg-white shadow-card",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3.5 sm:px-5">
          <h2 className="text-base font-semibold tracking-tight text-gray-900">{title}</h2>
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
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "gray" | "green" | "blue" | "red" | "orange" | "purple" | "indigo";
  icon?: React.ElementType;
  href?: string;
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
    <div className="flex h-full items-start gap-3 rounded-2xl border border-gray-200/80 bg-white px-4 py-4 shadow-card transition hover:border-gray-300">
      {Icon && (
        <span
          className={cls(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            tones[tone],
          )}
        >
          <Icon size={20} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div
          className="line-clamp-2 text-[14px] font-medium leading-snug text-gray-600"
          title={label}
        >
          {label}
        </div>
        <div
          className={cls(
            "mt-1 whitespace-nowrap font-semibold leading-tight tabular-nums tracking-tight text-gray-900",
            String(value).length > 11
              ? "text-lg"
              : String(value).length > 8
                ? "text-xl"
                : "text-2xl",
          )}
        >
          {value}
        </div>
        {sub && (
          <div className="mt-0.5 line-clamp-2 text-[13px] text-gray-600">
            {sub}
          </div>
        )}
      </div>
    </div>
  );
  return href ? (
    <a href={href} className="block rounded-2xl">
      {body}
    </a>
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
    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
      <div
        className={cls("h-full rounded-full transition-all", tone)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="display text-2xl text-gray-900 sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] leading-relaxed text-gray-600">{subtitle}</p>}
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
      className="ui-overlay fixed inset-0 z-50 flex items-end justify-center bg-gray-900/50 backdrop-blur-sm sm:items-start sm:overflow-y-auto sm:p-4 sm:pt-[6vh]"
      onMouseDown={onClose}
    >
      <div
        className={cls(
          "ui-pop flex max-h-[94dvh] w-full flex-col rounded-t-2xl bg-white shadow-pop sm:max-h-[88vh] sm:rounded-2xl",
          wide ? "max-w-3xl" : "max-w-lg",
        )}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 py-2 pl-5 pr-3">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 rounded-b-2xl border-t border-gray-100 bg-gray-50/60 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
      className="ui-overlay fixed inset-0 z-50 flex justify-end bg-gray-900/50 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <aside
        className="ui-drawer flex h-full w-full max-w-md flex-col bg-white shadow-pop max-sm:max-w-none"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 py-2 pl-5 pr-3">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
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

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-12 text-center text-[15px] text-gray-600">
      {children}
    </div>
  );
}

export function Table({
  head,
  children,
}: {
  head: React.ReactNode[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="ui-table w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-[13px] font-semibold uppercase tracking-wide text-gray-600">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
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
    <div className="inline-flex max-w-full overflow-x-auto rounded-xl border border-gray-200 bg-gray-100 p-1">
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={cls(
            "min-h-11 shrink-0 whitespace-nowrap rounded-lg px-4 text-[15px] font-medium transition sm:min-h-10",
            value === it.value
              ? "bg-white font-semibold text-gray-900 shadow-card"
              : "text-gray-600 hover:bg-white/60 hover:text-gray-900",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** Pequeño sistema de notificaciones */
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
            "ui-pop w-full rounded-xl px-4 py-3 text-[15px] leading-snug shadow-pop sm:max-w-sm",
            i.tone === "ok" && "bg-gray-900 text-white",
            i.tone === "error" && "bg-red-700 text-white",
            i.tone === "live" &&
              "border border-gray-200 bg-white text-gray-800",
          )}
        >
          {i.tone === "live" && (
            <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
          )}
          {i.tone === "ok" && (
            <CheckCircle2 size={18} className="mr-2 inline-block align-[-4px] text-emerald-400" aria-hidden />
          )}
          {i.tone === "error" && <AlertCircle size={18} className="mr-2 inline-block align-[-4px]" aria-hidden />}
          {i.msg.replace(/\s*[\u2714\u2705\u{1F389}]\ufe0f?/gu, "").trim()}
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
        "flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-card transition hover:bg-gray-50 hover:text-gray-900 sm:h-10 sm:w-10",
        className,
      )}
      title={dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      aria-label={dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

/** Bloque que se ve mientras carga algo (mismo brillo que el panel de Se7en). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cls("ui-skeleton rounded-lg", className)} />
  );
}
