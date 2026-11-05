import { addDays, diffDays, today } from "./dates";
import type {
  ChargeCategory,
  DataState,
  Priority,
  Reservation,
  ReservationStatus,
  Role,
  Room,
  RoomState,
  Task,
  TaskStatus,
  TaskTrigger,
  TaskType,
  VisualStatus,
} from "./types";

// ================== Etiquetas y colores ==================

export const VISUAL_LABEL: Record<VisualStatus, string> = {
  ocupada: "Ocupada",
  reservada: "Reservada",
  proxima: "Próxima a salir",
  otros: "Otros estados",
};

export const VISUAL_CLASS: Record<VisualStatus, string> = {
  ocupada: "bg-ocupada text-white",
  reservada: "bg-reservada text-white",
  proxima: "bg-proxima text-white",
  otros: "bg-otros text-gray-800",
};

export const VISUAL_DOT: Record<VisualStatus, string> = {
  ocupada: "bg-ocupada",
  reservada: "bg-reservada",
  proxima: "bg-proxima",
  otros: "bg-gray-300",
};

export const RES_STATUS_LABEL: Record<ReservationStatus, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  checkin: "En casa (check-in)",
  checkout: "Salió (check-out)",
  cancelada: "Cancelada",
  no_show: "No show",
};

export const RES_STATUS_BADGE: Record<ReservationStatus, string> = {
  pendiente: "bg-gray-100 text-gray-700 ring-gray-300",
  confirmada: "bg-blue-50 text-blue-700 ring-blue-200",
  checkin: "bg-green-50 text-green-700 ring-green-200",
  checkout: "bg-slate-100 text-slate-600 ring-slate-300",
  cancelada: "bg-red-50 text-red-700 ring-red-200",
  no_show: "bg-amber-50 text-amber-700 ring-amber-200",
};

export const ROOM_STATE_LABEL: Record<RoomState, string> = {
  lista: "Lista",
  ocupada: "Ocupada",
  sucia: "Sucia / por limpiar",
  en_limpieza: "En limpieza",
  mantenimiento: "En mantenimiento",
  fuera_servicio: "Fuera de servicio",
};

export const ROOM_STATE_CLASS: Record<RoomState, string> = {
  lista: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ocupada: "bg-green-600 text-white ring-green-700",
  sucia: "bg-orange-50 text-orange-700 ring-orange-200",
  en_limpieza: "bg-yellow-50 text-yellow-800 ring-yellow-300",
  mantenimiento: "bg-purple-50 text-purple-700 ring-purple-200",
  fuera_servicio: "bg-gray-200 text-gray-700 ring-gray-300",
};

export const ROOM_STATE_DOT: Record<RoomState, string> = {
  lista: "bg-emerald-500",
  ocupada: "bg-green-600",
  sucia: "bg-orange-500",
  en_limpieza: "bg-yellow-400",
  mantenimiento: "bg-purple-500",
  fuera_servicio: "bg-gray-500",
};

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  pre_salida: "Pre-salida",
  cambio_sabanas: "Cambio de sábanas",
  limpieza_salida: "Limpieza de salida",
  reposicion: "Reposición amenities",
  inspeccion: "Inspección final",
  preparar_llegada: "Preparar llegada",
  repaso_diario: "Repaso diario",
  reparacion: "Reparación",
  otro: "Otro",
};

export const TASK_TYPE_ICON: Record<TaskType, string> = {
  pre_salida: "🧾",
  cambio_sabanas: "🛏️",
  limpieza_salida: "🧹",
  reposicion: "🧴",
  inspeccion: "🔍",
  preparar_llegada: "🛎️",
  repaso_diario: "✨",
  reparacion: "🔧",
  otro: "📌",
};

export const TRIGGER_LABEL: Record<TaskTrigger, string> = {
  proxima_salida: "Automática · próxima a salir",
  checkout: "Automática · check-out",
  llegada: "Automática · llegada",
  estadia: "Automática · estadía",
  manual: "Manual",
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completada: "Completada",
};

export const PRIORITY_LABEL: Record<Priority, string> = { baja: "Baja", media: "Media", alta: "Alta", urgente: "Urgente" };
export const PRIORITY_CLASS: Record<Priority, string> = {
  baja: "bg-gray-100 text-gray-600",
  media: "bg-blue-50 text-blue-700",
  alta: "bg-orange-100 text-orange-700",
  urgente: "bg-red-600 text-white",
};
export const PRIORITY_ORDER: Record<Priority, number> = { urgente: 0, alta: 1, media: 2, baja: 3 };

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  recepcion: "Recepción",
  limpieza: "Limpieza / Housekeeping",
  mantenimiento: "Mantenimiento técnico",
};

export const CHARGE_LABEL: Record<ChargeCategory, string> = {
  alojamiento: "Alojamiento",
  restaurante: "Restaurante / Room service",
  minibar: "Minibar",
  lavanderia: "Lavandería",
  spa: "Spa",
  otros: "Otros",
};

// ================== Permisos por rol ==================

export type Section =
  | "dashboard"
  | "reservas"
  | "recepcion"
  | "facturacion"
  | "menus"
  | "mantenimiento"
  | "whatsapp"
  | "administradores";

export const ROLE_SECTIONS: Record<Role, Section[]> = {
  admin: ["dashboard", "reservas", "recepcion", "facturacion", "menus", "mantenimiento", "whatsapp", "administradores"],
  recepcion: ["dashboard", "reservas", "recepcion", "facturacion", "menus", "mantenimiento", "whatsapp"],
  limpieza: ["dashboard", "mantenimiento"],
  mantenimiento: ["dashboard", "mantenimiento"],
};

export function canAccess(role: Role | undefined, s: Section) {
  return !!role && ROLE_SECTIONS[role].includes(s);
}

// ================== Estado visual de reservas ==================

export function isActive(r: Reservation) {
  return r.status !== "cancelada" && r.status !== "no_show";
}

/**
 * Regla de colores del calendario:
 *  - Verde (Ocupada): huésped hizo check-in y le quedan 2+ noches.
 *  - Rojo (Próxima a salir): huésped en casa y sale hoy/mañana (o salida vencida).
 *  - Azul (Reservada): reserva confirmada, aún sin check-in.
 *  - Gris (Otros): pendiente de confirmar, ya salió, etc.
 */
export function visualStatus(r: Reservation, t: string = today()): VisualStatus {
  if (r.status === "checkin") {
    return r.checkOut <= addDays(t, 1) ? "proxima" : "ocupada";
  }
  if (r.status === "confirmada") return "reservada";
  return "otros";
}

export function nights(r: Pick<Reservation, "checkIn" | "checkOut">) {
  return Math.max(1, diffDays(r.checkIn, r.checkOut));
}

// ================== Estado operativo de habitaciones ==================

export function openTasks(tasks: Task[]) {
  return tasks.filter((t) => t.status !== "completada");
}

/** Estado calculado de la habitación a partir de reservas + tareas. */
export function roomState(room: Room, data: Pick<DataState, "reservations" | "tasks">, t = today()): RoomState {
  if (room.outOfService) return "fuera_servicio";
  const roomTasks = data.tasks.filter((x) => x.roomId === room.id && x.status !== "completada");
  if (roomTasks.some((x) => x.blocksRoom)) return "mantenimiento";
  const inHouse = data.reservations.find((r) => r.roomId === room.id && r.status === "checkin");
  if (inHouse) return "ocupada";
  const cleaning = roomTasks.filter((x) => x.trigger === "checkout");
  if (cleaning.some((x) => x.status === "en_progreso")) return "en_limpieza";
  if (cleaning.length > 0) return "sucia";
  return "lista";
}

export function currentReservation(roomId: string, reservations: Reservation[], t = today()) {
  return (
    reservations.find((r) => r.roomId === roomId && r.status === "checkin") ||
    reservations.find((r) => r.roomId === roomId && isActive(r) && r.status !== "checkout" && r.checkIn <= t && r.checkOut > t)
  );
}

// ================== Folio / facturación ==================

export function folio(r: Reservation, data: Pick<DataState, "charges" | "payments">) {
  const lodging = nights(r) * r.rate;
  const charges = data.charges.filter((c) => c.reservationId === r.id);
  const payments = data.payments.filter((p) => p.reservationId === r.id);
  const extras = charges.reduce((s, c) => s + c.amount, 0);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const total = lodging + extras;
  return { lodging, charges, payments, extras, paid, total, balance: total - paid };
}

export function money(n: number, currency = "$") {
  return `${currency} ${Math.round(n).toLocaleString("es-AR")}`;
}

// ================== Plantillas de tareas (automatizaciones) ==================

export const TASK_TEMPLATES: Record<TaskType, { title: string; checklist: string[]; priority: Priority }> = {
  pre_salida: {
    title: "Pre-salida: revisar minibar y consumos",
    checklist: ["Revisar minibar y cargar consumos al folio", "Verificar daños o faltantes", "Confirmar hora de salida con el huésped"],
    priority: "media",
  },
  cambio_sabanas: {
    title: "Cambio de sábanas y toallas",
    checklist: ["Retirar sábanas, fundas y toallas", "Colocar ropa de cama limpia", "Colocar toallas limpias", "Enviar ropa a lavandería"],
    priority: "alta",
  },
  limpieza_salida: {
    title: "Limpieza completa de salida",
    checklist: ["Limpieza y desinfección de baño", "Aspirar y trapear pisos", "Quitar polvo de superficies", "Vaciar papeleras", "Ventilar habitación"],
    priority: "alta",
  },
  reposicion: {
    title: "Reposición de amenities y minibar",
    checklist: ["Shampoo, jabón y acondicionador", "Papel higiénico", "Agua de cortesía", "Reponer minibar"],
    priority: "media",
  },
  inspeccion: {
    title: "Inspección final — habilitar habitación",
    checklist: ["Revisión visual general", "Luces, A/C y TV funcionando", "Cama y baño impecables", "Habitación habilitada para venta"],
    priority: "media",
  },
  preparar_llegada: {
    title: "Preparar habitación para llegada",
    checklist: ["Verificar que esté limpia e inspeccionada", "Climatizar habitación", "Amenities de bienvenida", "Revisar pedidos especiales del huésped"],
    priority: "alta",
  },
  repaso_diario: {
    title: "Repaso diario (huésped en casa)",
    checklist: ["Tender cama", "Cambiar toallas si se solicitó", "Repaso de baño", "Vaciar papeleras"],
    priority: "baja",
  },
  reparacion: {
    title: "Reparación",
    checklist: ["Diagnosticar problema", "Reparar", "Probar funcionamiento"],
    priority: "alta",
  },
  otro: { title: "Tarea", checklist: [], priority: "media" },
};

export const CHECKOUT_SEQUENCE: TaskType[] = ["cambio_sabanas", "limpieza_salida", "reposicion", "inspeccion"];

/** Rol que naturalmente ejecuta cada tipo de tarea (para sugerir asignación). */
export const TASK_DEFAULT_ROLE: Record<TaskType, Role> = {
  pre_salida: "recepcion",
  cambio_sabanas: "limpieza",
  limpieza_salida: "limpieza",
  reposicion: "limpieza",
  inspeccion: "recepcion",
  preparar_llegada: "limpieza",
  repaso_diario: "limpieza",
  reparacion: "mantenimiento",
  otro: "limpieza",
};

export function cls(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

export function uid(prefix = ""): string {
  const r = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  return prefix ? `${prefix}_${r}` : r;
}
