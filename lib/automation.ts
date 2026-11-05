// Motor de automatizaciones: conecta el estado de las reservas con el área de mantenimiento.
// Es idempotente: cada tarea automática tiene un ID determinístico (reserva + tipo),
// así que correrlo muchas veces (o desde varias PCs a la vez) no duplica tareas.
import { addDays, nowISO, today } from "./dates";
import { CHECKOUT_SEQUENCE, TASK_DEFAULT_ROLE, TASK_TEMPLATES } from "./logic";
import type { DataState, Reservation, Staff, Task, TaskTrigger, TaskType } from "./types";

export function buildTask(params: {
  id: string;
  type: TaskType;
  roomId: string;
  reservationId?: string;
  trigger: TaskTrigger;
  dueDate: string;
  createdBy?: string;
  assignedTo?: string;
  title?: string;
  notes?: string;
  priority?: Task["priority"];
  blocksRoom?: boolean;
}): Task {
  const tpl = TASK_TEMPLATES[params.type];
  return {
    id: params.id,
    roomId: params.roomId,
    reservationId: params.reservationId,
    type: params.type,
    title: params.title ?? tpl.title,
    trigger: params.trigger,
    priority: params.priority ?? tpl.priority,
    status: "pendiente",
    dueDate: params.dueDate,
    assignedTo: params.assignedTo,
    checklist: tpl.checklist.map((label) => ({ label, done: false })),
    blocksRoom: params.blocksRoom,
    notes: params.notes,
    createdAt: nowISO(),
    createdBy: params.createdBy ?? "sistema",
    log: [{ at: nowISO(), by: params.createdBy ?? "sistema", action: "Tarea creada" }],
  };
}

/** Asignación automática: el miembro activo del rol con menos tareas abiertas. */
export function autoAssign(type: TaskType, staff: Staff[], tasks: Task[]): string | undefined {
  const role = TASK_DEFAULT_ROLE[type];
  const candidates = staff.filter((s) => s.active && s.role === role);
  if (!candidates.length) return undefined;
  const load = (id: string) => tasks.filter((t) => t.assignedTo === id && t.status !== "completada").length;
  return candidates.sort((a, b) => load(a.id) - load(b.id))[0].id;
}

export function checkoutTasks(r: Reservation, data: Pick<DataState, "staff" | "tasks">, by = "sistema"): Task[] {
  const created: Task[] = [];
  for (const type of CHECKOUT_SEQUENCE) {
    created.push(
      buildTask({
        id: `${r.id}-${type}`,
        type,
        roomId: r.roomId,
        reservationId: r.id,
        trigger: "checkout",
        dueDate: r.checkOut,
        createdBy: by,
        assignedTo: autoAssign(type, data.staff, [...data.tasks, ...created]),
        notes: `Salida de ${r.guestName}`,
      }),
    );
  }
  return created;
}

/** Calcula qué tareas automáticas faltan crear según el estado actual. */
export function pendingAutomations(data: DataState, t = today()): Task[] {
  const settings = data.settings[0];
  const rules = settings?.rules ?? { preSalida: true, checkoutTasks: true, llegada: true, repasoDiario: false };
  const existing = new Set(data.tasks.map((x) => x.id));
  const out: Task[] = [];
  const push = (task: Task) => {
    if (!existing.has(task.id)) {
      existing.add(task.id);
      out.push(task);
    }
  };
  const tomorrow = addDays(t, 1);
  const allTasks = () => [...data.tasks, ...out];

  for (const r of data.reservations) {
    // 1) Próxima a salir → pre-salida (minibar, consumos, confirmar horario)
    if (rules.preSalida && r.status === "checkin" && r.checkOut <= tomorrow) {
      push(
        buildTask({
          id: `${r.id}-pre_salida`,
          type: "pre_salida",
          roomId: r.roomId,
          reservationId: r.id,
          trigger: "proxima_salida",
          dueDate: r.checkOut,
          assignedTo: autoAssign("pre_salida", data.staff, allTasks()),
          notes: `${r.guestName} sale el ${r.checkOut.split("-").reverse().join("/")}`,
          priority: r.checkOut <= t ? "alta" : "media",
        }),
      );
    }
    // 2) Ya salió → sábanas, limpieza, reposición, inspección
    if (rules.checkoutTasks && r.status === "checkout" && r.checkOut >= addDays(t, -2)) {
      checkoutTasks(r, { staff: data.staff, tasks: allTasks() }).forEach(push);
    }
    // 3) Llega hoy o mañana → preparar habitación
    if (rules.llegada && (r.status === "confirmada" || r.status === "pendiente") && r.checkIn >= t && r.checkIn <= tomorrow) {
      push(
        buildTask({
          id: `${r.id}-preparar_llegada`,
          type: "preparar_llegada",
          roomId: r.roomId,
          reservationId: r.id,
          trigger: "llegada",
          dueDate: r.checkIn,
          assignedTo: autoAssign("preparar_llegada", data.staff, allTasks()),
          notes: `Llega ${r.guestName} (${r.pax} pax)${r.notes ? " · " + r.notes : ""}`,
        }),
      );
    }
    // 4) Huésped en casa → repaso diario
    if (rules.repasoDiario && r.status === "checkin" && r.checkIn < t && r.checkOut > t) {
      push(
        buildTask({
          id: `${r.id}-repaso_diario-${t}`,
          type: "repaso_diario",
          roomId: r.roomId,
          reservationId: r.id,
          trigger: "estadia",
          dueDate: t,
          assignedTo: autoAssign("repaso_diario", data.staff, allTasks()),
        }),
      );
    }
  }
  return out;
}

/** Alertas para la campanita. */
export function alerts(data: DataState, t = today()) {
  const list: { level: "alta" | "media"; text: string; href: string }[] = [];
  const roomNum = (id: string) => data.rooms.find((r) => r.id === id)?.number ?? id;
  for (const r of data.reservations) {
    if (r.status === "checkin" && r.checkOut < t)
      list.push({ level: "alta", text: `Salida vencida: ${r.guestName} (Hab. ${roomNum(r.roomId)})`, href: "/recepcion" });
    if ((r.status === "confirmada" || r.status === "pendiente") && r.checkIn === t) {
      const open = data.tasks.filter(
        (x) => x.roomId === r.roomId && x.status !== "completada" && (x.trigger === "checkout" || x.blocksRoom),
      );
      if (open.length)
        list.push({
          level: "alta",
          text: `Hab. ${roomNum(r.roomId)} no está lista y llega ${r.guestName} hoy (${open.length} tareas abiertas)`,
          href: "/mantenimiento",
        });
    }
  }
  for (const task of data.tasks) {
    if (task.status !== "completada" && task.priority === "urgente")
      list.push({ level: "alta", text: `Urgente: ${task.title} · Hab. ${roomNum(task.roomId)}`, href: "/mantenimiento" });
    else if (task.status !== "completada" && task.dueDate < t)
      list.push({ level: "media", text: `Tarea vencida: ${task.title} · Hab. ${roomNum(task.roomId)}`, href: "/mantenimiento" });
  }
  return list;
}
