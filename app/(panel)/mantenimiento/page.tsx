"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Inbox, Plus, Zap } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { NewTaskModal, TaskCard, TaskDrawer } from "@/components/tasks";
import { Badge, Button, Card, Input, PageHeader, Select, Stat, Table, Tabs, toast } from "@/components/ui";
import { addDays, fmtDateTime, today } from "@/lib/dates";
import {
  cls,
  currentReservation,
  PRIORITY_ORDER,
  ROLE_LABEL,
  roomState,
  ROOM_STATE_CLASS,
  ROOM_STATE_DOT,
  ROOM_STATE_LABEL,
  TASK_TYPE_LABEL,
  visualStatus,
  VISUAL_LABEL,
} from "@/lib/logic";
import type { RoomState, Task, TaskStatus, TaskType } from "@/lib/types";

export default function Page() {
  return (
    <Suspense>
      <Mantenimiento />
    </Suspense>
  );
}

function Mantenimiento() {
  const { data, idx, me, actions, staffName, can } = useApp();
  const params = useSearchParams();
  const [tab, setTab] = useState<"tablero" | "habitaciones" | "personal" | "reglas">("tablero");
  const [room, setRoom] = useState(params.get("hab") ?? "");
  const [assignee, setAssignee] = useState(params.get("mias") ? me?.id ?? "" : "");
  const [type, setType] = useState<TaskType | "">("");
  const [q, setQ] = useState("");
  const [range, setRange] = useState<"hoy" | "semana" | "todas">("todas");
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [newTask, setNewTask] = useState(false);
  const t = today();

  useEffect(() => {
    setRoom(params.get("hab") ?? "");
    if (params.get("mias")) setAssignee(me?.id ?? "");
  }, [params, me?.id]);

  const roomNum = (id: string) => data.rooms.find((r) => r.id === id)?.number ?? "";

  const filtered = useMemo(
    () =>
      data.tasks
        .filter((x) => !room || x.roomId === room)
        .filter((x) => !assignee || (assignee === "none" ? !x.assignedTo : x.assignedTo === assignee || x.completedBy === assignee))
        .filter((x) => !type || x.type === type)
        .filter((x) => !q || x.title.toLowerCase().includes(q.toLowerCase()) || roomNum(x.roomId).includes(q))
        .filter((x) => range === "todas" || (range === "hoy" ? x.dueDate <= t : x.dueDate <= addDays(t, 7))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.tasks, room, assignee, type, q, range, t],
  );

  const columns: { status: TaskStatus; title: string; tone: string }[] = [
    { status: "pendiente", title: "Por hacer", tone: "bg-gray-400" },
    { status: "en_progreso", title: "Empezadas", tone: "bg-blue-500" },
    { status: "completada", title: "Terminadas (última semana)", tone: "bg-green-500" },
  ];

  const sortTasks = (a: Task, b: Task) =>
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.dueDate.localeCompare(b.dueDate) || roomNum(a.roomId).localeCompare(roomNum(b.roomId), undefined, { numeric: true });

  const open = data.tasks.filter((x) => x.status !== "completada");
  const roomsDirty = data.rooms.filter((r) => ["sucia", "en_limpieza"].includes((idx.roomStates.get(r.id) ?? "lista"))).length;

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Limpieza y arreglos"
        subtitle="Las tareas se crean solas según las reservas: cuando un huésped está por irse, se va o llega."
        actions={
          <>
            {can("automatizaciones") && (
              <Button
                onClick={async () => {
                  const n = await actions.runAutomations(can("editar_reservas"));
                  toast(n ? `Listo: se hicieron ${n} cambios automáticos ✔` : "No hay nada pendiente por hacer");
                }}
              >
                <Zap size={16} /> Crear las tareas pendientes ahora
              </Button>
            )}
            {can("gestionar_tareas") ? (
              <Button variant="primary" onClick={() => setNewTask(true)}>
                <Plus size={16} /> Nueva tarea
              </Button>
            ) : (
              <Link href="/mi-jornada">
                <Button variant="primary">Ir a Mi trabajo de hoy</Button>
              </Link>
            )}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Tareas por terminar" value={open.length} tone="gray" />
        <Stat label="Empezadas" value={open.filter((x) => x.status === "en_progreso").length} tone="blue" />
        <Stat label="Urgentes o importantes" value={open.filter((x) => x.priority === "urgente" || x.priority === "alta").length} tone="red" />
        <Stat label="Habitaciones por limpiar" value={roomsDirty} tone="orange" />
        <Stat label="Terminadas hoy" value={data.tasks.filter((x) => x.completedAt?.slice(0, 10) === t).length} tone="green" />
      </div>

      <div className="-mx-4 mb-4 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
        <div className="w-max">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "tablero", label: "Tareas" },
            { value: "habitaciones", label: "Habitaciones" },
            { value: "personal", label: "Quién hizo qué" },
            ...(can("automatizaciones") ? [{ value: "reglas" as const, label: "Tareas automáticas" }] : []),
          ]}
        />
        </div>
      </div>

      {tab === "tablero" && (
        <>
          <div className="mb-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <Input placeholder="Buscar tarea o habitación" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-[240px]" />
            <Select value={room} onChange={(e) => setRoom(e.target.value)} className="w-full sm:w-[210px]">
              <option value="">Todas las habitaciones</option>
              {data.rooms
                .slice()
                .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    Habitación {r.number}
                  </option>
                ))}
            </Select>
            <Select value={type} onChange={(e) => setType(e.target.value as TaskType | "")} className="w-full sm:w-[180px]">
              <option value="">Todos los tipos</option>
              {(Object.keys(TASK_TYPE_LABEL) as TaskType[]).map((k) => (
                <option key={k} value={k}>
                  {TASK_TYPE_LABEL[k]}
                </option>
              ))}
            </Select>
            <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-full sm:w-[190px]">
              <option value="">Todas las personas</option>
              <option value="none">Sin responsable</option>
              {data.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id === me?.id ? `${s.name} (yo)` : s.name}
                </option>
              ))}
            </Select>
            <Select value={range} onChange={(e) => setRange(e.target.value as typeof range)} className="w-full sm:w-[200px]">
              <option value="todas">Cualquier fecha</option>
              <option value="hoy">Para hoy o atrasadas</option>
              <option value="semana">Próximos 7 días</option>
            </Select>
            {(room || assignee || type || q) && (
              <Button variant="ghost" onClick={() => { setRoom(""); setAssignee(""); setType(""); setQ(""); }}>
                Quitar filtros
              </Button>
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {columns.map((col) => {
              const items = filtered
                .filter((x) => x.status === col.status)
                .filter((x) => col.status !== "completada" || (x.completedAt ?? "") >= addDays(t, -7))
                .sort(col.status === "completada" ? (a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "") : sortTasks);
              return (
                <div key={col.status} className="flex flex-col rounded-2xl border border-gray-200/80 bg-gray-100/70 p-3">
                  <div className="mb-3 flex items-center gap-2 px-1">
                    <span className={cls("h-3 w-3 shrink-0 rounded-full", col.tone)} />
                    <h3 className="text-[16px] font-semibold text-gray-900">{col.title}</h3>
                    <span className="ml-auto min-w-[30px] rounded-full bg-white px-2.5 py-0.5 text-center text-[14px] font-semibold tabular-nums text-gray-700">{items.length}</span>
                  </div>
                  <div className="flex min-h-[120px] flex-col gap-2.5 lg:max-h-[calc(100vh-330px)] lg:overflow-y-auto lg:pr-1">
                    {items.map((task) => (
                      <TaskCard key={task.id} task={task} onOpen={() => setOpenTask(task.id)} />
                    ))}
                    {items.length === 0 && (
                      <div className="flex flex-col items-center gap-1.5 py-8 text-center">
                        <Inbox size={28} className="text-gray-500" aria-hidden />
                        <p className="text-[15px] text-gray-600">No hay tareas</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "habitaciones" && <RoomsBoard onFilter={(id) => { setRoom(id); setTab("tablero"); }} />}

      {tab === "personal" && <StaffPerformance />}

      {tab === "reglas" && <Rules />}

      <TaskDrawer id={openTask} onClose={() => setOpenTask(null)} />
      <NewTaskModal open={newTask} onClose={() => setNewTask(false)} roomId={room || undefined} />
    </div>
  );

  function RoomsBoard({ onFilter }: { onFilter: (id: string) => void }) {
    const floors = Array.from(new Set(data.rooms.map((r) => r.floor))).sort();
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-[15px] shadow-card">
          {(Object.keys(ROOM_STATE_LABEL) as RoomState[]).map((s) => (
            <span key={s} className="flex items-center gap-2">
              <span className={cls("h-3 w-3 rounded-full", ROOM_STATE_DOT[s])} /> {ROOM_STATE_LABEL[s]}
            </span>
          ))}
        </div>
        {floors.map((f) => (
          <div key={f}>
            <h3 className="mb-2.5 text-[17px] font-semibold text-gray-900">Piso {f}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
              {data.rooms
                .filter((r) => r.floor === f)
                .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
                .map((r) => {
                  const st = idx.roomStates.get(r.id) ?? "lista";
                  const res = currentReservation(r.id, data.reservations, t);
                  const ot = data.tasks.filter((x) => x.roomId === r.id && x.status !== "completada");
                  return (
                    <button
                      key={r.id}
                      onClick={() => onFilter(r.id)}
                      className={cls("min-h-[104px] rounded-xl p-3 text-left ring-1 transition duration-150 hover:-translate-y-0.5 hover:shadow-pop motion-reduce:transform-none motion-reduce:transition-none", ROOM_STATE_CLASS[st])}
                    >
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="text-[22px] font-bold leading-none">{r.number}</span>
                        <span className="truncate text-[14px] opacity-90">{r.type}</span>
                      </div>
                      <div className="mt-1.5 text-[15px] font-semibold leading-tight">{ROOM_STATE_LABEL[st]}</div>
                      <div className="mt-0.5 truncate text-[14px] opacity-90">{res ? `${res.guestName} · ${VISUAL_LABEL[visualStatus(res, t)]}` : "Sin huésped"}</div>
                      {ot.length > 0 && (
                        <div className="mt-1 text-[14px] font-semibold">
                          {ot.length} {ot.length > 1 ? "tareas por hacer" : "tarea por hacer"}
                        </div>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function StaffPerformance() {
    const since = addDays(t, -30);
    const rows = data.staff
      .filter((s) => s.role !== "admin" || data.tasks.some((x) => x.completedBy === s.id))
      .map((s) => {
        const done = data.tasks.filter((x) => x.completedBy === s.id && (x.completedAt ?? "") >= since);
        const durations = done
          .filter((x) => x.startedAt && x.completedAt)
          .map((x) => (new Date(x.completedAt!).getTime() - new Date(x.startedAt!).getTime()) / 60000);
        return {
          s,
          done: done.length,
          today: done.filter((x) => x.completedAt!.slice(0, 10) === t).length,
          open: data.tasks.filter((x) => x.assignedTo === s.id && x.status !== "completada").length,
          avg: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
        };
      })
      .sort((a, b) => b.done - a.done);
    const recent = data.tasks
      .filter((x) => x.status === "completada")
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
      .slice(0, 40);
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Cómo viene trabajando cada persona (últimos 30 días)">
          <Table head={["Persona", "Cargo", "Hoy", "En 30 días", "Le quedan", "Tiempo promedio"]}>
            {rows.map(({ s, done, today: td, open, avg }) => (
              <tr key={s.id} className="cursor-pointer hover:bg-gray-50" onClick={() => { setAssignee(s.id); setTab("tablero"); }}>
                <td className="px-4 py-2.5 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-gray-600">{ROLE_LABEL[s.role]}</td>
                <td className="px-4 py-2.5 tabular-nums">{td}</td>
                <td className="px-4 py-2.5 tabular-nums font-semibold">{done}</td>
                <td className="px-4 py-2.5 tabular-nums">{open}</td>
                <td className="px-4 py-2.5 tabular-nums">{avg != null ? `${avg} min` : "—"}</td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Últimas tareas terminadas">
          <Table head={["Cuándo", "Habitación", "Tarea", "La hizo"]}>
            {recent.map((x) => (
              <tr key={x.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setOpenTask(x.id)}>
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{fmtDateTime(x.completedAt)}</td>
                <td className="px-4 py-2 font-medium">{roomNum(x.roomId)}</td>
                <td className="px-4 py-2">{x.title}</td>
                <td className="px-4 py-2">{staffName(x.completedBy)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    );
  }

  function Rules() {
    return (
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="text-[15px] text-gray-700">
            Las tareas que se crean solas (cuando un huésped se va o llega, el repaso del día, a quién se le asigna, qué hacer con las atrasadas) se
            ajustan en la pantalla de Automatizaciones.
          </div>
          <Link href="/automatizaciones">
            <Button variant="primary">
              <Zap size={16} /> Ver y cambiar las tareas automáticas
            </Button>
          </Link>
        </div>
      </Card>
    );
  }
}
