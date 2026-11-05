"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, MessageCircle, Play, RotateCcw, Trash2 } from "lucide-react";
import { useApp } from "./AppProvider";
import { Badge, Button, Drawer, Field, Input, Modal, Select, Textarea, toast } from "./ui";
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
  TASK_TYPE_ICON,
  TASK_TYPE_LABEL,
  TRIGGER_LABEL,
  uid,
} from "@/lib/logic";
import type { Priority, Task, TaskType } from "@/lib/types";

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
  return (
    <button onClick={onOpen} className="w-full rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-gray-400">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-snug text-gray-900">
          {TASK_TYPE_ICON[task.type]} {task.title}
        </span>
        <span className="shrink-0 rounded bg-gray-900 px-1.5 py-0.5 text-xs font-semibold text-white">{room?.number ?? "?"}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Badge className={PRIORITY_CLASS[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>
        {task.trigger !== "manual" && <Badge className="bg-indigo-50 text-indigo-700">⚡ Auto</Badge>}
        {task.blocksRoom && <Badge className="bg-purple-50 text-purple-700">Bloquea hab.</Badge>}
        {overdue && <Badge className="bg-red-50 text-red-700">Vencida</Badge>}
      </div>
      {total > 0 && (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div className={cls("h-full", task.status === "completada" ? "bg-green-500" : "bg-blue-500")} style={{ width: `${(done / total) * 100}%` }} />
          </div>
        </div>
      )}
      <div className="mt-2 flex justify-between text-xs text-gray-500">
        <span>{task.status === "completada" ? `✔ ${staffName(task.completedBy)}` : task.assignedTo ? `👤 ${staffName(task.assignedTo)}` : "Sin asignar"}</span>
        <span>
          {done}/{total} · {fmtDate(task.dueDate).slice(0, 5)}
        </span>
      </div>
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
    if (!assignee?.phone) return toast("La persona asignada no tiene teléfono cargado", "error");
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

  return (
    <Drawer open={!!id} onClose={onClose} title={`${TASK_TYPE_ICON[task.type]} Hab. ${room?.number ?? "?"}`}>
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold leading-snug">{task.title}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge className={task.status === "completada" ? "bg-green-50 text-green-700" : task.status === "en_progreso" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-700"}>
              {TASK_STATUS_LABEL[task.status]}
            </Badge>
            <Badge className={PRIORITY_CLASS[task.priority]}>Prioridad {PRIORITY_LABEL[task.priority].toLowerCase()}</Badge>
            <Badge className="bg-indigo-50 text-indigo-700">{TRIGGER_LABEL[task.trigger]}</Badge>
            {task.blocksRoom && <Badge className="bg-purple-50 text-purple-700">Bloquea la habitación</Badge>}
          </div>
          {task.notes && <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{task.notes}</p>}
          {res && (
            <p className="mt-2 text-xs text-gray-500">
              Vinculada a la reserva de <b>{res.guestName}</b> ({fmtDate(res.checkIn)} → {fmtDate(res.checkOut)})
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Asignada a">
            <Select value={task.assignedTo ?? ""} onChange={(e) => actions.assignTask(task, e.target.value)} disabled={!canManage && task.assignedTo !== me?.id && !!task.assignedTo}>
              <option value="">— Sin asignar —</option>
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
            <div className="mb-1 text-xs font-medium text-gray-600">Vence</div>
            <div className="py-2">{fmtDate(task.dueDate)}</div>
          </div>
        </div>

        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Checklist</h4>
          <ul className="space-y-1">
            {task.checklist.map((c, i) => (
              <li key={i}>
                <button
                  onClick={() => actions.toggleChecklist(task, i)}
                  disabled={task.status === "completada"}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-50 disabled:cursor-default"
                >
                  {c.done ? <CheckCircle2 size={18} className="mt-px shrink-0 text-green-600" /> : <Circle size={18} className="mt-px shrink-0 text-gray-300" />}
                  <span className="flex-1">
                    <span className={c.done ? "text-gray-500 line-through" : ""}>{c.label}</span>
                    {c.done && c.doneBy && (
                      <span className="block text-xs text-gray-400">
                        {staffName(c.doneBy)} · {fmtDateTime(c.doneAt)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
            {task.checklist.length === 0 && <li className="text-sm text-gray-500">Sin ítems.</li>}
          </ul>
        </section>

        <div className="flex flex-wrap gap-2">
          {task.status === "pendiente" && (
            <Button variant="primary" onClick={() => actions.setTaskStatus(task, "en_progreso")}>
              <Play size={15} /> Empezar
            </Button>
          )}
          {task.status !== "completada" && (
            <Button
              variant="success"
              onClick={() => {
                actions.setTaskStatus(task, "completada");
                toast(`Tarea completada por ${me?.name}`);
              }}
            >
              <CheckCircle2 size={15} /> Marcar completada
            </Button>
          )}
          {task.status === "completada" && (
            <Button onClick={() => actions.setTaskStatus(task, "pendiente")}>
              <RotateCcw size={15} /> Reabrir
            </Button>
          )}
          {assignee && task.status !== "completada" && (
            <Button onClick={notify}>
              <MessageCircle size={15} /> Avisar por WhatsApp
            </Button>
          )}
        </div>

        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Quién hizo qué</h4>
          <dl className="mb-3 grid grid-cols-1 gap-1 text-sm">
            <div>
              <span className="text-gray-500">Creada:</span> {fmtDateTime(task.createdAt)} por {staffName(task.createdBy)}
            </div>
            {task.startedAt && (
              <div>
                <span className="text-gray-500">Iniciada:</span> {fmtDateTime(task.startedAt)} por {staffName(task.startedBy)}
              </div>
            )}
            {task.completedAt && (
              <div>
                <span className="text-gray-500">Completada:</span> {fmtDateTime(task.completedAt)} por <b>{staffName(task.completedBy)}</b>
              </div>
            )}
          </dl>
          <ol className="relative space-y-2 border-l border-gray-200 pl-4">
            {[...(task.log ?? [])].reverse().map((l, i) => (
              <li key={i} className="text-sm">
                <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-gray-400" />
                <span className="font-medium">{staffName(l.by)}</span> — {l.action}
                <div className="text-xs text-gray-400">{fmtDateTime(l.at)}</div>
              </li>
            ))}
          </ol>
        </section>

        {me && ["admin", "gerente", "recepcion"].includes(me.role) && (
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600"
            onClick={() => {
              if (confirm("¿Eliminar la tarea?")) {
                actions.deleteTask(task);
                onClose();
              }
            }}
          >
            <Trash2 size={14} /> Eliminar tarea
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
    toast("Tarea creada");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva tarea de mantenimiento"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save}>
            Crear tarea
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Habitación">
          <Select value={room} onChange={(e) => setRoom(e.target.value)}>
            <option value="">— Elegir —</option>
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
        <Field label="Tipo">
          <Select value={type} onChange={(e) => setType(e.target.value as TaskType)}>
            {(Object.keys(TASK_TYPE_LABEL) as TaskType[]).map((k) => (
              <option key={k} value={k}>
                {TASK_TYPE_ICON[k]} {TASK_TYPE_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Título" className="sm:col-span-2">
          <Input placeholder={TASK_TEMPLATES[type].title} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Prioridad">
          <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Vence">
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field label="Asignar a" className="sm:col-span-2" hint={`Sugerido: ${ROLE_LABEL[TASK_DEFAULT_ROLE[type]]}`}>
          <Select value={assigned} onChange={(e) => setAssigned(e.target.value)}>
            <option value="">— Sin asignar —</option>
            {suggested.map((s) => (
              <option key={s.id} value={s.id}>
                ★ {s.name}
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
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={blocks} onChange={(e) => setBlocks(e.target.checked)} />
          Bloquear la habitación hasta completar (no se puede vender / aparece rayada en el calendario)
        </label>
        <Field label="Checklist" className="sm:col-span-2" hint="Se incluyen los ítems estándar del tipo. Agregá ítems extra, uno por línea.">
          <Textarea rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={TASK_TEMPLATES[type].checklist.join(" · ")} />
        </Field>
        <Field label="Notas" className="sm:col-span-2">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
