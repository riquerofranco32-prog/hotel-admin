"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BedDouble, CalendarDays, LogIn, LogOut, MessageCircle, Pencil, Receipt, Trash2, Users } from "lucide-react";
import { useApp } from "./AppProvider";
import { Badge, Button, Drawer, Field, Input, Modal, Select, Textarea, toast } from "./ui";
import { addDays, fmtDate, fmtDateTime, nowISO, today } from "@/lib/dates";
import {
  folio,
  isActive,
  money,
  nights,
  PRIORITY_CLASS,
  RES_STATUS_BADGE,
  RES_STATUS_LABEL,
  roomState,
  ROOM_STATE_CLASS,
  ROOM_STATE_LABEL,
  TASK_STATUS_LABEL,
  TASK_TYPE_ICON,
  uid,
  VISUAL_DOT,
  VISUAL_LABEL,
  visualStatus,
} from "@/lib/logic";
import { overlaps } from "@/lib/dates";
import type { Guest, Reservation } from "@/lib/types";

const SOURCES: Reservation["source"][] = ["Directo", "Booking", "Expedia", "Airbnb", "Teléfono", "WhatsApp", "Walk-in"];

export function ReservationForm({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Partial<Reservation>;
}) {
  const { data, actions, me } = useApp();
  const editing = !!initial?.id && data.reservations.some((r) => r.id === initial.id);
  const [r, setR] = useState<Partial<Reservation>>({});
  const [newGuest, setNewGuest] = useState(false);
  const [g, setG] = useState<Partial<Guest>>({});
  const [error, setError] = useState("");
  const [guestQuery, setGuestQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const t = today();
    const room = data.rooms.find((x) => x.id === initial?.roomId);
    setR({
      status: "confirmada",
      pax: 2,
      source: "Directo",
      checkIn: t,
      checkOut: addDays(initial?.checkIn ?? t, 2),
      rate: room?.rate,
      ...initial,
    });
    setNewGuest(false);
    setG({});
    setError("");
    setGuestQuery("");
  }, [open, initial, data.rooms]);

  const set = (patch: Partial<Reservation>) => setR((x) => ({ ...x, ...patch }));

  const availableRooms = useMemo(() => {
    if (!r.checkIn || !r.checkOut) return data.rooms;
    return data.rooms.filter(
      (room) =>
        !data.reservations.some(
          (x) => x.id !== r.id && x.roomId === room.id && isActive(x) && overlaps(x.checkIn, x.checkOut, r.checkIn!, r.checkOut!),
        ),
    );
  }, [data.rooms, data.reservations, r.checkIn, r.checkOut, r.id]);

  const guests = useMemo(
    () =>
      data.guests
        .filter((x) => !guestQuery || x.name.toLowerCase().includes(guestQuery.toLowerCase()) || x.document?.includes(guestQuery))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.guests, guestQuery],
  );

  async function save() {
    setError("");
    let guestId = r.guestId;
    let guestName = r.guestName;
    if (newGuest) {
      if (!g.name?.trim()) return setError("Ingresá el nombre del huésped");
    } else if (!guestId) return setError("Elegí un huésped o creá uno nuevo");
    const candidate = { ...r, roomId: r.roomId ?? "", checkIn: r.checkIn ?? "", checkOut: r.checkOut ?? "" };
    const err = actions.validateReservation(candidate);
    if (err) return setError(err);
    if (newGuest) {
      const guest: Guest = { id: uid("guest"), name: g.name!.trim(), phone: g.phone, email: g.email, document: g.document, createdAt: nowISO() };
      await actions.saveGuest(guest);
      guestId = guest.id;
      guestName = guest.name;
    } else {
      guestName = data.guests.find((x) => x.id === guestId)?.name ?? guestName;
    }
    const room = data.rooms.find((x) => x.id === r.roomId)!;
    const res: Reservation = {
      id: r.id ?? uid("res"),
      roomId: room.id,
      guestId: guestId!,
      guestName: guestName!,
      checkIn: r.checkIn!,
      checkOut: r.checkOut!,
      pax: Number(r.pax) || 1,
      status: r.status ?? "confirmada",
      rate: Number(r.rate) || room.rate,
      source: r.source ?? "Directo",
      notes: r.notes,
      createdAt: r.createdAt ?? nowISO(),
      createdBy: r.createdBy ?? me?.id,
      checkedInAt: r.checkedInAt,
      checkedInBy: r.checkedInBy,
      checkedOutAt: r.checkedOutAt,
      checkedOutBy: r.checkedOutBy,
    };
    await actions.saveReservation(res);
    toast(editing ? "Reserva actualizada" : "Reserva creada");
    onClose();
  }

  const n = r.checkIn && r.checkOut && r.checkOut > r.checkIn ? nights({ checkIn: r.checkIn, checkOut: r.checkOut }) : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={editing ? "Editar reserva" : "Nueva reserva"}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save}>
            {editing ? "Guardar cambios" : "Crear reserva"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Huésped</span>
            <button className="text-xs font-medium text-blue-600 hover:underline" onClick={() => setNewGuest(!newGuest)}>
              {newGuest ? "Elegir existente" : "+ Nuevo huésped"}
            </button>
          </div>
          {newGuest ? (
            <div className="grid gap-2 rounded-md border border-dashed border-gray-300 p-3 sm:grid-cols-2">
              <Input placeholder="Nombre y apellido *" value={g.name ?? ""} onChange={(e) => setG({ ...g, name: e.target.value })} />
              <Input placeholder="Teléfono (WhatsApp) ej 5491155551234" value={g.phone ?? ""} onChange={(e) => setG({ ...g, phone: e.target.value })} />
              <Input placeholder="Email" value={g.email ?? ""} onChange={(e) => setG({ ...g, email: e.target.value })} />
              <Input placeholder="DNI / Pasaporte" value={g.document ?? ""} onChange={(e) => setG({ ...g, document: e.target.value })} />
            </div>
          ) : (
            <div className="flex gap-2">
              <Input placeholder="Buscar…" className="max-w-[160px]" value={guestQuery} onChange={(e) => setGuestQuery(e.target.value)} />
              <Select value={r.guestId ?? ""} onChange={(e) => set({ guestId: e.target.value })}>
                <option value="">— Elegir huésped —</option>
                {guests.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} {x.document ? `· ${x.document}` : ""}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
        <Field label="Entrada">
          <Input type="date" value={r.checkIn ?? ""} onChange={(e) => set({ checkIn: e.target.value })} />
        </Field>
        <Field label="Salida">
          <Input type="date" value={r.checkOut ?? ""} onChange={(e) => set({ checkOut: e.target.value })} />
        </Field>
        <Field label={`Habitación (${availableRooms.length} disponibles en esas fechas)`}>
          <Select
            value={r.roomId ?? ""}
            onChange={(e) => {
              const room = data.rooms.find((x) => x.id === e.target.value);
              set({ roomId: e.target.value, rate: room?.rate });
            }}
          >
            <option value="">— Elegir —</option>
            {data.rooms
              .slice()
              .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
              .map((room) => {
                const free = availableRooms.includes(room);
                return (
                  <option key={room.id} value={room.id} disabled={!free && room.id !== r.roomId}>
                    {room.number} · {room.type} ({room.capacity}p) {free ? "" : "— ocupada"}
                  </option>
                );
              })}
          </Select>
        </Field>
        <Field label="Huéspedes (pax)">
          <Input type="number" min={1} value={r.pax ?? 1} onChange={(e) => set({ pax: Number(e.target.value) })} />
        </Field>
        <Field label="Tarifa por noche">
          <Input type="number" min={0} value={r.rate ?? ""} onChange={(e) => set({ rate: Number(e.target.value) })} />
        </Field>
        <Field label="Estado">
          <Select value={r.status} onChange={(e) => set({ status: e.target.value as Reservation["status"] })}>
            {(Object.keys(RES_STATUS_LABEL) as Reservation["status"][]).map((s) => (
              <option key={s} value={s}>
                {RES_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Canal">
          <Select value={r.source} onChange={(e) => set({ source: e.target.value as Reservation["source"] })}>
            {SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <div className="flex items-end">
          <div className="w-full rounded-md bg-gray-50 px-3 py-2 text-sm">
            {n} noche{n === 1 ? "" : "s"} · Total alojamiento <b>{money(n * (Number(r.rate) || 0))}</b>
          </div>
        </div>
        <Field label="Notas / pedidos especiales" className="sm:col-span-2" hint="Se copian a la tarea de 'Preparar llegada' de housekeeping.">
          <Textarea rows={2} value={r.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </Modal>
  );
}

export function ReservationDrawer({ id, onClose, onEdit }: { id: string | null; onClose: () => void; onEdit: (r: Reservation) => void }) {
  const { data, actions, staffName, me } = useApp();
  const r = data.reservations.find((x) => x.id === id);
  if (!r) return null;
  const room = data.rooms.find((x) => x.id === r.roomId);
  const guest = data.guests.find((x) => x.id === r.guestId);
  const f = folio(r, data);
  const vs = visualStatus(r);
  const tasks = data.tasks.filter((t) => t.reservationId === r.id || (t.roomId === r.roomId && t.status !== "completada"));
  const state = room ? roomState(room, data) : undefined;
  const t = today();
  const canCheckIn = (r.status === "confirmada" || r.status === "pendiente") && r.checkIn <= t;
  const canCheckOut = r.status === "checkin";

  async function doCheckIn() {
    if (state && state !== "lista" && !confirm(`La habitación figura como "${ROOM_STATE_LABEL[state]}". ¿Hacer check-in igual?`)) return;
    await actions.checkIn(r!);
    toast("Check-in realizado");
  }
  async function doCheckOut() {
    if (f.balance > 0 && !confirm(`Queda un saldo pendiente de ${money(f.balance)}. ¿Hacer check-out igual?`)) return;
    await actions.checkOut(r!);
    toast("Check-out realizado · se generaron las tareas de limpieza");
  }

  return (
    <Drawer open={!!id} onClose={onClose} title={`Reserva · ${r.guestName}`}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={RES_STATUS_BADGE[r.status]}>{RES_STATUS_LABEL[r.status]}</Badge>
          {isActive(r) && (
            <Badge className="bg-white ring-gray-200">
              <span className={`h-2 w-2 rounded-full ${VISUAL_DOT[vs]}`} /> {VISUAL_LABEL[vs]}
            </Badge>
          )}
          <span className="text-xs text-gray-400">#{r.id.slice(-6)}</span>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Info icon={<BedDouble size={15} />} label="Habitación" value={`${room?.number ?? "?"} · ${room?.type ?? ""}`} />
          <Info icon={<Users size={15} />} label="Huéspedes" value={`${r.pax} pax`} />
          <Info icon={<CalendarDays size={15} />} label="Entrada" value={fmtDate(r.checkIn)} />
          <Info icon={<CalendarDays size={15} />} label="Salida" value={`${fmtDate(r.checkOut)} (${nights(r)} n.)`} />
          <Info label="Canal" value={r.source} />
          <Info label="Teléfono" value={guest?.phone ?? "—"} />
        </dl>
        {r.notes && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">📝 {r.notes}</p>}

        <div className="grid grid-cols-2 gap-2">
          {r.status === "pendiente" && (
            <Button variant="primary" onClick={() => actions.setReservationStatus(r, "confirmada").then(() => toast("Reserva confirmada"))}>
              Confirmar
            </Button>
          )}
          {canCheckIn && (
            <Button variant="success" onClick={doCheckIn}>
              <LogIn size={15} /> Check-in
            </Button>
          )}
          {canCheckOut && (
            <Button variant="danger" onClick={doCheckOut}>
              <LogOut size={15} /> Check-out
            </Button>
          )}
          <Button onClick={() => onEdit(r)}>
            <Pencil size={15} /> Editar
          </Button>
          <Link href={`/facturacion?r=${r.id}`} className="contents">
            <Button>
              <Receipt size={15} /> Folio / factura
            </Button>
          </Link>
          <Link href={`/whatsapp?r=${r.id}`} className="contents">
            <Button>
              <MessageCircle size={15} /> WhatsApp
            </Button>
          </Link>
        </div>

        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Cuenta</h4>
          <div className="rounded-md border border-gray-200 text-sm">
            <Row label={`Alojamiento (${nights(r)} × ${money(r.rate)})`} value={money(f.lodging)} />
            <Row label={`Consumos (${f.charges.length})`} value={money(f.extras)} />
            <Row label="Pagado" value={`− ${money(f.paid)}`} />
            <Row label="Saldo" value={money(f.balance)} strong tone={f.balance > 0 ? "text-red-600" : "text-green-700"} />
          </div>
        </section>

        <section>
          <h4 className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500">
            Mantenimiento de la habitación
            {state && <Badge className={ROOM_STATE_CLASS[state]}>{ROOM_STATE_LABEL[state]}</Badge>}
          </h4>
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-500">Sin tareas vinculadas.</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
              {tasks.slice(0, 10).map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">
                      {TASK_TYPE_ICON[task.type]} {task.title}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {task.status === "completada"
                        ? `Hecha por ${staffName(task.completedBy)} · ${fmtDateTime(task.completedAt)}`
                        : `Asignada a ${staffName(task.assignedTo)}`}
                    </span>
                  </span>
                  <Badge className={task.status === "completada" ? "bg-green-50 text-green-700" : PRIORITY_CLASS[task.priority]}>
                    {TASK_STATUS_LABEL[task.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/mantenimiento?hab=${r.roomId}`} className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline">
            Ver en Mantenimiento →
          </Link>
        </section>

        <section className="space-y-1 text-xs text-gray-500">
          <div>Creada {fmtDateTime(r.createdAt)} por {staffName(r.createdBy)}</div>
          {r.checkedInAt && <div>Check-in {fmtDateTime(r.checkedInAt)} por {staffName(r.checkedInBy)}</div>}
          {r.checkedOutAt && <div>Check-out {fmtDateTime(r.checkedOutAt)} por {staffName(r.checkedOutBy)}</div>}
        </section>

        {isActive(r) && r.status !== "checkout" && (
          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            <Button size="sm" variant="ghost" onClick={() => confirm("¿Cancelar la reserva?") && actions.setReservationStatus(r, "cancelada")}>
              Cancelar reserva
            </Button>
            {r.checkIn <= t && r.status !== "checkin" && (
              <Button size="sm" variant="ghost" onClick={() => actions.setReservationStatus(r, "no_show")}>
                Marcar no-show
              </Button>
            )}
          </div>
        )}
        {me?.role === "admin" && (
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600"
            onClick={() => {
              if (confirm("¿Eliminar definitivamente la reserva?")) {
                actions.deleteReservation(r);
                onClose();
              }
            }}
          >
            <Trash2 size={14} /> Eliminar
          </Button>
        )}
      </div>
    </Drawer>
  );
}

function Info({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-gray-500">
        {icon}
        {label}
      </dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  );
}
function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex justify-between border-b border-gray-100 px-3 py-2 last:border-0">
      <span className="text-gray-600">{label}</span>
      <span className={`tabular-nums ${strong ? "font-semibold" : ""} ${tone ?? ""}`}>{value}</span>
    </div>
  );
}
