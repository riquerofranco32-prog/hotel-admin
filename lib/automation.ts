// Motor de automatizaciones: conecta el estado de las reservas con mantenimiento, recepción y alertas.
// Es idempotente: cada tarea automática tiene un ID determinístico (reserva + tipo),
// así que correrlo muchas veces (o desde varias PCs a la vez) no duplica tareas.
import { addDays, nowISO, today } from "./dates";
import { automationOf, CHECKOUT_SEQUENCE, normalizeRole, TASK_DEFAULT_ROLE, TASK_TEMPLATES } from "./logic";
import type { AutomationConfig, DataState, Reservation, Staff, Task, TaskTrigger, TaskType } from "./types";

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
export function autoAssign(type: TaskType, staff: Staff[], tasks: Task[], enabled = true): string | undefined {
  if (!enabled) return undefined;
  const role = TASK_DEFAULT_ROLE[type];
  const candidates = staff.filter((s) => s.active && normalizeRole(s.role) === role);
  if (!candidates.length) return undefined;
  const load = new Map<string, number>();
  for (const t of tasks) if (t.assignedTo && t.status !== "completada") load.set(t.assignedTo, (load.get(t.assignedTo) ?? 0) + 1);
  return candidates.sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0) || a.name.localeCompare(b.name))[0].id;
}

export function checkoutTasks(
  r: Reservation,
  data: Pick<DataState, "staff" | "tasks">,
  by = "sistema",
  cfg?: Pick<AutomationConfig, "checkoutTipos" | "autoAsignar">,
): Task[] {
  const tipos = cfg?.checkoutTipos ?? CHECKOUT_SEQUENCE;
  const created: Task[] = [];
  for (const type of CHECKOUT_SEQUENCE.filter((x) => tipos.includes(x))) {
    created.push(
      buildTask({
        id: `${r.id}-${type}`,
        type,
        roomId: r.roomId,
        reservationId: r.id,
        trigger: "checkout",
        dueDate: r.checkOut,
        createdBy: by,
        assignedTo: autoAssign(type, data.staff, [...data.tasks, ...created], cfg?.autoAsignar ?? true),
        notes: `Salida de ${r.guestName}`,
      }),
    );
  }
  return created;
}

export interface AutomationPlan {
  create: Task[];
  escalate: Task[];
  noShows: Reservation[];
}

/** Calcula todo lo que el motor debe hacer según el estado actual. */
export function planAutomations(data: DataState, t = today()): AutomationPlan {
  const cfg = automationOf(data.settings[0]);
  const existing = new Set(data.tasks.map((x) => x.id));
  const out: Task[] = [];
  const push = (task: Task) => {
    if (!existing.has(task.id)) {
      existing.add(task.id);
      out.push(task);
    }
  };
  const allTasks = () => (out.length ? [...data.tasks, ...out] : data.tasks);
  const preLimit = addDays(t, cfg.preSalidaDias);
  const arrLimit = addDays(t, cfg.llegadaDias);

  for (const r of data.reservations) {
    // 1) Próxima a salir → pre-salida (minibar, consumos, confirmar horario)
    if (cfg.preSalida && r.status === "checkin" && r.checkOut <= preLimit) {
      push(
        buildTask({
          id: `${r.id}-pre_salida`,
          type: "pre_salida",
          roomId: r.roomId,
          reservationId: r.id,
          trigger: "proxima_salida",
          dueDate: r.checkOut,
          assignedTo: autoAssign("pre_salida", data.staff, allTasks(), cfg.autoAsignar),
          notes: `${r.guestName} sale el ${r.checkOut.split("-").reverse().join("/")}`,
          priority: r.checkOut <= t ? "alta" : "media",
        }),
      );
    }
    // 2) Ya salió → sábanas, limpieza, reposición, inspección
    if (cfg.checkoutTasks && r.status === "checkout" && r.checkOut >= addDays(t, -2)) {
      checkoutTasks(r, { staff: data.staff, tasks: allTasks() }, "sistema", cfg).forEach(push);
    }
    // 3) Llega pronto → preparar habitación
    if (cfg.llegada && (r.status === "confirmada" || r.status === "pendiente") && r.checkIn >= t && r.checkIn <= arrLimit) {
      push(
        buildTask({
          id: `${r.id}-preparar_llegada`,
          type: "preparar_llegada",
          roomId: r.roomId,
          reservationId: r.id,
          trigger: "llegada",
          dueDate: r.checkIn,
          assignedTo: autoAssign("preparar_llegada", data.staff, allTasks(), cfg.autoAsignar),
          notes: `Llega ${r.guestName} (${r.pax} pax)${r.notes ? " · " + r.notes : ""}`,
        }),
      );
    }
    // 4) Huésped en casa → repaso diario
    if (cfg.repasoDiario && r.status === "checkin" && r.checkIn < t && r.checkOut > t) {
      push(
        buildTask({
          id: `${r.id}-repaso_diario-${t}`,
          type: "repaso_diario",
          roomId: r.roomId,
          reservationId: r.id,
          trigger: "estadia",
          dueDate: t,
          assignedTo: autoAssign("repaso_diario", data.staff, allTasks(), cfg.autoAsignar),
        }),
      );
    }
  }

  // 5) Tareas vencidas → prioridad urgente
  const escalate = cfg.escalarVencidas
    ? data.tasks.filter((x) => x.status !== "completada" && x.dueDate < t && x.priority !== "urgente")
    : [];

  // 6) No-show automático
  const noShows = cfg.noShowAuto
    ? data.reservations.filter((r) => (r.status === "confirmada" || r.status === "pendiente") && r.checkIn < addDays(t, -cfg.noShowDias + 1) && r.checkIn < t)
    : [];

  return { create: out, escalate, noShows };
}

export function planSize(p: AutomationPlan) {
  return p.create.length + p.escalate.length + p.noShows.length;
}

/** Alertas para la campanita. */
export function alerts(data: DataState, t = today()) {
  const list: { level: "alta" | "media"; text: string; href: string }[] = [];
  const roomNum = new Map(data.rooms.map((r) => [r.id, r.number]));
  const openByRoom = new Map<string, Task[]>();
  for (const x of data.tasks)
    if (x.status !== "completada" && (x.trigger === "checkout" || x.blocksRoom)) openByRoom.set(x.roomId, [...(openByRoom.get(x.roomId) ?? []), x]);
  for (const r of data.reservations) {
    if (r.status === "checkin" && r.checkOut < t)
      list.push({ level: "alta", text: `Salida vencida: ${r.guestName} (Hab. ${roomNum.get(r.roomId)})`, href: "/recepcion" });
    if ((r.status === "confirmada" || r.status === "pendiente") && r.checkIn === t) {
      const open = openByRoom.get(r.roomId) ?? [];
      if (open.length)
        list.push({
          level: "alta",
          text: `Hab. ${roomNum.get(r.roomId)} no está lista y llega ${r.guestName} hoy (${open.length} tareas abiertas)`,
          href: "/mantenimiento",
        });
    }
  }
  for (const task of data.tasks) {
    if (task.status === "completada") continue;
    if (task.priority === "urgente")
      list.push({ level: "alta", text: `Urgente: ${task.title} · Hab. ${roomNum.get(task.roomId)}`, href: "/mantenimiento" });
    else if (task.dueDate < t) list.push({ level: "media", text: `Tarea vencida: ${task.title} · Hab. ${roomNum.get(task.roomId)}`, href: "/mantenimiento" });
  }
  return list;
}
