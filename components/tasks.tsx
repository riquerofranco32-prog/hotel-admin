"use client";
import { useEffect, useState } from "react";
import {
  BedDouble,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Flame,
  History,
  ListChecks,
  MessageCircle,
  Play,
  PlusCircle,
  RotateCcw,
  StickyNote,
  Timer,
  Trash2,
  User,
  UserCheck,
  Zap,
} from "lucide-react";
import { useApp } from "./AppProvider";
import {
  Avatar,
  Badge,
  Button,
  Drawer,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
  toast,
} from "./ui";
import { buildTask } from "@/lib/automation";
import { fmtDate, fmtDateTime, today } from "@/lib/dates";
import {
  cls,
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  ROLE_LABEL,
  TASK_DEFAULT_ROLE,
  TASK_STATUS_LABEL,
  TASK_TEMPLATES,
  TASK_TYPE_LABEL,
  TRIGGER_LABEL,
  uid,
} from "@/lib/logic";
import type { Priority, Task, TaskType } from "@/lib/types";
import {
  AnimatedCheck,
  Elapsed,
  fireConfetti,
  formatDuration,
  TaskIcon,
  vibrate,
} from "./TaskIcon";

/** Cabecera de la ficha según prioridad (degradé con texto legible). */
const PRIORITY_HEAD: Record<Priority, string> = {
  urgente: "bg-gradient-to-br from-red-700 to-red-500 text-white",
  alta: "bg-gradient-to-br from-amber-800 to-amber-600 text-white",
  media: "bg-gradient-to-br from-accent to-accent/75 text-accent-fg",
  baja: "bg-gradient-to-br from-accent/15 to-accent/5 text-fg",
};

/** Ícono y color de cada paso de la línea de tiempo, según lo que dice el registro. */
function logLook(action: string): { icon: React.ElementType; box: string } {
  const a = action.toLowerCase();
  if (/reabri|volvi|pendiente/.test(a))
    return { icon: RotateCcw, box: "bg-amber-500/15 text-amber-700" };
  if (/termin|complet|list[ao]/.test(a))
    return { icon: CheckCircle2, box: "bg-green-500/15 text-green-700" };
  if (/empez|inici|comenz/.test(a))
    return { icon: Play, box: "bg-blue-500/15 text-blue-700" };
  if (/asign|responsable/.test(a))
    return { icon: UserCheck, box: "bg-indigo-500/15 text-indigo-700" };
  if (/cre/.test(a))
    return { icon: PlusCircle, box: "bg-accent/10 text-accent" };
  return { icon: Circle, box: "bg-gray-900/10 text-gray-700" };
}

export function fillTemplate(body: string, vars: Record<string, string>) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

export function waLink(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export const PRIORITY_BAR: Record<Priority, string> = {
  urgente: "border-l-red-600",
  alta: "border-l-amber-500",
  media: "border-l-accent",
  baja: "border-l-gray-300",
};

function SectionHead({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <h4 className="label-mono flex items-center gap-2.5 border-t border-gray-200/80 pt-4 text-[12.5px] font-semibold text-gray-700 first:border-t-0 first:pt-0 sm:col-span-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon size={17} aria-hidden />
      </span>
      {children}
    </h4>
  );
}

export function TaskCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { data, staffName } = useApp();
  const room = data.rooms.find((r) => r.id === task.roomId);
  const done = task.checklist.filter((c) => c.done).length;
  const total = task.checklist.length;
  const overdue = task.status !== "completada" && task.dueDate < today();
  const accent =
    task.status === "completada"
      ? "border-l-green-500"
      : task.priority === "urgente" || overdue
        ? "border-l-red-600"
        : PRIORITY_BAR[task.priority];
  const who = task.status === "completada" ? task.completedBy : task.assignedTo;
  return (
    <button
      onClick={onOpen}
      className={cls(
        "lift w-full rounded-xl border border-l-[6px] border-gray-200/80 bg-white p-3.5 text-left shadow-card focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/30",
        accent,
        overdue && "bg-red-50/40",
      )}
    >
      <span className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <TaskIcon type={task.type} size={20} className="!mr-0 align-middle" />
        </span>
        <span className="block min-w-0 flex-1 text-[16px] font-semibold leading-snug text-gray-900">
          {task.title}
        </span>
        <span className="flex shrink-0 flex-col items-center rounded-lg bg-gray-900 px-2.5 py-1 text-white">
          <BedDouble size={13} className="opacity-70" aria-hidden />
          <span className="num text-[20px] leading-none">
            {room?.number ?? "?"}
          </span>
        </span>
      </span>
      <span className="mt-2.5 flex flex-wrap gap-1.5">
        <Badge className={PRIORITY_CLASS[task.priority]}>
          {task.priority === "urgente" && (
            <Flame
              size={13}
              className="mr-0.5 inline-block align-[-2px]"
              aria-hidden
            />
          )}
          {PRIORITY_LABEL[task.priority]}
        </Badge>
        {task.status === "en_progreso" && task.startedAt && (
          <Badge className="bg-blue-50 text-blue-700">
            <Timer
              size={13}
              className="mr-0.5 inline-block align-[-2px]"
              aria-hidden
            />{" "}
            <Elapsed since={task.startedAt} prefix="" />
          </Badge>
        )}
        {task.trigger !== "manual" && (
          <Badge className="bg-indigo-50 text-indigo-700">
            <Zap size={13} className="mr-0.5 inline-block" aria-hidden />{" "}
            Automática
          </Badge>
        )}
        {task.blocksRoom && (
          <Badge className="bg-purple-50 text-purple-700">
            Habitación no disponible
          </Badge>
        )}
        {overdue && <Badge className="bg-red-50 text-red-700">Atrasada</Badge>}
      </span>
      <span className="mt-3 flex items-center gap-2 text-[15px] text-gray-700">
        {who ? (
          <>
            <Avatar name={staffName(who)} size={26} />
            <span className="min-w-0 flex-1 truncate">
              {task.status === "completada" && (
                <Check
                  size={16}
                  className="mr-1 inline-block align-[-3px] text-green-600"
                  aria-hidden
                />
              )}
              {staffName(who)}
            </span>
          </>
        ) : (
          <span className="flex-1 text-gray-600">Sin responsable</span>
        )}
        <span className="shrink-0 text-[14px] tabular-nums text-gray-600">
          {fmtDate(task.dueDate).slice(0, 5)}
        </span>
      </span>
      {total > 0 && (
        <>
          <span className="mt-2.5 block h-2 overflow-hidden rounded-full bg-gray-100 ring-1 ring-inset ring-gray-200/60">
            <span
              className={cls(
                "block h-full rounded-full transition-all duration-500 motion-reduce:transition-none",
                task.status === "completada" ? "bg-green-500" : "bg-accent",
              )}
              style={{ width: `${(done / total) * 100}%` }}
            />
          </span>
          <span className="mt-1.5 block text-[14px] text-gray-600">
            {done} de {total} pasos
          </span>
        </>
      )}
    </button>
  );
}

export function TaskDrawer({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const { data, actions, staffName, me, can } = useApp();
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return null;
  const room = data.rooms.find((r) => r.id === task.roomId);
  const res = data.reservations.find((r) => r.id === task.reservationId);
  const assignee = data.staff.find((s) => s.id === task.assignedTo);
  const canManage = can("gestionar_tareas");
  const settings = data.settings[0];

  function notify() {
    if (!assignee?.phone)
      return toast("Esa persona no tiene teléfono cargado", "error");
    const tpl =
      data.templates.find((t) => t.id === "tpl_staff_tarea")?.body ??
      "Tarea: {{tarea}} · Hab. {{habitacion}}";
    const body = fillTemplate(tpl, {
      nombre: assignee.name.split(" ")[0],
      tarea: task!.title,
      habitacion: room?.number ?? "",
      prioridad: PRIORITY_LABEL[task!.priority].toLowerCase(),
      vence: fmtDate(task!.dueDate),
      hotel: settings?.hotelName ?? "",
    });
    window.open(waLink(assignee.phone, body), "_blank");
    actions.logMessage({
      to: assignee.id,
      toName: assignee.name,
      phone: assignee.phone,
      body,
      taskId: task!.id,
    });
  }

  const doneSteps = task.checklist.filter((c) => c.done).length;
  const totalSteps = task.checklist.length;
  const sectionTitle =
    "label-mono mb-2.5 flex items-center gap-2 text-[12.5px] font-semibold text-gray-700";

  return (
    <Drawer
      open={!!id}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <TaskIcon type={task.type} size={20} /> Habitación{" "}
          {room?.number ?? "?"}
        </span>
      }
    >
      <div className="space-y-6">
        <section className="space-y-3">
          <div
            className={cls(
              "relative overflow-hidden rounded-2xl p-4 shadow-card",
              PRIORITY_HEAD[task.priority],
            )}
          >
            <div className="flex items-start gap-3.5">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30">
                <TaskIcon
                  type={task.type}
                  size={26}
                  className="!mr-0 align-middle"
                />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[19px] font-semibold leading-snug">
                  {task.title}
                </h3>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <Badge
                    className={
                      task.status === "completada"
                        ? "bg-green-50 text-green-700"
                        : task.status === "en_progreso"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-gray-100 text-gray-700"
                    }
                  >
                    {TASK_STATUS_LABEL[task.status]}
                  </Badge>
                  <Badge className={PRIORITY_CLASS[task.priority]}>
                    Prioridad {PRIORITY_LABEL[task.priority].toLowerCase()}
                  </Badge>
                  <Badge className="bg-indigo-50 text-indigo-700">
                    {TRIGGER_LABEL[task.trigger]}
                  </Badge>
                  {task.blocksRoom && (
                    <Badge className="bg-purple-50 text-purple-700">
                      La habitación no se puede usar
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          {task.notes && (
            <p className="flex gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-[15px] text-amber-900">
              <StickyNote size={18} className="mt-0.5 shrink-0" aria-hidden />{" "}
              <span>{task.notes}</span>
            </p>
          )}
          {res && (
            <p className="text-[15px] text-gray-700">
              Es por la reserva de <b>{res.guestName}</b> (
              {fmtDate(res.checkIn)} → {fmtDate(res.checkOut)})
            </p>
          )}
        </section>

        <section className="grid gap-3 rounded-xl border border-gray-200/80 bg-gray-50 p-3.5 text-[15px] sm:grid-cols-2">
          <Field label="Responsable">
            <Select
              className="h-11"
              value={task.assignedTo ?? ""}
              onChange={(e) => actions.assignTask(task, e.target.value)}
              disabled={
                !canManage && task.assignedTo !== me?.id && !!task.assignedTo
              }
            >
              <option value="">Sin responsable</option>
              {data.staff
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({ROLE_LABEL[s.role].split(" ")[0]})
                  </option>
                ))}
            </Select>
          </Field>
          <div>
            <div className="label-mono mb-1.5 text-[12.5px] text-gray-600">
              Para el día
            </div>
            <div className="flex h-11 items-center gap-2 font-medium">
              <CalendarDays
                size={18}
                className="shrink-0 text-gray-500"
                aria-hidden
              />{" "}
              {fmtDate(task.dueDate)}
            </div>
          </div>
        </section>

        <section>
          <h4 className={sectionTitle}>
            <ListChecks size={18} className="text-gray-500" aria-hidden /> Pasos
            a seguir
            {totalSteps > 0 && (
              <span className="ml-auto text-[14px] font-normal tabular-nums text-gray-600">
                {doneSteps} de {totalSteps}
              </span>
            )}
          </h4>
          {totalSteps > 0 && (
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className={cls(
                  "h-full rounded-full transition-all duration-200 motion-reduce:transition-none",
                  doneSteps === totalSteps ? "bg-green-500" : "bg-accent",
                )}
                style={{ width: `${(doneSteps / totalSteps) * 100}%` }}
              />
            </div>
          )}
          <ul className="space-y-2">
            {task.checklist.map((c, i) => (
              <li key={i}>
                <button
                  onClick={() => {
                    vibrate();
                    actions.toggleChecklist(task, i);
                  }}
                  disabled={task.status === "completada"}
                  className={cls(
                    "flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[16px] leading-snug transition-colors duration-200 disabled:cursor-default motion-reduce:transition-none",
                    c.done
                      ? "border-green-200 bg-green-50"
                      : "border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100",
                  )}
                >
                  <AnimatedCheck done={c.done} size={28} />
                  <span className="flex-1">
                    <span
                      className={
                        c.done
                          ? "text-gray-600 line-through decoration-green-600/50"
                          : "font-medium"
                      }
                    >
                      {c.label}
                    </span>
                    {c.done && c.doneBy && (
                      <span className="block text-[14px] text-gray-600">
                        {staffName(c.doneBy)} · {fmtDateTime(c.doneAt)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
            {task.checklist.length === 0 && (
              <li className="px-2.5 text-[15px] text-gray-600">
                No hay pasos cargados.
              </li>
            )}
          </ul>
        </section>

        <div className="grid gap-2 sm:flex sm:flex-wrap">
          {task.status === "pendiente" && (
            <Button
              variant="primary"
              className="h-11 text-[15px]"
              onClick={() => actions.setTaskStatus(task, "en_progreso")}
            >
              <Play size={17} /> Empezar
            </Button>
          )}
          {task.status !== "completada" && (
            <Button
              variant="success"
              className="h-11 text-[15px]"
              onClick={() => {
                actions.setTaskStatus(task, "completada");
                vibrate(25);
                fireConfetti("¡Muy bien, una menos!");
                toast("Tarea terminada ✔");
              }}
            >
              <CheckCircle2 size={17} /> Ya está terminada
            </Button>
          )}
          {task.status === "completada" && (
            <Button
              className="h-11 text-[15px]"
              onClick={() => actions.setTaskStatus(task, "pendiente")}
            >
              <RotateCcw size={17} /> Volver a abrir
            </Button>
          )}
          {assignee && task.status !== "completada" && (
            <Button className="h-11 text-[15px]" onClick={notify}>
              <MessageCircle size={17} /> Avisar por WhatsApp
            </Button>
          )}
        </div>

        <section>
          <h4 className={sectionTitle}>
            <History size={18} className="text-gray-500" aria-hidden /> Quién
            hizo qué
          </h4>
          {task.status === "en_progreso" && task.startedAt && (
            <p className="mb-3 flex items-center gap-2 rounded-xl bg-blue-50 px-3.5 py-2.5 text-[15px] font-medium text-blue-700">
              <Timer size={18} aria-hidden />{" "}
              <Elapsed since={task.startedAt} prefix="Empezada " />
            </p>
          )}
          {task.status === "completada" &&
            formatDuration(task.startedAt, task.completedAt) && (
              <p className="mb-3 flex items-center gap-2 rounded-xl bg-green-50 px-3.5 py-2.5 text-[15px] font-medium text-green-700">
                <Timer size={18} aria-hidden /> Se hizo en{" "}
                {formatDuration(task.startedAt, task.completedAt)}
              </p>
            )}
          <dl className="mb-4 grid grid-cols-1 gap-1 rounded-xl border border-gray-200/80 bg-gray-50 px-3.5 py-3 text-[15px]">
            <div>
              <span className="text-gray-600">Creada:</span>{" "}
              {fmtDateTime(task.createdAt)} por {staffName(task.createdBy)}
            </div>
            {task.startedAt && (
              <div>
                <span className="text-gray-600">Empezada:</span>{" "}
                {fmtDateTime(task.startedAt)} por {staffName(task.startedBy)}
              </div>
            )}
            {task.completedAt && (
              <div>
                <span className="text-gray-600">Terminada:</span>{" "}
                {fmtDateTime(task.completedAt)} por{" "}
                <b>{staffName(task.completedBy)}</b>
              </div>
            )}
          </dl>
          <ol className="ml-4 space-y-4 border-l-2 border-accent/25 pl-8">
            {[...(task.log ?? [])].reverse().map((l, i) => {
              const look = logLook(l.action);
              return (
                <li key={i} className="relative text-[15px]">
                  <span
                    className={cls(
                      "absolute -left-[50px] top-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white",
                      look.box,
                      i === 0 && "ring-4 ring-accent/20",
                    )}
                  >
                    <look.icon size={17} aria-hidden />
                  </span>
                  <span className="font-medium">{staffName(l.by)}</span> —{" "}
                  {l.action}
                  <div className="text-[14px] text-gray-600">
                    {fmtDateTime(l.at)}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {me && ["admin", "gerente", "recepcion"].includes(me.role) && (
          <Button
            size="sm"
            variant="ghost"
            className="h-10 text-red-600"
            onClick={() => {
              if (confirm("¿Borrar esta tarea?\n\nNo se puede deshacer.")) {
                actions.deleteTask(task);
                onClose();
              }
            }}
          >
            <Trash2 size={15} /> Borrar tarea
          </Button>
        )}
      </div>
    </Drawer>
  );
}

export function NewTaskModal({
  open,
  onClose,
  roomId,
}: {
  open: boolean;
  onClose: () => void;
  roomId?: string;
}) {
  const { data, actions, me } = useApp();
  const [type, setType] = useState<TaskType>("reparacion");
  const [room, setRoom] = useState(roomId ?? "");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("alta");
  const [due, setDue] = useState(today());
  const [assigned, setAssigned] = useState("");
  const [blocks, setBlocks] = useState(false);
  const [notes, setNotes] = useState("");
  const [extra, setExtra] = useState("");

  useEffect(() => {
    if (!open) return;
    setRoom(roomId ?? "");
    setTitle("");
    setNotes("");
    setExtra("");
    setBlocks(false);
    setDue(today());
    setType("reparacion");
    setPriority("alta");
    setAssigned("");
  }, [open, roomId]);

  useEffect(() => setPriority(TASK_TEMPLATES[type].priority), [type]);

  const suggested = data.staff.filter(
    (s) => s.active && s.role === TASK_DEFAULT_ROLE[type],
  );

  async function save() {
    if (!room) return toast("Elegí una habitación", "error");
    const t = buildTask({
      id: uid("task"),
      type,
      roomId: room,
      trigger: "manual",
      dueDate: due,
      createdBy: me?.id,
      assignedTo: assigned || undefined,
      title: title.trim() || TASK_TEMPLATES[type].title,
      priority,
      blocksRoom: blocks,
      notes: notes.trim() || undefined,
    });
    extra
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((label) => t.checklist.push({ label, done: false }));
    await actions.saveTask(t);
    toast("Tarea creada ✔");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva tarea"
      footer={
        <>
          <Button className="h-11" onClick={onClose}>
            Cerrar sin guardar
          </Button>
          <Button variant="primary" className="h-11" onClick={save}>
            Crear tarea
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5 sm:grid-cols-2">
        <SectionHead icon={BedDouble}>La tarea</SectionHead>
        <Field label="Habitación">
          <Select
            className="h-11"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
          >
            <option value="">Elegí una habitación</option>
            {data.rooms
              .slice()
              .sort((a, b) =>
                a.number.localeCompare(b.number, undefined, { numeric: true }),
              )
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Qué hay que hacer">
          <Select
            className="h-11"
            value={type}
            onChange={(e) => setType(e.target.value as TaskType)}
          >
            {(Object.keys(TASK_TYPE_LABEL) as TaskType[]).map((k) => (
              <option key={k} value={k}>
                {TASK_TYPE_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nombre de la tarea" className="sm:col-span-2">
          <Input
            className="h-11"
            placeholder={TASK_TEMPLATES[type].title}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <SectionHead icon={User}>Cuándo y quién</SectionHead>
        <Field label="¿Qué tan urgente es?">
          <Select
            className="h-11"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Para qué día">
          <Input
            className="h-11"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </Field>
        <Field
          label="¿Quién lo hace?"
          className="sm:col-span-2"
          hint={`Lo recomendado: ${ROLE_LABEL[TASK_DEFAULT_ROLE[type]]}`}
        >
          <Select
            className="h-11"
            value={assigned}
            onChange={(e) => setAssigned(e.target.value)}
          >
            <option value="">Todavía no sé</option>
            {suggested.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (recomendado)
              </option>
            ))}
            {data.staff
              .filter((s) => s.active && !suggested.includes(s))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({ROLE_LABEL[s.role]})
                </option>
              ))}
          </Select>
        </Field>
        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-[15px] sm:col-span-2">
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 accent-accent"
            checked={blocks}
            onChange={(e) => setBlocks(e.target.checked)}
          />
          <span>
            La habitación no se puede usar hasta que se termine (se ve rayada en
            el calendario)
          </span>
        </label>

        <SectionHead icon={ListChecks}>Detalles</SectionHead>
        <Field
          label="Pasos extra (opcional)"
          className="sm:col-span-2"
          hint="Ya están los pasos de siempre. Si querés agregar otros, escribí uno por línea."
        >
          <Textarea
            rows={2}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder={TASK_TEMPLATES[type].checklist.join(" · ")}
          />
        </Field>
        <Field label="Notas (opcional)" className="sm:col-span-2">
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
