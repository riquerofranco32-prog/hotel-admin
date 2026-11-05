"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ChevronsLeftRight,
  DollarSign,
  LayoutDashboard,
  List,
  LogOut,
  Menu as MenuIcon,
  MessageCircle,
  ShieldCheck,
  UtensilsCrossed,
  Wrench,
  Loader2,
} from "lucide-react";
import { useApp } from "./AppProvider";
import { pendingAutomations } from "@/lib/automation";
import { canAccess, cls, ROLE_LABEL, type Section } from "@/lib/logic";

const NAV: { href: string; label: string; icon: React.ElementType; section: Section }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, section: "dashboard" },
  { href: "/reservas", label: "Reservas", icon: List, section: "reservas" },
  { href: "/recepcion", label: "Recepción", icon: ArrowLeftRight, section: "recepcion" },
  { href: "/facturacion", label: "Facturación", icon: DollarSign, section: "facturacion" },
  { href: "/menus", label: "Menús", icon: UtensilsCrossed, section: "menus" },
  { href: "/mantenimiento", label: "Mantenimiento", icon: Wrench, section: "mantenimiento" },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, section: "whatsapp" },
  { href: "/administradores", label: "Administradores", icon: ShieldCheck, section: "administradores" },
];

export function sectionFor(path: string): Section {
  const n = NAV.filter((x) => x.href !== "/").find((x) => path.startsWith(x.href));
  return n?.section ?? "dashboard";
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const { me, loaded, authReady, mode, data, actions, logout, accessError, authEmail } = useApp();
  const router = useRouter();
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Redirigir a login
  useEffect(() => {
    if (!authReady) return;
    if (mode === "demo" && loaded && !me) router.replace("/login");
    if (mode === "firebase" && !authEmail) router.replace("/login");
  }, [authReady, loaded, me, mode, authEmail, router]);

  useEffect(() => setMobileOpen(false), [path]);

  // ===== Motor de automatizaciones (reservas → mantenimiento) =====
  const pending = useMemo(() => (loaded && me ? pendingAutomations(data).length : 0), [loaded, me, data]);
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => actions.runAutomations().catch(console.error), 600);
    return () => clearTimeout(t);
  }, [pending, actions]);
  // re-evaluar cada 5 minutos (cambio de día, etc.)
  useEffect(() => {
    if (!me) return;
    const i = setInterval(() => actions.runAutomations().catch(console.error), 5 * 60 * 1000);
    return () => clearInterval(i);
  }, [me, actions]);

  const openTasks = data.tasks.filter((t) => t.status !== "completada");
  const myOpen = me ? openTasks.filter((t) => t.assignedTo === me.id).length : 0;
  const pendingOrders = data.orders.filter((o) => o.status === "pendiente" || o.status === "preparando").length;

  if (!authReady || (mode === "firebase" && authEmail && !loaded) || (mode === "demo" && !loaded)) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        <Loader2 className="mr-2 animate-spin" size={18} /> Cargando…
      </div>
    );
  }

  if (mode === "firebase" && authEmail && loaded && !me) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <ShieldCheck size={36} className="text-gray-400" />
        <h1 className="text-lg font-semibold">Sin acceso al panel</h1>
        <p className="max-w-md text-sm text-gray-600">
          La cuenta <b>{authEmail}</b> no está dada de alta como personal del hotel{accessError ? " (Firestore denegó la lectura)" : ""}. Pedile a un
          administrador que te agregue en <b>Administradores</b> con este mismo email.
        </p>
        <button onClick={() => logout()} className="text-sm font-medium text-blue-600 hover:underline">
          Cerrar sesión
        </button>
      </div>
    );
  }
  if (!me) return null;

  const section = sectionFor(path);
  const allowed = canAccess(me.role, section);
  const hotelName = data.settings[0]?.hotelName ?? "Hotel";

  const nav = (
    <nav className="flex flex-col gap-0.5 px-2">
      {NAV.filter((n) => canAccess(me.role, n.section)).map((n) => {
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        const badge = n.section === "mantenimiento" ? openTasks.length : n.section === "menus" ? pendingOrders : 0;
        return (
          <Link
            key={n.href}
            href={n.href}
            title={n.label}
            className={cls(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] transition",
              active ? "bg-gray-100 font-medium text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
            )}
          >
            <n.icon size={17} className="shrink-0" />
            {!collapsed && <span className="flex-1">{n.label}</span>}
            {!collapsed && badge > 0 && (
              <span className="rounded-full bg-gray-900 px-1.5 text-[11px] font-semibold leading-5 text-white">{badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center justify-between px-4">
        {!collapsed && <span className="truncate text-[15px] font-bold uppercase tracking-[0.2em] text-gray-900">{hotelName}</span>}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 lg:block"
          title="Contraer menú"
        >
          <ChevronsLeftRight size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto pt-2">{nav}</div>
      <div className="border-t border-gray-100 p-3">
        {!collapsed && (
          <div className="mb-2 rounded-md bg-gray-50 px-3 py-2">
            <div className="truncate text-sm font-medium text-gray-900">{me.name}</div>
            <div className="truncate text-xs text-gray-500">{ROLE_LABEL[me.role]}</div>
            {myOpen > 0 && (
              <Link href="/mantenimiento?mias=1" className="mt-1 block text-xs font-medium text-blue-600 hover:underline">
                {myOpen} tarea{myOpen > 1 ? "s" : ""} asignada{myOpen > 1 ? "s" : ""} a mí
              </Link>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          {!collapsed && (
            <span
              className={cls(
                "rounded px-1.5 py-0.5 text-[11px] font-medium",
                mode === "firebase" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700",
              )}
              title={mode === "firebase" ? "Datos en Firebase Firestore (tiempo real)" : "Datos guardados en este navegador"}
            >
              {mode === "firebase" ? "● Firebase" : "● Modo demo"}
            </span>
          )}
          <button onClick={() => logout().then(() => router.replace("/login"))} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100" title="Cerrar sesión">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className={cls("hidden shrink-0 lg:block", collapsed ? "w-[72px]" : "w-[232px]")}>{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="h-full w-[240px]" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="rounded p-1 hover:bg-gray-100" aria-label="Menú">
            <MenuIcon size={20} />
          </button>
          <span className="text-sm font-bold uppercase tracking-[0.2em]">{hotelName}</span>
        </div>
        <main className="min-h-0 flex-1 overflow-auto">
          {allowed ? (
            children
          ) : (
            <div className="p-10 text-center text-sm text-gray-600">Tu rol ({ROLE_LABEL[me.role]}) no tiene acceso a esta sección.</div>
          )}
        </main>
      </div>
    </div>
  );
}
