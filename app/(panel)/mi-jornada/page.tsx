"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Circle, Hand, Play, StickyNote } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { TaskDrawer } from "@/components/tasks";
import { Badge, Button, Card, Field, Modal, PageHeader, Select, Textarea, toast } from "@/components/ui";
import { fmtDate, fmtDateTime, today } from "@/lib/dates";
import { cls, PRIORITY_CLASS, PRIORITY_LABEL, PRIORITY_ORDER, ROLE_LABEL, ROOM_STATE_CLASS, ROOM_STATE_DOT, ROOM_STATE_LABEL, TASK_DEFAULT_ROLE } from "@/lib/logic";
import type { RoomState, Task } from "@/lib/types";
import { TaskIcon } from "@/components/TaskIcon";

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
    <div className="mx-auto max-w-5xl space-y-5 p-4 pb-10 lg:p-6">
      <PageHeader
        title="Mi trabajo de hoy"
        subtitle={`${me.name} · ${ROLE_LABEL[me.role]} · ${new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}`}
        actions={
          <Button variant="danger" className="h-12 px-5 text-[16px]" onClick={() => setReport(true)}>
            <AlertTriangle size={18} /> Avisar de un problema
          </Button>
        }
      />

      <Card>
        <div className="space-y-4 p-4 sm:p-5">
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2 text-[16px]">
              <span className="font-semibold">Avance de hoy</span>
              <span className="tabular-nums text-gray-600">
                {doneToday.length} de {totalToday} tareas
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div
                className={cls("h-full rounded-full transition-all duration-200 motion-reduce:transition-none", pct === 100 ? "bg-green-500" : "bg-accent")}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-gray-50 px-1 py-3">
              <div className="text-[26px] font-semibold leading-none tabular-nums">{mine.length}</div>
              <div className="mt-1.5 text-[14px] text-gray-600">Me faltan</div>
            </div>
            <div className="rounded-xl bg-blue-50 px-1 py-3">
              <div className="text-[26px] font-semibold leading-none tabular-nums text-blue-700">{mine.filter((x) => x.status === "en_progreso").length}</div>
              <div className="mt-1.5 text-[14px] text-gray-600">Empezadas</div>
            </div>
            <div className="rounded-xl bg-green-50 px-1 py-3">
              <div className="text-[26px] font-semibold leading-none tabular-nums text-green-700">{doneToday.length}</div>
              <div className="mt-1.5 text-[14px] text-gray-600">Ya hechas</div>
            </div>
          </div>
        </div>
      </Card>

      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-2xl border border-gray-200 bg-gray-50 p-1">
        {(["pendientes", "hechas"] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cls(
              "min-h-[56px] rounded-xl px-3 py-2 text-[15px] font-semibold leading-tight transition-colors duration-150 motion-reduce:transition-none sm:text-[16px]",
              tab === k ? "bg-accent text-accent-fg shadow-btn" : "text-gray-700 hover:bg-white",
            )}
          >
            {k === "pendientes" ? `Lo que tengo que hacer (${mine.length})` : `Lo que ya hice (${doneToday.length})`}
          </button>
        ))}
      </div>

      {tab === "pendientes" ? (
        <div className="grid gap-4 md:grid-cols-2">
          {mine.map((task) => (
            <BigTask key={task.id} task={task} onOpen={() => setOpenTask(task.id)} />
          ))}
          {mine.length === 0 && (
            <Card className="md:col-span-2">
              <div className="flex flex-col items-center gap-2 p-10 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600">
                  <CheckCircle2 size={36} aria-hidden />
                </span>
                <div className="mt-1 text-[18px] font-semibold">¡Listo! No te queda nada por hacer</div>
                <div className="text-[15px] text-gray-600">{pool.length ? "Abajo hay tareas sin dueño que podés agarrar." : "Te avisamos cuando te den una tarea nueva."}</div>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <ul className="divide-y divide-gray-100">
            {doneToday.map((x) => (
              <li key={x.id}>
                <button
                  onClick={() => setOpenTask(x.id)}
                  className="flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-gray-50 active:bg-gray-100 motion-reduce:transition-none"
                >
                  <CheckCircle2 className="shrink-0 text-green-600" size={24} />
                  <span className="min-w-0 flex-1 text-[16px] leading-snug">
                    <b>Habitación {idx.roomById.get(x.roomId)?.number}</b> · {x.title}
                  </span>
                  <span className="shrink-0 text-[15px] tabular-nums text-gray-600">{fmtDateTime(x.completedAt).slice(-5)}</span>
                </button>
              </li>
            ))}
            {!doneToday.length && (
              <li className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <ClipboardList size={32} className="text-gray-500" aria-hidden />
                <span className="text-[15px] text-gray-600">Todavía no terminaste ninguna tarea hoy.</span>
              </li>
            )}
          </ul>
        </Card>
      )}

      {pool.length > 0 && (
        <Card title={`Tareas sin dueño que podés agarrar (${pool.length})`}>
          <ul className="divide-y divide-gray-100">
            {pool.slice(0, 20).map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex h-11 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-[16px] font-bold text-white">{idx.roomById.get(x.roomId)?.number}</span>
                <span className="min-w-0 flex-1 basis-40 text-[15px]">
                  <span className="block font-semibold leading-snug">
                    <TaskIcon type={x.type} /> {x.title}
                  </span>
                  <span className="text-[14px] text-gray-600">Para el {fmtDate(x.dueDate)}</span>
                </span>
                <Button
                  className="h-12 w-full px-5 text-[16px] sm:w-auto"
                  onClick={() => {
                    actions.assignTask(x, me.id);
                    toast("Listo, ahora es tu tarea ✔");
                  }}
                >
                  <Hand size={18} /> La hago yo
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <RoomBoard />

      <TaskDrawer id={openTask} onClose={() => setOpenTask(null)} />
      <ReportModal open={report} onClose={() => setReport(false)} />
      <p className="text-center text-[14px] text-gray-600">Todo lo que marcás lo ven al instante en recepción y en el panel principal · {staffName(me.id)}</p>
    </div>
  );
}

function BigTask({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { idx, actions } = useApp();
  const room = idx.roomById.get(task.roomId);
  const done = task.checklist.filter((c) => c.done).length;
  const total = task.checklist.length;
  const overdue = task.dueDate < today();
  const urgent = task.priority === "urgente";
  return (
    <Card className={cls("flex flex-col overflow-hidden", urgent ? "border-red-500 ring-2 ring-red-500" : overdue && "border-red-300 ring-1 ring-red-300")}>
      {(urgent || overdue) && (
        <div className="flex items-center gap-2 bg-red-700 px-4 py-2 text-[15px] font-semibold text-white">
          <AlertTriangle size={18} aria-hidden /> {urgent ? PRIORITY_LABEL.urgente : "Atrasada"}
          {urgent && overdue && <span className="ml-auto text-[14px] font-medium opacity-90">Atrasada</span>}
        </div>
      )}
      <div className="flex-1 p-4">
        <div className="flex items-start gap-3">
          <button onClick={onOpen} aria-label={`Abrir la tarea de la habitación ${room?.number}`} className="flex h-16 w-[72px] shrink-0 flex-col items-center justify-center rounded-xl bg-gray-900 text-white transition-transform duration-150 active:scale-95 motion-reduce:transition-none">
            <span className="text-[13px] opacity-80">Hab.</span>
            <span className="text-[24px] font-bold leading-none">{room?.number}</span>
          </button>
          <div className="min-w-0 flex-1">
            <button onClick={onOpen} className="block text-left text-[18px] font-semibold leading-snug">
              <TaskIcon type={task.type} size={19} /> {task.title}
            </button>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge className={PRIORITY_CLASS[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>
              {overdue && !urgent && <Badge className="bg-red-50 text-red-700">Atrasada</Badge>}
              {task.status === "en_progreso" && <Badge className="bg-blue-50 text-blue-700">Empezada</Badge>}
            </div>
          </div>
        </div>
        {task.notes && (
          <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[15px] text-amber-900">
            <StickyNote size={18} className="mt-0.5 shrink-0" aria-hidden /> <span>{task.notes}</span>
          </p>
        )}
        {total > 0 && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden>
            <div className={cls("h-full rounded-full transition-all duration-200 motion-reduce:transition-none", done === total ? "bg-green-500" : "bg-accent")} style={{ width: `${(done / total) * 100}%` }} />
          </div>
        )}
        <ul className="mt-3 space-y-2">
          {task.checklist.map((c, i) => (
            <li key={i}>
              <button
                onClick={() => actions.toggleChecklist(task, i)}
                className={cls(
                  "flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[16px] leading-snug transition-colors duration-150 motion-reduce:transition-none",
                  c.done ? "border-green-200 bg-green-50" : "border-gray-200 bg-white active:bg-gray-100",
                )}
              >
                {c.done ? <CheckCircle2 size={26} className="shrink-0 text-green-600" /> : <Circle size={26} className="shrink-0 text-gray-500" />}
                <span className={c.done ? "text-gray-600 line-through" : "font-medium"}>{c.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-auto flex flex-col gap-2 border-t border-gray-100 bg-gray-50 p-3 sm:flex-row">
        {task.status === "pendiente" && (
          <Button variant="primary" className="h-14 flex-1 text-[17px]" onClick={() => actions.setTaskStatus(task, "en_progreso")}>
            <Play size={20} /> Empezar
          </Button>
        )}
        <Button
          variant="success"
          className="h-14 flex-1 text-[17px]"
          onClick={() => {
            actions.setTaskStatus(task, "completada");
            toast(`Habitación ${room?.number}: ${task.title} ✔ ¡Bien!`);
          }}
        >
          <CheckCircle2 size={20} /> Ya terminé {total ? `(${done} de ${total})` : ""}
        </Button>
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
        <Select value={filter} onChange={(e) => setFilter(e.target.value as RoomState | "todas")} className="w-full sm:w-[210px]">
          <option value="todas">Ver todas</option>
          {(Object.keys(ROOM_STATE_LABEL) as RoomState[]).map((s) => (
            <option key={s} value={s}>
              {ROOM_STATE_LABEL[s]}
            </option>
          ))}
        </Select>
      }
    >
      <div className="grid grid-cols-3 gap-2.5 p-3 sm:grid-cols-5 lg:grid-cols-8">
        {rooms.map((r) => {
          const st = idx.roomStates.get(r.id) ?? "lista";
          const open = idx.openTasksByRoom.get(r.id)?.length ?? 0;
          const arriving = data.reservations.some((x) => x.roomId === r.id && x.checkIn === today() && (x.status === "confirmada" || x.status === "pendiente"));
          return (
            <div key={r.id} className={cls("relative rounded-xl px-2 py-2.5 text-center ring-1", ROOM_STATE_CLASS[st])} title={ROOM_STATE_LABEL[st]}>
              <div className="text-[18px] font-bold leading-tight">{r.number}</div>
              <div className="truncate text-[14px] leading-tight">{ROOM_STATE_LABEL[st].split(" ")[0]}</div>
              {open > 0 && <span className="absolute -right-1.5 -top-1.5 min-w-[22px] rounded-full bg-gray-900 px-1.5 py-0.5 text-[13px] font-bold leading-none text-white">{open}</span>}
              {arriving && <span className="absolute -left-1.5 -top-1.5 rounded-full bg-blue-700 px-1.5 py-0.5 text-[13px] font-bold leading-none text-white">llega</span>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-gray-100 px-4 py-3 text-[14px] text-gray-700">
        {(Object.keys(ROOM_STATE_LABEL) as RoomState[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cls("h-3 w-3 rounded-full", ROOM_STATE_DOT[s])} /> {ROOM_STATE_LABEL[s]}
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
  const quick = ["Pierde agua", "El aire no enfría", "Lámpara quemada", "La tele no funciona", "Faltan sábanas o toallas", "Mueble roto", "Un huésped olvidó algo"];
  async function send() {
    if (!room || !desc.trim()) return toast("Elegí la habitación y contá qué pasó", "error");
    await actions.reportIssue(room, desc.trim(), { urgent, block });
    toast("Listo, ya le avisamos a mantenimiento ✔");
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
      title="Avisar de un problema"
      footer={
        <>
          <Button onClick={onClose}>Cerrar sin avisar</Button>
          <Button variant="danger" onClick={send}>
            Enviar aviso
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Habitación">
          <Select value={room} onChange={(e) => setRoom(e.target.value)}>
            <option value="">Elegí la habitación</option>
            {idx.roomsSorted.map((r) => (
              <option key={r.id} value={r.id}>
                {r.number}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <button key={q} onClick={() => setDesc(q)} className="min-h-[44px] rounded-full bg-gray-100 px-4 py-2 text-[15px] transition-colors duration-150 hover:bg-gray-200 active:bg-gray-300 motion-reduce:transition-none">
              {q}
            </button>
          ))}
        </div>
        <Field label="¿Qué pasó? (tocá una opción de arriba o escribilo)">
          <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Contá qué pasó" />
        </Field>
        <label className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-[16px]">
          <input type="checkbox" className="h-6 w-6 shrink-0 accent-red-600" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> Es urgente
        </label>
        <label className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-[16px]">
          <input type="checkbox" className="h-6 w-6 shrink-0 accent-red-600" checked={block} onChange={(e) => setBlock(e.target.checked)} /> La habitación no se puede usar hasta que se arregle
        </label>
      </div>
    </Modal>
  );
}
