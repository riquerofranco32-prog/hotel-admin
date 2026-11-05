// ===== Modelo de datos del PMS =====

export type Role = "admin" | "recepcion" | "limpieza" | "mantenimiento";

export interface Staff {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export type RoomType = "Simple" | "Doble" | "Triple" | "Suite" | "Familiar";

export interface Room {
  id: string;
  number: string;
  floor: number; // 100, 200, 300...
  type: RoomType;
  capacity: number;
  rate: number; // tarifa por noche
  notes?: string;
  outOfService?: boolean; // bloqueo manual
}

export interface Guest {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  nationality?: string;
  notes?: string;
  createdAt: string;
}

export type ReservationStatus =
  | "pendiente" // sin confirmar / sin seña
  | "confirmada" // reservada
  | "checkin" // huésped en el hotel
  | "checkout" // ya salió
  | "cancelada"
  | "no_show";

export interface Reservation {
  id: string;
  roomId: string;
  guestId: string;
  guestName: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD (día de salida)
  pax: number;
  status: ReservationStatus;
  rate: number; // tarifa por noche acordada
  source: "Directo" | "Booking" | "Expedia" | "Airbnb" | "Teléfono" | "WhatsApp" | "Walk-in";
  notes?: string;
  createdAt: string;
  createdBy?: string;
  checkedInAt?: string;
  checkedInBy?: string;
  checkedOutAt?: string;
  checkedOutBy?: string;
}

// Visual del calendario
export type VisualStatus = "ocupada" | "reservada" | "proxima" | "otros";

// ===== Mantenimiento / Housekeeping =====
export type TaskType =
  | "pre_salida"
  | "cambio_sabanas"
  | "limpieza_salida"
  | "reposicion"
  | "inspeccion"
  | "preparar_llegada"
  | "repaso_diario"
  | "reparacion"
  | "otro";

export type TaskTrigger = "proxima_salida" | "checkout" | "llegada" | "estadia" | "manual";
export type TaskStatus = "pendiente" | "en_progreso" | "completada";
export type Priority = "baja" | "media" | "alta" | "urgente";

export interface ChecklistItem {
  label: string;
  done: boolean;
  doneBy?: string;
  doneAt?: string;
}

export interface TaskLog {
  at: string;
  by: string; // staff id
  action: string;
}

export interface Task {
  id: string;
  roomId: string;
  reservationId?: string;
  type: TaskType;
  title: string;
  trigger: TaskTrigger;
  priority: Priority;
  status: TaskStatus;
  dueDate: string; // YYYY-MM-DD
  assignedTo?: string; // staff id
  checklist: ChecklistItem[];
  blocksRoom?: boolean; // la habitación queda fuera de servicio hasta completar
  notes?: string;
  createdAt: string;
  createdBy: string; // staff id o "sistema"
  startedAt?: string;
  startedBy?: string;
  completedAt?: string;
  completedBy?: string;
  log: TaskLog[];
}

// Estado operativo de la habitación (calculado)
export type RoomState = "lista" | "ocupada" | "sucia" | "en_limpieza" | "mantenimiento" | "fuera_servicio";

// ===== Facturación =====
export type ChargeCategory = "alojamiento" | "restaurante" | "minibar" | "lavanderia" | "spa" | "otros";

export interface Charge {
  id: string;
  reservationId: string;
  description: string;
  category: ChargeCategory;
  amount: number;
  date: string;
  createdBy: string;
  orderId?: string;
}

export type PaymentMethod = "Efectivo" | "Tarjeta de crédito" | "Tarjeta de débito" | "Transferencia" | "Mercado Pago";

export interface Payment {
  id: string;
  reservationId: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  reference?: string;
  createdBy: string;
}

export interface InvoiceLine {
  description: string;
  qty: number;
  unit: number;
  total: number;
}

export interface Invoice {
  id: string;
  number: number;
  reservationId: string;
  guestName: string;
  roomNumber: string;
  lines: InvoiceLine[];
  subtotal: number;
  tax: number;
  total: number;
  issuedAt: string;
  issuedBy: string;
  voided?: boolean;
}

// ===== Menús / room service =====
export type MenuCategory = "Desayuno" | "Entradas" | "Principales" | "Postres" | "Bebidas" | "Minibar";

export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  price: number;
  description?: string;
  available: boolean;
}

export interface OrderLine {
  menuItemId: string;
  name: string;
  qty: number;
  price: number;
}

export interface Order {
  id: string;
  reservationId: string;
  roomId: string;
  lines: OrderLine[];
  total: number;
  status: "pendiente" | "preparando" | "entregado" | "cancelado";
  notes?: string;
  createdAt: string;
  createdBy: string;
  deliveredAt?: string;
  deliveredBy?: string;
}

// ===== WhatsApp =====
export interface MessageTemplate {
  id: string;
  name: string;
  body: string;
  audience: "huesped" | "staff";
}

export interface MessageLog {
  id: string;
  to: string;
  toName: string;
  phone: string;
  body: string;
  reservationId?: string;
  taskId?: string;
  sentAt: string;
  sentBy: string;
}

// ===== Auditoría =====
export interface Activity {
  id: string;
  at: string;
  by: string;
  action: string;
  entity: string; // reservations/xyz
  detail?: string;
}

export interface Settings {
  id: "general";
  hotelName: string;
  currency: string;
  taxRate: number; // ej 21
  checkInTime: string;
  checkOutTime: string;
  rules: {
    preSalida: boolean;
    checkoutTasks: boolean;
    llegada: boolean;
    repasoDiario: boolean;
  };
  invoiceSeq: number;
}

export interface DataState {
  rooms: Room[];
  guests: Guest[];
  reservations: Reservation[];
  tasks: Task[];
  staff: Staff[];
  charges: Charge[];
  payments: Payment[];
  invoices: Invoice[];
  menuItems: MenuItem[];
  orders: Order[];
  templates: MessageTemplate[];
  messages: MessageLog[];
  activity: Activity[];
  settings: Settings[];
}

export type CollectionName = keyof DataState;

export const COLLECTIONS: CollectionName[] = [
  "rooms",
  "guests",
  "reservations",
  "tasks",
  "staff",
  "charges",
  "payments",
  "invoices",
  "menuItems",
  "orders",
  "templates",
  "messages",
  "activity",
  "settings",
];
