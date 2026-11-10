import { BedDouble, Brush, ClipboardCheck, ConciergeBell, Droplets, Feather, PackagePlus, Pin, ScanSearch, SprayCan, Sparkles, Wrench, type LucideIcon } from "lucide-react";
import { addDays, diffDays, today } from "./dates";
import { COLLECTIONS } from "./types";
import type {
  AutomationConfig,
  Charge,
  Payment,
  ChargeCategory,
  CollectionName,
  Perm,
  Settings,
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
  ocupada: "Con huéspedes",
  reservada: "Por llegar",
  proxima: "Se van pronto",
  otros: "Sin confirmar o terminada",
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
  pendiente: "Sin confirmar",
  confirmada: "Confirmada",
  checkin: "Alojado (ya entró)",
  checkout: "Ya se fue",
  cancelada: "Cancelada",
  no_show: "No se presentó",
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
  pre_salida: "Revisar antes de la salida",
  cambio_sabanas: "Cambio de sábanas",
  limpieza_salida: "Limpieza de salida",
  reposicion: "Reponer jabón, toallas y artículos",
  inspeccion: "Revisión final",
  preparar_llegada: "Preparar llegada",
  repaso_diario: "Repaso del día",
  servicio: "Limpieza completa",
  fondo: "Limpieza a fondo",
  repaso: "Repaso rápido",
  reparacion: "Reparación",
  otro: "Otro",
};

/** Íconos (lucide) de cada tipo de tarea. Se muestran con <TaskIcon type=... /> */
export const TASK_TYPE_LUCIDE: Record<TaskType, LucideIcon> = {
  pre_salida: ClipboardCheck,
  cambio_sabanas: BedDouble,
  limpieza_salida: SprayCan,
  reposicion: PackagePlus,
  inspeccion: ScanSearch,
  preparar_llegada: ConciergeBell,
  repaso_diario: Sparkles,
  servicio: Brush,
  fondo: Droplets,
  repaso: Feather,
  reparacion: Wrench,
  otro: Pin,
};

export const TRIGGER_LABEL: Record<TaskTrigger, string> = {
  proxima_salida: "Automática · el huésped se va pronto",
  checkout: "Automática · el huésped se fue",
  llegada: "Automática · llega un huésped",
  estadia: "Automática · huésped alojado",
  manual: "Manual",
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pendiente: "Por hacer",
  en_progreso: "Empezada",
  completada: "Terminada",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  baja: "Puede esperar",
  media: "Normal",
  alta: "Importante",
  urgente: "Urgente",
};
export const PRIORITY_CLASS: Record<Priority, string> = {
  baja: "bg-gray-100 text-gray-600",
  media: "bg-blue-50 text-blue-700",
  alta: "bg-orange-100 text-orange-700",
  urgente: "bg-red-600 text-white",
};
export const PRIORITY_ORDER: Record<Priority, number> = {
  urgente: 0,
  alta: 1,
  media: 2,
  baja: 3,
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador general",
  gerente: "Gerencia",
  recepcion: "Recepción",
  encargado: "Encargado/a de limpieza",
  mucama: "Mucama",
  mantenimiento: "Mantenimiento (arreglos)",
  restaurante: "Restaurante",
};

export const ROLE_COLOR: Record<Role, string> = {
  admin: "bg-gray-900 text-white",
  gerente: "bg-indigo-600 text-white",
  recepcion: "bg-blue-600 text-white",
  encargado: "bg-teal-700 text-white",
  mucama: "bg-emerald-600 text-white",
  mantenimiento: "bg-purple-600 text-white",
  restaurante: "bg-amber-500 text-white",
};

/** Roles guardados en versiones anteriores */
export function normalizeRole(r: string): Role {
  if (r === "limpieza") return "mucama";
  return (
    [
      "admin",
      "gerente",
      "recepcion",
      "encargado",
      "mucama",
      "mantenimiento",
      "restaurante",
    ].includes(r)
      ? r
      : "mucama"
  ) as Role;
}

export const CHARGE_LABEL: Record<ChargeCategory, string> = {
  alojamiento: "Alojamiento",
  restaurante: "Comidas y pedidos a la habitación",
  minibar: "Minibar",
  lavanderia: "Lavandería",
  spa: "Spa",
  otros: "Otros gastos",
};

// ================== Permisos por rol ==================

export const ALL_ROLES: Role[] = [
  "admin",
  "gerente",
  "recepcion",
  "encargado",
  "mucama",
  "mantenimiento",
  "restaurante",
];

export const PERM_INFO: Record<
  Perm,
  { label: string; group: "Secciones" | "Capacidades"; hint?: string }
> = {
  dashboard: { label: "Inicio (calendario de habitaciones)", group: "Secciones" },
  mi_jornada: {
    label: "Mi trabajo de hoy",
    group: "Secciones",
    hint: "Tareas propias del día",
  },
  mucamas: { label: "Mucamas (reparto de la limpieza)", group: "Secciones" },
  recepcion: { label: "Recepción", group: "Secciones" },
  reservas: { label: "Reservas", group: "Secciones" },
  huespedes: { label: "Huéspedes", group: "Secciones" },
  mantenimiento: { label: "Limpieza y arreglos", group: "Secciones" },
  menus: { label: "Comidas y pedidos a la habitación", group: "Secciones" },
  whatsapp: { label: "WhatsApp", group: "Secciones" },
  facturacion: { label: "Cobros y facturas", group: "Secciones" },
  finanzas: { label: "Plata y resultados", group: "Secciones" },
  automatizaciones: { label: "Automatizaciones", group: "Secciones" },
  administradores: { label: "Administración (personal y datos del hotel)", group: "Secciones" },
  ver_montos: { label: "Ver la plata y lo que debe cada huésped", group: "Capacidades" },
  editar_reservas: {
    label: "Crear y cambiar reservas, dar entrada y salida",
    group: "Capacidades",
  },
  gestionar_tareas: {
    label: "Crear, repartir y borrar cualquier tarea",
    group: "Capacidades",
  },
  registrar_pagos: {
    label: "Anotar pagos y hacer facturas",
    group: "Capacidades",
  },
};

export const DEFAULT_PERMISSIONS: Record<Role, Perm[]> = {
  admin: Object.keys(PERM_INFO) as Perm[],
  gerente: [
    "dashboard",
    "mi_jornada",
    "mucamas",
    "recepcion",
    "reservas",
    "huespedes",
    "mantenimiento",
    "menus",
    "whatsapp",
    "facturacion",
    "finanzas",
    "ver_montos",
    "editar_reservas",
    "gestionar_tareas",
    "registrar_pagos",
  ],
  recepcion: [
    "dashboard",
    "mi_jornada",
    "recepcion",
    "reservas",
    "huespedes",
    "mantenimiento",
    "menus",
    "whatsapp",
    "facturacion",
    "ver_montos",
    "editar_reservas",
    "gestionar_tareas",
    "registrar_pagos",
  ],
  encargado: ["mucamas", "mi_jornada", "mantenimiento", "gestionar_tareas"],
  mucama: ["mi_jornada", "mucamas", "mantenimiento"],
  mantenimiento: ["mi_jornada", "mantenimiento"],
  restaurante: ["menus", "mi_jornada"],
};

/**
 * Lo que la BASE DE DATOS permite a cada rol (ver firestore.rules). El admin puede quitar permisos,
 * pero no dar algo que las reglas de seguridad no permiten (por ejemplo, finanzas a una mucama).
 */
export const PERM_CEILING: Record<Role, Perm[]> = {
  admin: DEFAULT_PERMISSIONS.admin,
  gerente: DEFAULT_PERMISSIONS.gerente,
  recepcion: DEFAULT_PERMISSIONS.recepcion.concat(["finanzas", "mucamas"]),
  encargado: [
    "dashboard",
    "mi_jornada",
    "mucamas",
    "mantenimiento",
    "gestionar_tareas",
  ],
  mucama: [
    "dashboard",
    "mi_jornada",
    "mucamas",
    "mantenimiento",
    "gestionar_tareas",
  ],
  mantenimiento: [
    "dashboard",
    "mi_jornada",
    "mantenimiento",
    "gestionar_tareas",
  ],
  restaurante: [
    "dashboard",
    "mi_jornada",
    "menus",
    "mantenimiento",
    "ver_montos",
  ],
};

export function permsFor(role: Role | undefined, settings?: Settings): Perm[] {
  if (!role) return [];
  const custom = settings?.permissions?.[role];
  const base = custom ?? DEFAULT_PERMISSIONS[role];
  const allowed = base.filter((p) => PERM_CEILING[role].includes(p));
  // el administrador nunca puede quedarse sin acceso a Administradores
  if (role === "admin" && !allowed.includes("administradores"))
    allowed.push("administradores");
  return allowed;
}

/** Colecciones que cada rol puede leer (debe coincidir con firestore.rules). */
export const ROLE_COLLECTIONS: Record<Role, CollectionName[]> = {
  admin: [...COLLECTIONS],
  gerente: [...COLLECTIONS],
  recepcion: [...COLLECTIONS],
  encargado: ["rooms", "guests", "reservations", "tasks", "staff", "settings"],
  mucama: ["rooms", "guests", "reservations", "tasks", "staff", "settings"],
  mantenimiento: [
    "rooms",
    "guests",
    "reservations",
    "tasks",
    "staff",
    "settings",
  ],
  restaurante: [
    "rooms",
    "guests",
    "reservations",
    "tasks",
    "staff",
    "settings",
    "menuItems",
    "orders",
    "charges",
  ],
};

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
export function visualStatus(
  r: Reservation,
  t: string = today(),
): VisualStatus {
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
export function roomState(
  room: Room,
  data: Pick<DataState, "reservations" | "tasks">,
  t = today(),
): RoomState {
  if (room.outOfService) return "fuera_servicio";
  const roomTasks = data.tasks.filter(
    (x) => x.roomId === room.id && x.status !== "completada",
  );
  if (roomTasks.some((x) => x.blocksRoom)) return "mantenimiento";
  const inHouse = data.reservations.find(
    (r) => r.roomId === room.id && r.status === "checkin",
  );
  if (inHouse) return "ocupada";
  const cleaning = roomTasks.filter((x) => x.trigger === "checkout");
  if (cleaning.some((x) => x.status === "en_progreso")) return "en_limpieza";
  if (cleaning.length > 0) return "sucia";
  return "lista";
}

export function currentReservation(
  roomId: string,
  reservations: Reservation[],
  t = today(),
) {
  return (
    reservations.find((r) => r.roomId === roomId && r.status === "checkin") ||
    reservations.find(
      (r) =>
        r.roomId === roomId &&
        isActive(r) &&
        r.status !== "checkout" &&
        r.checkIn <= t &&
        r.checkOut > t,
    )
  );
}

// ================== Folio / facturación ==================

type FolioSource =
  | Pick<DataState, "charges" | "payments">
  | {
      chargesByRes: Map<string, Charge[]>;
      paymentsByRes: Map<string, Payment[]>;
    };

/** Cuenta de la reserva. Acepta los índices del AppProvider (rápido) o las listas completas. */
export function folio(r: Reservation, src: FolioSource) {
  const lodging = nights(r) * r.rate;
  const charges =
    "chargesByRes" in src
      ? (src.chargesByRes.get(r.id) ?? [])
      : src.charges.filter((c) => c.reservationId === r.id);
  const payments =
    "paymentsByRes" in src
      ? (src.paymentsByRes.get(r.id) ?? [])
      : src.payments.filter((p) => p.reservationId === r.id);
  let extras = 0;
  for (const c of charges) extras += c.amount;
  let paid = 0;
  for (const p of payments) paid += p.amount;
  const total = lodging + extras;
  return {
    lodging,
    charges,
    payments,
    extras,
    paid,
    total,
    balance: total - paid,
  };
}

export function money(n: number, currency = "$") {
  return `${currency} ${Math.round(n).toLocaleString("es-AR")}`;
}

// ================== Plantillas de tareas (automatizaciones) ==================

export const TASK_TEMPLATES: Record<
  TaskType,
  { title: string; checklist: string[]; priority: Priority }
> = {
  pre_salida: {
    title: "Antes de la salida: revisar el minibar y los consumos",
    checklist: [
      "Revisar el minibar y anotar lo consumido en la cuenta",
      "Ver si hay daños o algo que falte",
      "Confirmar con el huésped a qué hora se va",
    ],
    priority: "media",
  },
  cambio_sabanas: {
    title: "Cambio de sábanas y toallas",
    checklist: [
      "Retirar sábanas, fundas y toallas",
      "Colocar ropa de cama limpia",
      "Colocar toallas limpias",
      "Enviar ropa a lavandería",
    ],
    priority: "alta",
  },
  limpieza_salida: {
    title: "Limpieza completa de salida",
    checklist: [
      "Limpieza y desinfección de baño",
      "Aspirar y trapear pisos",
      "Quitar polvo de superficies",
      "Vaciar papeleras",
      "Ventilar habitación",
    ],
    priority: "alta",
  },
  reposicion: {
    title: "Reponer jabón, toallas y artículos del minibar",
    checklist: [
      "Shampoo, jabón y acondicionador",
      "Papel higiénico",
      "Agua de cortesía",
      "Reponer minibar",
    ],
    priority: "media",
  },
  inspeccion: {
    title: "Revisión final: dejar la habitación lista",
    checklist: [
      "Revisión visual general",
      "Luces, aire y tele funcionando",
      "Cama y baño impecables",
      "Habitación lista para alquilar",
    ],
    priority: "media",
  },
  preparar_llegada: {
    title: "Preparar habitación para llegada",
    checklist: [
      "Ver que esté limpia y revisada",
      "Prender el aire o la calefacción",
      "Dejar los artículos de bienvenida",
      "Revisar pedidos especiales del huésped",
    ],
    priority: "alta",
  },
  repaso_diario: {
    title: "Repaso del día (huésped alojado)",
    checklist: [
      "Tender cama",
      "Cambiar toallas si se solicitó",
      "Repaso de baño",
      "Vaciar papeleras",
    ],
    priority: "baja",
  },
  servicio: {
    title: "Limpieza completa (habitación con huéspedes)",
    checklist: [
      "Tender cama",
      "Baño: limpiar y reponer papel",
      "Toallas: cambiar las del piso",
      "Vaciar papeleras",
      "Repaso de pisos",
    ],
    priority: "media",
  },
  fondo: {
    title: "Limpieza a fondo",
    checklist: [
      "Mover muebles y aspirar debajo",
      "Limpiar vidrios y cortinas",
      "Desinfección completa del baño",
      "Colchón: aspirar y rotar",
      "Placard y cajones",
    ],
    priority: "media",
  },
  repaso: {
    title: "Repaso rápido",
    checklist: [
      "Quitar polvo de superficies",
      "Ventilar",
      "Revisar el baño y los artículos",
    ],
    priority: "baja",
  },
  reparacion: {
    title: "Reparación",
    checklist: ["Ver qué le pasa", "Arreglarlo", "Probar que funcione"],
    priority: "alta",
  },
  otro: { title: "Tarea", checklist: [], priority: "media" },
};

export const CHECKOUT_SEQUENCE: TaskType[] = [
  "cambio_sabanas",
  "limpieza_salida",
  "reposicion",
  "inspeccion",
];

/** Rol que naturalmente ejecuta cada tipo de tarea (para sugerir asignación). */
export const TASK_DEFAULT_ROLE: Record<TaskType, Role> = {
  pre_salida: "recepcion",
  cambio_sabanas: "mucama",
  limpieza_salida: "mucama",
  reposicion: "mucama",
  inspeccion: "recepcion",
  preparar_llegada: "mucama",
  repaso_diario: "mucama",
  servicio: "mucama",
  fondo: "mucama",
  repaso: "mucama",
  reparacion: "mantenimiento",
  otro: "mucama",
};

export const DEFAULT_AUTOMATION: AutomationConfig = {
  preSalida: true,
  preSalidaDias: 1,
  checkoutTasks: true,
  checkoutTipos: [
    "cambio_sabanas",
    "limpieza_salida",
    "reposicion",
    "inspeccion",
  ],
  llegada: true,
  llegadaDias: 1,
  repasoDiario: false,
  autoAsignar: true,
  escalarVencidas: true,
  noShowAuto: false,
  noShowDias: 1,
  cerrarAlCheckin: true,
  avisosEnVivo: true,
  reporteBloquea: false,
  sabanasAuto: true,
  sabanasCadaDias: 3,
};

/** Configuración de automatizaciones (con migración desde `rules` v1). */
export function automationOf(s?: Settings): AutomationConfig {
  const legacy = s?.rules
    ? {
        preSalida: s.rules.preSalida,
        checkoutTasks: s.rules.checkoutTasks,
        llegada: s.rules.llegada,
        repasoDiario: s.rules.repasoDiario,
      }
    : {};
  return { ...DEFAULT_AUTOMATION, ...legacy, ...(s?.automation ?? {}) };
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("");
}

export function cls(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

export function uid(prefix = ""): string {
  const r =
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  return prefix ? `${prefix}_${r}` : r;
}
