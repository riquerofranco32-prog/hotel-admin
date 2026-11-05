"use client";
import { X } from "lucide-react";
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
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3.5 text-sm",
        variant === "primary" && "bg-gray-900 text-white hover:bg-gray-700",
        variant === "secondary" && "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        variant === "success" && "bg-green-600 text-white hover:bg-green-700",
        variant === "ghost" && "text-gray-600 hover:bg-gray-100",
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
        "h-9 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900",
        !/\bw-/.test(props.className ?? "") && "w-full",
        props.className,
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cls(
        "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900",
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
        "h-9 rounded-md border border-gray-300 bg-white px-2.5 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900",
        !/\bw-/.test(props.className ?? "") && "w-full",
        props.className,
      )}
    />
  );
}

export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cls("block", className)}>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cls("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-transparent", className)}>
      {children}
    </span>
  );
}

export function Card({ children, className, title, actions }: { children: React.ReactNode; className?: string; title?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className={cls("rounded-lg border border-gray-200 bg-white", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone = "gray" }: { label: string; value: React.ReactNode; sub?: string; tone?: "gray" | "green" | "blue" | "red" | "orange" | "purple" }) {
  const tones = {
    gray: "border-l-gray-400",
    green: "border-l-green-600",
    blue: "border-l-blue-600",
    red: "border-l-red-600",
    orange: "border-l-orange-500",
    purple: "border-l-purple-500",
  };
  return (
    <div className={cls("rounded-lg border border-l-4 border-gray-200 bg-white px-4 py-3", tones[tone])}>
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[6vh]" onMouseDown={onClose}>
      <div
        className={cls("w-full rounded-xl bg-white shadow-xl", wide ? "max-w-3xl" : "max-w-lg")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onMouseDown={onClose}>
      <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-gray-500">{children}</div>;
}

export function Table({ head, children }: { head: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-2.5">
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

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: React.ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange(it.value)}
          className={cls(
            "rounded-md px-3 py-1.5 text-sm font-medium transition",
            value === it.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** Pequeño sistema de notificaciones */
let toastFn: ((msg: string, tone?: "ok" | "error") => void) | null = null;
export function toast(msg: string, tone: "ok" | "error" = "ok") {
  toastFn?.(msg, tone);
}
export function Toaster() {
  const [items, setItems] = useState<{ id: number; msg: string; tone: "ok" | "error" }[]>([]);
  useEffect(() => {
    toastFn = (msg, tone = "ok") => {
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { id, msg, tone }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3500);
    };
    return () => {
      toastFn = null;
    };
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {items.map((i) => (
        <div
          key={i.id}
          className={cls("rounded-lg px-4 py-2.5 text-sm text-white shadow-lg", i.tone === "ok" ? "bg-gray-900" : "bg-red-600")}
        >
          {i.msg}
        </div>
      ))}
    </div>
  );
}
