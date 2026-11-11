"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowUp,
  BarChart3,
  Bell,
  BedDouble,
  CalendarRange,
  CheckCircle2,
  ChevronsLeftRight,
  ClipboardCheck,
  Clock,
  DollarSign,
  LayoutDashboard,
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
import { Avatar, Empty, HotelLoader, Kbd, ThemeToggle, toast } from "./ui";
import { alerts, planAutomations, planSize } from "@/lib/automation";
import { fmtDate, today } from "@/lib/dates";
import { automationOf, cls, ROLE_LABEL } from "@/lib/logic";
import type { Perm } from "@/lib/types";

type NavItem = { href: string; label: string; icon: React.ElementType; perm: Perm };
const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Operación",
    items: [
      { href: "/", label: "Inicio", icon: LayoutDashboard, perm: "dashboard" },
      { href: "/mi-jornada", label: "Mi trabajo de hoy", icon: ClipboardCheck, perm: "mi_jornada" },
      { href: "/recepcion", label: "Recepción", icon: ArrowLeftRight, perm: "recepcion" },
      { href: "/reservas", label: "Reservas", icon: CalendarRange, perm: "reservas" },
      { href: "/huespedes", label: "Huéspedes", icon: Users, perm: "huespedes" },
    ],
  },
  {
    group: "Servicios",
    items: [
      { href: "/mucamas", label: "Mucamas", icon: Sparkles, perm: "mucamas" },
      { href: "/mantenimiento", label: "Limpieza y arreglos", icon: Wrench, perm: "mantenimiento" },
      { href: "/menus", label: "Comidas y pedidos", icon: UtensilsCrossed, perm: "menus" },
      { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, perm: "whatsapp" },
    ],
  },
  {
    group: "Gestión",
    items: [
      { href: "/facturacion", label: "Cobros y facturas", icon: DollarSign, perm: "facturacion" },
      { href: "/finanzas", label: "Plata y resultados", icon: BarChart3, perm: "finanzas" },
      { href: "/automatizaciones", label: "Automatizaciones", icon: Workflow, perm: "automatizaciones" },
      { href: "/administradores", label: "Administradores", icon: ShieldCheck, perm: "administradores" },
    ],
  },
];
const ALL_NAV = NAV.flatMap((g) => g.items);

// Alertas agrupadas por gravedad: título y caja de color del ícono.
const ALERT_GROUPS = [
  { level: "alta", title: "Urgente", box: "bg-red-50 text-red-700" },
  { level: "media", title: "Para revisar", box: "bg-amber-50 text-amber-800" },
] as const;

function alertIcon(text: string): React.ElementType {
  if (text.includes("día de salida")) return LogOut;
  if (text.includes("no está lista")) return BedDouble;
  if (text.startsWith("Urgente")) return AlertTriangle;
  if (text.includes("atrasada")) return Clock;
  return Bell;
}

// Acciones rápidas de la paleta Ctrl+K (sólo las que la persona puede ver).
const QUICK_ACTIONS: { label: string; sub: string; href: string; perm: Perm; icon: React.ElementType }[] = [
  { label: "Ver reservas", sub: "Calendario y lista de reservas", href: "/reservas", perm: "reservas", icon: CalendarRange },
  { label: "Ir a Recepción", sub: "Llegadas y salidas de hoy", href: "/recepcion", perm: "recepcion", icon: ArrowLeftRight },
  { label: "Ir a Mi trabajo de hoy", sub: "Tus tareas pendientes", href: "/mi-jornada", perm: "mi_jornada", icon: ClipboardCheck },
  { label: "Ir a Limpieza y arreglos", sub: "Tareas de las habitaciones", href: "/mantenimiento", perm: "mantenimiento", icon: Wrench },
  { label: "Ir a Cobros y facturas", sub: "Cobros pendientes y facturas", href: "/facturacion", perm: "facturacion", icon: DollarSign },
];

/** Hora y fecha cortas (se actualiza cada 30 s sin tocar el resto de la barra). */
function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(i);
  }, []);
  if (!now) return null;
  const hora = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  const fecha = now.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" }).replace(/[,.]/g, "");
  return (
    <time dateTime={now.toISOString()} className="mr-2 hidden flex-col items-end leading-tight lg:flex" title="Hora actual">
      <span className="num text-[19px] text-fg">{hora}</span>
      <span className="text-[12.5px] text-gray-600">{fecha}</span>
    </time>
  );
}

/** Bienvenida en la barra superior: saludo + fecha + huéspedes alojados hoy. */
function Greeting() {
  const { me, data } = useApp();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(i);
  }, []);
  const huespedes = useMemo(() => data.reservations.reduce((s, r) => (r.status === "checkin" ? s + r.pax : s), 0), [data.reservations]);
  if (!now || !me) return null;
  const h = now.getHours();
  const saludo = h < 12 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
  const fecha = now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="hidden min-w-0 shrink flex-col leading-tight md:flex" aria-live="off">
      <span className="truncate text-[15px] font-semibold text-fg">
        {saludo}, <span className="text-accent">{me.name.split(" ")[0]}</span>
      </span>
      <span className="truncate text-[12.5px] text-gray-600">
        {fecha} · {huespedes} {huespedes === 1 ? "huésped alojado" : "huéspedes alojados"} hoy
      </span>
    </div>
  );
}

/** Logo del hotel (public/logo-al-mare.png). Si el archivo no está, muestra ícono + nombre. */
function HotelLogo({ name }: { name: string }) {
  const [ok, setOk] = useState(true);
  if (ok)
    return <Image src="/logo-al-mare.png" alt={name} width={373} height={128} priority className="h-12 w-auto" onError={() => setOk(false)} unoptimized />;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="logo-grad flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-accent-fg">
        <BedDouble size={18} />
      </span>
      <span className="display line-clamp-2 text-[12.5px] leading-[1.05] text-fg">{name}</span>
    </span>
  );
}

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
  const [showTop, setShowTop] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
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
    setShowTop(false);
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
        const msg = `${x.title} · Habitación ${idx.roomById.get(x.roomId)?.number ?? ""}`;
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
    return <HotelLoader />;
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
        <button onClick={() => logout()} className="text-sm font-medium text-accent hover:underline">
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
    <div className="flex h-full flex-col border-r border-gray-200/80 bg-panel">
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 px-4">
        {!collapsed && (
          <Link href={home} className="flex min-w-0 items-center" aria-label={hotelName}>
            <HotelLogo name={hotelName} />
          </Link>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden rounded-lg border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-100 hover:text-fg lg:block"
          title="Contraer menú"
          aria-label="Contraer menú"
        >
          <ChevronsLeftRight size={15} />
        </button>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 pt-2">
        {NAV.map((g) => {
          const items = g.items.filter((n) => can(n.perm));
          if (!items.length) return null;
          return (
            <div key={g.group}>
              {!collapsed && (
                <div className="label-mono flex items-center gap-2 px-3 pb-1.5 text-[12.5px] text-gray-600">
                  {g.group}
                  <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-gray-300 to-transparent" />
                </div>
              )}
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
                        "group relative flex min-h-11 items-center gap-3 rounded-xl px-2 py-1.5 text-[15px] transition before:absolute before:-left-2 before:top-2.5 before:h-6 before:w-1 before:rounded-full before:bg-accent before:opacity-0 before:transition-opacity",
                        active ? "nav-active font-semibold text-accent before:opacity-100 before:shadow-[0_0_10px_rgb(var(--accent))]" : "text-gray-700 hover:bg-gray-100 hover:text-fg",
                      )}
                    >
                      <span className={cls("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition duration-200", active ? "bg-accent text-accent-fg shadow-btn" : "bg-gray-100 text-gray-600 group-hover:bg-accent/15 group-hover:text-accent group-hover:shadow-[0_0_12px_rgb(var(--accent)/0.35)]")}>
                        <n.icon size={17} />
                      </span>
                      {!collapsed && <span className="flex-1">{n.label}</span>}
                      {badge > 0 && (
                        <span
                          className={cls(
                            "label-mono min-w-[24px] rounded-full px-1.5 text-center text-[12.5px] font-semibold leading-[22px] tracking-normal",
                            active ? "bg-accent text-accent-fg" : "bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-300",
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
      <div className="border-t border-gray-200/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className={cls("flex items-center gap-2.5 rounded-xl border border-gray-200/80 bg-panel-2/70 p-2 shadow-card", collapsed && "justify-center")}>
          <span className="relative">
            <Avatar name={me.name} size={36} />
            <span aria-hidden className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 ring-2 ring-panel" />
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-fg">{me.name}</div>
              <div className="line-clamp-2 text-[12.5px] leading-tight text-gray-600">{ROLE_LABEL[me.role]}</div>
            </div>
          )}
          {!collapsed && (
            <button onClick={() => logout().then(() => router.replace("/login"))} className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 hover:text-fg lg:h-9 lg:w-9" title="Cerrar sesión" aria-label="Cerrar sesión">
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
        <div className="ui-overlay fixed inset-0 z-40 bg-black/55 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="ui-drawer-left h-full w-[min(300px,86vw)] shadow-pop" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ===== Barra superior ===== */}
        <header className="glass sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b border-gray-200/80 px-3 lg:px-5">
          <button onClick={() => setMobileOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-700 transition hover:bg-gray-100 hover:text-fg lg:hidden" aria-label="Menú">
            <MenuIcon size={22} />
          </button>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-11 min-w-0 max-w-md flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-[rgb(var(--well))] px-3 text-left text-[15px] text-gray-600 transition hover:border-gray-400 sm:h-10 md:max-w-[260px] 2xl:max-w-md"
          >
            <Search size={17} className="shrink-0 text-accent" />
            <span className="truncate">Buscar huésped, habitación o reserva…</span>
            <span className="ml-auto hidden shrink-0 whitespace-nowrap 2xl:inline">
              <Kbd>Ctrl K</Kbd>
            </span>
          </button>
          <div className="ml-2 min-w-0 lg:ml-4">
            <Greeting />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <LiveClock />
            <ThemeToggle />
            <span
              className="hidden items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-[13px] font-semibold text-green-700 md:flex"
              title={online.map((s) => s.name).join(", ") || "Sólo vos"}
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              {mode === "firebase" ? `En vivo · ${Math.max(1, online.length)} conectado${online.length === 1 ? "" : "s"}` : "Modo demo"}
            </span>
            <div className="relative">
              <button onClick={() => setBellOpen(!bellOpen)} className="relative flex h-11 w-11 items-center justify-center rounded-lg text-gray-700 transition hover:bg-gray-100 hover:text-fg sm:h-10 sm:w-10" aria-label="Alertas">
                <Bell size={20} className={cls(alertList.length > 0 && "bell-ring")} />
                {alertList.length > 0 && (
                  <span className="alert-pulse absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-700 px-1 text-[12px] font-bold leading-none text-white ring-2 ring-panel">
                    {alertList.length}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="ui-pop fixed inset-x-3 top-[4.25rem] z-30 rounded-xl border border-gray-200 bg-panel shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[380px]">
                  <div className="border-b border-gray-200/70 px-4 py-3 text-[15px] font-semibold">Alertas ({alertList.length})</div>
                  <div className="max-h-[60vh] overflow-y-auto pb-1">
                    {alertList.length === 0 && (
                      <Empty icon={CheckCircle2} title="Todo en orden">
                        No hay nada que atender por ahora.
                      </Empty>
                    )}
                    {ALERT_GROUPS.map((g) => {
                      const items = alertList.filter((a) => a.level === g.level).slice(0, 40);
                      if (!items.length) return null;
                      return (
                        <section key={g.level}>
                          <h3 className="label-mono px-4 pb-1 pt-3 text-[12.5px] text-gray-600">
                            {g.title} ({items.length})
                          </h3>
                          <ul className="stagger divide-y divide-gray-200/60">
                            {items.map((a, i) => {
                              const Icon = alertIcon(a.text);
                              return (
                                <li key={i}>
                                  <Link href={a.href} className="flex gap-3 px-4 py-3 text-[15px] leading-snug transition hover:bg-gray-100">
                                    <span className={cls("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", g.box)}>
                                      <Icon size={17} />
                                    </span>
                                    <span className="min-w-0 pt-1">{a.text}</span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </section>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main ref={mainRef} key={path} onScroll={(e) => setShowTop(e.currentTarget.scrollTop > 600)} className="page-enter min-h-0 flex-1 overflow-auto">
          {allowed ? (
            children
          ) : (
            <div className="p-10 text-center text-sm text-gray-600">
              Tu cargo ({ROLE_LABEL[me.role]}) no tiene acceso a esta sección.{" "}
              <Link href={home} className="font-medium text-accent hover:underline">
                Ir al inicio
              </Link>
            </div>
          )}
        </main>
        {showTop && (
          <button
            type="button"
            onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Ir arriba"
            className="ui-pop fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-gray-300 bg-panel text-accent shadow-pop lg:hidden"
          >
            <ArrowUp size={20} />
          </button>
        )}
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
    const out: { label: string; sub: string; href: string; kind: string; icon?: React.ElementType }[] = [];
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

  const quick = useMemo(() => QUICK_ACTIONS.filter((x) => can(x.perm)).map((x) => ({ ...x, kind: "Ir a" })), [can]);
  const list: { label: string; sub: string; href: string; kind: string; icon?: React.ElementType }[] = q.trim() ? results : quick;

  function go(i: number) {
    const r = list[i];
    if (!r) return;
    router.push(r.href);
    onClose();
  }

  return (
    <div className="ui-overlay fixed inset-0 z-[55] flex items-start justify-center bg-black/55 p-3 pt-[8vh] backdrop-blur-sm sm:p-4 sm:pt-[12vh]" onMouseDown={onClose}>
      <div className="ui-pop w-full max-w-xl overflow-hidden rounded-2xl bg-panel shadow-pop" onMouseDown={(e) => e.stopPropagation()}>
        <div className="h-0.5 bg-gradient-to-r from-accent via-accent/40 to-transparent" aria-hidden />
        <div className="flex items-center gap-2 border-b border-gray-200/70 bg-gradient-to-b from-accent/[0.06] to-transparent px-4">
          <Search size={18} className="shrink-0 text-accent" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") setSel((x) => Math.min(list.length - 1, x + 1));
              if (e.key === "ArrowUp") setSel((x) => Math.max(0, x - 1));
              if (e.key === "Enter") go(sel);
            }}
            placeholder="Nombre, teléfono, DNI o número de habitación…"
            className="h-14 min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-gray-500"
          />
        </div>
        <ul className="max-h-[60vh] overflow-y-auto py-1">
          {q && results.length === 0 && <li className="px-4 py-6 text-center text-[15px] text-gray-600">Sin resultados</li>}
          {!q.trim() && <li className="label-mono px-4 pb-1 pt-3 text-[12.5px] text-gray-600">Acciones rápidas</li>}
          {list.map((r, i) => (
            <li key={i}>
              <button
                onMouseEnter={() => setSel(i)}
                onClick={() => go(i)}
                className={cls("relative flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left transition-colors", i === sel && "bg-accent/10 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-accent")}
              >
                {r.icon ? (
                  <span className={cls("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", i === sel ? "bg-accent text-accent-fg" : "bg-gray-100 text-gray-600")}>
                    <r.icon size={18} />
                  </span>
                ) : (
                  <span className={cls("label-mono w-[96px] shrink-0 rounded-md px-2 py-0.5 text-center text-[12.5px]", i === sel ? "bg-accent text-accent-fg" : "bg-gray-100 text-gray-600")}>{r.kind}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{r.label}</span>
                  <span className="block truncate text-[13px] text-gray-600">{r.sub}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="hidden items-center gap-4 border-t border-gray-200/70 px-4 py-2.5 text-[13px] text-gray-600 sm:flex">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> elegir
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Enter</Kbd> abrir
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Esc</Kbd> cerrar
          </span>
        </div>
      </div>
    </div>
  );
}
