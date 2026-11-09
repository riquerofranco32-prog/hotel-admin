"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  BedDouble,
  CalendarRange,
  ChevronsLeftRight,
  ClipboardCheck,
  DollarSign,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu as MenuIcon,
  MessageCircle,
  Search,
  Sparkles,
  ShieldCheck,
  Users,
  UtensilsCrossed,
  Workflow,
  Wrench,
} from "lucide-react";
import { useApp } from "./AppProvider";
import { Avatar, ThemeToggle, toast } from "./ui";
import { alerts, planAutomations, planSize } from "@/lib/automation";
import { fmtDate, today } from "@/lib/dates";
import { automationOf, cls, ROLE_LABEL, TASK_TYPE_ICON } from "@/lib/logic";
import type { Perm } from "@/lib/types";

type NavItem = { href: string; label: string; icon: React.ElementType; perm: Perm };
const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Operación",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard" },
      { href: "/mi-jornada", label: "Mi jornada", icon: ClipboardCheck, perm: "mi_jornada" },
      { href: "/recepcion", label: "Recepción", icon: ArrowLeftRight, perm: "recepcion" },
      { href: "/reservas", label: "Reservas", icon: CalendarRange, perm: "reservas" },
      { href: "/huespedes", label: "Huéspedes", icon: Users, perm: "huespedes" },
    ],
  },
  {
    group: "Servicios",
    items: [
      { href: "/mucamas", label: "Mucamas", icon: Sparkles, perm: "mucamas" },
      { href: "/mantenimiento", label: "Mantenimiento", icon: Wrench, perm: "mantenimiento" },
      { href: "/menus", label: "Menús", icon: UtensilsCrossed, perm: "menus" },
      { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, perm: "whatsapp" },
    ],
  },
  {
    group: "Gestión",
    items: [
      { href: "/facturacion", label: "Facturación", icon: DollarSign, perm: "facturacion" },
      { href: "/finanzas", label: "Finanzas", icon: BarChart3, perm: "finanzas" },
      { href: "/automatizaciones", label: "Automatizaciones", icon: Workflow, perm: "automatizaciones" },
      { href: "/administradores", label: "Administradores", icon: ShieldCheck, perm: "administradores" },
    ],
  },
];
const ALL_NAV = NAV.flatMap((g) => g.items);

export function permForPath(path: string): Perm {
  const n = ALL_NAV.filter((x) => x.href !== "/").find((x) => path === x.href || path.startsWith(x.href + "/"));
  return n?.perm ?? "dashboard";
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const { me, loaded, authReady, mode, data, idx, actions, logout, accessError, authEmail, can, perms, staffName } = useApp();
  const router = useRouter();
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const t = today();
  const cfg = automationOf(data.settings[0]);

  // Redirigir a login
  useEffect(() => {
    if (!authReady) return;
    if (mode === "demo" && loaded && !me) router.replace("/login");
    if (mode === "firebase" && !authEmail) router.replace("/login");
  }, [authReady, loaded, me, mode, authEmail, router]);

  // Inicio según el rol: quien no ve el dashboard va a su primera sección
  const home = perms.includes("dashboard") ? "/" : perms.map((pp) => ALL_NAV.find((n) => n.perm === pp)).find(Boolean)?.href ?? "/";
  useEffect(() => {
    if (me && path === "/" && !can("dashboard") && home !== "/") router.replace(home);
  }, [me, path, can, home, router]);

  useEffect(() => {
    setMobileOpen(false);
    setBellOpen(false);
  }, [path]);

  // Ctrl/Cmd + K → búsqueda
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((x) => !x);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ===== Motor de automatizaciones (reservas → mantenimiento, escalamiento, no-shows) =====
  const pending = useMemo(() => (loaded && me ? planSize(planAutomations(data, t)) : 0), [loaded, me, data, t]);
  const running = useRef(false);
  useEffect(() => {
    if (!pending || running.current) return;
    const id = setTimeout(() => {
      running.current = true;
      actions
        .runAutomations(can("editar_reservas"))
        .catch(console.error)
        .finally(() => (running.current = false));
    }, 500);
    return () => clearTimeout(id);
  }, [pending, actions, can]);

  // ===== Presencia (quién está conectado) =====
  useEffect(() => {
    if (!me) return;
    actions.touchPresence();
    const i = setInterval(() => actions.touchPresence(), 120_000);
    return () => clearInterval(i);
  }, [me?.id, actions]); // eslint-disable-line react-hooks/exhaustive-deps
  const online = data.staff.filter((s) => s.lastSeen && Date.now() - new Date(s.lastSeen).getTime() < 4 * 60_000);

  // ===== Avisos en vivo =====
  const seenAct = useRef<Set<string> | null>(null);
  const seenTasks = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!loaded || !me) return;
    // actividad de otros usuarios (sólo roles que ven la auditoría)
    if (seenAct.current === null) seenAct.current = new Set(data.activity.map((a) => a.id));
    else {
      for (const a of data.activity) {
        if (seenAct.current.has(a.id)) continue;
        seenAct.current.add(a.id);
        if (cfg.avisosEnVivo && a.by !== me.id && a.by !== "sistema" && Date.now() - new Date(a.at).getTime() < 60_000)
          toast(`${staffName(a.by)}: ${a.action}${a.detail ? " · " + a.detail : ""}`, "live");
      }
    }
    // tareas nuevas asignadas a mí
    const mine = data.tasks.filter((x) => x.assignedTo === me.id && x.status !== "completada");
    if (seenTasks.current === null) seenTasks.current = new Set(mine.map((x) => x.id));
    else
      for (const x of mine) {
        if (seenTasks.current.has(x.id)) continue;
        seenTasks.current.add(x.id);
        const msg = `${TASK_TYPE_ICON[x.type]} ${x.title} · Hab. ${idx.roomById.get(x.roomId)?.number ?? ""}`;
        if (cfg.avisosEnVivo) toast(`Nueva tarea para vos: ${msg}`, "live");
        // Aviso del sistema (celular / escritorio) si la persona lo activó en "Mucamas"
        try {
          if (cfg.avisosEnVivo && "Notification" in window && Notification.permission === "granted")
            new Notification("Nueva tarea", { body: msg, tag: x.id });
        } catch {}
      }
  }, [data.activity, data.tasks, loaded, me, cfg.avisosEnVivo, staffName, idx.roomById]);

  const alertList = useMemo(() => (loaded && (can("dashboard") || can("mantenimiento")) ? alerts(data, t) : []), [data, t, loaded, can]);
  const openTasks = data.tasks.filter((x) => x.status !== "completada");
  const myOpen = me ? openTasks.filter((x) => x.assignedTo === me.id).length : 0;
  const pendingOrders = data.orders.filter((o) => o.status === "pendiente" || o.status === "preparando").length;

  // Título de la pestaña con contador
  useEffect(() => {
    const hotel = data.settings[0]?.hotelName ?? "Hotel";
    document.title = myOpen ? `(${myOpen}) ${hotel} · PMS` : `${hotel} · PMS`;
  }, [myOpen, data.settings]);

  if (!authReady || (mode === "firebase" && authEmail && !loaded) || (mode === "demo" && !loaded)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-gray-500">
        <Loader2 className="animate-spin" size={22} />
        <span className="text-sm">Cargando el hotel…</span>
      </div>
    );
  }

  if (mode === "firebase" && authEmail && loaded && !me) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <ShieldCheck size={36} className="text-gray-400" />
        <h1 className="text-lg font-semibold">Sin acceso al panel</h1>
        <p className="max-w-md text-sm text-gray-600">
          La cuenta <b>{authEmail}</b> no está dada de alta como personal del hotel{accessError ? " (la base de datos denegó el acceso)" : ""}. Pedile a un
          administrador que te agregue en <b>Administradores</b> con este mismo email.
        </p>
        <button onClick={() => logout()} className="text-sm font-medium text-blue-600 hover:underline">
          Cerrar sesión
        </button>
      </div>
    );
  }
  if (!me) return null;

  const allowed = can(permForPath(path));
  const hotelName = data.settings[0]?.hotelName ?? "Hotel";

  const badgeFor = (perm: Perm) =>
    perm === "mantenimiento" ? openTasks.length : perm === "mi_jornada" ? myOpen : perm === "mucamas" ? openTasks.filter((x) => x.id.startsWith("hk-") || x.type === "cambio_sabanas").length : perm === "menus" ? pendingOrders : 0;

  const sidebar = (
    <div className="flex h-full flex-col border-r border-gray-200/80 bg-white">
      <div className="flex h-16 items-center justify-between gap-2 px-4">
        {!collapsed && (
          <Link href={home} className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg shadow-btn">
              <BedDouble size={16} />
            </span>
            <span className="truncate text-[12px] font-bold uppercase tracking-[0.12em] text-gray-900">{hotelName}</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 lg:block"
          title="Contraer menú"
        >
          <ChevronsLeftRight size={15} />
        </button>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-4 pt-1">
        {NAV.map((g) => {
          const items = g.items.filter((n) => can(n.perm));
          if (!items.length) return null;
          return (
            <div key={g.group}>
              {!collapsed && <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{g.group}</div>}
              <div className="space-y-0.5">
                {items.map((n) => {
                  const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
                  const badge = badgeFor(n.perm);
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      prefetch
                      title={n.label}
                      className={cls(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition",
                        active ? "bg-accent/10 font-medium text-accent ring-1 ring-inset ring-accent/20" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                      )}
                    >
                      <n.icon size={17} className="shrink-0" />
                      {!collapsed && <span className="flex-1">{n.label}</span>}
                      {badge > 0 && (
                        <span
                          className={cls(
                            "rounded-full px-1.5 text-[11px] font-semibold leading-5",
                            active ? "bg-accent text-accent-fg" : "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200",
                            collapsed && "absolute right-1 top-0.5 scale-90",
                          )}
                        >
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-gray-100 p-3">
        <div className={cls("flex items-center gap-2.5", collapsed && "justify-center")}>
          <Avatar name={me.name} size={34} />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-gray-900">{me.name}</div>
              <div className="truncate text-xs text-gray-500">{ROLE_LABEL[me.role]}</div>
            </div>
          )}
          {!collapsed && (
            <button onClick={() => logout().then(() => router.replace("/login"))} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="Cerrar sesión">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className={cls("hidden shrink-0 transition-[width] lg:block", collapsed ? "w-[72px]" : "w-[240px]")}>{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-gray-900/30 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="h-full w-[260px]" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ===== Barra superior ===== */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-gray-200 bg-white/90 px-3 backdrop-blur lg:px-5">
          <button onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 hover:bg-gray-100 lg:hidden" aria-label="Menú">
            <MenuIcon size={20} />
          </button>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-9 min-w-0 max-w-md flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-400 hover:bg-gray-100"
          >
            <Search size={15} />
            <span className="truncate">Buscar huésped, habitación o reserva…</span>
            <kbd className="ml-auto hidden rounded border border-gray-200 bg-white px-1.5 text-[11px] text-gray-500 sm:inline">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <span
              className="hidden items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 md:flex"
              title={online.map((s) => s.name).join(", ") || "Sólo vos"}
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              {mode === "firebase" ? `En vivo · ${Math.max(1, online.length)} conectado${online.length === 1 ? "" : "s"}` : "Modo demo"}
            </span>
            <div className="relative">
              <button onClick={() => setBellOpen(!bellOpen)} className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100" aria-label="Alertas">
                <Bell size={18} />
                {alertList.length > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {alertList.length}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="absolute right-0 top-11 z-30 w-[min(380px,90vw)] rounded-xl border border-gray-200 bg-white shadow-xl">
                  <div className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold">Alertas ({alertList.length})</div>
                  <ul className="max-h-[400px] divide-y divide-gray-100 overflow-y-auto">
                    {alertList.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-500">Todo en orden 👌</li>}
                    {alertList.slice(0, 60).map((a, i) => (
                      <li key={i}>
                        <Link href={a.href} className="flex gap-2 px-4 py-2.5 text-sm hover:bg-gray-50">
                          <span className={cls("mt-1.5 h-2 w-2 shrink-0 rounded-full", a.level === "alta" ? "bg-red-500" : "bg-amber-400")} />
                          {a.text}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto">
          {allowed ? (
            children
          ) : (
            <div className="p-10 text-center text-sm text-gray-600">
              Tu cargo ({ROLE_LABEL[me.role]}) no tiene acceso a esta sección.{" "}
              <Link href={home} className="font-medium text-blue-600 hover:underline">
                Ir al inicio
              </Link>
            </div>
          )}
        </main>
      </div>
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

function GlobalSearch({ onClose }: { onClose: () => void }) {
  const { data, idx, can } = useApp();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const out: { label: string; sub: string; href: string; kind: string }[] = [];
    for (const room of idx.roomsSorted)
      if (room.number.includes(s)) out.push({ kind: "Habitación", label: `Hab. ${room.number}`, sub: room.type, href: `/mantenimiento?hab=${room.id}` });
    if (can("reservas") || can("recepcion"))
      for (const r of data.reservations)
        if (r.guestName.toLowerCase().includes(s) && r.status !== "cancelada")
          out.push({
            kind: "Reserva",
            label: r.guestName,
            sub: `Hab. ${idx.roomById.get(r.roomId)?.number} · ${fmtDate(r.checkIn)} → ${fmtDate(r.checkOut)}`,
            href: `/reservas?r=${r.id}`,
          });
    if (can("huespedes"))
      for (const g of data.guests)
        if ([g.name, g.email, g.phone, g.document].some((x) => x?.toLowerCase().includes(s)))
          out.push({ kind: "Huésped", label: g.name, sub: g.phone ?? g.email ?? "", href: `/huespedes?g=${g.id}` });
    return out.slice(0, 30);
  }, [q, data, idx, can]);

  function go(i: number) {
    const r = results[i];
    if (!r) return;
    router.push(r.href);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center bg-gray-900/40 p-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-gray-100 px-4">
          <Search size={17} className="text-gray-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") setSel((x) => Math.min(results.length - 1, x + 1));
              if (e.key === "ArrowUp") setSel((x) => Math.max(0, x - 1));
              if (e.key === "Enter") go(sel);
            }}
            placeholder="Nombre, teléfono, DNI o número de habitación…"
            className="h-12 flex-1 bg-transparent text-[15px] outline-none"
          />
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-1">
          {q && results.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-500">Sin resultados</li>}
          {!q && <li className="px-4 py-6 text-center text-sm text-gray-400">Escribí para buscar en todo el hotel</li>}
          {results.map((r, i) => (
            <li key={i}>
              <button
                onMouseEnter={() => setSel(i)}
                onClick={() => go(i)}
                className={cls("flex w-full items-center gap-3 px-4 py-2 text-left", i === sel && "bg-gray-100")}
              >
                <span className="w-[78px] shrink-0 text-[11px] font-medium uppercase tracking-wide text-gray-400">{r.kind}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.label}</span>
                  <span className="block truncate text-xs text-gray-500">{r.sub}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
