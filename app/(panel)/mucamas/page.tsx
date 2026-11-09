"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BedDouble, BellRing, CheckCircle2, DoorOpen, ListChecks, Sparkles, Wand2 } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { TaskDrawer } from "@/components/tasks";
import { Avatar, Badge, Button, Card, PageHeader, Progress, Select, Stat, toast } from "@/components/ui";
import { sheetsInfo } from "@/lib/automation";
import { fmtDate, today } from "@/lib/dates";
import { automationOf, cls, ROOM_STATE_DOT, ROOM_STATE_LABEL, TASK_TYPE_ICON, TASK_TYPE_LABEL } from "@/lib/logic";
import type { Reservation, Room, Task } from "@/lib/types";

type HkType = "servicio" | "fondo" | "repaso";
const TAREAS: { valor: HkType; etiqueta: string; ayuda: string }[] = [
  { valor: "servicio", etiqueta: "Servicio", ayuda: "Limpieza diaria de habitación ocupada" },
  { valor: "fondo", etiqueta: "Fondo", ayuda: "Limpieza profunda" },
  { valor: "repaso", etiqueta: "Repaso", ayuda: "Repaso rápido" },
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
    toast(`${sel.length} habitación(es) asignadas a ${staffName(bulkMucama)}`);
    setSel([]);
  }
  async function quitarLote() {
    if (!sel.length) return;
    await actions.clearHousekeeping(sel);
    toast("Tareas quitadas");
    setSel([]);
  }
  /** Plan automático: ocupadas → Servicio, libres listas → Repaso; reparte equitativamente entre las mucamas activas. */
  async function planAutomatico() {
    if (!mucamas.length) return toast("No hay mucamas activas para asignar", "error");
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
    if (!items.length) return toast("Todas las habitaciones ya tienen tarea para hoy");
    if (!confirm(`Se asignarán ${items.length} habitaciones (${items.filter((i) => i.type === "servicio").length} servicios y ${items.filter((i) => i.type === "repaso").length} repasos) entre ${mucamas.length} mucamas. ¿Continuar?`)) return;
    await actions.planHousekeeping(items);
    toast(`Plan del día armado: ${items.length} habitaciones`);
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
    { valor: "ocupadas", etiqueta: "Ocupadas" },
    { valor: "desocupadas", etiqueta: "Desocupadas" },
    { valor: "pendientes", etiqueta: "Pendientes" },
    { valor: "sabanas", etiqueta: `Sábanas (${resumen.sabanas.length})` },
    { valor: "llegan", etiqueta: `Llegan hoy (${resumen.llegan})` },
    ...(puedeAsignar ? [{ valor: "sinasignar" as const, etiqueta: "Sin asignar" }] : []),
  ];

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <PageHeader
        title="Mucamas"
        subtitle={`${new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })} · plan de limpieza por habitación`}
        actions={
          <>
            {permiso === "default" && (
              <Button onClick={activarAvisos}>
                <BellRing size={15} /> Activar avisos en este dispositivo
              </Button>
            )}
            {permiso === "denied" && <span className="text-xs text-gray-500">Los avisos están bloqueados en el navegador.</span>}
            {puedeAsignar && (
              <Button variant="primary" onClick={planAutomatico}>
                <Wand2 size={15} /> Armar plan automático
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat icon={BedDouble} tone="blue" label="Ocupadas" value={resumen.ocupadas} />
        <Stat icon={DoorOpen} tone="gray" label="Desocupadas" value={resumen.desocupadas} />
        <Stat icon={ListChecks} tone="green" label="Hechas hoy" value={`${resumen.hechas}/${resumen.conTarea}`} />
        <Stat icon={Sparkles} tone="orange" label="Sábanas por cambiar" value={resumen.sabanas.length} sub={`cada ${cfg.sabanasCadaDias} días en ocupadas`} />
        <Stat icon={CheckCircle2} tone="indigo" label="Llegan hoy" value={resumen.llegan} />
      </div>

      {resumen.sabanas.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <b>Cambio de sábanas hoy:</b> {resumen.sabanas.map((r) => r.room.number).join(", ")}{" "}
          <span className="opacity-80">
            (cada {cfg.sabanasCadaDias} días en habitaciones ocupadas
            {can("automatizaciones") && (
              <>
                {" · "}
                <Link href="/automatizaciones" className="underline">
                  cambiar
                </Link>
              </>
            )}
            )
          </span>
        </div>
      )}

      {puedeAsignar && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {resumen.equipo.map((m) => (
              <div key={m.id} className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                <Avatar name={m.name} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{m.name}</div>
                  <div className="text-xs text-gray-500">
                    {m.hechas}/{m.total} hechas{m.otras ? ` · +${m.otras} tareas más` : ""}
                  </div>
                  <Progress value={m.total ? (m.hechas / m.total) * 100 : 0} tone={m.total && m.hechas === m.total ? "bg-green-500" : "bg-teal-600"} />
                </div>
              </div>
            ))}
            {!mucamas.length && <p className="text-sm text-gray-500">No hay mucamas activas. Dalas de alta en Administradores.</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5">
            <span className="mr-1 text-sm font-semibold">{sel.length === 1 ? "1 habitación seleccionada" : `${sel.length} habitaciones seleccionadas`}</span>
            <Select value={bulkTarea} onChange={(e) => setBulkTarea(e.target.value as HkType)} className="h-8 w-[130px]" aria-label="Tarea a asignar">
              {TAREAS.map((x) => (
                <option key={x.valor} value={x.valor}>
                  {x.etiqueta}
                </option>
              ))}
            </Select>
            <Select value={bulkMucama} onChange={(e) => setBulkMucama(e.target.value)} className="h-8 w-[170px]" aria-label="Mucama">
              {mucamas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
            <Button size="sm" variant="primary" disabled={!sel.length} onClick={asignarLote}>
              Asignar
            </Button>
            <Button size="sm" disabled={!sel.length} onClick={quitarLote}>
              Quitar tarea
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSel(sel.length ? [] : visibles.map((r) => r.room.id))}>
              {sel.length ? "Limpiar selección" : "Seleccionar las visibles"}
            </Button>
          </div>
        </>
      )}

      <nav className="flex flex-wrap gap-1.5" aria-label="Filtrar habitaciones">
        {filtros.map((f) => (
          <button
            key={f.valor}
            aria-pressed={filtro === f.valor}
            onClick={() => setFiltro(f.valor)}
            className={cls("rounded-full px-3 py-1.5 text-sm font-medium", filtro === f.valor ? "bg-gray-900 text-white" : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50")}
          >
            {f.etiqueta}
          </button>
        ))}
      </nav>

      {visibles.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-500">No hay habitaciones para este filtro.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
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
  const txtSab = d === undefined ? "Sin dato" : r.tocaSabanas ? `Cambiar (hace ${d} día${d === 1 ? "" : "s"})` : d === 0 ? "Cambiadas hoy" : `Hace ${d} día${d === 1 ? "" : "s"}`;
  const asignar = onAsignar;

  return (
    <li
      className={cls(
        "flex flex-col gap-2.5 rounded-xl border border-l-[5px] bg-white p-3.5 transition",
        r.hecha ? "border-green-200 border-l-green-600 bg-green-50" : r.res ? "border-gray-200 border-l-teal-600" : "border-gray-200 border-l-gray-400",
        selected && "ring-2 ring-teal-500",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2.5 text-xl font-bold">
          {puedeAsignar && <input type="checkbox" className="h-5 w-5 accent-teal-600" checked={selected} onChange={onSelect} aria-label={`Seleccionar habitación ${r.room.number}`} />}
          {r.room.number}
          <span className={cls("h-2.5 w-2.5 rounded-full", ROOM_STATE_DOT[r.state])} title={ROOM_STATE_LABEL[r.state]} />
        </span>
        <div className="flex flex-wrap justify-end gap-1">
          {r.arriving && <Badge className="bg-blue-600 text-white">Llega hoy</Badge>}
          <Badge className={r.res ? "bg-teal-50 text-teal-800" : "bg-gray-100 text-gray-600"}>{r.res ? "Ocupada" : "Desocupada"}</Badge>
        </div>
      </div>
      {r.res && (
        <div className="-mt-1 text-xs text-gray-500">
          {r.res.guestName} · sale {fmtDate(r.res.checkOut).slice(0, 5)}
        </div>
      )}

      <div className="flex items-center gap-2 text-sm">
        <span className="w-[60px] shrink-0 text-xs text-gray-500">Tarea</span>
        {puedeAsignar ? (
          <Select value={tarea ?? ""} onChange={(e) => asignar(r, e.target.value as HkType | "")} className="h-8" aria-label={`Tarea para la habitación ${r.room.number}`}>
            <option value="">Sin tarea</option>
            {TAREAS.map((x) => (
              <option key={x.valor} value={x.valor}>
                {x.etiqueta}
              </option>
            ))}
          </Select>
        ) : (
          <span className={cls(info ? "font-semibold" : "text-gray-400")} title={info?.ayuda}>
            {info ? `${TASK_TYPE_ICON[info.valor]} ${info.etiqueta}` : "Sin tarea asignada"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="w-[60px] shrink-0 text-xs text-gray-500">Mucama</span>
        {puedeAsignar ? (
          <Select
            value={r.hk?.assignedTo ?? ""}
            disabled={!tarea}
            onChange={(e) => tarea && asignar(r, tarea, e.target.value || undefined)}
            className="h-8"
            aria-label={`Mucama para la habitación ${r.room.number}`}
          >
            <option value="">Sin asignar</option>
            {mucamas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        ) : (
          <span className={cls(r.hk?.assignedTo ? "font-semibold" : "text-gray-400")}>
            {r.hk?.assignedTo ? (r.hk.assignedTo === meId ? "Vos" : staffName(r.hk.assignedTo)) : "Sin asignar"}
          </span>
        )}
      </div>
      {r.res && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-[60px] shrink-0 text-xs text-gray-500">Sábanas</span>
          <span className={cls(r.tocaSabanas && "font-semibold text-amber-700")}>{txtSab}</span>
          {r.tocaSabanas && (
            <Button
              size="sm"
              onClick={async () => {
                await actions.markSheetsChanged(r.room.id);
                toast(`Hab. ${r.room.number}: sábanas cambiadas ✔`);
              }}
            >
              Ya las cambié
            </Button>
          )}
        </div>
      )}

      {r.otras.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-gray-50 px-2.5 py-2 text-xs">
          {r.otras.slice(0, 4).map((x) => (
            <li key={x.id}>
              <button onClick={() => onOpenTask(x.id)} className="flex w-full justify-between gap-2 text-left hover:underline">
                <span className="truncate">
                  {TASK_TYPE_ICON[x.type]} {TASK_TYPE_LABEL[x.type]}
                </span>
                <span className="shrink-0 text-gray-500">{x.assignedTo ? (x.assignedTo === meId ? "vos" : staffName(x.assignedTo).split(" ")[0]) : "libre"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className={cls("mt-auto flex items-center gap-2.5 border-t border-dashed border-gray-200 pt-2.5 text-sm", puedeTildar ? "cursor-pointer" : "cursor-not-allowed text-gray-400")}>
        <input
          type="checkbox"
          className="h-[22px] w-[22px] accent-green-600"
          checked={r.hecha}
          disabled={!puedeTildar}
          onChange={() => r.hk && actions.setTaskStatus(r.hk, r.hecha ? "pendiente" : "completada")}
        />
        <span>
          {r.hecha
            ? `Hecha${r.hk?.completedBy ? " por " + (r.hk.completedBy === meId ? "vos" : staffName(r.hk.completedBy)) : ""}`
            : puedeTildar
              ? "Marcar como hecha"
              : tarea
                ? r.hk?.assignedTo
                  ? `Le toca a ${staffName(r.hk.assignedTo)}`
                  : "Esperando asignación"
                : "Esperando tarea del encargado"}
        </span>
        {r.hk && (
          <button type="button" onClick={(e) => { e.preventDefault(); onOpenTask(r.hk!.id); }} className="ml-auto text-xs text-blue-600 hover:underline">
            checklist
          </button>
        )}
      </label>
    </li>
  );
}
