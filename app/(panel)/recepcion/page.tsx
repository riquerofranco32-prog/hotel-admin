"use client";
import Link from "next/link";
import { useState } from "react";
import { LogIn, LogOut, Plus } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { ReservationDrawer, ReservationForm } from "@/components/reservation";
import { Badge, Button, Card, PageHeader, Stat, toast } from "@/components/ui";
import { addDays, fmtDate, today } from "@/lib/dates";
import { folio, isActive, money, nights, roomState, ROOM_STATE_CLASS, ROOM_STATE_LABEL, visualStatus, VISUAL_CLASS, VISUAL_LABEL } from "@/lib/logic";
import type { Reservation } from "@/lib/types";

export default function RecepcionPage() {
  const { data, idx, actions, can } = useApp();
  const showMoney = can("ver_montos");
  const canEdit = can("editar_reservas");
  const t = today();
  const [openRes, setOpenRes] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; initial?: Partial<Reservation> }>({ open: false });

  const room = (id: string) => data.rooms.find((r) => r.id === id);
  const arrivals = data.reservations
    .filter((r) => (r.status === "confirmada" || r.status === "pendiente") && r.checkIn <= t && r.checkOut > t)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const arrivedToday = data.reservations.filter((r) => r.status === "checkin" && r.checkIn === t);
  const departures = data.reservations.filter((r) => r.status === "checkin" && r.checkOut <= t).sort((a, b) => a.checkOut.localeCompare(b.checkOut));
  const departedToday = data.reservations.filter((r) => r.status === "checkout" && r.checkOut === t);
  const inHouse = data.reservations
    .filter((r) => r.status === "checkin")
    .sort((a, b) => (room(a.roomId)?.number ?? "").localeCompare(room(b.roomId)?.number ?? "", undefined, { numeric: true }));
  const tomorrow = data.reservations.filter((r) => isActive(r) && r.checkIn === addDays(t, 1) && r.status !== "checkin");
  const guestsInHouse = inHouse.reduce((s, r) => s + r.pax, 0);

  async function checkIn(r: Reservation) {
    const rm = room(r.roomId);
    const st = rm ? roomState(rm, data, t) : "lista";
    if (st !== "lista" && !confirm(`La habitación ${rm?.number} está "${ROOM_STATE_LABEL[st]}". ¿Hacer check-in igual?`)) return;
    await actions.checkIn(r);
    toast(`Check-in de ${r.guestName} ✔`);
  }
  async function checkOut(r: Reservation) {
    const f = folio(r, idx);
    if (f.balance > 0 && !confirm(`${r.guestName} tiene saldo pendiente de ${money(f.balance)}. ¿Hacer check-out igual?`)) return;
    await actions.checkOut(r);
    toast(`Check-out de ${r.guestName} ✔ · Housekeeping notificado`);
  }

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Recepción"
        subtitle={`Hoy ${fmtDate(t)} · Check-in desde ${data.settings[0]?.checkInTime ?? "14:00"} · Check-out hasta ${data.settings[0]?.checkOutTime ?? "10:00"}`}
        actions={
          canEdit && (
            <Button variant="primary" onClick={() => setForm({ open: true, initial: { checkIn: t, checkOut: addDays(t, 1), source: "Walk-in", status: "confirmada" } })}>
              <Plus size={15} /> Walk-in
            </Button>
          )
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Llegadas pendientes" value={arrivals.length} sub={`${arrivedToday.length} ya ingresaron hoy`} tone="blue" />
        <Stat label="Salidas pendientes" value={departures.length} sub={`${departedToday.length} ya salieron hoy`} tone="red" />
        <Stat label="Habitaciones ocupadas" value={inHouse.length} sub={`${guestsInHouse} huéspedes en casa`} tone="green" />
        <Stat label="Llegan mañana" value={tomorrow.length} tone="gray" />
        <Stat
          label="Hab. listas para vender"
          value={data.rooms.filter((r) => roomState(r, data, t) === "lista").length}
          sub="limpias e inspeccionadas"
          tone="purple"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={`Llegadas (${arrivals.length})`}>
          <ul className="divide-y divide-gray-100">
            {arrivals.map((r) => {
              const rm = room(r.roomId);
              const st = rm ? roomState(rm, data, t) : "lista";
              const late = r.checkIn < t;
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setOpenRes(r.id)}>
                    <div className="font-medium">
                      {r.guestName} <span className="text-gray-400">· {r.pax}p</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Hab. <b>{rm?.number}</b> · {nights(r)} noches · {r.source}
                      {late && <span className="ml-1 font-semibold text-amber-600">· debía llegar el {fmtDate(r.checkIn)}</span>}
                      {r.status === "pendiente" && <span className="ml-1 font-semibold text-gray-700">· sin confirmar</span>}
                    </div>
                    {r.notes && <div className="text-xs text-amber-700">📝 {r.notes}</div>}
                  </button>
                  <Link href={`/mantenimiento?hab=${r.roomId}`}>
                    <Badge className={ROOM_STATE_CLASS[st]}>{ROOM_STATE_LABEL[st]}</Badge>
                  </Link>
                  {canEdit && (
                    <Button size="sm" variant="success" onClick={() => checkIn(r)}>
                      <LogIn size={14} /> Check-in
                    </Button>
                  )}
                </li>
              );
            })}
            {arrivals.length === 0 && <li className="px-4 py-8 text-center text-sm text-gray-500">No hay llegadas pendientes 🎉</li>}
          </ul>
        </Card>

        <Card title={`Salidas (${departures.length})`}>
          <ul className="divide-y divide-gray-100">
            {departures.map((r) => {
              const f = folio(r, idx);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setOpenRes(r.id)}>
                    <div className="font-medium">{r.guestName}</div>
                    <div className="text-xs text-gray-500">
                      Hab. <b>{room(r.roomId)?.number}</b> · salida {fmtDate(r.checkOut)}
                      {r.checkOut < t && <span className="ml-1 font-semibold text-red-600">· VENCIDA</span>}
                    </div>
                  </button>
                  {showMoney && <Link href={`/facturacion?r=${r.id}`}>
                    <Badge className={f.balance > 0 ? "bg-red-50 text-red-700 ring-red-200" : "bg-green-50 text-green-700 ring-green-200"}>
                      {f.balance > 0 ? `Debe ${money(f.balance)}` : "Pagado"}
                    </Badge>
                  </Link>}
                  {canEdit && (
                    <Button size="sm" variant="danger" onClick={() => checkOut(r)}>
                      <LogOut size={14} /> Check-out
                    </Button>
                  )}
                </li>
              );
            })}
            {departures.length === 0 && <li className="px-4 py-8 text-center text-sm text-gray-500">No hay salidas pendientes</li>}
          </ul>
          <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
            Al hacer check-out se crean automáticamente las tareas de cambio de sábanas, limpieza, reposición e inspección.
          </p>
        </Card>

        <Card title={`En casa (${inHouse.length})`} className="xl:col-span-2">
          <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {inHouse.map((r) => {
              const vs = visualStatus(r, t);
              const f = folio(r, idx);
              return (
                <button key={r.id} onClick={() => setOpenRes(r.id)} className="flex items-center gap-3 rounded-lg border border-gray-200 p-2.5 text-left hover:border-gray-400">
                  <span className={`flex h-10 w-12 shrink-0 items-center justify-center rounded-md text-sm font-semibold ${VISUAL_CLASS[vs]}`}>
                    {room(r.roomId)?.number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.guestName}</span>
                    <span className="block text-xs text-gray-500">
                      {VISUAL_LABEL[vs]} · sale {fmtDate(r.checkOut).slice(0, 5)} {showMoney && f.balance > 0 && <span className="text-red-600">· {money(f.balance)}</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      <ReservationDrawer id={openRes} onClose={() => setOpenRes(null)} onEdit={(r) => { setOpenRes(null); setForm({ open: true, initial: r }); }} />
      <ReservationForm open={form.open} initial={form.initial} onClose={() => setForm({ open: false })} />
    </div>
  );
}
