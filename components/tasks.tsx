"use client";
import { useEffect, useState } from "react";
import { BedDouble, CalendarDays, Check, CheckCircle2, Circle, History, ListChecks, MessageCircle, Play, RotateCcw, StickyNote, Trash2, User, Zap } from "lucide-react";
import { useApp } from "./AppProvider";
import { Badge, Button, Drawer, Field, Input, Modal, Select, Textarea, toast } from "./ui";
import { buildTask } from "@/lib/automation";
import { fmtDate, fmtDateTime, today } from "@/lib/dates";
import { cls, PRIORITY_CLASS, PRIORITY_LABEL, ROLE_LABEL, TASK_DEFAULT_ROLE, TASK_STATUS_LABEL, TASK_TEMPLATES, TASK_TYPE_LABEL, TRIGGER_LABEL, uid } from "@/lib/logic";
import type { Priority, Task, TaskType } from "@/lib/types";
import { TaskIcon } from "./TaskIcon";

export function fillTemplate(body: string, vars: Record<string, string>) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

export function waLink(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
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
        ? "border-l-red-500"
        : task.status === "en_progreso"
          ? "border-l-blue-500"
          : "border-l-gray-300";
  return (
    <button
      onClick={onOpen}
      className={cls(
        "w-full rounded-xl border border-l-4 border-gray-200 bg-white p-3.5 text-left shadow-card transition duration-150 hover:border-gray-300 hover:shadow-pop focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/30 motion-reduce:transition-none",
        accent,
      )}
    >
      <span className="block text-[16px] font-semibold leading-snug text-gray-900">
        <TaskIcon type={task.type} /> {task.title}
      </span>
      <span className="mt-1.5 flex items-center gap-1.5 text-[15px] font-medium text-gray-700">
        <BedDouble size={16} className="shrink-0 text-gray-500" aria-hidden />
        <span className="rounded-md bg-gray-900 px-2 py-0.5 text-[14px] font-semibold text-white">{room?.number ?? "?"}</span>
      </span>
      <span className="mt-2 flex flex-wrap gap-1.5">
        <Badge className={PRIORITY_CLASS[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>
        {task.trigger !== "manual" && (
          <Badge className="bg-indigo-50 text-indigo-700">
            <Zap size={13} className="mr-0.5 inline-block" aria-hidden /> Automática
          </Badge>
        )}
        {task.blocksRoom && <Badge className="bg-purple-50 text-purple-700">Habitación no disponible</Badge>}
        {overdue && <Badge className="bg-red-50 text-red-700">Atrasada</Badge>}
      </span>
      <span className="mt-2.5 block text-[15px] text-gray-700">
        {task.status === "completada" ? (
          <>
            <Check size={16} className="inline-block align-[-3px] text-green-600" aria-hidden /> {staffName(task.completedBy)}
          </>
        ) : task.assignedTo ? (
          <>
            <User size={16} className="inline-block align-[-3px] text-gray-500" aria-hidden /> {staffName(task.assignedTo)}
          </>
        ) : (
          <span className="text-gray-600">Sin responsable</span>
        )}
      </span>
      {total > 0 && (
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-gray-100">
          <span
            className={cls("block h-full rounded-full transition-all duration-200 motion-reduce:transition-none", task.status === "completada" ? "bg-green-500" : "bg-blue-500")}
            style={{ width: `${(done / total) * 100}%` }}
          />
        </span>
      )}
      <span className="mt-1.5 flex justify-between gap-2 text-[14px] text-gray-600">
        <span>
          {done} de {total} pasos
        </span>
        <span className="tabular-nums">{fmtDate(task.dueDate).slice(0, 5)}</span>
      </span>
    </button>
  );
}

export function TaskDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, actions, staffName, me, can } = useApp();
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return null;
  const room = data.rooms.find((r) => r.id === task.roomId);
  const res = data.reservations.find((r) => r.id === task.reservationId);
  const assignee = data.staff.find((s) => s.id === task.assignedTo);
  const canManage = can("gestionar_tareas");
  const settings = data.settings[0];

  function notify() {
    if (!assignee?.phone) return toast("Esa persona no tiene teléfono cargado", "error");
    const tpl = data.templates.find((t) => t.id === "tpl_staff_tarea")?.body ?? "Tarea: {{tarea}} · Hab. {{habitacion}}";
    const body = fillTemplate(tpl, {
      nombre: assignee.name.split(" ")[0],
      tarea: task!.title,
      habitacion: room?.number ?? "",
      prioridad: PRIORITY_LABEL[task!.priority].toLowerCase(),
      vence: fmtDate(task!.dueDate),
      hotel: settings?.hotelName ?? "",
    });
    window.open(waLink(assignee.phone, body), "_blank");
    actions.logMessage({ to: assignee.id, toName: assignee.name, phone: assignee.phone, body, taskId: task!.id });
  }

  const doneSteps = task.checklist.filter((c) => c.done).length;
  const totalSteps = task.checklist.length;
  const sectionTitle = "mb-2.5 flex items-center gap-2 text-[15px] font-semibold text-gray-900";

  return (
    <Drawer open={!!id} onClose={onClose} title={
        <span className="flex items-center gap-2">
          <TaskIcon type={task.type} size={20} /> Habitación {room?.number ?? "?"}
        </span>
      }>
      <div className="space-y-6">
        <section>
          <h3 className="text-[19px] font-semibold leading-snug">{task.title}</h3>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Badge className={task.status === "completada" ? "bg-green-50 text-green-700" : task.status === "en_progreso" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-700"}>
              {TASK_STATUS_LABEL[task.status]}
            </Badge>
            <Badge className={PRIORITY_CLASS[task.priority]}>Prioridad {PRIORITY_LABEL[task.priority].toLowerCase()}</Badge>
            <Badge className="bg-indigo-50 text-indigo-700">{TRIGGER_LABEL[task.trigger]}</Badge>
            {task.blocksRoom && <Badge className="bg-purple-50 text-purple-700">La habitación no se puede usar</Badge>}
          </div>
          {task.notes && (
            <p className="mt-3 flex gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-[15px] text-amber-900">
              <StickyNote size={17} className="mt-0.5 shrink-0" aria-hidden /> <span>{task.notes}</span>
            </p>
          )}
          {res && (
            <p className="mt-2.5 text-[15px] text-gray-700">
              Es por la reserva de <b>{res.guestName}</b> ({fmtDate(res.checkIn)} → {fmtDate(res.checkOut)})
            </p>
          )}
        </section>

        <section className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3.5 text-[15px] sm:grid-cols-2">
          <Field label="Responsable">
            <Select className="h-11" value={task.assignedTo ?? ""} onChange={(e) => actions.assignTask(task, e.target.value)} disabled={!canManage && task.assignedTo !== me?.id && !!task.assignedTo}>
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
            <div className="mb-1 text-[14px] font-medium text-gray-700">Para el día</div>
            <div className="flex h-11 items-center gap-2 font-medium">
              <CalendarDays size={18} className="shrink-0 text-gray-500" aria-hidden /> {fmtDate(task.dueDate)}
            </div>
          </div>
        </section>

        <section>
          <h4 className={sectionTitle}>
            <ListChecks size={18} className="text-gray-500" aria-hidden /> Pasos a seguir
            {totalSteps > 0 && (
              <span className="ml-auto text-[14px] font-normal tabular-nums text-gray-600">
                {doneSteps} de {totalSteps}
              </span>
            )}
          </h4>
          {totalSteps > 0 && (
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-gray-100">
              <div className={cls("h-full rounded-full transition-all duration-200 motion-reduce:transition-none", doneSteps === totalSteps ? "bg-green-500" : "bg-accent")} style={{ width: `${(doneSteps / totalSteps) * 100}%` }} />
            </div>
          )}
          <ul className="space-y-1">
            {task.checklist.map((c, i) => (
              <li key={i}>
                <button
                  onClick={() => actions.toggleChecklist(task, i)}
                  disabled={task.status === "completada"}
                  className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[15px] transition-colors duration-150 hover:bg-gray-50 active:bg-gray-100 disabled:cursor-default motion-reduce:transition-none"
                >
                  {c.done ? <CheckCircle2 size={22} className="shrink-0 text-green-600" /> : <Circle size={22} className="shrink-0 text-gray-300" />}
                  <span className="flex-1">
                    <span className={c.done ? "text-gray-600 line-through" : ""}>{c.label}</span>
                    {c.done && c.doneBy && (
                      <span className="block text-[14px] text-gray-600">
                        {staffName(c.doneBy)} · {fmtDateTime(c.doneAt)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
            {task.checklist.length === 0 && <li className="px-2.5 text-[15px] text-gray-600">No hay pasos cargados.</li>}
          </ul>
        </section>

        <div className="grid gap-2 sm:flex sm:flex-wrap">
          {task.status === "pendiente" && (
            <Button variant="primary" className="h-11 text-[15px]" onClick={() => actions.setTaskStatus(task, "en_progreso")}>
              <Play size={17} /> Empezar
            </Button>
          )}
          {task.status !== "completada" && (
            <Button
              variant="success"
              className="h-11 text-[15px]"
              onClick={() => {
                actions.setTaskStatus(task, "completada");
                toast("Tarea terminada ✔");
              }}
            >
              <CheckCircle2 size={17} /> Ya está terminada
            </Button>
          )}
          {task.status === "completada" && (
            <Button className="h-11 text-[15px]" onClick={() => actions.setTaskStatus(task, "pendiente")}>
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
            <History size={18} className="text-gray-500" aria-hidden /> Quién hizo qué
          </h4>
          <dl className="mb-4 grid grid-cols-1 gap-1 rounded-xl bg-gray-50 px-3.5 py-3 text-[15px]">
            <div>
              <span className="text-gray-600">Creada:</span> {fmtDateTime(task.createdAt)} por {staffName(task.createdBy)}
            </div>
            {task.startedAt && (
              <div>
                <span className="text-gray-600">Empezada:</span> {fmtDateTime(task.startedAt)} por {staffName(task.startedBy)}
              </div>
            )}
            {task.completedAt && (
              <div>
                <span className="text-gray-600">Terminada:</span> {fmtDateTime(task.completedAt)} por <b>{staffName(task.completedBy)}</b>
              </div>
            )}
          </dl>
          <ol className="ml-1.5 space-y-4 border-l-2 border-gray-200 pl-5">
            {[...(task.log ?? [])].reverse().map((l, i) => (
              <li key={i} className="relative text-[15px]">
                <span className={cls("absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white", i === 0 ? "bg-accent" : "bg-gray-400")} />
                <span className="font-medium">{staffName(l.by)}</span> — {l.action}
                <div className="text-[14px] text-gray-600">{fmtDateTime(l.at)}</div>
              </li>
            ))}
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

export function NewTaskModal({ open, onClose, roomId }: { open: boolean; onClose: () => void; roomId?: string }) {
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

  const suggested = data.staff.filter((s) => s.active && s.role === TASK_DEFAULT_ROLE[type]);

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

  const sectionHead = "border-t border-gray-100 pt-3 text-[15px] font-semibold text-gray-900 first:border-t-0 first:pt-0 sm:col-span-2";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva tarea"
      footer={
        <>
          <Button className="h-11" onClick={onClose}>Cerrar sin guardar</Button>
          <Button variant="primary" className="h-11" onClick={save}>
            Crear tarea
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5 sm:grid-cols-2">
        <h4 className={sectionHead}>La tarea</h4>
        <Field label="Habitación">
          <Select className="h-11" value={room} onChange={(e) => setRoom(e.target.value)}>
            <option value="">Elegí una habitación</option>
            {data.rooms
              .slice()
              .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Qué hay que hacer">
          <Select className="h-11" value={type} onChange={(e) => setType(e.target.value as TaskType)}>
            {(Object.keys(TASK_TYPE_LABEL) as TaskType[]).map((k) => (
              <option key={k} value={k}>
                {TASK_TYPE_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nombre de la tarea" className="sm:col-span-2">
          <Input className="h-11" placeholder={TASK_TEMPLATES[type].title} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>

        <h4 className={sectionHead}>Cuándo y quién</h4>
        <Field label="¿Qué tan urgente es?">
          <Select className="h-11" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Para qué día">
          <Input className="h-11" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field label="¿Quién lo hace?" className="sm:col-span-2" hint={`Lo recomendado: ${ROLE_LABEL[TASK_DEFAULT_ROLE[type]]}`}>
          <Select className="h-11" value={assigned} onChange={(e) => setAssigned(e.target.value)}>
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
          <input type="checkbox" className="h-5 w-5 shrink-0 accent-teal-600" checked={blocks} onChange={(e) => setBlocks(e.target.checked)} />
          <span>La habitación no se puede usar hasta que se termine (se ve rayada en el calendario)</span>
        </label>

        <h4 className={sectionHead}>Detalles</h4>
        <Field label="Pasos extra (opcional)" className="sm:col-span-2" hint="Ya están los pasos de siempre. Si querés agregar otros, escribí uno por línea.">
          <Textarea rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={TASK_TEMPLATES[type].checklist.join(" · ")} />
        </Field>
        <Field label="Notas (opcional)" className="sm:col-span-2">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
