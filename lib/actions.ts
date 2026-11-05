"use client";
import type { Adapter } from "./db";
import { checkoutTasks, pendingAutomations } from "./automation";
import { nowISO, overlaps, today } from "./dates";
import { folio, isActive, nights, uid } from "./logic";
import { buildSeed } from "./seed";
import type {
  Charge,
  CollectionName,
  DataState,
  Guest,
  Invoice,
  MenuItem,
  MessageLog,
  MessageTemplate,
  Order,
  Payment,
  Reservation,
  Room,
  Settings,
  Staff,
  Task,
  TaskStatus,
} from "./types";
import { COLLECTIONS } from "./types";

export type Actions = ReturnType<typeof makeActions>;

export function makeActions(db: Adapter, get: () => DataState, me: () => Staff | null) {
  const by = () => me()?.id ?? "sistema";

  const log = (action: string, entity: string, detail?: string) =>
    db.set("activity", uid("act"), { at: nowISO(), by: by(), action, entity, detail });

  const roomNum = (roomId: string) => get().rooms.find((r) => r.id === roomId)?.number ?? "?";

  const taskLog = (t: Task, action: string) => [...(t.log ?? []), { at: nowISO(), by: by(), action }];

  async function generateCheckout(r: Reservation) {
    const d = get();
    if (!d.settings[0]?.rules?.checkoutTasks && d.settings[0]) return;
    for (const task of checkoutTasks(r, d, by())) {
      task.log = [{ at: nowISO(), by: by(), action: "Tarea creada automáticamente por check-out" }];
      await db.createIfMissing("tasks", task.id, task);
    }
  }

  return {
    log,

    // ---------------- Reservas ----------------
    validateReservation(r: Partial<Reservation> & { roomId: string; checkIn: string; checkOut: string }): string | null {
      if (!r.checkIn || !r.checkOut) return "Completá las fechas";
      if (r.checkOut <= r.checkIn) return "La salida debe ser posterior a la entrada";
      const room = get().rooms.find((x) => x.id === r.roomId);
      if (!room) return "Elegí una habitación";
      if (r.pax && r.pax > room.capacity) return `La habitación ${room.number} admite hasta ${room.capacity} personas`;
      const clash = get().reservations.find(
        (x) => x.id !== r.id && x.roomId === r.roomId && isActive(x) && overlaps(x.checkIn, x.checkOut, r.checkIn, r.checkOut),
      );
      if (clash) return `Se superpone con ${clash.guestName} (${clash.checkIn} → ${clash.checkOut}) en Hab. ${room.number}`;
      return null;
    },

    async saveReservation(r: Reservation) {
      const prev = get().reservations.find((x) => x.id === r.id);
      // Si el estado se cambia a mano desde el formulario, aplicamos los mismos efectos que los botones
      if (prev && prev.status !== r.status) {
        if (r.status === "checkin" && !r.checkedInAt) Object.assign(r, { checkedInAt: nowISO(), checkedInBy: by() });
        if (r.status === "checkout" && !r.checkedOutAt) Object.assign(r, { checkedOutAt: nowISO(), checkedOutBy: by() });
      }
      await db.set("reservations", r.id, r);
      if (prev && prev.status !== r.status && r.status === "checkout") await generateCheckout(r);
      // Si cambió de habitación, las tareas abiertas de la reserva (llegada / pre-salida) la siguen
      if (prev && prev.roomId !== r.roomId) {
        for (const t of get().tasks.filter((t) => t.reservationId === r.id && t.status !== "completada" && t.trigger !== "checkout"))
          await db.update("tasks", t.id, { roomId: r.roomId, log: taskLog(t, `Movida a Hab. ${roomNum(r.roomId)} (cambio de habitación)`) });
      }
      const detail = `${r.guestName} · Hab. ${roomNum(r.roomId)} · ${r.checkIn} → ${r.checkOut}`;
      if (!prev) await log("Creó reserva", `reservations/${r.id}`, detail);
      else if (prev.roomId !== r.roomId || prev.checkIn !== r.checkIn || prev.checkOut !== r.checkOut)
        await log("Movió reserva", `reservations/${r.id}`, `${detail} (antes Hab. ${roomNum(prev.roomId)} · ${prev.checkIn} → ${prev.checkOut})`);
      else await log("Editó reserva", `reservations/${r.id}`, detail);
    },

    async checkIn(r: Reservation) {
      await db.update("reservations", r.id, { status: "checkin", checkedInAt: nowISO(), checkedInBy: by() });
      // la tarea de "preparar llegada" se cierra sola si quedó abierta
      const prep = get().tasks.find((t) => t.id === `${r.id}-preparar_llegada` && t.status !== "completada");
      if (prep)
        await db.update("tasks", prep.id, {
          status: "completada",
          completedAt: nowISO(),
          completedBy: by(),
          log: taskLog(prep, "Cerrada automáticamente al hacer check-in"),
        });
      await log("Check-in", `reservations/${r.id}`, `${r.guestName} · Hab. ${roomNum(r.roomId)}`);
    },

    async checkOut(r: Reservation) {
      await db.update("reservations", r.id, { status: "checkout", checkedOutAt: nowISO(), checkedOutBy: by() });
      await generateCheckout({ ...r, status: "checkout" });
      // pre-salida pendiente se marca como resuelta
      const pre = get().tasks.find((t) => t.id === `${r.id}-pre_salida` && t.status !== "completada");
      if (pre)
        await db.update("tasks", pre.id, {
          status: "completada",
          completedAt: nowISO(),
          completedBy: by(),
          log: taskLog(pre, "Cerrada al realizar el check-out"),
        });
      await log("Check-out", `reservations/${r.id}`, `${r.guestName} · Hab. ${roomNum(r.roomId)} · se generaron tareas de limpieza`);
    },

    async setReservationStatus(r: Reservation, status: Reservation["status"]) {
      await db.update("reservations", r.id, { status });
      // si se cancela, se eliminan tareas automáticas pendientes de esa reserva
      if (status === "cancelada" || status === "no_show") {
        const ids = get()
          .tasks.filter((t) => t.reservationId === r.id && t.status === "pendiente" && t.trigger !== "manual")
          .map((t) => t.id);
        if (ids.length) await db.clear("tasks", ids);
      }
      await log(`Cambió estado a ${status}`, `reservations/${r.id}`, r.guestName);
    },

    async deleteReservation(r: Reservation) {
      await db.remove("reservations", r.id);
      await log("Eliminó reserva", `reservations/${r.id}`, r.guestName);
    },

    // ---------------- Huéspedes / habitaciones ----------------
    async saveGuest(g: Guest) {
      await db.set("guests", g.id, g);
      // mantener el nombre desnormalizado en las reservas
      for (const r of get().reservations.filter((x) => x.guestId === g.id && x.guestName !== g.name))
        await db.update("reservations", r.id, { guestName: g.name });
      await log("Guardó huésped", `guests/${g.id}`, g.name);
    },
    async saveRoom(r: Room) {
      await db.set("rooms", r.id, r);
      await log("Guardó habitación", `rooms/${r.id}`, r.number);
    },
    async deleteRoom(r: Room) {
      await db.remove("rooms", r.id);
      await log("Eliminó habitación", `rooms/${r.id}`, r.number);
    },

    // ---------------- Mantenimiento ----------------
    async saveTask(t: Task) {
      const isNew = !get().tasks.some((x) => x.id === t.id);
      await db.set("tasks", t.id, isNew ? t : { ...t, log: taskLog(t, "Editó la tarea") });
      await log(isNew ? "Creó tarea" : "Editó tarea", `tasks/${t.id}`, `${t.title} · Hab. ${roomNum(t.roomId)}`);
    },
    async setTaskStatus(t: Task, status: TaskStatus) {
      const patch: Partial<Task> = { status };
      if (status === "en_progreso") {
        patch.startedAt = nowISO();
        patch.startedBy = by();
        if (!t.assignedTo) patch.assignedTo = by();
        patch.log = taskLog(t, "Inició la tarea");
      } else if (status === "completada") {
        patch.completedAt = nowISO();
        patch.completedBy = by();
        patch.checklist = t.checklist.map((c) => (c.done ? c : { ...c, done: true, doneBy: by(), doneAt: nowISO() }));
        patch.log = taskLog(t, "Completó la tarea");
      } else {
        patch.log = taskLog(t, "Reabrió la tarea");
        (patch as Record<string, unknown>).completedAt = null;
        (patch as Record<string, unknown>).completedBy = null;
      }
      await db.update("tasks", t.id, patch);
      await log(`Tarea → ${status}`, `tasks/${t.id}`, `${t.title} · Hab. ${roomNum(t.roomId)}`);
    },
    async toggleChecklist(t: Task, index: number) {
      const checklist = t.checklist.map((c, i) =>
        i === index ? (c.done ? { label: c.label, done: false } : { ...c, done: true, doneBy: by(), doneAt: nowISO() }) : c,
      );
      const item = checklist[index];
      const patch: Partial<Task> = { checklist, log: taskLog(t, `${item.done ? "Marcó" : "Desmarcó"}: ${item.label}`) };
      if (t.status === "pendiente" && item.done) {
        patch.status = "en_progreso";
        patch.startedAt = nowISO();
        patch.startedBy = by();
        if (!t.assignedTo) patch.assignedTo = by();
      }
      await db.update("tasks", t.id, patch);
    },
    async assignTask(t: Task, staffId: string) {
      const name = get().staff.find((s) => s.id === staffId)?.name ?? "nadie";
      await db.update("tasks", t.id, { assignedTo: staffId || null, log: taskLog(t, `Asignó a ${name}`) });
      await log("Asignó tarea", `tasks/${t.id}`, `${t.title} → ${name}`);
    },
    async deleteTask(t: Task) {
      await db.remove("tasks", t.id);
      await log("Eliminó tarea", `tasks/${t.id}`, t.title);
    },
    async runAutomations() {
      const created = pendingAutomations(get(), today());
      let n = 0;
      for (const t of created) if (await db.createIfMissing("tasks", t.id, t)) n++;
      if (n) await db.set("activity", uid("act"), { at: nowISO(), by: "sistema", action: `Automatizaciones: ${n} tareas creadas`, entity: "tasks" });
      return n;
    },

    // ---------------- Facturación ----------------
    async addCharge(c: Omit<Charge, "id" | "createdBy">) {
      const id = uid("chg");
      await db.set("charges", id, { ...c, id, createdBy: by() });
      await log("Agregó cargo", `charges/${id}`, `${c.description} $${c.amount}`);
    },
    async removeCharge(c: Charge) {
      await db.remove("charges", c.id);
      await log("Eliminó cargo", `charges/${c.id}`, c.description);
    },
    async addPayment(p: Omit<Payment, "id" | "createdBy">) {
      const id = uid("pay");
      await db.set("payments", id, { ...p, id, createdBy: by() });
      await log("Registró pago", `payments/${id}`, `$${p.amount} · ${p.method}`);
    },
    async removePayment(p: Payment) {
      await db.remove("payments", p.id);
      await log("Anuló pago", `payments/${p.id}`, `$${p.amount}`);
    },
    async issueInvoice(r: Reservation): Promise<Invoice> {
      const d = get();
      const settings = d.settings[0];
      const f = folio(r, d);
      const lines = [
        { description: `Alojamiento Hab. ${roomNum(r.roomId)} (${r.checkIn} → ${r.checkOut})`, qty: nights(r), unit: r.rate, total: f.lodging },
        ...f.charges.map((c) => ({ description: c.description, qty: 1, unit: c.amount, total: c.amount })),
      ];
      const total = f.total;
      const rate = (settings?.taxRate ?? 21) / 100;
      const subtotal = total / (1 + rate);
      const number = settings?.invoiceSeq ?? 1;
      const inv: Invoice = {
        id: uid("inv"),
        number,
        reservationId: r.id,
        guestName: r.guestName,
        roomNumber: roomNum(r.roomId),
        lines,
        subtotal,
        tax: total - subtotal,
        total,
        issuedAt: nowISO(),
        issuedBy: by(),
      };
      await db.set("invoices", inv.id, inv);
      if (settings) await db.update("settings", "general", { invoiceSeq: number + 1 });
      await log("Emitió factura", `invoices/${inv.id}`, `N° ${number} · ${r.guestName}`);
      return inv;
    },
    async voidInvoice(inv: Invoice) {
      await db.update("invoices", inv.id, { voided: true });
      await log("Anuló factura", `invoices/${inv.id}`, `N° ${inv.number}`);
    },

    // ---------------- Menús / room service ----------------
    async saveMenuItem(m: MenuItem) {
      await db.set("menuItems", m.id, m);
      await log("Guardó ítem de menú", `menuItems/${m.id}`, m.name);
    },
    async deleteMenuItem(m: MenuItem) {
      await db.remove("menuItems", m.id);
      await log("Eliminó ítem de menú", `menuItems/${m.id}`, m.name);
    },
    async createOrder(o: Omit<Order, "id" | "createdAt" | "createdBy" | "status">) {
      const id = uid("ord");
      await db.set("orders", id, { ...o, id, status: "pendiente", createdAt: nowISO(), createdBy: by() });
      const isMinibar = o.lines.every((l) => get().menuItems.find((m) => m.id === l.menuItemId)?.category === "Minibar");
      const chargeId = uid("chg");
      await db.set("charges", chargeId, {
        id: chargeId,
        reservationId: o.reservationId,
        description: `Pedido: ${o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}`,
        category: isMinibar ? "minibar" : "restaurante",
        amount: o.total,
        date: today(),
        createdBy: by(),
        orderId: id,
      });
      await log("Nuevo pedido (cargado al folio)", `orders/${id}`, `Hab. ${roomNum(o.roomId)} · $${o.total}`);
    },
    async setOrderStatus(o: Order, status: Order["status"]) {
      const patch: Partial<Order> = { status };
      if (status === "entregado") {
        patch.deliveredAt = nowISO();
        patch.deliveredBy = by();
      }
      await db.update("orders", o.id, patch);
      if (status === "cancelado") {
        const ch = get().charges.find((c) => c.orderId === o.id);
        if (ch) await db.remove("charges", ch.id);
      }
      await log(`Pedido → ${status}`, `orders/${o.id}`, `Hab. ${roomNum(o.roomId)}`);
    },

    // ---------------- WhatsApp ----------------
    async saveTemplate(t: MessageTemplate) {
      await db.set("templates", t.id, t);
    },
    async deleteTemplate(t: MessageTemplate) {
      await db.remove("templates", t.id);
    },
    async logMessage(m: Omit<MessageLog, "id" | "sentAt" | "sentBy">) {
      const id = uid("msg");
      await db.set("messages", id, { ...m, id, sentAt: nowISO(), sentBy: by() });
    },

    // ---------------- Administración ----------------
    async saveStaff(s: Staff) {
      await db.set("staff", s.id, s);
      await log("Guardó usuario", `staff/${s.id}`, `${s.name} (${s.role})`);
    },
    async deleteStaff(s: Staff) {
      await db.remove("staff", s.id);
      await log("Eliminó usuario", `staff/${s.id}`, s.name);
    },
    async saveSettings(s: Settings) {
      await db.set("settings", "general", s);
      await log("Actualizó configuración", "settings/general");
    },

    /** Carga los datos demo. keepStaff mantiene los usuarios actuales (útil en Firebase). */
    async loadDemoData(keepStaff = false) {
      const seed = buildSeed();
      const d = get();
      for (const col of COLLECTIONS) {
        if (keepStaff && col === "staff") continue;
        const current = (d[col] as { id: string }[]).map((x) => x.id);
        if (current.length) await db.clear(col, current);
        await db.bulkSet(col as CollectionName, seed[col] as unknown as { id: string }[] as never);
      }
      if (keepStaff && me()) {
        // los usuarios demo se agregan sin pisar el actual
        await db.bulkSet("staff", seed.staff.filter((s) => s.email !== me()!.email) as never);
      }
    },
    async wipeAll(keepStaff = true) {
      const d = get();
      for (const col of COLLECTIONS) {
        if (keepStaff && col === "staff") continue;
        const ids = (d[col] as { id: string }[]).map((x) => x.id);
        if (ids.length) await db.clear(col, ids);
      }
    },
  };
}
