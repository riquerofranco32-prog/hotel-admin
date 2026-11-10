"use client";
import Link from "next/link";
import { useState } from "react";
import {
  BedDouble,
  CalendarClock,
  CheckCircle2,
  LogIn,
  LogOut,
  Plus,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { ReservationDrawer, ReservationForm } from "@/components/reservation";
import { Badge, Button, Card, PageHeader, Stat, toast } from "@/components/ui";
import { addDays, fmtDate, today } from "@/lib/dates";
import {
  folio,
  isActive,
  money,
  nights,
  roomState,
  ROOM_STATE_CLASS,
  ROOM_STATE_LABEL,
  visualStatus,
  VISUAL_CLASS,
  VISUAL_LABEL,
} from "@/lib/logic";
import type { Reservation } from "@/lib/types";

export default function RecepcionPage() {
  const { data, idx, actions, can } = useApp();
  const showMoney = can("ver_montos");
  const canEdit = can("editar_reservas");
  const t = today();
  const [openRes, setOpenRes] = useState<string | null>(null);
  const [form, setForm] = useState<{
    open: boolean;
    initial?: Partial<Reservation>;
  }>({ open: false });

  const room = (id: string) => data.rooms.find((r) => r.id === id);
  const arrivals = data.reservations
    .filter(
      (r) =>
        (r.status === "confirmada" || r.status === "pendiente") &&
        r.checkIn <= t &&
        r.checkOut > t,
    )
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const arrivedToday = data.reservations.filter(
    (r) => r.status === "checkin" && r.checkIn === t,
  );
  const departures = data.reservations
    .filter((r) => r.status === "checkin" && r.checkOut <= t)
    .sort((a, b) => a.checkOut.localeCompare(b.checkOut));
  const departedToday = data.reservations.filter(
    (r) => r.status === "checkout" && r.checkOut === t,
  );
  const inHouse = data.reservations
    .filter((r) => r.status === "checkin")
    .sort((a, b) =>
      (room(a.roomId)?.number ?? "").localeCompare(
        room(b.roomId)?.number ?? "",
        undefined,
        { numeric: true },
      ),
    );
  const tomorrow = data.reservations.filter(
    (r) => isActive(r) && r.checkIn === addDays(t, 1) && r.status !== "checkin",
  );
  const guestsInHouse = inHouse.reduce((s, r) => s + r.pax, 0);

  async function checkIn(r: Reservation) {
    const rm = room(r.roomId);
    const st = rm ? roomState(rm, data, t) : "lista";
    if (
      st !== "lista" &&
      !confirm(
        `La habitación ${rm?.number} todavía no está lista (${ROOM_STATE_LABEL[st].toLowerCase()}).\n\n¿Querés darle la entrada igual?`,
      )
    )
      return;
    await actions.checkIn(r);
    toast(`${r.guestName} ya entró al hotel ✔`);
  }
  async function checkOut(r: Reservation) {
    const f = folio(r, idx);
    if (
      f.balance > 0 &&
      !confirm(
        `${r.guestName} todavía debe ${money(f.balance)}.\n\n¿Querés darle la salida igual?`,
      )
    )
      return;
    await actions.checkOut(r);
    toast(`${r.guestName} ya se fue ✔ · Ya se avisó a limpieza`);
  }

  const settings = data.settings[0];

  return (
    <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
      <PageHeader
        title="Recepción"
        subtitle={`Hoy ${fmtDate(t)} · Se puede entrar desde las ${settings?.checkInTime ?? "14:00"} · Hay que dejar la habitación antes de las ${settings?.checkOutTime ?? "10:00"}`}
        actions={
          canEdit && (
            <Button
              variant="primary"
              className="!h-11 !px-5 !text-[15px] max-sm:w-full"
              onClick={() =>
                setForm({
                  open: true,
                  initial: {
                    checkIn: t,
                    checkOut: addDays(t, 1),
                    source: "Walk-in",
                    status: "confirmada",
                  },
                })
              }
            >
              <Plus size={15} /> Huésped que llegó sin reserva
            </Button>
          )
        }
      />
      <div className="mb-6 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4 lg:grid-cols-5">
        <Stat
          icon={LogIn}
          label="Todavía no llegaron"
          value={arrivals.length}
          sub={`${arrivedToday.length} ya entraron hoy`}
          tone="blue"
        />
        <Stat
          icon={LogOut}
          label="Todavía no se fueron"
          value={departures.length}
          sub={`${departedToday.length} ya se fueron hoy`}
          tone="red"
        />
        <Stat
          icon={BedDouble}
          label="Habitaciones con gente"
          value={inHouse.length}
          sub={`${guestsInHouse} huéspedes alojados`}
          tone="green"
        />
        <Stat
          icon={CalendarClock}
          label="Llegan mañana"
          value={tomorrow.length}
          tone="gray"
        />
        <Stat
          icon={Sparkles}
          label="Listas para alquilar"
          value={
            data.rooms.filter((r) => roomState(r, data, t) === "lista").length
          }
          sub="limpias y revisadas"
          tone="purple"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title={`Por llegar (${arrivals.length})`}>
          <ul className="divide-y divide-gray-100">
            {arrivals.map((r) => {
              const rm = room(r.roomId);
              const st = rm ? roomState(rm, data, t) : "lista";
              const late = r.checkIn < t;
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 transition-colors duration-150 hover:bg-gray-50/70 motion-reduce:transition-none"
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setOpenRes(r.id)}
                  >
                    <div className="text-[17px] font-semibold leading-snug">
                      {r.guestName}{" "}
                      <span className="font-normal text-gray-600">
                        · {r.pax} {r.pax === 1 ? "persona" : "personas"}
                      </span>
                    </div>
                    <div className="mt-1 text-[14.5px] leading-snug text-gray-600">
                      Habitación <b>{rm?.number}</b> · {nights(r)}{" "}
                      {nights(r) === 1 ? "noche" : "noches"} · {r.source}
                      {late && (
                        <span className="ml-1 font-semibold text-amber-700">
                          · tenía que llegar el {fmtDate(r.checkIn)}
                        </span>
                      )}
                      {r.status === "pendiente" && (
                        <span className="ml-1 font-semibold text-gray-700">
                          · reserva sin confirmar
                        </span>
                      )}
                    </div>
                    {r.notes && (
                      <div className="mt-1.5 inline-flex rounded-md bg-amber-50 px-2 py-1 text-[14px] text-amber-800">
                        <StickyNote size={15} className="mr-1 inline-block align-[-2px]" aria-hidden /> {r.notes}
                      </div>
                    )}
                  </button>
                  <Link
                    href={`/mantenimiento?hab=${r.roomId}`}
                    title="Ver el estado de la habitación"
                  >
                    <Badge className={`${ROOM_STATE_CLASS[st]} !px-2.5 !py-1 !text-[13px]`}>
                      {ROOM_STATE_LABEL[st]}
                    </Badge>
                  </Link>
                  {canEdit && (
                    <Button
                      variant="success"
                      className="!h-11 !px-5 !text-[15px] max-sm:w-full"
                      onClick={() => checkIn(r)}
                    >
                      <LogIn size={16} /> Dar entrada
                    </Button>
                  )}
                </li>
              );
            })}
            {arrivals.length === 0 && (
              <li className="flex flex-col items-center gap-2 px-4 py-10 text-center text-[15px] text-gray-600">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <CheckCircle2 size={20} aria-hidden />
                </span>
                No queda nadie por llegar
              </li>
            )}
          </ul>
        </Card>

        <Card title={`Por irse (${departures.length})`}>
          <ul className="divide-y divide-gray-100">
            {departures.map((r) => {
              const f = folio(r, idx);
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 transition-colors duration-150 hover:bg-gray-50/70 motion-reduce:transition-none"
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setOpenRes(r.id)}
                  >
                    <div className="text-[17px] font-semibold leading-snug">
                      {r.guestName}
                    </div>
                    <div className="mt-1 text-[14.5px] leading-snug text-gray-600">
                      Habitación <b>{room(r.roomId)?.number}</b> · se va el{" "}
                      {fmtDate(r.checkOut)}
                      {r.checkOut < t && (
                        <span className="ml-1 font-semibold text-red-700">
                          · ya pasó el día de salida
                        </span>
                      )}
                    </div>
                  </button>
                  {showMoney && (
                    <Link href={`/facturacion?r=${r.id}`} title="Ver la cuenta">
                      <Badge
                        className={
                          f.balance > 0
                            ? "!px-2.5 !py-1 !text-[13px] bg-red-50 text-red-700 ring-red-200"
                            : "!px-2.5 !py-1 !text-[13px] bg-green-50 text-green-700 ring-green-200"
                        }
                      >
                        {f.balance > 0 ? `Debe ${money(f.balance)}` : "Pagado"}
                      </Badge>
                    </Link>
                  )}
                  {canEdit && (
                    <Button
                      variant="danger"
                      className="!h-11 !px-5 !text-[15px] max-sm:w-full"
                      onClick={() => checkOut(r)}
                    >
                      <LogOut size={16} /> Dar salida
                    </Button>
                  )}
                </li>
              );
            })}
            {departures.length === 0 && (
              <li className="flex flex-col items-center gap-2 px-4 py-10 text-center text-[15px] text-gray-600">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <CheckCircle2 size={20} aria-hidden />
                </span>
                No queda nadie por irse
              </li>
            )}
          </ul>
          <p className="rounded-b-xl border-t border-gray-100 bg-gray-50/60 px-4 py-3 text-[14px] leading-relaxed text-gray-600">
            Al dar la salida, el sistema le avisa solo a limpieza: cambiar
            sábanas, limpiar, reponer artículos y revisar la habitación.
          </p>
        </Card>

        <Card
          title={`Alojados ahora (${inHouse.length})`}
          className="xl:col-span-2"
        >
          <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {inHouse.map((r) => {
              const vs = visualStatus(r, t);
              const f = folio(r, idx);
              return (
                <button
                  key={r.id}
                  onClick={() => setOpenRes(r.id)}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-card transition duration-150 hover:border-gray-400 hover:bg-gray-50 motion-reduce:transition-none"
                >
                  <span
                    className={`flex h-11 w-14 shrink-0 items-center justify-center rounded-lg text-[17px] font-semibold ${VISUAL_CLASS[vs]}`}
                  >
                    {room(r.roomId)?.number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">
                      {r.guestName}
                    </span>
                    <span className="block text-[14px] text-gray-600">
                      {VISUAL_LABEL[vs]} · se va el{" "}
                      {fmtDate(r.checkOut).slice(0, 5)}{" "}
                      {showMoney && f.balance > 0 && (
                        <span className="font-medium text-red-700">
                          · debe {money(f.balance)}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
            {inHouse.length === 0 && (
              <p className="flex items-center gap-3 p-4 text-[15px] text-gray-600 sm:col-span-full">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <BedDouble size={20} aria-hidden />
                </span>
                No hay nadie alojado en este momento.
              </p>
            )}
          </div>
        </Card>
      </div>

      <ReservationDrawer
        id={openRes}
        onClose={() => setOpenRes(null)}
        onEdit={(r) => {
          setOpenRes(null);
          setForm({ open: true, initial: r });
        }}
      />
      <ReservationForm
        open={form.open}
        initial={form.initial}
        onClose={() => setForm({ open: false })}
      />
    </div>
  );
}
