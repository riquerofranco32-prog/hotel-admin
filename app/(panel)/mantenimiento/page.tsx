"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Zap } from "lucide-react";
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
  const { data, me, actions, staffName } = useApp();
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
    { status: "pendiente", title: "Pendientes", tone: "bg-gray-400" },
    { status: "en_progreso", title: "En progreso", tone: "bg-blue-500" },
    { status: "completada", title: "Completadas (últimos 7 días)", tone: "bg-green-500" },
  ];

  const sortTasks = (a: Task, b: Task) =>
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.dueDate.localeCompare(b.dueDate) || roomNum(a.roomId).localeCompare(roomNum(b.roomId), undefined, { numeric: true });

  const open = data.tasks.filter((x) => x.status !== "completada");
  const roomsDirty = data.rooms.filter((r) => ["sucia", "en_limpieza"].includes(roomState(r, data, t))).length;

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Mantenimiento y housekeeping"
        subtitle="Las tareas se generan solas según el estado de las reservas: próxima salida, check-out y llegadas."
        actions={
          <>
            <Button
              onClick={async () => {
                const n = await actions.runAutomations();
                toast(n ? `Se crearon ${n} tareas automáticas` : "No hay tareas automáticas pendientes de crear");
              }}
            >
              <Zap size={15} /> Ejecutar automatizaciones
            </Button>
            <Button variant="primary" onClick={() => setNewTask(true)}>
              <Plus size={15} /> Nueva tarea
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Tareas abiertas" value={open.length} tone="gray" />
        <Stat label="En progreso" value={open.filter((x) => x.status === "en_progreso").length} tone="blue" />
        <Stat label="Urgentes / alta" value={open.filter((x) => x.priority === "urgente" || x.priority === "alta").length} tone="red" />
        <Stat label="Habitaciones por limpiar" value={roomsDirty} tone="orange" />
        <Stat label="Completadas hoy" value={data.tasks.filter((x) => x.completedAt?.slice(0, 10) === t).length} tone="green" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "tablero", label: "Tablero" },
            { value: "habitaciones", label: "Habitaciones" },
            { value: "personal", label: "Quién hizo qué" },
            { value: "reglas", label: "Reglas automáticas" },
          ]}
        />
      </div>

      {tab === "tablero" && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <Input placeholder="Buscar tarea o habitación" value={q} onChange={(e) => setQ(e.target.value)} className="w-[200px]" />
            <Select value={room} onChange={(e) => setRoom(e.target.value)} className="w-[150px]">
              <option value="">Todas las hab.</option>
              {data.rooms
                .slice()
                .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    Hab. {r.number}
                  </option>
                ))}
            </Select>
            <Select value={type} onChange={(e) => setType(e.target.value as TaskType | "")} className="w-[180px]">
              <option value="">Todos los tipos</option>
              {(Object.keys(TASK_TYPE_LABEL) as TaskType[]).map((k) => (
                <option key={k} value={k}>
                  {TASK_TYPE_LABEL[k]}
                </option>
              ))}
            </Select>
            <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-[190px]">
              <option value="">Todo el personal</option>
              <option value="none">Sin asignar</option>
              {data.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id === me?.id ? `${s.name} (yo)` : s.name}
                </option>
              ))}
            </Select>
            <Select value={range} onChange={(e) => setRange(e.target.value as typeof range)} className="w-[160px]">
              <option value="todas">Cualquier fecha</option>
              <option value="hoy">Vencen hoy o antes</option>
              <option value="semana">Próximos 7 días</option>
            </Select>
            {(room || assignee || type || q) && (
              <Button variant="ghost" onClick={() => { setRoom(""); setAssignee(""); setType(""); setQ(""); }}>
                Limpiar filtros
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
                <div key={col.status} className="rounded-xl bg-gray-100/80 p-3">
                  <div className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold text-gray-700">
                    <span className={cls("h-2.5 w-2.5 rounded-full", col.tone)} /> {col.title}
                    <span className="ml-auto rounded-full bg-white px-2 text-xs">{items.length}</span>
                  </div>
                  <div className="flex max-h-[calc(100vh-330px)] min-h-[120px] flex-col gap-2 overflow-y-auto pr-1">
                    {items.map((task) => (
                      <TaskCard key={task.id} task={task} onOpen={() => setOpenTask(task.id)} />
                    ))}
                    {items.length === 0 && <p className="py-6 text-center text-sm text-gray-400">Sin tareas</p>}
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
      <div className="space-y-5">
        <div className="flex flex-wrap gap-3 text-sm">
          {(Object.keys(ROOM_STATE_LABEL) as RoomState[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={cls("h-2.5 w-2.5 rounded-full", ROOM_STATE_DOT[s])} /> {ROOM_STATE_LABEL[s]}
            </span>
          ))}
        </div>
        {floors.map((f) => (
          <div key={f}>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Piso {f}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
              {data.rooms
                .filter((r) => r.floor === f)
                .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
                .map((r) => {
                  const st = roomState(r, data, t);
                  const res = currentReservation(r.id, data.reservations, t);
                  const ot = data.tasks.filter((x) => x.roomId === r.id && x.status !== "completada");
                  return (
                    <button key={r.id} onClick={() => onFilter(r.id)} className={cls("rounded-lg p-3 text-left ring-1 transition hover:shadow", ROOM_STATE_CLASS[st])}>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold">{r.number}</span>
                        <span className="text-[11px] opacity-80">{r.type}</span>
                      </div>
                      <div className="text-xs font-medium">{ROOM_STATE_LABEL[st]}</div>
                      <div className="mt-1 truncate text-[11px] opacity-80">
                        {res ? `${res.guestName} · ${VISUAL_LABEL[visualStatus(res, t)]}` : "Sin huésped"}
                      </div>
                      {ot.length > 0 && <div className="mt-1 text-[11px] font-semibold">{ot.length} tarea{ot.length > 1 ? "s" : ""} abierta{ot.length > 1 ? "s" : ""}</div>}
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
        <Card title="Rendimiento del personal (últimos 30 días)">
          <Table head={["Persona", "Rol", "Hoy", "30 días", "Abiertas", "Tiempo prom."]}>
            {rows.map(({ s, done, today: td, open, avg }) => (
              <tr key={s.id} className="cursor-pointer hover:bg-gray-50" onClick={() => { setAssignee(s.id); setTab("tablero"); }}>
                <td className="px-4 py-2.5 font-medium">{s.name}</td>
                <td className="px-4 py-2.5 text-gray-500">{ROLE_LABEL[s.role]}</td>
                <td className="px-4 py-2.5 tabular-nums">{td}</td>
                <td className="px-4 py-2.5 tabular-nums font-semibold">{done}</td>
                <td className="px-4 py-2.5 tabular-nums">{open}</td>
                <td className="px-4 py-2.5 tabular-nums">{avg != null ? `${avg} min` : "—"}</td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Últimas tareas completadas">
          <Table head={["Cuándo", "Hab.", "Tarea", "Hecha por"]}>
            {recent.map((x) => (
              <tr key={x.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setOpenTask(x.id)}>
                <td className="whitespace-nowrap px-4 py-2 text-gray-500">{fmtDateTime(x.completedAt)}</td>
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
    const s = data.settings[0];
    const rules = s?.rules ?? { preSalida: true, checkoutTasks: true, llegada: true, repasoDiario: false };
    const canEdit = me?.role === "admin";
    const toggle = (k: keyof typeof rules) => s && actions.saveSettings({ ...s, rules: { ...rules, [k]: !rules[k] } });
    const items: { key: keyof typeof rules; color: string; when: string; then: string }[] = [
      { key: "preSalida", color: "bg-proxima", when: "La reserva pasa a 🔴 Próxima a salir (sale hoy o mañana)", then: "Se crea “Pre-salida: revisar minibar y consumos” para Recepción. Se cierra sola al hacer el check-out." },
      { key: "checkoutTasks", color: "bg-gray-400", when: "Se hace el check-out (el huésped ya salió)", then: "Se crean 4 tareas: 🛏️ cambio de sábanas y toallas, 🧹 limpieza de salida, 🧴 reposición de amenities y 🔍 inspección final. La habitación queda “Sucia” hasta completarlas y luego vuelve a “Lista”." },
      { key: "llegada", color: "bg-reservada", when: "Hay una 🔵 reserva que llega hoy o mañana", then: "Se crea “Preparar habitación para llegada” con los pedidos especiales del huésped. Se cierra sola al hacer el check-in. Si la habitación sigue sucia el día de llegada, aparece una alerta 🔔." },
      { key: "repasoDiario", color: "bg-ocupada", when: "Hay un 🟢 huésped en casa (estadías de varias noches)", then: "Se crea un “Repaso diario” por día para housekeeping." },
    ];
    return (
      <div className="space-y-3">
        {items.map((it) => (
          <Card key={it.key}>
            <div className="flex flex-wrap items-start gap-4 p-4">
              <span className={cls("mt-1 h-3 w-3 shrink-0 rounded-full", it.color)} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">Cuando: {it.when}</div>
                <div className="mt-1 text-sm text-gray-600">Entonces: {it.then}</div>
              </div>
              <label className={cls("flex items-center gap-2 text-sm", !canEdit && "opacity-60")}>
                <input type="checkbox" checked={rules[it.key]} disabled={!canEdit} onChange={() => toggle(it.key)} />
                {rules[it.key] ? <Badge className="bg-green-50 text-green-700">Activa</Badge> : <Badge className="bg-gray-100 text-gray-600">Inactiva</Badge>}
              </label>
            </div>
          </Card>
        ))}
        <Card>
          <div className="p-4 text-sm text-gray-600">
            <b>Asignación automática:</b> cada tarea automática se asigna a la persona activa del rol correspondiente (limpieza, recepción o
            mantenimiento) que tenga menos tareas abiertas. Cada acción (iniciar, tildar un ítem, completar) queda registrada con quién y
            cuándo. Las reparaciones marcadas como “bloquea la habitación” la dejan fuera de servicio y se ven rayadas en el calendario.
          </div>
        </Card>
      </div>
    );
  }
}
