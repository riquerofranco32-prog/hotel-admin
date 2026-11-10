"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, BedDouble, CheckCircle2, ChevronsRight, Flame, Hand, ListTodo, Medal, Play, Sparkles, Star, StickyNote, Timer } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { PRIORITY_BAR, TaskDrawer } from "@/components/tasks";
import { Badge, Button, Card, Field, Modal, Select, Textarea, toast } from "@/components/ui";
import { CountUp, Ring } from "@/components/viz";
import { fmtDate, fmtDateTime, today } from "@/lib/dates";
import { cls, PRIORITY_CLASS, PRIORITY_LABEL, PRIORITY_ORDER, ROLE_LABEL, ROOM_STATE_CLASS, ROOM_STATE_DOT, ROOM_STATE_LABEL, TASK_DEFAULT_ROLE } from "@/lib/logic";
import type { RoomState, Task } from "@/lib/types";
import { AnimatedCheck, ConfettiLayer, Elapsed, EmptyArt, fireConfetti, TaskIcon, vibrate } from "@/components/TaskIcon";

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
  const allDone = totalToday > 0 && pct === 100;
  const prevDone = useRef<number | null>(null);
  useEffect(() => {
    if (!me) return;
    if (prevDone.current !== null && allDone && doneToday.length > prevDone.current) fireConfetti("¡Terminaste todo por hoy! Muchas gracias", true);
    prevDone.current = doneToday.length;
  }, [me, allDone, doneToday.length]);
  if (!me) return null;
  const nextId = (mine.find((x) => x.status === "en_progreso") ?? mine[0])?.id;

  const tiles = [
    { label: "Me faltan", value: mine.length, icon: ListTodo, box: "border-gray-200/80 bg-gray-50", ico: "bg-gray-900/10 text-gray-700", num: "" },
    { label: "Empezadas", value: mine.filter((x) => x.status === "en_progreso").length, icon: Play, box: "border-blue-200/70 bg-blue-50", ico: "bg-blue-500/15 text-blue-700", num: "text-blue-700" },
    { label: "Ya hechas", value: doneToday.length, icon: CheckCircle2, box: "border-green-200/70 bg-green-50", ico: "bg-green-500/15 text-green-700", num: "text-green-700" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 pb-10 lg:p-6">
      <header className="aurora">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="display text-balance text-[28px] text-fg md:text-[36px]">
              Mi trabajo de <span className="serif-accent">hoy</span>
            </h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-gray-600">
              {`${me.name} · ${ROLE_LABEL[me.role]} · ${new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}`}
            </p>
          </div>
          <Button variant="danger" className="h-12 w-full px-5 text-[16px] sm:w-auto" onClick={() => setReport(true)}>
            <AlertTriangle size={18} /> Avisar de un problema
          </Button>
        </div>

        <div className={cls("mt-5 overflow-hidden rounded-2xl border bg-panel shadow-card", allDone ? "border-green-300" : "border-gray-200/80")}>
          <div className="flex items-center gap-4 p-4 sm:gap-6 sm:p-5">
            <div className="relative shrink-0">
              {allDone && (
                <>
                  <span aria-hidden className="absolute inset-0 rounded-full border-4 border-green-400/60 motion-safe:animate-ping" style={{ animationIterationCount: 3 }} />
                  {SPARKS.map((c, i) => (
                    <Sparkles key={i} size={i % 2 ? 16 : 20} aria-hidden className={cls("absolute text-amber-500 motion-safe:animate-pulse", c)} />
                  ))}
                </>
              )}
              <Ring value={pct} size={128} stroke={12} tone={allDone ? "green" : "accent"} label={`${pct}% del día`}>
                <span className="num text-[34px] leading-none">
                  <CountUp value={pct} />
                  <span className="text-[20px] text-gray-600">%</span>
                </span>
              </Ring>
            </div>
            <div className="min-w-0 flex-1">
              <div className="label-mono text-[12.5px] font-semibold text-gray-600">Avance de hoy</div>
              <div className="mt-1.5 text-[18px] leading-tight text-gray-700 sm:text-[20px]">
                <CountUp value={doneToday.length} className="num text-[44px] leading-none text-fg sm:text-[56px]" /> de {totalToday} tareas
              </div>
              {allDone && (
                <p className="mt-2.5 flex animate-[ui-rise_0.5s_var(--ease)_both] items-center gap-2 text-[16px] font-semibold text-green-700 motion-reduce:animate-none">
                  <Sparkles size={20} aria-hidden /> ¡Terminaste todo por hoy!
                </p>
              )}
            </div>
          </div>
          <Achievements done={doneToday.length} />
          <div className="stagger grid grid-cols-3 gap-2 border-t border-gray-200/70 p-3 text-center sm:gap-3 sm:p-4">
            {tiles.map((x) => (
              <div key={x.label} className={cls("rounded-xl border px-1 py-3.5", x.box)}>
                <span className={cls("mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg", x.ico)}>
                  <x.icon size={19} aria-hidden />
                </span>
                <div className={cls("num text-[34px] leading-none tabular-nums", x.num)}>
                  <CountUp value={x.value} />
                </div>
                <div className="label-mono mt-2 text-[12.5px] text-gray-600">{x.label}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div role="tablist" className="grid grid-cols-2 gap-1.5 rounded-2xl border border-gray-200 bg-[rgb(var(--well))] p-1.5">
        {(["pendientes", "hechas"] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cls(
              "min-h-[56px] rounded-xl px-3 py-2 text-[15px] font-semibold leading-tight transition-all duration-200 motion-reduce:transition-none sm:text-[16px]",
              tab === k ? "bg-accent text-accent-fg shadow-card" : "text-gray-700 hover:bg-panel/70",
            )}
          >
            {k === "pendientes" ? `Lo que tengo que hacer (${mine.length})` : `Lo que ya hice (${doneToday.length})`}
          </button>
        ))}
      </div>

      {tab === "pendientes" ? (
        <div className="stagger grid gap-4 md:grid-cols-2">
          {mine.map((task) => (
            <BigTask key={task.id} task={task} next={task.id === nextId} isLast={mine.length === 1} onOpen={() => setOpenTask(task.id)} />
          ))}
          {mine.length === 0 && (
            <Card className="md:col-span-2">
              <div className="flex flex-col items-center gap-2 p-10 text-center">
                <EmptyArt kind="olas" />
                <div className="mt-1 text-[18px] font-semibold">¡Listo! No te queda nada por hacer</div>
                <div className="text-[15px] text-gray-600">{pool.length ? "Abajo hay tareas sin dueño que podés agarrar." : "Te avisamos cuando te den una tarea nueva."}</div>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <ul className="stagger divide-y divide-gray-100">
            {doneToday.map((x) => (
              <li key={x.id}>
                <button
                  onClick={() => setOpenTask(x.id)}
                  className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-gray-50 active:bg-gray-100 motion-reduce:transition-none"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/15 text-green-600">
                    <CheckCircle2 size={24} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 text-[16px] leading-snug">
                    <b>Habitación {idx.roomById.get(x.roomId)?.number}</b> · {x.title}
                  </span>
                  <span className="shrink-0 text-[15px] tabular-nums text-gray-600">{fmtDateTime(x.completedAt).slice(-5)}</span>
                </button>
              </li>
            ))}
            {!doneToday.length && (
              <li className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <EmptyArt kind="escoba" />
                <span className="text-[15px] text-gray-600">Todavía no terminaste ninguna tarea hoy.</span>
              </li>
            )}
          </ul>
        </Card>
      )}

      {pool.length > 0 && (
        <Card icon={Hand} title={`Tareas sin dueño que podés agarrar (${pool.length})`}>
          <ul className="stagger divide-y divide-gray-100">
            {pool.slice(0, 20).map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="num flex h-12 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-[22px] text-white">{idx.roomById.get(x.roomId)?.number}</span>
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
      <ConfettiLayer />
      <ReportModal open={report} onClose={() => setReport(false)} />
      <p className="text-center text-[14px] text-gray-600">Todo lo que marcás lo ven al instante en recepción y en el panel principal · {staffName(me.id)}</p>
    </div>
  );
}

function BigTask({ task, onOpen, next, isLast }: { task: Task; onOpen: () => void; next: boolean; isLast: boolean }) {
  const { idx, actions } = useApp();
  const room = idx.roomById.get(task.roomId);
  const done = task.checklist.filter((c) => c.done).length;
  const total = task.checklist.length;
  const overdue = task.dueDate < today();
  const urgent = task.priority === "urgente";
  return (
    <section
      className={cls(
        "flex flex-col overflow-hidden rounded-2xl border border-l-[8px] bg-panel shadow-card",
        urgent || overdue ? "border-red-300 border-l-red-600" : cls("border-gray-200/80", PRIORITY_BAR[task.priority]),
        urgent && "ring-2 ring-red-500",
        next && !urgent && "ring-2 ring-accent/60",
      )}
    >
      {next && (
        <div className="flex items-center gap-2 bg-gradient-to-r from-accent to-accent/70 px-4 py-2.5 text-[15px] font-semibold text-accent-fg">
          <ArrowRight size={18} aria-hidden /> {task.status === "en_progreso" ? "La que estás haciendo" : "Lo que sigue"}
        </div>
      )}
      {(urgent || overdue) && (
        <div className="flex items-center gap-2 bg-red-700 px-4 py-2.5 text-[15px] font-semibold text-white">
          <span className="pulse-dot h-2.5 w-2.5 rounded-full bg-white" aria-hidden />
          <AlertTriangle size={18} aria-hidden /> {urgent ? PRIORITY_LABEL.urgente : "Atrasada"}
          {urgent && overdue && <span className="ml-auto text-[14px] font-medium opacity-90">Atrasada</span>}
        </div>
      )}
      <div className="flex-1 p-4">
        <div className="flex items-start gap-3">
          <button onClick={onOpen} aria-label={`Abrir la tarea de la habitación ${room?.number}`} className="flex h-[72px] w-20 shrink-0 flex-col items-center justify-center rounded-2xl bg-gray-900 text-white shadow-card transition-transform duration-150 active:scale-95 motion-reduce:transition-none">
            <span className="label-mono text-[12.5px] opacity-80">Hab.</span>
            <span className="num text-[34px] leading-none">{room?.number}</span>
          </button>
          <div className="min-w-0 flex-1">
            <button onClick={onOpen} className="flex min-h-[44px] items-start gap-2 text-left text-[18px] font-semibold leading-snug">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <TaskIcon type={task.type} size={19} className="!mr-0 align-middle" />
              </span>
              <span>{task.title}</span>
            </button>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge className={PRIORITY_CLASS[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>
              {overdue && !urgent && <Badge className="bg-red-50 text-red-700">Atrasada</Badge>}
              {task.status === "en_progreso" && (
                <Badge className="bg-blue-50 text-blue-700">
                  <Timer size={13} className="mr-0.5 inline-block align-[-2px]" aria-hidden /> {task.startedAt ? <Elapsed since={task.startedAt} /> : "Empezada"}
                </Badge>
              )}
            </div>
          </div>
        </div>
        {task.notes && (
          <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[15px] text-amber-900">
            <StickyNote size={18} className="mt-0.5 shrink-0" aria-hidden /> <span>{task.notes}</span>
          </p>
        )}
        {total > 0 && (
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-100" aria-hidden>
            <div className={cls("h-full rounded-full transition-all duration-500 motion-reduce:transition-none", done === total ? "bg-green-500" : "bg-accent")} style={{ width: `${(done / total) * 100}%` }} />
          </div>
        )}
        <ul className="mt-3 space-y-2">
          {task.checklist.map((c, i) => (
            <li key={i}>
              <button
                onClick={() => {
                  vibrate();
                  actions.toggleChecklist(task, i);
                }}
                className={cls(
                  "flex min-h-[60px] w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[17px] leading-snug transition-colors duration-200 motion-reduce:transition-none",
                  c.done ? "border-green-200 bg-green-50" : "border-gray-200 bg-white active:bg-gray-100",
                )}
              >
                <AnimatedCheck done={c.done} size={32} />
                <span className={c.done ? "text-gray-600 line-through decoration-green-600/50" : "font-medium"}>{c.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-auto flex flex-col gap-2 border-t border-gray-200/80 bg-gradient-to-r from-accent/10 via-gray-50 to-green-500/15 p-3 sm:flex-row">
        {task.status === "pendiente" && (
          <Button variant="primary" className="h-14 flex-1 text-[17px]" onClick={() => actions.setTaskStatus(task, "en_progreso")}>
            <Play size={20} /> Empezar <ChevronsRight size={20} aria-hidden className="opacity-70" />
          </Button>
        )}
        <Button
          variant="success"
          className="h-14 flex-1 text-[17px]"
          onClick={() => {
            actions.setTaskStatus(task, "completada");
            vibrate(25);
            if (!isLast) fireConfetti("¡Muy bien, una menos!");
            toast(`Habitación ${room?.number}: ${task.title} ✔ ¡Bien!`);
          }}
        >
          <CheckCircle2 size={20} /> Ya terminé {total ? `(${done} de ${total})` : ""} <ChevronsRight size={20} aria-hidden className="opacity-70" />
        </Button>
      </div>
    </section>
  );
}

const SPARKS = ["-top-2 left-1/2", "-bottom-2 left-1/2", "top-1/2 -left-3", "top-1/2 -right-3", "top-1 left-0", "bottom-1 right-0"];
const MILESTONES = [3, 6, 10];

/** Racha amistosa del día + medallas por hitos (3, 6 y 10 tareas). */
function Achievements({ done }: { done: number }) {
  const nextGoal = MILESTONES.find((m) => done < m);
  const Icon = done > 0 ? Flame : Star;
  return (
    <div className="flex flex-col gap-3 border-t border-gray-200/70 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-6 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className={cls("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", done > 0 ? "bg-amber-500/15 text-amber-700" : "bg-gray-100 text-gray-500")}>
          <Icon size={24} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-semibold leading-snug">{done > 0 ? `Llevás ${done} ${done === 1 ? "tarea hecha" : "tareas hechas"} hoy` : "Cada tarea que termines suma"}</div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuemin={0} aria-valuemax={10} aria-valuenow={Math.min(done, 10)} aria-label="Camino a la próxima medalla">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-500 motion-reduce:transition-none" style={{ width: `${nextGoal ? (done / nextGoal) * 100 : 100}%` }} />
          </div>
          <div className="mt-1 text-[14px] text-gray-600">{nextGoal ? `Faltan ${nextGoal - done} para la próxima medalla` : "¡Conseguiste todas las medallas!"}</div>
        </div>
      </div>
      <ul className="flex items-start justify-around gap-3 sm:justify-end" aria-label="Medallas del día">
        {MILESTONES.map((m) => {
          const got = done >= m;
          return (
            <li key={m} className="flex w-16 flex-col items-center gap-1" aria-label={`Medalla de ${m} tareas: ${got ? "conseguida" : "todavía no"}`}>
              <span className={cls("flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-300 motion-reduce:transition-none", got ? "bg-amber-500 text-white shadow-card" : "bg-gray-100 text-gray-500")}>
                <Medal size={22} aria-hidden />
              </span>
              <span className="label-mono text-[12.5px] text-gray-600">{m} tareas</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RoomBoard() {
  const { idx, data } = useApp();
  const [filter, setFilter] = useState<RoomState | "todas">("todas");
  const rooms = idx.roomsSorted.filter((r) => filter === "todas" || idx.roomStates.get(r.id) === filter);
  return (
    <Card
      icon={BedDouble}
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
              <div className="num text-[22px] leading-tight">{r.number}</div>
              <div className="truncate text-[14px] leading-tight">{ROOM_STATE_LABEL[st].split(" ")[0]}</div>
              {open > 0 && <span className="absolute -right-1.5 -top-1.5 min-w-[22px] rounded-full bg-gray-900 px-1.5 py-0.5 text-[13px] font-bold leading-none text-white">{open}</span>}
              {arriving && <span className="absolute -left-1.5 -top-1.5 rounded-full bg-blue-700 px-1.5 py-0.5 text-[13px] font-bold leading-none text-white">llega</span>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-gray-100 px-4 py-3 text-[14px] text-gray-700">
        {(Object.keys(ROOM_STATE_LABEL) as RoomState[]).map((s) => (
          <span key={s} className="flex items-center gap-2">
            <span className={cls("h-2.5 w-2.5 rounded-full ring-2 ring-white/70", ROOM_STATE_DOT[s])} /> {ROOM_STATE_LABEL[s]}
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
