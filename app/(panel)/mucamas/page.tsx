"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BedDouble, BellRing, CheckCircle2, DoorOpen, ListChecks, Sparkles, User, Wand2 } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { TaskDrawer } from "@/components/tasks";
import { Avatar, Badge, Button, Card, PageHeader, Progress, Select, Stat, toast } from "@/components/ui";
import { sheetsInfo } from "@/lib/automation";
import { fmtDate, today } from "@/lib/dates";
import { automationOf, cls, ROOM_STATE_DOT, ROOM_STATE_LABEL, TASK_TYPE_LABEL } from "@/lib/logic";
import type { Reservation, Room, Task } from "@/lib/types";
import { TaskIcon } from "@/components/TaskIcon";

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
  useEffect(() => setPermiso(permisoInicial()), []);

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
      <PageHeader
        title="Mucamas"
        subtitle={`${new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })} · quién limpia cada habitación hoy`}
        actions={
          <>
            {permiso === "default" && (
              <Button onClick={activarAvisos}>
                <BellRing size={16} /> Activar avisos en este aparato
              </Button>
            )}
            {permiso === "denied" && <span className="text-[14px] text-gray-600">Los avisos están bloqueados. Se activan desde la configuración del navegador.</span>}
            {puedeAsignar && (
              <Button variant="primary" onClick={planAutomatico}>
                <Wand2 size={16} /> Repartir el día automáticamente
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat icon={BedDouble} tone="blue" label="Con huéspedes" value={resumen.ocupadas} />
        <Stat icon={DoorOpen} tone="gray" label="Libres" value={resumen.desocupadas} />
        <Stat icon={ListChecks} tone="green" label="Limpiezas hechas hoy" value={`${resumen.hechas} de ${resumen.conTarea}`} />
        <Stat icon={Sparkles} tone="orange" label="Sábanas por cambiar" value={resumen.sabanas.length} sub={`cada ${cfg.sabanasCadaDias} días en habitaciones con gente`} />
        <Stat icon={CheckCircle2} tone="indigo" label="Llegan hoy" value={resumen.llegan} />
      </div>

      {resumen.sabanas.length > 0 && (
        <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-[15px] text-amber-900" role="status">
          <Sparkles size={20} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <b>Cambio de sábanas hoy:</b> {resumen.sabanas.map((r) => r.room.number).join(", ")}{" "}
            <span className="opacity-90">
              (se cambian cada {cfg.sabanasCadaDias} días en habitaciones con gente
              {can("automatizaciones") && (
                <>
                  {" · "}
                  <Link href="/automatizaciones" className="font-medium underline">
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {resumen.equipo.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 shadow-card">
                <Avatar name={m.name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold">{m.name}</div>
                  <div className="mb-1.5 text-[14px] text-gray-600">
                    {m.hechas} de {m.total} hechas{m.otras ? ` · y ${m.otras} tareas más` : ""}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={cls("h-full rounded-full transition-all duration-200 motion-reduce:transition-none", m.total && m.hechas === m.total ? "bg-green-500" : "bg-teal-600")}
                      style={{ width: `${m.total ? (m.hechas / m.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {!mucamas.length && <p className="text-[15px] text-gray-600">No hay mucamas cargadas. Agregalas en Administradores.</p>}
          </div>
          <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
            <div className="mb-3 flex items-start gap-2 text-[15px] font-semibold">
              <ListChecks size={20} className="mt-0.5 shrink-0 text-teal-800" aria-hidden />
              <span>{sel.length === 0 ? "Tildá las habitaciones de abajo, elegí la tarea y la mucama, y tocá Asignar." : sel.length === 1 ? "Elegiste 1 habitación" : `Elegiste ${sel.length} habitaciones`}</span>
            </div>
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

      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" aria-label="Filtrar habitaciones">
        {filtros.map((f) => (
          <button
            key={f.valor}
            aria-pressed={filtro === f.valor}
            onClick={() => setFiltro(f.valor)}
            className={cls(
              "min-h-[44px] shrink-0 whitespace-nowrap rounded-full px-4 text-[15px] font-medium transition-colors duration-150 motion-reduce:transition-none",
              filtro === f.valor ? "bg-gray-900 text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
            )}
          >
            {f.etiqueta}
          </button>
        ))}
      </nav>

      {visibles.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-500">
            <BedDouble size={26} aria-hidden />
          </span>
          <p className="text-[15px] text-gray-600">No hay habitaciones en este grupo.</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
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
      <TaskDrawer id={openTask} onClose={() => setOpenTask(null)} />
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

  return (
    <li
      className={cls(
        "flex flex-col overflow-hidden rounded-2xl border border-l-[6px] bg-white shadow-card transition-shadow duration-150 motion-reduce:transition-none",
        r.hecha ? "border-green-200 border-l-green-600 bg-green-50" : r.res ? "border-gray-200 border-l-teal-600" : "border-gray-200 border-l-gray-300",
        selected && "ring-2 ring-teal-500",
      )}
    >
      <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
        <div className="flex items-center gap-3">
          {puedeAsignar && (
            <label className="-m-2 flex cursor-pointer p-2">
              <input type="checkbox" className="h-6 w-6 accent-teal-600" checked={selected} onChange={onSelect} aria-label={`Seleccionar habitación ${r.room.number}`} />
            </label>
          )}
          <span className="text-[34px] font-bold leading-none tracking-tight tabular-nums">{r.room.number}</span>
          <span className={cls("h-3 w-3 rounded-full", ROOM_STATE_DOT[r.state])} title={ROOM_STATE_LABEL[r.state]} />
        </div>
        <div className="flex flex-col items-end gap-1">
          {r.arriving && <Badge className="bg-blue-700 text-white">Llega hoy</Badge>}
          <Badge className={r.res ? "bg-teal-50 text-teal-800" : "bg-gray-100 text-gray-700"}>{r.res ? "Con huéspedes" : "Libre"}</Badge>
        </div>
      </div>
      {r.res && (
        <div className="flex items-center gap-1.5 px-4 pb-1 text-[15px] text-gray-700">
          <User size={16} className="shrink-0 text-gray-500" aria-hidden />
          <span className="min-w-0 truncate">
            {r.res.guestName} · se va el {fmtDate(r.res.checkOut).slice(0, 5)}
          </span>
        </div>
      )}

      <div className="space-y-2.5 px-4 py-3">
        <div className="grid grid-cols-[72px_1fr] items-center gap-2 text-[15px]">
          <span className="text-[14px] text-gray-600">Tarea</span>
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
            <span className={cls(info ? "font-semibold" : "text-gray-600")} title={info?.ayuda}>
              {info ? (
                <>
                  <TaskIcon type={info.valor} /> {info.etiqueta}
                </>
              ) : (
                "Sin tarea asignada"
              )}
            </span>
          )}
        </div>
        <div className="grid grid-cols-[72px_1fr] items-center gap-2 text-[15px]">
          <span className="text-[14px] text-gray-600">Mucama</span>
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
            <span className={cls(r.hk?.assignedTo ? "font-semibold" : "text-gray-600")}>
              {r.hk?.assignedTo ? (r.hk.assignedTo === meId ? "Vos" : staffName(r.hk.assignedTo)) : "Sin mucama"}
            </span>
          )}
        </div>
        {r.res && (
          <div className="grid grid-cols-[72px_1fr] items-center gap-2 text-[15px]">
            <span className="text-[14px] text-gray-600">Sábanas</span>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cls(r.tocaSabanas && "font-semibold text-amber-700")}>{txtSab}</span>
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
          <ul className="space-y-0.5 rounded-xl bg-gray-50 px-2 py-1.5 text-[14px]">
            {r.otras.slice(0, 4).map((x) => (
              <li key={x.id}>
                <button onClick={() => onOpenTask(x.id)} className="flex min-h-[40px] w-full items-center justify-between gap-2 rounded-lg px-1 text-left transition-colors duration-150 hover:underline motion-reduce:transition-none">
                  <span className="truncate">
                    <TaskIcon type={x.type} /> {TASK_TYPE_LABEL[x.type]}
                  </span>
                  <span className="shrink-0 text-gray-600">{x.assignedTo ? (x.assignedTo === meId ? "vos" : staffName(x.assignedTo).split(" ")[0]) : "sin mucama"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label
        className={cls(
          "mt-auto flex min-h-[64px] items-center gap-3 border-t px-4 py-3 text-[16px] transition-colors duration-150 motion-reduce:transition-none",
          r.hecha ? "border-green-200 bg-green-100 font-semibold text-green-700" : "border-gray-200 bg-gray-50",
          puedeTildar ? "cursor-pointer" : "cursor-not-allowed text-gray-600",
          puedeTildar && !r.hecha && "hover:bg-gray-100",
        )}
      >
        <input
          type="checkbox"
          className="h-7 w-7 shrink-0 accent-green-600"
          checked={r.hecha}
          disabled={!puedeTildar}
          onChange={() => r.hk && actions.setTaskStatus(r.hk, r.hecha ? "pendiente" : "completada")}
        />
        <span className="min-w-0 flex-1 leading-snug">
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
            className="min-h-[44px] shrink-0 px-2 text-[15px] font-medium text-blue-700 hover:underline"
          >
            ver pasos
          </button>
        )}
      </label>
    </li>
  );
}
