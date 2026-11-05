"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Hand, Play } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { TaskDrawer } from "@/components/tasks";
import { Badge, Button, Card, Field, Modal, Progress, Select, Textarea, toast } from "@/components/ui";
import { fmtDate, fmtDateTime, today } from "@/lib/dates";
import {
  cls,
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  ROLE_LABEL,
  ROOM_STATE_CLASS,
  ROOM_STATE_DOT,
  ROOM_STATE_LABEL,
  TASK_DEFAULT_ROLE,
  TASK_TYPE_ICON,
} from "@/lib/logic";
import type { RoomState, Task } from "@/lib/types";

export default function MiJornada() {
  const { data, idx, me, actions, staffName } = useApp();
  const t = today();
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [report, setReport] = useState(false);
  const [tab, setTab] = useState<"pendientes" | "hechas">("pendientes");

  const sort = (a: Task, b: Task) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.dueDate.localeCompare(b.dueDate);
  const mine = useMemo(() => data.tasks.filter((x) => x.assignedTo === me?.id && x.status !== "completada").sort(sort), [data.tasks, me?.id]);
  const pool = useMemo(
    () => data.tasks.filter((x) => !x.assignedTo && x.status !== "completada" && me && TASK_DEFAULT_ROLE[x.type] === me.role).sort(sort),
    [data.tasks, me],
  );
  const doneToday = useMemo(
    () => data.tasks.filter((x) => x.completedBy === me?.id && x.completedAt?.slice(0, 10) === t).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
    [data.tasks, me?.id, t],
  );
  const totalToday = doneToday.length + mine.length;
  const pct = totalToday ? Math.round((doneToday.length / totalToday) * 100) : 100;
  if (!me) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Mi jornada</h1>
          <p className="text-sm text-gray-500">
            {me.name} · {ROLE_LABEL[me.role]} · {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <Button variant="danger" onClick={() => setReport(true)}>
          <AlertTriangle size={15} /> Reportar problema
        </Button>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-6 p-4">
          <div className="min-w-[200px] flex-1">
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="font-medium">Avance de hoy</span>
              <span className="tabular-nums text-gray-600">
                {doneToday.length} de {totalToday} tareas
              </span>
            </div>
            <Progress value={pct} tone={pct === 100 ? "bg-green-500" : "bg-blue-600"} />
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <div className="text-2xl font-semibold tabular-nums">{mine.length}</div>
              <div className="text-xs text-gray-500">Pendientes</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums text-blue-600">{mine.filter((x) => x.status === "en_progreso").length}</div>
              <div className="text-xs text-gray-500">En curso</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums text-green-600">{doneToday.length}</div>
              <div className="text-xs text-gray-500">Hechas hoy</div>
            </div>
          </div>
        </div>
      </Card>

      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
        {(["pendientes", "hechas"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cls("rounded-md px-4 py-1.5 text-sm font-medium", tab === k ? "bg-gray-900 text-white" : "text-gray-600")}
          >
            {k === "pendientes" ? `Mis tareas (${mine.length})` : `Hechas hoy (${doneToday.length})`}
          </button>
        ))}
      </div>

      {tab === "pendientes" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {mine.map((task) => (
            <BigTask key={task.id} task={task} onOpen={() => setOpenTask(task.id)} />
          ))}
          {mine.length === 0 && (
            <Card className="md:col-span-2">
              <div className="p-10 text-center">
                <div className="text-3xl">🎉</div>
                <div className="mt-2 font-medium">No tenés tareas pendientes</div>
                <div className="text-sm text-gray-500">{pool.length ? "Podés tomar alguna de las tareas libres de abajo." : "Te avisamos cuando te asignen una nueva."}</div>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <ul className="divide-y divide-gray-100">
            {doneToday.map((x) => (
              <li key={x.id}>
                <button onClick={() => setOpenTask(x.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
                  <CheckCircle2 className="text-green-600" size={20} />
                  <span className="flex-1 text-sm">
                    <b>Hab. {idx.roomById.get(x.roomId)?.number}</b> · {x.title}
                  </span>
                  <span className="text-xs text-gray-500">{fmtDateTime(x.completedAt).slice(-5)}</span>
                </button>
              </li>
            ))}
            {!doneToday.length && <li className="px-4 py-8 text-center text-sm text-gray-500">Todavía no completaste tareas hoy</li>}
          </ul>
        </Card>
      )}

      {pool.length > 0 && (
        <Card title={`Tareas libres para ${ROLE_LABEL[me.role].split(" ")[0].toLowerCase()} (${pool.length})`}>
          <ul className="divide-y divide-gray-100">
            {pool.slice(0, 20).map((x) => (
              <li key={x.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex h-9 w-11 items-center justify-center rounded-md bg-gray-900 text-sm font-semibold text-white">{idx.roomById.get(x.roomId)?.number}</span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block truncate font-medium">
                    {TASK_TYPE_ICON[x.type]} {x.title}
                  </span>
                  <span className="text-xs text-gray-500">Vence {fmtDate(x.dueDate)}</span>
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                    actions.assignTask(x, me.id);
                    toast("Tarea tomada");
                  }}
                >
                  <Hand size={14} /> Tomar
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <RoomBoard />

      <TaskDrawer id={openTask} onClose={() => setOpenTask(null)} />
      <ReportModal open={report} onClose={() => setReport(false)} />
      <p className="text-center text-xs text-gray-400">Todo lo que marcás se ve al instante en el dashboard y en recepción · {staffName(me.id)}</p>
    </div>
  );
}

function BigTask({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { idx, actions } = useApp();
  const room = idx.roomById.get(task.roomId);
  const done = task.checklist.filter((c) => c.done).length;
  const overdue = task.dueDate < today();
  return (
    <Card className={cls(task.priority === "urgente" && "ring-2 ring-red-500")}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <button onClick={onOpen} className="flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-gray-900 text-white">
            <span className="text-[10px] uppercase opacity-70">Hab.</span>
            <span className="text-lg font-bold leading-none">{room?.number}</span>
          </button>
          <div className="min-w-0 flex-1">
            <button onClick={onOpen} className="block text-left font-semibold leading-snug">
              {TASK_TYPE_ICON[task.type]} {task.title}
            </button>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge className={PRIORITY_CLASS[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>
              {overdue && <Badge className="bg-red-50 text-red-700">Vencida</Badge>}
              {task.status === "en_progreso" && <Badge className="bg-blue-50 text-blue-700">En curso</Badge>}
            </div>
            {task.notes && <p className="mt-1.5 text-xs text-amber-800">📝 {task.notes}</p>}
          </div>
        </div>
        <ul className="mt-3 space-y-0.5">
          {task.checklist.map((c, i) => (
            <li key={i}>
              <button onClick={() => actions.toggleChecklist(task, i)} className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-2 text-left text-sm active:bg-gray-100">
                {c.done ? <CheckCircle2 size={22} className="shrink-0 text-green-600" /> : <Circle size={22} className="shrink-0 text-gray-300" />}
                <span className={c.done ? "text-gray-400 line-through" : ""}>{c.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          {task.status === "pendiente" && (
            <Button className="h-11 flex-1" onClick={() => actions.setTaskStatus(task, "en_progreso")}>
              <Play size={16} /> Empezar
            </Button>
          )}
          <Button
            variant="success"
            className="h-11 flex-1"
            onClick={() => {
              actions.setTaskStatus(task, "completada");
              toast(`Hab. ${room?.number}: ${task.title} ✔`);
            }}
          >
            <CheckCircle2 size={16} /> Terminar {task.checklist.length ? `(${done}/${task.checklist.length})` : ""}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function RoomBoard() {
  const { idx, data } = useApp();
  const [filter, setFilter] = useState<RoomState | "todas">("todas");
  const rooms = idx.roomsSorted.filter((r) => filter === "todas" || idx.roomStates.get(r.id) === filter);
  return (
    <Card
      title="Estado de las habitaciones"
      actions={
        <Select value={filter} onChange={(e) => setFilter(e.target.value as RoomState | "todas")} className="h-8 w-[180px]">
          <option value="todas">Todas</option>
          {(Object.keys(ROOM_STATE_LABEL) as RoomState[]).map((s) => (
            <option key={s} value={s}>
              {ROOM_STATE_LABEL[s]}
            </option>
          ))}
        </Select>
      }
    >
      <div className="grid grid-cols-4 gap-1.5 p-3 sm:grid-cols-6 lg:grid-cols-10">
        {rooms.map((r) => {
          const st = idx.roomStates.get(r.id) ?? "lista";
          const open = idx.openTasksByRoom.get(r.id)?.length ?? 0;
          const arriving = data.reservations.some((x) => x.roomId === r.id && x.checkIn === today() && (x.status === "confirmada" || x.status === "pendiente"));
          return (
            <div key={r.id} className={cls("relative rounded-md px-2 py-1.5 text-center ring-1", ROOM_STATE_CLASS[st])} title={ROOM_STATE_LABEL[st]}>
              <div className="text-sm font-semibold">{r.number}</div>
              <div className="truncate text-[10px] opacity-80">{ROOM_STATE_LABEL[st].split(" ")[0]}</div>
              {open > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-gray-900 px-1 text-[10px] font-bold text-white">{open}</span>}
              {arriving && <span className="absolute -left-1 -top-1 rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">llega</span>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
        {(Object.keys(ROOM_STATE_LABEL) as RoomState[]).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className={cls("h-2 w-2 rounded-full", ROOM_STATE_DOT[s])} /> {ROOM_STATE_LABEL[s]}
          </span>
        ))}
      </div>
    </Card>
  );
}

function ReportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { idx, actions, data } = useApp();
  const [room, setRoom] = useState("");
  const [desc, setDesc] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [block, setBlock] = useState(false);
  const quick = ["Pérdida de agua", "Aire acondicionado no enfría", "Lámpara quemada", "TV no funciona", "Falta reponer lencería", "Daño en mobiliario", "Objeto olvidado por huésped"];
  async function send() {
    if (!room || !desc.trim()) return toast("Elegí la habitación y describí el problema", "error");
    await actions.reportIssue(room, desc.trim(), { urgent, block });
    toast("Problema reportado · mantenimiento ya fue avisado");
    setDesc("");
    setUrgent(false);
    setBlock(false);
    onClose();
  }
  void data;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reportar un problema"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={send}>
            Enviar reporte
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Habitación">
          <Select value={room} onChange={(e) => setRoom(e.target.value)}>
            <option value="">— Elegir —</option>
            {idx.roomsSorted.map((r) => (
              <option key={r.id} value={r.id}>
                {r.number}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <button key={q} onClick={() => setDesc(q)} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs hover:bg-gray-200">
              {q}
            </button>
          ))}
        </div>
        <Field label="¿Qué pasa?">
          <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Describí el problema…" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> Es urgente
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} /> La habitación no se puede usar hasta que se arregle
        </label>
      </div>
    </Modal>
  );
}
