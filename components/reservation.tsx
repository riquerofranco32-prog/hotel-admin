"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, BedDouble, CalendarDays, LogIn, LogOut, MessageCircle, Pencil, Receipt, Star, StickyNote, Trash2, Users } from "lucide-react";
import { useApp } from "./AppProvider";
import { Badge, Button, Drawer, Field, Input, Modal, Select, Textarea, toast } from "./ui";
import { addDays, fmtDate, fmtDateTime, nowISO, today } from "@/lib/dates";
import { folio, isActive, money, nights, PRIORITY_CLASS, RES_STATUS_BADGE, RES_STATUS_LABEL, roomState, ROOM_STATE_CLASS, ROOM_STATE_LABEL, TASK_STATUS_LABEL, uid, VISUAL_DOT, VISUAL_LABEL, visualStatus } from "@/lib/logic";
import { overlaps } from "@/lib/dates";
import type { Guest, Reservation } from "@/lib/types";
import { TaskIcon } from "./TaskIcon";

function FormSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
        <h4 className="text-[16px] font-semibold text-gray-900">{title}</h4>
        {action}
      </div>
      {children}
    </section>
  );
}

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
    toast(editing ? "Reserva actualizada ✔" : "Reserva creada ✔");
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
          <Button className="!h-11 !px-5 !text-[15px]" onClick={onClose}>Cerrar sin guardar</Button>
          <Button variant="primary" className="!h-11 !px-5 !text-[15px]" onClick={save}>
            {editing ? "Guardar cambios" : "Crear reserva"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <FormSection
          title="Huésped"
          action={
            <button
              type="button"
              className="rounded-md px-2.5 py-2 text-[14px] font-medium text-blue-700 transition-colors duration-150 hover:bg-blue-50 motion-reduce:transition-none"
              onClick={() => setNewGuest(!newGuest)}
            >
              {newGuest ? "Elegir uno que ya conocemos" : "+ Es un huésped nuevo"}
            </button>
          }
        >
          {newGuest ? (
            <div className="grid gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-3 sm:grid-cols-2">
              <Input placeholder="Nombre y apellido *" value={g.name ?? ""} onChange={(e) => setG({ ...g, name: e.target.value })} />
              <Input placeholder="Teléfono con código de área (ej. 5491155551234)" value={g.phone ?? ""} onChange={(e) => setG({ ...g, phone: e.target.value })} />
              <Input placeholder="Email" value={g.email ?? ""} onChange={(e) => setG({ ...g, email: e.target.value })} />
              <Input placeholder="DNI / Pasaporte" value={g.document ?? ""} onChange={(e) => setG({ ...g, document: e.target.value })} />
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input placeholder="Buscar por nombre" className={`w-full sm:w-[200px] sm:shrink-0`} value={guestQuery} onChange={(e) => setGuestQuery(e.target.value)} />
              <Select value={r.guestId ?? ""} onChange={(e) => set({ guestId: e.target.value })}>
                <option value="">Elegí el huésped</option>
                {guests.map((x) => (
                  <option key={x.id} value={x.id} disabled={x.blacklisted}>
                    {x.blacklisted ? "(no aceptado) " : x.tags?.includes("VIP") ? "VIP · " : ""}
                    {x.name} {x.document ? `· ${x.document}` : ""}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </FormSection>

        <FormSection title="Fechas y habitación">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Día de entrada">
              <Input type="date" value={r.checkIn ?? ""} onChange={(e) => set({ checkIn: e.target.value })} />
            </Field>
            <Field label="Día de salida">
              <Input type="date" value={r.checkOut ?? ""} onChange={(e) => set({ checkOut: e.target.value })} />
            </Field>
            <Field label={`Habitación (${availableRooms.length} libres en esas fechas)`}>
              <Select
               
                value={r.roomId ?? ""}
                onChange={(e) => {
                  const room = data.rooms.find((x) => x.id === e.target.value);
                  set({ roomId: e.target.value, rate: room?.rate });
                }}
              >
                <option value="">Elegí una habitación</option>
                {data.rooms
                  .slice()
                  .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
                  .map((room) => {
                    const free = availableRooms.includes(room);
                    return (
                      <option key={room.id} value={room.id} disabled={!free && room.id !== r.roomId}>
                        {room.number} · {room.type} ({room.capacity}p) {free ? "" : "— no está libre"}
                      </option>
                    );
                  })}
              </Select>
            </Field>
            <Field label="Cantidad de personas">
              <Input type="number" min={1} value={r.pax ?? 1} onChange={(e) => set({ pax: Number(e.target.value) })} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Precio y detalles">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Precio por noche">
              <Input type="number" min={0} value={r.rate ?? ""} onChange={(e) => set({ rate: Number(e.target.value) })} />
            </Field>
            <Field label="¿Cómo está la reserva?">
              <Select value={r.status} onChange={(e) => set({ status: e.target.value as Reservation["status"] })}>
                {(Object.keys(RES_STATUS_LABEL) as Reservation["status"][]).map((s) => (
                  <option key={s} value={s}>
                    {RES_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Por dónde llegó la reserva">
              <Select value={r.source} onChange={(e) => set({ source: e.target.value as Reservation["source"] })}>
                {SOURCES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] text-gray-700 sm:self-end">
              <span>
                {n} noche{n === 1 ? "" : "s"} · Total de la estadía
              </span>
              <b className="text-[20px] font-semibold tabular-nums text-gray-900">{money(n * (Number(r.rate) || 0))}</b>
            </div>
            <Field label="Pedidos especiales o notas" className="sm:col-span-2" hint="Limpieza lo ve y deja la habitación lista antes de que llegue.">
              <Textarea rows={2} value={r.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
            </Field>
          </div>
        </FormSection>
      </div>
      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-[14px] text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </Modal>
  );
}

export function ReservationDrawer({ id, onClose, onEdit }: { id: string | null; onClose: () => void; onEdit: (r: Reservation) => void }) {
  const { data, idx, actions, staffName, me, can } = useApp();
  const r = id ? idx.resById.get(id) : undefined;
  if (!r) return null;
  const room = data.rooms.find((x) => x.id === r.roomId);
  const guest = data.guests.find((x) => x.id === r.guestId);
  const f = folio(r, idx);
  const vs = visualStatus(r);
  const canEdit = can("editar_reservas");
  const showMoney = can("ver_montos");
  const tasks = data.tasks.filter((t) => t.reservationId === r.id || (t.roomId === r.roomId && t.status !== "completada"));
  const guestTags = guest?.tags ?? [];
  const state = room ? roomState(room, data) : undefined;
  const t = today();
  const canCheckIn = canEdit && (r.status === "confirmada" || r.status === "pendiente") && r.checkIn <= t;
  const canCheckOut = canEdit && r.status === "checkin";

  async function doCheckIn() {
    if (state && state !== "lista" && !confirm(`La habitación todavía no está lista (${ROOM_STATE_LABEL[state].toLowerCase()}).\n\n¿Querés darle la entrada igual?`)) return;
    await actions.checkIn(r!);
    toast("Ya entró al hotel ✔");
  }
  async function doCheckOut() {
    if (f.balance > 0 && !confirm(`Todavía debe ${money(f.balance)}.\n\n¿Querés darle la salida igual?`)) return;
    await actions.checkOut(r!);
    toast("Ya se fue ✔ · Ya se avisó a limpieza");
  }

  return (
    <Drawer open={!!id} onClose={onClose} title={`Reserva · ${r.guestName}`}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={RES_STATUS_BADGE[r.status]}>{RES_STATUS_LABEL[r.status]}</Badge>
          {isActive(r) && r.status !== "checkout" && (
            <Badge className="bg-white ring-gray-200">
              <span className={`h-2 w-2 rounded-full ${VISUAL_DOT[vs]}`} /> {VISUAL_LABEL[vs]}
            </Badge>
          )}
          <span className="text-[14px] text-gray-600">N° {r.id.slice(-6)}</span>
        </div>

        <dl className="grid grid-cols-2 gap-2.5 text-[15px]">
          <Info icon={<BedDouble size={15} />} label="Habitación" value={`${room?.number ?? "?"} · ${room?.type ?? ""}`} />
          <Info icon={<Users size={15} />} label="Personas" value={`${r.pax} ${r.pax === 1 ? "persona" : "personas"}`} />
          <Info icon={<CalendarDays size={15} />} label="Entrada" value={fmtDate(r.checkIn)} />
          <Info icon={<CalendarDays size={15} />} label="Salida" value={`${fmtDate(r.checkOut)} (${nights(r)} ${nights(r) === 1 ? "noche" : "noches"})`} />
          <Info label="Llegó por" value={r.source} />
          <Info label="Teléfono" value={guest?.phone ?? "—"} />
        </dl>
        {(guestTags.length > 0 || guest?.preferences) && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2.5 text-[15px] text-blue-900">
            {guestTags.map((tg) => (
              <Badge key={tg} className={tg === "VIP" ? "bg-amber-100 text-amber-800" : "bg-white text-gray-700"}>
                {tg}
              </Badge>
            ))}
            {guest?.preferences && <span><Star size={15} className="mr-1 inline-block align-[-2px]" aria-hidden /> {guest.preferences}</span>}
          </div>
        )}
        {r.notes && <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-[15px] text-amber-900"><StickyNote size={15} className="mr-1 inline-block align-[-2px]" aria-hidden /> {r.notes}</p>}

        <div className="grid grid-cols-2 gap-2.5">
          {canEdit && r.status === "pendiente" && (
            <Button variant="primary" className="col-span-2 !h-11 !text-[15px]" onClick={() => actions.setReservationStatus(r, "confirmada").then(() => toast("Reserva confirmada"))}>
              Confirmar reserva
            </Button>
          )}
          {canCheckIn && (
            <Button variant="success" className="col-span-2 !h-11 !text-[15px]" onClick={doCheckIn}>
              <LogIn size={16} /> Dar entrada
            </Button>
          )}
          {canCheckOut && (
            <Button variant="danger" className="col-span-2 !h-11 !text-[15px]" onClick={doCheckOut}>
              <LogOut size={16} /> Dar salida
            </Button>
          )}
          {canEdit && (
            <Button className="!h-11 w-full !text-[15px]" onClick={() => onEdit(r)}>
              <Pencil size={15} /> Editar
            </Button>
          )}
          {can("facturacion") && (
            <Link href={`/facturacion?r=${r.id}`} className="contents">
              <Button className="!h-auto min-h-[44px] w-full !whitespace-normal !py-2 text-center !text-[15px]">
                <Receipt size={16} /> Ver cuenta y factura
              </Button>
            </Link>
          )}
          {can("whatsapp") && (
            <Link href={`/whatsapp?r=${r.id}`} className="contents">
              <Button className="!h-auto min-h-[44px] w-full !whitespace-normal !py-2 text-center !text-[15px]">
                <MessageCircle size={15} /> WhatsApp
              </Button>
            </Link>
          )}
        </div>

        {showMoney && <section>
          <h4 className="mb-2 text-[16px] font-semibold text-gray-900">Cuenta</h4>
          <div className="overflow-hidden rounded-xl border border-gray-200 text-[15px]">
            <Row label={`Alojamiento (${nights(r)} × ${money(r.rate)})`} value={money(f.lodging)} />
            <Row label={`Consumos (${f.charges.length})`} value={money(f.extras)} />
            <Row label="Pagado" value={`− ${money(f.paid)}`} />
            <Row label="Saldo" value={money(f.balance)} strong tone={f.balance > 0 ? "text-red-600" : "text-green-700"} />
          </div>
        </section>}

        <section>
          <h4 className="mb-2 flex items-center justify-between gap-2 text-[16px] font-semibold text-gray-900">
            Estado de la habitación
            {state && <Badge className={ROOM_STATE_CLASS[state]}>{ROOM_STATE_LABEL[state]}</Badge>}
          </h4>
          {tasks.length === 0 ? (
            <p className="text-[15px] text-gray-600">No hay tareas para esta habitación.</p>
          ) : (
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
              {tasks.slice(0, 10).map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[15px]">
                  <span className="min-w-0">
                    <span className="block truncate">
                      <TaskIcon type={task.type} /> {task.title}
                    </span>
                    <span className="block text-[13.5px] text-gray-600">
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
          <Link href={`/mantenimiento?hab=${r.roomId}`} className="mt-3 inline-block py-1 text-[15px] font-medium text-blue-700 hover:underline">
            Ver limpieza y arreglos →
          </Link>
        </section>

        <section className="space-y-1 border-t border-gray-100 pt-4 text-[14px] text-gray-600">
          <div>Reserva cargada el {fmtDateTime(r.createdAt)} por {staffName(r.createdBy)}</div>
          {r.checkedInAt && <div>Entró el {fmtDateTime(r.checkedInAt)} (lo registró {staffName(r.checkedInBy)})</div>}
          {r.checkedOutAt && <div>Se fue el {fmtDateTime(r.checkedOutAt)} (lo registró {staffName(r.checkedOutBy)})</div>}
        </section>

        {canEdit && isActive(r) && r.status !== "checkout" && (
          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            <Button size="sm" variant="ghost" onClick={() => confirm(`¿Querés cancelar la reserva de ${r.guestName}?`) && actions.setReservationStatus(r, "cancelada")}>
              Cancelar reserva
            </Button>
            {r.checkIn <= t && r.status !== "checkin" && (
              <Button size="sm" variant="ghost" onClick={() => actions.setReservationStatus(r, "no_show")}>
                El huésped no se presentó
              </Button>
            )}
          </div>
        )}
        {(me?.role === "admin" || me?.role === "gerente") && (
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600"
            onClick={() => {
              if (confirm("¿Borrar esta reserva para siempre?\n\nNo se puede deshacer.")) {
                actions.deleteReservation(r);
                onClose();
              }
            }}
          >
            <Trash2 size={14} /> Borrar para siempre
          </Button>
        )}
      </div>
    </Drawer>
  );
}

function Info({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-[13.5px] text-gray-600">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 break-words font-medium text-gray-900">{value}</dd>
    </div>
  );
}
function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-2.5 last:border-0 ${strong ? "bg-gray-50 py-3" : ""}`}>
      <span className={strong ? "font-medium text-gray-800" : "text-gray-600"}>{label}</span>
      <span className={`tabular-nums ${strong ? "text-[18px] font-semibold" : ""} ${tone ?? ""}`}>{value}</span>
    </div>
  );
}
