"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, BedDouble, CheckCircle2, ClipboardList, Medal, Play, Plus, Zap } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { NewTaskModal, TaskCard, TaskDrawer } from "@/components/tasks";
import { Avatar, Button, Card, Input, Select, Table, Tabs, toast } from "@/components/ui";
import { CountUp, Ring } from "@/components/viz";
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
import { ConfettiLayer, EmptyArt } from "@/components/TaskIcon";

/** Cuántas tareas empezadas a la vez se consideran razonables. */
const WIP_LIMIT = 6;

const PODIUM = [
  { medal: "bg-gradient-to-t from-amber-700 to-amber-500", h: 150, label: "Primer puesto" },
  { medal: "bg-gradient-to-t from-slate-600 to-slate-500", h: 112, label: "Segundo puesto" },
  { medal: "bg-gradient-to-t from-orange-800 to-orange-600", h: 84, label: "Tercer puesto" },
];

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

  const doneToday = data.tasks.filter((x) => x.completedAt?.slice(0, 10) === t).length;
  const dayPct = doneToday + open.length ? Math.round((doneToday / (doneToday + open.length)) * 100) : 100;
  const pulses = [
    { icon: ClipboardList, label: "Tareas por terminar", value: open.length, box: "bg-gray-900/10 text-gray-700" },
    { icon: Play, label: "Empezadas", value: open.filter((x) => x.status === "en_progreso").length, box: "bg-blue-500/15 text-blue-700" },
    { icon: AlertTriangle, label: "Urgentes o importantes", value: open.filter((x) => x.priority === "urgente" || x.priority === "alta").length, box: "bg-red-500/15 text-red-700" },
    { icon: BedDouble, label: "Habitaciones por limpiar", value: roomsDirty, box: "bg-amber-500/15 text-amber-700" },
  ];

  return (
    <div className="p-4 lg:p-6">
      <header className="aurora mb-5 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="display text-balance text-[28px] text-fg md:text-[36px]">
              Limpieza y <span className="serif-accent">arreglos</span>
            </h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-gray-600">Las tareas se crean solas según las reservas: cuando un huésped está por irse, se va o llega.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
          </div>
        </div>

        <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {pulses.map((x) => (
            <div key={x.label} className="flex items-center gap-3 rounded-2xl border border-gray-200/80 bg-panel p-3.5 shadow-card">
              <span className={cls("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", x.box)}>
                <x.icon size={22} aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="num text-[30px] leading-none">
                  <CountUp value={x.value} />
                </div>
                <div className="label-mono mt-1.5 text-[12.5px] leading-snug text-gray-600">{x.label}</div>
              </div>
            </div>
          ))}
          <div className="col-span-2 flex items-center gap-3 rounded-2xl border border-green-300/70 bg-panel p-3.5 shadow-card sm:col-span-1">
            <Ring value={dayPct} size={72} stroke={8} tone="green" label={`${doneToday} tareas terminadas hoy`}>
              <CheckCircle2 size={22} className="text-green-700" aria-hidden />
            </Ring>
            <div className="min-w-0">
              <div className="num text-[30px] leading-none">
                <CountUp value={doneToday} />
              </div>
              <div className="label-mono mt-1.5 text-[12.5px] text-gray-600">Terminadas hoy</div>
            </div>
          </div>
        </div>
      </header>

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
          <div className="stagger grid gap-4 lg:grid-cols-3">
            {columns.map((col) => {
              const items = filtered
                .filter((x) => x.status === col.status)
                .filter((x) => col.status !== "completada" || (x.completedAt ?? "") >= addDays(t, -7))
                .sort(col.status === "completada" ? (a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "") : sortTasks);
              return (
                <div key={col.status} className="flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-gray-50">
                  <div className="mb-3 flex items-center gap-2.5 border-b border-gray-200/80 bg-panel px-4 py-3.5">
                    <span className={cls("h-3 w-3 shrink-0 rounded-full ring-4 ring-gray-200/70", col.tone)} />
                    <h3 className="label-mono text-[13px] font-bold text-gray-900">{col.title}</h3>
                    <span className="num ml-auto min-w-[34px] rounded-full bg-gray-900 px-2.5 py-0.5 text-center text-[17px] tabular-nums text-white">{items.length}</span>
                  </div>
                  {col.status === "en_progreso" && (
                    <div className="mx-3 mb-3 rounded-xl border border-blue-200/70 bg-blue-50 px-3 py-2.5 text-[14px]" title="Tareas que se están haciendo al mismo tiempo">
                      <div className="flex items-center gap-2">
                        <span className="label-mono text-[12.5px] text-blue-700">A la vez</span>
                        <span className="flex flex-1 gap-1" aria-hidden>
                          {Array.from({ length: Math.max(WIP_LIMIT, items.length) }, (_, i) => (
                            <span key={i} className={cls("h-2.5 flex-1 rounded-full", i < items.length ? (items.length > WIP_LIMIT ? "bg-amber-500" : "bg-blue-500") : "bg-gray-200")} />
                          ))}
                        </span>
                        <span className="font-semibold tabular-nums text-blue-700">{items.length}</span>
                      </div>
                      {items.length > WIP_LIMIT && <p className="mt-1.5 text-amber-700">Son muchas a la vez: conviene terminar algunas antes de empezar otras.</p>}
                    </div>
                  )}
                  <div className="stagger flex min-h-[120px] flex-col gap-2.5 px-3 pb-3 lg:max-h-[calc(100vh-330px)] lg:overflow-y-auto">
                    {items.map((task) => (
                      <TaskCard key={task.id} task={task} onOpen={() => setOpenTask(task.id)} />
                    ))}
                    {items.length === 0 && (
                      <div className="flex flex-col items-center gap-2 py-8 text-center">
                        <EmptyArt kind="olas" />
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
      <ConfettiLayer />
      <NewTaskModal open={newTask} onClose={() => setNewTask(false)} roomId={room || undefined} />
    </div>
  );

  function RoomsBoard({ onFilter }: { onFilter: (id: string) => void }) {
    const floors = Array.from(new Set(data.rooms.map((r) => r.floor))).sort();
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-gray-200/80 bg-white px-4 py-3 text-[15px] shadow-card">
          {(Object.keys(ROOM_STATE_LABEL) as RoomState[]).map((s) => (
            <span key={s} className="flex items-center gap-2">
              <span className={cls("h-2.5 w-2.5 rounded-full ring-2 ring-white/70", ROOM_STATE_DOT[s])} /> {ROOM_STATE_LABEL[s]}
            </span>
          ))}
        </div>
        {floors.map((f) => (
          <div key={f}>
            <h3 className="label-mono mb-3 flex items-center gap-2 text-[13px] font-bold text-gray-900"><span className="h-px w-6 bg-accent" aria-hidden />Piso {f}</h3>
            <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
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
                      className={cls("lift relative min-h-[112px] rounded-xl border-l-[5px] border-l-current p-3 text-left ring-1", ROOM_STATE_CLASS[st])}
                    >
                      {ot.length > 0 && (
                        <span
                          className="num absolute -right-2 -top-2 flex h-8 min-w-[32px] items-center justify-center rounded-full bg-gray-900 px-2 text-[16px] leading-none text-white ring-2 ring-white/80"
                          aria-label={`${ot.length} ${ot.length > 1 ? "tareas abiertas" : "tarea abierta"}`}
                        >
                          {ot.length}
                        </span>
                      )}
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="num text-[34px] leading-none">{r.number}</span>
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
    const maxDone = Math.max(1, ...rows.map((x) => x.done));
    const recent = data.tasks
      .filter((x) => x.status === "completada")
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
      .slice(0, 40);
    const top = rows.filter((x) => x.done > 0).slice(0, 3);
    const days = Array.from({ length: 14 }, (_, i) => addDays(t, i - 13));
    const perDay = days.map((d) => ({ d, n: data.tasks.filter((x) => x.completedAt?.slice(0, 10) === d).length }));
    const maxDay = Math.max(1, ...perDay.map((x) => x.n));
    const podiumOrder = [1, 0, 2].filter((i) => top[i]);
    return (
      <div className="stagger grid gap-4 xl:grid-cols-2">
        {top.length > 0 && (
          <Card icon={Medal} title="Los que más tareas terminaron (últimos 30 días)">
            <ol className="grid grid-cols-3 items-end gap-3 px-4 pb-4 pt-6" aria-label="Podio">
              {podiumOrder.map((i) => {
                const x = top[i];
                const hh = PODIUM[i].h * (0.55 + 0.45 * (x.done / maxDone));
                return (
                  <li key={x.s.id} className="flex min-w-0 flex-col items-center text-center" aria-label={`${PODIUM[i].label}: ${x.s.name}, ${x.done} tareas`}>
                    <Avatar name={x.s.name} size={i === 0 ? 52 : 42} />
                    <div className="mt-1.5 w-full truncate text-[15px] font-semibold">{x.s.name.split(" ")[0]}</div>
                    <div className="mb-2 text-[14px] tabular-nums text-gray-600">{x.done} tareas</div>
                    <div className={cls("ui-bar-grow flex w-full max-w-[120px] items-start justify-center rounded-t-xl pt-2.5 text-white shadow-card", PODIUM[i].medal)} style={{ height: hh }}>
                      <Medal size={i === 0 ? 30 : 24} aria-hidden />
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        )}
        <Card icon={ClipboardList} title="Tareas terminadas en los últimos 14 días">
          <div className="overflow-x-auto px-4 pb-4 pt-5">
            <div role="img" aria-label={`Tareas terminadas por día: ${perDay.map((x) => `${x.d.slice(8, 10)}/${x.d.slice(5, 7)} ${x.n}`).join(", ")}`} className="flex h-40 min-w-[420px] items-end gap-1.5">
              {perDay.map(({ d, n }) => (
                <div key={d} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.slice(8, 10)}/${d.slice(5, 7)}: ${n}`}>
                  <span className="text-[12.5px] font-semibold tabular-nums text-gray-700">{n || ""}</span>
                  <div className={cls("ui-bar-grow w-full rounded-t-md", d === t ? "bg-accent" : "bg-accent/55", n === 0 && "opacity-30")} style={{ height: `${n ? Math.max(8, (n / maxDay) * 100) : 4}%` }} />
                  <span className={cls("text-[12.5px] tabular-nums", d === t ? "font-bold text-gray-900" : "text-gray-600")}>{d.slice(8, 10)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card icon={ClipboardList} title="Cómo viene trabajando cada persona (últimos 30 días)">
          <Table head={["Persona", "Cargo", "Hoy", "En 30 días", "Le quedan", "Tiempo promedio"]}>
            {rows.map(({ s, done, today: td, open, avg }) => (
              <tr key={s.id} className="cursor-pointer hover:bg-gray-50" onClick={() => { setAssignee(s.id); setTab("tablero"); }}>
                <td className="px-4 py-2.5 font-medium">
                  <span className="flex items-center gap-2.5">
                    <Avatar name={s.name} size={32} />
                    {s.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{ROLE_LABEL[s.role]}</td>
                <td className="px-4 py-2.5 tabular-nums">{td}</td>
                <td className="min-w-[140px] px-4 py-2.5 tabular-nums font-semibold">
                  {done}
                  <span className="mt-1 block h-2 overflow-hidden rounded-full bg-gray-100">
                    <span className="block h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${maxDone ? (done / maxDone) * 100 : 0}%` }} />
                  </span>
                </td>
                <td className="px-4 py-2.5 tabular-nums">{open}</td>
                <td className="px-4 py-2.5 tabular-nums">{avg != null ? `${avg} min` : "—"}</td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card icon={CheckCircle2} title="Últimas tareas terminadas">
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
