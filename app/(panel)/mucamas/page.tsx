"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BedDouble, BellRing, ChevronRight, DoorOpen, LayoutGrid, List, ListChecks, LogIn, Sparkles, User, Wand2 } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { TaskDrawer } from "@/components/tasks";
import { Avatar, Badge, Button, Card, Empty, Modal, Select, toast } from "@/components/ui";
import { CountUp, Ring } from "@/components/viz";
import { sheetsInfo } from "@/lib/automation";
import { fmtDate, today } from "@/lib/dates";
import { automationOf, cls, ROOM_STATE_DOT, ROOM_STATE_LABEL, TASK_TYPE_LABEL } from "@/lib/logic";
import type { Reservation, Room, Task } from "@/lib/types";
import { ConfettiLayer, fireConfetti, TaskIcon, vibrate } from "@/components/TaskIcon";

type HkType = "servicio" | "fondo" | "repaso";
const TAREAS: { valor: HkType; etiqueta: string; ayuda: string }[] = [
  { valor: "servicio", etiqueta: "Limpieza completa", ayuda: "Limpieza del día de una habitación con huéspedes" },
  { valor: "fondo", etiqueta: "Limpieza a fondo", ayuda: "Limpieza profunda de toda la habitación" },
  { valor: "repaso", etiqueta: "Repaso rápido", ayuda: "Una pasada rápida a una habitación libre" },
];
type HkRow = {
  room: Room;
  res?: Reservation;
  arriving?: Reservation;
  hk?: Task;
  hecha: boolean;
  sheets: { days: number; by?: string } | null;
  tocaSabanas: boolean;
  otras: Task[];
  state: keyof typeof ROOM_STATE_LABEL;
};
const VISTA_KEY = "hotel-mucamas-vista";
type Filtro = "mias" | "todas" | "ocupadas" | "desocupadas" | "pendientes" | "sabanas" | "sinasignar" | "llegan";

function permisoInicial(): NotificationPermission | "unsupported" {
  try {
    return "Notification" in window ? Notification.permission : "unsupported";
  } catch {
    return "unsupported";
  }
}

export default function MucamasPage() {
  const { data, idx, me, can, actions, staffName } = useApp();
  const t = today();
  const cfg = automationOf(data.settings[0]);
  const puedeAsignar = can("gestionar_tareas");
  const esMucama = me?.role === "mucama";
  const [filtro, setFiltro] = useState<Filtro>(esMucama ? "mias" : "todas");
  const [sel, setSel] = useState<string[]>([]);
  const [bulkTarea, setBulkTarea] = useState<HkType>("servicio");
  const [bulkMucama, setBulkMucama] = useState("");
  const [permiso, setPermiso] = useState<NotificationPermission | "unsupported">("unsupported");
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [vista, setVista] = useState<"lista" | "plano">("lista");
  const [planoRoom, setPlanoRoom] = useState<string | null>(null);
  useEffect(() => setPermiso(permisoInicial()), []);
  useEffect(() => {
    try {
      if (localStorage.getItem(VISTA_KEY) === "plano") setVista("plano");
    } catch {
      /* sin almacenamiento: queda la lista */
    }
  }, []);
  function elegirVista(v: "lista" | "plano") {
    setVista(v);
    try {
      localStorage.setItem(VISTA_KEY, v);
    } catch {
      /* no se pudo guardar la preferencia */
    }
  }

  const mucamas = useMemo(() => data.staff.filter((s) => s.active && s.role === "mucama").sort((a, b) => a.name.localeCompare(b.name)), [data.staff]);
  useEffect(() => {
    if (!bulkMucama && mucamas[0]) setBulkMucama(mucamas[0].id);
  }, [mucamas, bulkMucama]);

  // ---- Modelo por habitación (una pasada) ----
  const rooms = useMemo<HkRow[]>(() => {
    const tasksByRoom = new Map<string, Task[]>();
    for (const x of data.tasks) tasksByRoom.set(x.roomId, [...(tasksByRoom.get(x.roomId) ?? []), x]);
    return idx.roomsSorted.map((room) => {
      const roomTasks = tasksByRoom.get(room.id) ?? [];
      const res = (idx.resByRoom.get(room.id) ?? []).find((r) => r.status === "checkin");
      const arriving = (idx.resByRoom.get(room.id) ?? []).find((r) => (r.status === "confirmada" || r.status === "pendiente") && r.checkIn === t);
      const hk = roomTasks.find((x) => x.id === `hk-${room.id}-${t}`);
      const sheets = res ? sheetsInfo(res, roomTasks, t) : null;
      const sheetsTask = roomTasks.find((x) => x.type === "cambio_sabanas" && x.status !== "completada" && x.trigger === "estadia");
      const otras = roomTasks.filter((x) => x.status !== "completada" && x.id !== hk?.id);
      return {
        room,
        res,
        arriving,
        hk,
        hecha: hk?.status === "completada",
        sheets,
        tocaSabanas: !!res && (!!sheetsTask || (sheets?.days ?? 0) >= cfg.sabanasCadaDias),
        otras,
        state: idx.roomStates.get(room.id) ?? "lista",
      };
    });
  }, [data.tasks, idx, t, cfg.sabanasCadaDias]);

  const resumen = useMemo(() => {
    const ocupadas = rooms.filter((r) => r.res).length;
    const conTarea = rooms.filter((r) => r.hk);
    const hechas = conTarea.filter((r) => r.hecha).length;
    const equipo = mucamas.map((m) => {
      const mine = conTarea.filter((r) => r.hk!.assignedTo === m.id);
      const otras = data.tasks.filter((x) => x.assignedTo === m.id && x.status !== "completada" && !x.id.startsWith("hk-")).length;
      return { ...m, total: mine.length, hechas: mine.filter((r) => r.hecha).length, otras };
    });
    return { ocupadas, desocupadas: rooms.length - ocupadas, conTarea: conTarea.length, hechas, equipo, sabanas: rooms.filter((r) => r.tocaSabanas), llegan: rooms.filter((r) => r.arriving).length };
  }, [rooms, mucamas, data.tasks]);

  const visibles = useMemo(
    () =>
      rooms.filter((r) => {
        switch (filtro) {
          case "ocupadas":
            return !!r.res;
          case "desocupadas":
            return !r.res;
          case "pendientes":
            return r.hk && !r.hecha;
          case "sabanas":
            return r.tocaSabanas;
          case "mias":
            return r.hk?.assignedTo === me?.id || r.otras.some((x) => x.assignedTo === me?.id);
          case "sinasignar":
            return !r.hk?.assignedTo;
          case "llegan":
            return !!r.arriving;
          default:
            return true;
        }
      }),
    [rooms, filtro, me?.id],
  );

  /** Cómo quedaría la carga de cada mucama si se aplica la asignación en lote que está armada. */
  const vistaPrevia = useMemo(() => {
    if (!sel.length || !bulkMucama) return [];
    const cuenta = new Map(mucamas.map((m) => [m.id, 0]));
    for (const r of rooms) {
      const dueña = sel.includes(r.room.id) ? bulkMucama : r.hk?.assignedTo;
      if (dueña && (r.hk || sel.includes(r.room.id))) cuenta.set(dueña, (cuenta.get(dueña) ?? 0) + 1);
    }
    return mucamas.map((m) => ({ id: m.id, nombre: m.name.split(" ")[0], n: cuenta.get(m.id) ?? 0 }));
  }, [sel, bulkMucama, rooms, mucamas]);

  const planoRow = rooms.find((r) => r.room.id === planoRoom);
  const puedeTildar = (r: HkRow) => !!r.hk && (puedeAsignar || r.hk.assignedTo === me?.id);

  async function asignarUno(r: HkRow, tipo: HkType | "", mucama?: string) {
    if (!puedeAsignar) return;
    if (!tipo) return actions.clearHousekeeping([r.room.id]);
    await actions.planHousekeeping([{ roomId: r.room.id, type: tipo, staffId: mucama ?? r.hk?.assignedTo }]);
  }
  async function asignarLote() {
    if (!sel.length) return;
    await actions.planHousekeeping(sel.map((roomId) => ({ roomId, type: bulkTarea, staffId: bulkMucama || undefined })));
    toast(`Listo: ${sel.length} ${sel.length === 1 ? "habitación" : "habitaciones"} para ${staffName(bulkMucama)} ✔`);
    setSel([]);
  }
  async function quitarLote() {
    if (!sel.length) return;
    await actions.clearHousekeeping(sel);
    toast("Listo, se quitaron las tareas ✔");
    setSel([]);
  }
  /** Plan automático: ocupadas → Servicio, libres listas → Repaso; reparte equitativamente entre las mucamas activas. */
  async function planAutomatico() {
    if (!mucamas.length) return toast("No hay mucamas cargadas para repartir el trabajo", "error");
    const carga = new Map(mucamas.map((m) => [m.id, data.tasks.filter((x) => x.assignedTo === m.id && x.status !== "completada").length]));
    const items: { roomId: string; type: HkType; staffId: string }[] = [];
    for (const r of rooms) {
      if (r.hk) continue;
      if (r.state === "mantenimiento" || r.state === "fuera_servicio") continue;
      if (r.otras.some((x) => x.trigger === "checkout")) continue; // ya tiene la limpieza de salida
      const type: HkType | null = r.res ? "servicio" : r.state === "lista" && !r.arriving ? "repaso" : null;
      if (!type) continue;
      const m = [...carga.entries()].sort((a, b) => a[1] - b[1])[0][0];
      carga.set(m, (carga.get(m) ?? 0) + 1);
      items.push({ roomId: r.room.id, type, staffId: m });
    }
    if (!items.length) return toast("Todas las habitaciones ya tienen su tarea de hoy");
    if (!confirm(`Se van a repartir ${items.length} habitaciones (${items.filter((i) => i.type === "servicio").length} limpiezas completas y ${items.filter((i) => i.type === "repaso").length} repasos rápidos) entre ${mucamas.length} mucamas.\n\n¿Seguimos?`)) return;
    await actions.planHousekeeping(items);
    toast(`Listo, el trabajo de hoy quedó repartido: ${items.length} habitaciones ✔`);
  }
  async function activarAvisos() {
    try {
      const res = await Notification.requestPermission();
      setPermiso(res);
      if (res === "granted") new Notification("Avisos activados", { body: "Te vamos a avisar cuando tengas tareas nuevas o cambios de sábanas." });
    } catch {
      setPermiso("unsupported");
    }
  }

  if (!me) return null;
  const cargaMax = Math.max(0, ...resumen.equipo.map((m) => m.total + m.otras));
  const filtros: { valor: Filtro; etiqueta: string }[] = [
    ...(esMucama ? [{ valor: "mias" as const, etiqueta: "Mis habitaciones" }] : []),
    { valor: "todas", etiqueta: "Todas" },
    { valor: "ocupadas", etiqueta: "Con huéspedes" },
    { valor: "desocupadas", etiqueta: "Libres" },
    { valor: "pendientes", etiqueta: "Falta limpiar" },
    { valor: "sabanas", etiqueta: `Cambiar sábanas (${resumen.sabanas.length})` },
    { valor: "llegan", etiqueta: `Llegan hoy (${resumen.llegan})` },
    ...(puedeAsignar ? [{ valor: "sinasignar" as const, etiqueta: "Sin mucama" }] : []),
  ];

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <header className="aurora space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="display text-balance text-[28px] text-fg md:text-[36px]">
              <span className="serif-accent">Mucamas</span>
            </h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-gray-600">
              {`${new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })} · quién limpia cada habitación hoy`}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {permiso === "default" && (
              <Button className="w-full sm:w-auto" onClick={activarAvisos}>
                <BellRing size={16} /> Activar avisos en este aparato
              </Button>
            )}
            {permiso === "denied" && <span className="max-w-xs text-[14px] leading-snug text-gray-600">Los avisos están bloqueados. Se activan desde la configuración del navegador.</span>}
            {puedeAsignar && (
              <Button variant="primary" className="w-full sm:w-auto" onClick={planAutomatico}>
                <Wand2 size={16} /> Repartir el día automáticamente
              </Button>
            )}
          </div>
        </div>

        <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Pulse icon={BedDouble} label="Con huéspedes" value={resumen.ocupadas} />
          <Pulse icon={DoorOpen} label="Libres" value={resumen.desocupadas} />
          <div className="col-span-2 flex items-center gap-3 rounded-2xl border border-green-300/70 bg-panel p-3.5 shadow-card sm:col-span-1">
            <Ring value={resumen.conTarea ? (resumen.hechas / resumen.conTarea) * 100 : 0} size={72} stroke={8} tone="green" label={`${resumen.hechas} de ${resumen.conTarea} limpiezas hechas`}>
              <ListChecks size={22} className="text-green-700" aria-hidden />
            </Ring>
            <div className="min-w-0">
              <div className="num whitespace-nowrap text-[30px] leading-none tabular-nums text-fg">
                <CountUp value={resumen.hechas} /> <span className="text-[20px] text-gray-600">de {resumen.conTarea}</span>
              </div>
              <div className="label-mono mt-1.5 text-[12.5px] leading-snug text-gray-600">Limpiezas hechas hoy</div>
            </div>
          </div>
          <Pulse icon={Sparkles} label="Sábanas por cambiar" value={resumen.sabanas.length} sub={`cada ${cfg.sabanasCadaDias} días en habitaciones con gente`} />
          <Pulse icon={LogIn} label="Llegan hoy" value={resumen.llegan} />
        </div>
      </header>

      {resumen.sabanas.length > 0 && (
        <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-[15px] leading-relaxed text-amber-900 shadow-card" role="status">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700">
            <Sparkles size={20} aria-hidden />
          </span>
          <div className="min-w-0 self-center">
            <b className="font-semibold">Cambio de sábanas hoy:</b> <span className="font-semibold tabular-nums">{resumen.sabanas.map((r) => r.room.number).join(", ")}</span>{" "}
            <span className="opacity-90">
              (se cambian cada {cfg.sabanasCadaDias} días en habitaciones con gente
              {can("automatizaciones") && (
                <>
                  {" · "}
                  <Link href="/automatizaciones" className="rounded font-medium underline underline-offset-2 hover:no-underline">
                    cambiar cada cuánto
                  </Link>
                </>
              )}
              )
            </span>
          </div>
        </div>
      )}

      {puedeAsignar && (
        <>
          <div className="stagger grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
            {resumen.equipo.map((m) => (
              <div key={m.id} className="lift flex items-center gap-3 rounded-2xl border border-gray-200/80 bg-panel p-3.5 shadow-card">
                <Ring value={m.total ? (m.hechas / m.total) * 100 : 0} size={62} stroke={6} tone={m.total && m.hechas === m.total ? "green" : "accent"} label={`${m.name}: ${m.hechas} de ${m.total} hechas`}>
                  <Avatar name={m.name} size={38} />
                </Ring>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-fg" title={m.name}>{m.name}</div>
                  <div className="mb-2 truncate text-[14px] tabular-nums text-gray-600">
                    {m.hechas} de {m.total} hechas{m.otras ? ` · y ${m.otras} tareas más` : ""}
                  </div>
                  <div className="flex items-center gap-2" title={`Carga: ${m.total + m.otras} tareas`}>
                    <span className="label-mono text-[12px] text-gray-600">Carga</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200/70">
                      <div
                        className={cls("h-full rounded-full transition-all duration-500 motion-reduce:transition-none", m.total + m.otras >= cargaMax && cargaMax > 0 ? "bg-amber-500" : "bg-accent")}
                        style={{ width: `${cargaMax ? ((m.total + m.otras) / cargaMax) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {!mucamas.length && <p className="col-span-full rounded-2xl border border-dashed border-gray-300 px-4 py-5 text-center text-[15px] text-gray-600">No hay mucamas cargadas. Agregalas en Administradores.</p>}
          </div>
          <div className={cls("glass top-[4.5rem] z-10 rounded-2xl border p-3.5 transition-colors duration-200 motion-reduce:transition-none sm:p-4", sel.length ? "sticky border-accent/60 shadow-pop" : "border-gray-200/80 shadow-card lg:sticky")}>
            <div className={cls("mb-3 flex items-start gap-2.5 text-[15px] leading-snug", sel.length ? "font-semibold text-fg" : "text-gray-700")}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <ListChecks size={20} aria-hidden />
              </span>
              <span className="min-w-0 self-center">{sel.length === 0 ? "Tildá las habitaciones de abajo, elegí la tarea y la mucama, y tocá Asignar." : sel.length === 1 ? "Elegiste 1 habitación" : `Elegiste ${sel.length} habitaciones`}</span>
            </div>
            {vistaPrevia.length > 0 && (
              <p className="mb-3 flex flex-wrap items-center gap-1.5 text-[14px] text-gray-700">
                <span className="mr-0.5 font-medium">Así quedaría el reparto:</span>
                {vistaPrevia.map((v) => (
                  <span key={v.id} className={cls("rounded-full px-2.5 py-0.5 font-semibold tabular-nums ring-1 ring-inset", v.id === bulkMucama ? "bg-accent text-accent-fg ring-transparent" : "bg-gray-100 text-gray-800 ring-gray-200")}>
                    {v.nombre} {v.n}
                  </span>
                ))}
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
              <Select value={bulkTarea} onChange={(e) => setBulkTarea(e.target.value as HkType)} className="w-full lg:w-[200px]" aria-label="Tarea a asignar">
                {TAREAS.map((x) => (
                  <option key={x.valor} value={x.valor}>
                    {x.etiqueta}
                  </option>
                ))}
              </Select>
              <Select value={bulkMucama} onChange={(e) => setBulkMucama(e.target.value)} className="w-full lg:w-[200px]" aria-label="Mucama">
                {mucamas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
              <Button variant="primary" disabled={!sel.length} onClick={asignarLote}>
                Asignar a la mucama
              </Button>
              <Button disabled={!sel.length} onClick={quitarLote}>
                Quitarles la tarea
              </Button>
              <Button variant="ghost" className="sm:col-span-2 lg:col-span-1" onClick={() => setSel(sel.length ? [] : visibles.map((r) => r.room.id))}>
                {sel.length ? "Desmarcar todas" : "Elegir todas las que se ven"}
              </Button>
            </div>
          </div>
        </>
      )}

      <div role="group" aria-label="Cómo ver las habitaciones" className="grid w-full grid-cols-2 gap-1 rounded-xl border border-gray-200 bg-[rgb(var(--well))] p-1 sm:inline-grid sm:w-auto">
        {(
          [
            { v: "lista", t: "Lista", Icon: List },
            { v: "plano", t: "Plano de pisos", Icon: LayoutGrid },
          ] as const
        ).map(({ v, t: txt, Icon }) => (
          <button
            key={v}
            aria-pressed={vista === v}
            onClick={() => elegirVista(v)}
            className={cls(
              "flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-[15px] transition-all duration-200 motion-reduce:transition-none sm:min-h-10",
              vista === v ? "bg-panel font-semibold text-accent shadow-card ring-1 ring-inset ring-accent/30" : "font-medium text-gray-600 hover:bg-panel/60 hover:text-fg",
            )}
          >
            <Icon size={18} aria-hidden /> {txt}
          </button>
        ))}
      </div>

      <nav className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" aria-label="Filtrar habitaciones">
        {filtros.map((f) => (
          <button
            key={f.valor}
            aria-pressed={filtro === f.valor}
            onClick={() => setFiltro(f.valor)}
            className={cls(
              "min-h-[44px] shrink-0 whitespace-nowrap rounded-full border px-4 text-[15px] tabular-nums transition-colors duration-150 motion-reduce:transition-none sm:min-h-10",
              filtro === f.valor ? "border-accent bg-accent font-semibold text-accent-fg shadow-card" : "border-gray-200 bg-panel font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-100 hover:text-fg",
            )}
          >
            {f.etiqueta}
          </button>
        ))}
      </nav>

      {visibles.length === 0 ? (
        <Card>
          <Empty icon={BedDouble}>No hay habitaciones en este grupo.</Empty>
        </Card>
      ) : vista === "plano" ? (
        <FloorPlan rows={visibles} sel={sel} onOpen={setPlanoRoom} />
      ) : (
        <ul className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {visibles.map((r) => (
            <RoomCard
              key={r.room.id}
              r={r}
              selected={sel.includes(r.room.id)}
              onSelect={() => setSel((s) => (s.includes(r.room.id) ? s.filter((x) => x !== r.room.id) : [...s, r.room.id]))}
              puedeAsignar={puedeAsignar}
              puedeTildar={puedeTildar(r)}
              mucamas={mucamas}
              meId={me.id}
              onAsignar={asignarUno}
              onOpenTask={setOpenTask}
            />
          ))}
        </ul>
      )}
      <Modal open={!!planoRow} onClose={() => setPlanoRoom(null)} title={`Habitación ${planoRow?.room.number ?? ""}`}>
        {planoRow && (
          <ul>
            <RoomCard
              r={planoRow}
              selected={sel.includes(planoRow.room.id)}
              onSelect={() => setSel((s) => (s.includes(planoRow.room.id) ? s.filter((x) => x !== planoRow.room.id) : [...s, planoRow.room.id]))}
              puedeAsignar={puedeAsignar}
              puedeTildar={puedeTildar(planoRow)}
              mucamas={mucamas}
              meId={me.id}
              onAsignar={asignarUno}
              onOpenTask={setOpenTask}
            />
          </ul>
        )}
      </Modal>
      <TaskDrawer id={openTask} onClose={() => setOpenTask(null)} />
      <ConfettiLayer />
    </div>
  );
}

type TileKind = "hecha" | "falta" | "limpiando" | "llega" | "huespedes" | "libre";
const TILE: Record<TileKind, { label: string; box: string }> = {
  hecha: { label: "Hecha", box: "bg-green-700 text-white ring-green-800" },
  falta: { label: "Falta limpiar", box: "bg-orange-50 text-orange-700 ring-orange-300" },
  limpiando: { label: "En limpieza", box: "bg-yellow-50 text-yellow-800 ring-yellow-300" },
  llega: { label: "Llega hoy", box: "bg-blue-700 text-white ring-blue-800" },
  huespedes: { label: "Con huéspedes", box: "bg-accent/10 text-fg ring-accent/40" },
  libre: { label: "Libre", box: "bg-gray-50 text-gray-700 ring-gray-200" },
};
function tileKind(r: HkRow): TileKind {
  if (r.hecha) return "hecha";
  if (r.hk?.status === "en_progreso" || r.state === "en_limpieza") return "limpiando";
  if (r.hk) return "falta";
  if (r.arriving) return "llega";
  if (r.res) return "huespedes";
  return "libre";
}

/** Plano de pisos: una fila de baldosas por piso, coloreadas por estado de limpieza. */
function FloorPlan({ rows, sel, onOpen }: { rows: HkRow[]; sel: string[]; onOpen: (id: string) => void }) {
  const { staffName } = useApp();
  const pisos = useMemo(() => Array.from(new Set(rows.map((r) => r.room.floor))).sort((a, b) => a - b), [rows]);
  return (
    <div className="space-y-4">
      <ul className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-gray-200/80 bg-panel px-4 py-3 text-[14px] text-gray-700 shadow-card" aria-label="Qué significa cada color">
        {(Object.keys(TILE) as TileKind[]).map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span className={cls("h-4 w-4 shrink-0 rounded-[5px] ring-1", TILE[k].box)} aria-hidden /> {TILE[k].label}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[12px] font-bold leading-none text-white" aria-hidden>
            A
          </span>
          Inicial de la mucama
        </li>
      </ul>
      {pisos.map((f) => (
        <section key={f} className="rounded-2xl border border-gray-200/80 bg-panel p-3.5 shadow-card sm:p-4">
          <h3 className="label-mono mb-2 flex items-center gap-2 text-[13px] font-bold text-fg">
            <span className="h-px w-6 bg-accent" aria-hidden />
            Piso {f}
            <span className="ml-auto font-normal tabular-nums text-gray-600">{rows.filter((r) => r.room.floor === f).length}</span>
          </h3>
          <ul className="no-scrollbar -mx-3.5 flex gap-2.5 overflow-x-auto px-5 pb-2 pt-2.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-1.5">
            {rows
              .filter((r) => r.room.floor === f)
              .map((r) => {
                const k = tileKind(r);
                const quien = r.hk?.assignedTo ? staffName(r.hk.assignedTo) : "";
                return (
                  <li key={r.room.id} className="shrink-0">
                    <button
                      onClick={() => onOpen(r.room.id)}
                      aria-label={`Habitación ${r.room.number}: ${TILE[k].label}${quien ? `, mucama ${quien}` : ""}`}
                      className={cls(
                        "lift relative flex min-h-[72px] w-[96px] flex-col items-center justify-center rounded-xl px-1.5 py-2 ring-1 ring-inset focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/60",
                        TILE[k].box,
                        sel.includes(r.room.id) && "!ring-[3px] !ring-accent",
                      )}
                    >
                      <span className="num text-[26px] leading-none tabular-nums">{r.room.number}</span>
                      <span className="mt-1 text-center text-[12.5px] font-medium leading-tight">{TILE[k].label}</span>
                      {quien && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-[13px] font-bold leading-none text-white ring-2 ring-panel" aria-hidden>
                          {quien.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Pulse({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: number; sub?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-200/80 bg-panel p-3.5 shadow-card">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
        <Icon size={22} aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="num text-[30px] leading-none tabular-nums text-fg">
          <CountUp value={value} />
        </div>
        <div className="label-mono mt-1.5 text-[12.5px] leading-snug text-gray-600">{label}</div>
        {sub && <div className="mt-1 line-clamp-2 text-[13px] leading-snug text-gray-600" title={sub}>{sub}</div>}
      </div>
    </div>
  );
}

function RoomCard({
  r,
  selected,
  onSelect,
  puedeAsignar,
  puedeTildar,
  mucamas,
  meId,
  onAsignar,
  onOpenTask,
}: {
  r: HkRow;
  selected: boolean;
  onSelect: () => void;
  puedeAsignar: boolean;
  puedeTildar: boolean;
  mucamas: { id: string; name: string }[];
  meId: string;
  onAsignar: (r: HkRow, tipo: HkType | "", mucama?: string) => void;
  onOpenTask: (id: string) => void;
}) {
  const { actions, staffName } = useApp();
  const tarea = r.hk?.type as HkType | undefined;
  const info = TAREAS.find((x) => x.valor === tarea);
  const d = r.sheets?.days;
  const txtSab = d === undefined ? "Sin dato" : r.tocaSabanas ? `Hay que cambiarlas (hace ${d} día${d === 1 ? "" : "s"})` : d === 0 ? "Cambiadas hoy" : `Hace ${d} día${d === 1 ? "" : "s"}`;
  const asignar = onAsignar;
  const rowGrid = "grid grid-cols-[76px_minmax(0,1fr)] items-center gap-2.5 text-[15px]";
  const rowLabel = "label-mono text-[12px] text-gray-600";

  return (
    <li
      className={cls(
        "flex flex-col overflow-hidden rounded-2xl border border-l-[6px] shadow-card transition-shadow duration-150 motion-reduce:transition-none",
        r.hecha ? "border-green-200 border-l-green-600 bg-green-50" : cls("border-gray-200/80 bg-panel", r.res ? "border-l-accent" : "border-l-gray-300"),
        selected && "ring-2 ring-accent",
      )}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
        <div className="flex items-center gap-2.5">
          {puedeAsignar && (
            <label className="-m-2 flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg p-2 transition-colors hover:bg-accent/10">
              <input type="checkbox" className="h-6 w-6 accent-accent" checked={selected} onChange={onSelect} aria-label={`Seleccionar habitación ${r.room.number}`} />
            </label>
          )}
          <span className="num text-[52px] leading-none tabular-nums text-fg">{r.room.number}</span>
        </div>
        <div className="flex min-w-0 flex-col items-end gap-1.5 pt-0.5">
          <Badge dot={false} className="max-w-full gap-1.5 bg-gray-100 text-gray-700">
            <span className={cls("h-2.5 w-2.5 shrink-0 rounded-full", ROOM_STATE_DOT[r.state])} aria-hidden />
            <span className="truncate" title={ROOM_STATE_LABEL[r.state]}>
              {ROOM_STATE_LABEL[r.state]}
            </span>
          </Badge>
          {r.arriving && (
            <Badge dot={false} className="bg-blue-700 text-white">
              <LogIn size={13} className="shrink-0" aria-hidden /> Llega hoy
            </Badge>
          )}
          <Badge className={r.res ? "bg-accent/10 text-gray-900" : "bg-gray-100 text-gray-700"}>{r.res ? "Con huéspedes" : "Libre"}</Badge>
        </div>
      </div>
      {r.res && (
        <div className="flex items-center gap-1.5 px-4 pt-2 text-[15px] text-gray-700">
          <User size={16} className="shrink-0 text-gray-500" aria-hidden />
          <span className="min-w-0 truncate" title={r.res.guestName}>
            <span className="font-medium text-fg">{r.res.guestName}</span> · se va el <span className="tabular-nums">{fmtDate(r.res.checkOut).slice(0, 5)}</span>
          </span>
        </div>
      )}

      <div className="space-y-2.5 px-4 pb-3.5 pt-3">
        <div className={rowGrid}>
          <span className={rowLabel}>Tarea</span>
          {puedeAsignar ? (
            <Select value={tarea ?? ""} onChange={(e) => asignar(r, e.target.value as HkType | "")} aria-label={`Tarea para la habitación ${r.room.number}`}>
              <option value="">Sin tarea</option>
              {TAREAS.map((x) => (
                <option key={x.valor} value={x.valor}>
                  {x.etiqueta}
                </option>
              ))}
            </Select>
          ) : (
            <span className={cls("min-w-0 leading-snug", info ? "font-semibold text-fg" : "text-gray-600")} title={info?.ayuda}>
              {info ? (
                <>
                  <TaskIcon type={info.valor} className="text-accent" /> {info.etiqueta}
                </>
              ) : (
                "Sin tarea asignada"
              )}
            </span>
          )}
        </div>
        <div className={rowGrid}>
          <span className={rowLabel}>Mucama</span>
          {puedeAsignar ? (
            <Select
              value={r.hk?.assignedTo ?? ""}
              disabled={!tarea}
              onChange={(e) => tarea && asignar(r, tarea, e.target.value || undefined)}
              aria-label={`Mucama para la habitación ${r.room.number}`}
            >
              <option value="">Sin mucama</option>
              {mucamas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          ) : (
            <span className={cls("flex min-w-0 items-center gap-2", r.hk?.assignedTo ? "font-semibold text-fg" : "text-gray-600")}>
              {r.hk?.assignedTo && <Avatar name={staffName(r.hk.assignedTo)} size={26} />}
              <span className="min-w-0 truncate">{r.hk?.assignedTo ? (r.hk.assignedTo === meId ? "Vos" : staffName(r.hk.assignedTo)) : "Sin mucama"}</span>
            </span>
          )}
        </div>
        {r.res && (
          <div className={cls(rowGrid, r.tocaSabanas && "items-start")}>
            <span className={cls(rowLabel, r.tocaSabanas && "pt-1")}>Sábanas</span>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className={cls("leading-snug", r.tocaSabanas ? "font-semibold text-amber-700" : "tabular-nums text-gray-700")}>{txtSab}</span>
              {r.tocaSabanas && (
                <Button
                  onClick={async () => {
                    await actions.markSheetsChanged(r.room.id);
                    toast(`Habitación ${r.room.number}: sábanas cambiadas ✔`);
                  }}
                >
                  Ya las cambié
                </Button>
              )}
            </div>
          </div>
        )}

        {r.otras.length > 0 && (
          <ul className="divide-y divide-gray-200/70 overflow-hidden rounded-xl border border-gray-200/80 bg-gray-50 text-[14px]">
            {r.otras.slice(0, 4).map((x) => (
              <li key={x.id}>
                <button onClick={() => onOpenTask(x.id)} className="flex min-h-[44px] w-full items-center gap-2 px-3 text-left transition-colors duration-150 hover:bg-gray-100 active:bg-gray-200 motion-reduce:transition-none">
                  <span className="min-w-0 flex-1 truncate font-medium text-gray-800">
                    <TaskIcon type={x.type} className="text-gray-500" /> {TASK_TYPE_LABEL[x.type]}
                  </span>
                  <span className="shrink-0 text-gray-600">{x.assignedTo ? (x.assignedTo === meId ? "vos" : staffName(x.assignedTo).split(" ")[0]) : "sin mucama"}</span>
                  <ChevronRight size={16} className="-mr-1 shrink-0 text-gray-400" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label
        className={cls(
          "mt-auto flex min-h-[64px] items-center gap-3 border-t py-2.5 pl-4 pr-2 transition-colors duration-200 motion-reduce:transition-none",
          r.hecha
            ? "border-green-700 bg-green-700 text-[16px] font-semibold text-white"
            : puedeTildar
              ? "border-accent/30 bg-accent/10 text-[17px] font-semibold text-gray-900 hover:bg-accent/15"
              : "border-gray-200/80 bg-gray-50 text-[15px] text-gray-600",
          puedeTildar ? "cursor-pointer" : "cursor-not-allowed",
        )}
      >
        <input
          type="checkbox"
          className={cls("h-7 w-7 shrink-0", r.hecha ? "accent-white" : "accent-green-600", !puedeTildar && "opacity-60")}
          checked={r.hecha}
          disabled={!puedeTildar}
          onChange={() => {
            if (!r.hk) return;
            if (!r.hecha) {
              vibrate(25);
              fireConfetti("¡Muy bien, una menos!");
            }
            actions.setTaskStatus(r.hk, r.hecha ? "pendiente" : "completada");
          }}
        />
        <span className="min-w-0 flex-1 py-1 leading-snug">
          {r.hecha
            ? `Lista${r.hk?.completedBy ? " por " + (r.hk.completedBy === meId ? "vos" : staffName(r.hk.completedBy)) : ""}`
            : puedeTildar
              ? "Marcar como lista"
              : tarea
                ? r.hk?.assignedTo
                  ? `Le toca a ${staffName(r.hk.assignedTo)}`
                  : "Todavía no tiene mucama"
                : "Todavía no tiene tarea"}
        </span>
        {r.hk && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onOpenTask(r.hk!.id);
            }}
            className={cls(
              "inline-flex min-h-[44px] shrink-0 items-center gap-0.5 whitespace-nowrap rounded-lg pl-2.5 pr-1.5 text-[15px] font-medium transition-colors",
              r.hecha ? "text-white hover:bg-white/15" : "text-accent hover:bg-accent/10",
            )}
          >
            ver pasos
            <ChevronRight size={16} aria-hidden />
          </button>
        )}
      </label>
    </li>
  );
}
