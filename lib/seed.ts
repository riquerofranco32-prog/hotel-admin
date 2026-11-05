// Datos de demostración (relativos a la fecha de hoy para que siempre se vea "vivo").
import { addDays, today } from "./dates";
import { checkoutTasks, buildTask } from "./automation";
import { nights } from "./logic";
import type {
  Charge,
  DataState,
  Guest,
  MenuItem,
  MessageTemplate,
  Payment,
  Reservation,
  Room,
  RoomType,
  Settings,
  Staff,
  Task,
} from "./types";

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const GUEST_NAMES = [
  "Valentina Ruiz", "Bruno Molina", "Julián Acosta", "Carolina Vega", "Martín Gómez", "Paula Castro",
  "Mateo Rodríguez", "Camila Torres", "Nicolás Medina", "Sofía Ramírez", "Franco Silva", "Lucía Fernández",
  "Agustina Peña", "Diego Herrera", "Florencia Paz", "Tomás Benítez", "Micaela Sosa", "Joaquín Romero",
  "Martina López", "Santiago Díaz", "Emilia Navarro", "Lautaro Giménez", "Renata Ortiz", "Ignacio Ríos",
];

export const DEMO_STAFF: Staff[] = [
  { id: "st_admin", name: "Laura Méndez", email: "admin@hotelalmare.com", phone: "5491155550001", role: "admin", active: true, createdAt: "2026-01-01T09:00:00.000Z" },
  { id: "st_recep1", name: "Carlos Ruiz", email: "recepcion@hotelalmare.com", phone: "5491155550002", role: "recepcion", active: true, createdAt: "2026-01-01T09:00:00.000Z" },
  { id: "st_recep2", name: "Marina Sosa", email: "marina@hotelalmare.com", phone: "5491155550003", role: "recepcion", active: true, createdAt: "2026-01-01T09:00:00.000Z" },
  { id: "st_limp1", name: "Rosa Gómez", email: "rosa@hotelalmare.com", phone: "5491155550004", role: "limpieza", active: true, createdAt: "2026-01-01T09:00:00.000Z" },
  { id: "st_limp2", name: "Ana Torres", email: "ana@hotelalmare.com", phone: "5491155550005", role: "limpieza", active: true, createdAt: "2026-01-01T09:00:00.000Z" },
  { id: "st_limp3", name: "Beatriz Luna", email: "beatriz@hotelalmare.com", phone: "5491155550006", role: "limpieza", active: true, createdAt: "2026-01-01T09:00:00.000Z" },
  { id: "st_mant1", name: "Pedro Díaz", email: "pedro@hotelalmare.com", phone: "5491155550007", role: "mantenimiento", active: true, createdAt: "2026-01-01T09:00:00.000Z" },
];

export const DEFAULT_SETTINGS: Settings = {
  id: "general",
  hotelName: "Hotel Al Mare",
  currency: "$",
  taxRate: 21,
  checkInTime: "14:00",
  checkOutTime: "10:00",
  rules: { preSalida: true, checkoutTasks: true, llegada: true, repasoDiario: false },
  invoiceSeq: 1,
};

export const DEFAULT_TEMPLATES: MessageTemplate[] = [
  { id: "tpl_confirm", name: "Confirmación de reserva", audience: "huesped", body: "¡Hola {{nombre}}! 👋 Te confirmamos tu reserva en {{hotel}}: habitación {{habitacion}}, del {{checkin}} al {{checkout}} ({{noches}} noches). ¡Te esperamos!" },
  { id: "tpl_prellegada", name: "Pre-llegada", audience: "huesped", body: "Hola {{nombre}}, mañana te esperamos en {{hotel}}. El check-in es a partir de las {{hora_checkin}}. ¿Necesitás algo especial para tu llegada?" },
  { id: "tpl_checkout", name: "Recordatorio de check-out", audience: "huesped", body: "Hola {{nombre}}, te recordamos que tu salida es el {{checkout}} hasta las {{hora_checkout}}. Saldo pendiente: {{saldo}}. ¡Gracias por elegirnos!" },
  { id: "tpl_gracias", name: "Agradecimiento post-estadía", audience: "huesped", body: "¡Gracias por tu visita, {{nombre}}! Esperamos verte pronto en {{hotel}}. Si te gustó tu estadía, nos ayudaría mucho una reseña ⭐" },
  { id: "tpl_staff_tarea", name: "Aviso de tarea a personal", audience: "staff", body: "Hola {{nombre}}, tenés una tarea asignada: *{{tarea}}* en la habitación {{habitacion}} (prioridad {{prioridad}}). Vence: {{vence}}." },
];

const MENU: Omit<MenuItem, "id">[] = [
  { name: "Desayuno continental", category: "Desayuno", price: 9500, description: "Café, jugo, medialunas, tostadas, mermeladas", available: true },
  { name: "Desayuno americano", category: "Desayuno", price: 14000, description: "Huevos revueltos, panceta, tostadas, fruta", available: true },
  { name: "Provoleta", category: "Entradas", price: 8500, available: true },
  { name: "Rabas", category: "Entradas", price: 12500, available: true },
  { name: "Milanesa napolitana con fritas", category: "Principales", price: 18500, available: true },
  { name: "Risotto de hongos", category: "Principales", price: 17000, available: true },
  { name: "Pesca del día con verduras", category: "Principales", price: 22000, available: true },
  { name: "Hamburguesa Al Mare", category: "Principales", price: 15500, available: true },
  { name: "Flan con dulce de leche", category: "Postres", price: 6500, available: true },
  { name: "Volcán de chocolate", category: "Postres", price: 7800, available: false },
  { name: "Agua mineral 500ml", category: "Bebidas", price: 2500, available: true },
  { name: "Gaseosa", category: "Bebidas", price: 3000, available: true },
  { name: "Copa de vino Malbec", category: "Bebidas", price: 6000, available: true },
  { name: "Cerveza artesanal", category: "Bebidas", price: 5500, available: true },
  { name: "Snack minibar (papas)", category: "Minibar", price: 3200, available: true },
  { name: "Chocolate minibar", category: "Minibar", price: 2800, available: true },
];

export function buildSeed(): DataState {
  const rand = rng(20261105);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const t = today();
  const at = (date: string, hh: number, mm = 0) => `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00.000Z`;

  // Habitaciones
  const rooms: Room[] = [];
  const typeFor = (i: number): [RoomType, number, number] =>
    i === 12 ? ["Suite", 4, 120000] : i % 5 === 0 ? ["Familiar", 5, 95000] : i % 3 === 0 ? ["Triple", 3, 78000] : i % 2 === 0 ? ["Doble", 2, 65000] : ["Simple", 1, 48000];
  for (const floor of [100, 200, 300]) {
    for (let i = 0; i < 13; i++) {
      const [type, capacity, rate] = typeFor(i);
      rooms.push({ id: `room_${floor + i}`, number: String(floor + i), floor, type, capacity, rate: rate + (floor === 300 ? 8000 : 0) });
    }
  }

  // Huéspedes
  const guests: Guest[] = GUEST_NAMES.map((name, i) => ({
    id: `guest_${i + 1}`,
    name,
    email: name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(" ", ".") + "@mail.com",
    phone: `54911${String(40000000 + i * 137911).slice(0, 8)}`,
    document: String(28000000 + i * 731233).slice(0, 8),
    nationality: i % 6 === 0 ? "Uruguay" : i % 7 === 0 ? "Chile" : "Argentina",
    createdAt: at(addDays(t, -90), 12),
  }));

  // Reservas
  const reservations: Reservation[] = [];
  const sources: Reservation["source"][] = ["Directo", "Booking", "Booking", "Expedia", "WhatsApp", "Teléfono", "Airbnb"];
  let n = 1;
  for (const room of rooms) {
    let cursor = addDays(t, -25 + Math.floor(rand() * 4));
    while (cursor < addDays(t, 60)) {
      cursor = addDays(cursor, Math.floor(rand() * 4)); // hueco
      const len = 1 + Math.floor(rand() * 7);
      const checkIn = cursor;
      const checkOut = addDays(cursor, len);
      cursor = checkOut;
      if (rand() < 0.12) continue; // días libres
      const g = pick(guests);
      let status: Reservation["status"];
      if (checkOut <= t) status = rand() < 0.05 ? "cancelada" : "checkout";
      else if (checkIn < t) status = "checkin";
      else if (checkIn === t) status = rand() < 0.5 ? "checkin" : "confirmada";
      else status = rand() < 0.78 ? "confirmada" : "pendiente";
      const id = `res_${String(n++).padStart(4, "0")}`;
      reservations.push({
        id,
        roomId: room.id,
        guestId: g.id,
        guestName: g.name,
        checkIn,
        checkOut,
        pax: 1 + Math.floor(rand() * room.capacity),
        status,
        rate: room.rate,
        source: pick(sources),
        notes: rand() < 0.15 ? pick(["Cama extra", "Llega tarde (23 h)", "Aniversario: dejar espumante", "Alergia a plumas", "Cuna para bebé"]) : undefined,
        createdAt: at(addDays(checkIn, -20), 15),
        createdBy: "st_recep1",
        checkedInAt: status === "checkin" || status === "checkout" ? at(checkIn, 17, 10) : undefined,
        checkedInBy: status === "checkin" || status === "checkout" ? pick(["st_recep1", "st_recep2"]) : undefined,
        checkedOutAt: status === "checkout" ? at(checkOut, 13, 5) : undefined,
        checkedOutBy: status === "checkout" ? pick(["st_recep1", "st_recep2"]) : undefined,
      });
    }
  }

  // Tareas históricas (completadas) + algunas en curso
  const staff = DEMO_STAFF;
  const tasks: Task[] = [];
  const cleaners = staff.filter((s) => s.role === "limpieza").map((s) => s.id);
  for (const r of reservations.filter((x) => x.status === "checkout" && x.checkOut >= addDays(t, -12))) {
    const generated = checkoutTasks(r, { staff, tasks }, "sistema");
    generated.forEach((task, i) => {
      task.createdAt = at(r.checkOut, 13, 6);
      task.log = [{ at: task.createdAt, by: "sistema", action: "Tarea creada automáticamente por check-out" }];
      const isToday = r.checkOut === t;
      const isYesterday = r.checkOut === addDays(t, -1);
      if (isToday && i > 0) return tasks.push(task);
      const who = task.type === "inspeccion" ? pick(["st_recep1", "st_recep2"]) : pick(cleaners);
      task.assignedTo = who;
      if (isToday || (isYesterday && i === 3 && rand() < 0.5)) {
        task.status = "en_progreso";
        task.startedAt = at(t, 13, 30);
        task.startedBy = who;
        task.checklist = task.checklist.map((c, k) => (k < 2 ? { ...c, done: true, doneBy: who, doneAt: task.startedAt } : c));
        task.log.push({ at: task.startedAt, by: who, action: "Inició la tarea" });
      } else {
        const done = at(r.checkOut, 14 + i, Math.floor(rand() * 50));
        task.status = "completada";
        task.startedAt = at(r.checkOut, 13 + i, 40);
        task.startedBy = who;
        task.completedAt = done;
        task.completedBy = who;
        task.checklist = task.checklist.map((c) => ({ ...c, done: true, doneBy: who, doneAt: done }));
        task.log.push({ at: task.startedAt, by: who, action: "Inició la tarea" }, { at: done, by: who, action: "Completó la tarea" });
      }
      tasks.push(task);
    });
  }
  // Reparaciones
  tasks.push(
    {
      ...buildTask({ id: "task_rep_1", type: "reparacion", roomId: "room_207", trigger: "manual", dueDate: t, createdBy: "st_recep2", assignedTo: "st_mant1", title: "Pérdida de agua en el aire acondicionado", priority: "urgente", blocksRoom: true, notes: "El huésped anterior reportó goteo sobre la cama." }),
    },
    {
      ...buildTask({ id: "task_rep_2", type: "reparacion", roomId: "room_103", trigger: "manual", dueDate: addDays(t, 2), createdBy: "st_recep1", assignedTo: "st_mant1", title: "Cambiar lámpara de mesa de luz", priority: "baja" }),
    },
  );
  const rep3 = buildTask({ id: "task_rep_3", type: "reparacion", roomId: "room_311", trigger: "manual", dueDate: addDays(t, -3), createdBy: "st_admin", assignedTo: "st_mant1", title: "Ducha con poca presión" });
  rep3.status = "completada";
  rep3.completedAt = at(addDays(t, -3), 16, 20);
  rep3.completedBy = "st_mant1";
  rep3.checklist = rep3.checklist.map((c) => ({ ...c, done: true, doneBy: "st_mant1", doneAt: rep3.completedAt }));
  rep3.log.push({ at: rep3.completedAt!, by: "st_mant1", action: "Completó la tarea" });
  tasks.push(rep3);

  // Cargos y pagos
  const charges: Charge[] = [];
  const payments: Payment[] = [];
  let c = 1;
  for (const r of reservations) {
    if (r.status === "cancelada") continue;
    const lodging = nights(r) * r.rate;
    let extras = 0;
    if (r.status === "checkin" || r.status === "checkout") {
      if (rand() < 0.5) {
        const amount = 2800 + Math.floor(rand() * 4) * 3000;
        extras += amount;
        charges.push({ id: `chg_${c++}`, reservationId: r.id, description: "Consumo minibar", category: "minibar", amount, date: r.checkIn, createdBy: "st_recep1" });
      }
      if (rand() < 0.35) {
        const amount = 15000 + Math.floor(rand() * 5) * 4000;
        extras += amount;
        charges.push({ id: `chg_${c++}`, reservationId: r.id, description: "Cena restaurante", category: "restaurante", amount, date: r.checkIn, createdBy: "st_recep2" });
      }
    }
    if (r.status === "checkout") {
      payments.push({ id: `pay_${c++}`, reservationId: r.id, amount: lodging + extras, method: pick(["Tarjeta de crédito", "Efectivo", "Transferencia", "Mercado Pago"]), date: r.checkOut, createdBy: "st_recep1" });
    } else if (r.status === "checkin" || (r.status === "confirmada" && rand() < 0.6)) {
      payments.push({ id: `pay_${c++}`, reservationId: r.id, amount: Math.round(lodging * 0.3), method: "Transferencia", date: addDays(r.checkIn, -10), reference: "Seña 30%", createdBy: "st_recep1" });
    }
  }

  return {
    rooms,
    guests,
    reservations,
    tasks,
    staff,
    charges,
    payments,
    invoices: [],
    menuItems: MENU.map((m, i) => ({ ...m, id: `menu_${i + 1}` })),
    orders: [],
    templates: DEFAULT_TEMPLATES,
    messages: [],
    activity: [{ id: "act_seed", at: new Date().toISOString(), by: "sistema", action: "Datos de demostración cargados", entity: "sistema" }],
    settings: [DEFAULT_SETTINGS],
  };
}
