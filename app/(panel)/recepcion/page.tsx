"use client";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import {
  BedDouble,
  CalendarClock,
  Clock,
  Droplets,
  LogIn,
  LogOut,
  Plus,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { EmptyArt, GradAvatar, PulseChip, ReservationDrawer, ReservationForm, useBurst } from "@/components/reservation";
import { Badge, Button, Card, PageHeader, toast } from "@/components/ui";
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

function RoomBox({ number }: { number?: string }) {
  return (
    <span className="num flex h-14 w-16 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-100 text-[26px]">
      {number}
    </span>
  );
}

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
  const { fire, node: burst } = useBurst();
  const [nowHM, setNowHM] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNowHM(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    tick();
    const i = setInterval(tick, 60000);
    return () => clearInterval(i);
  }, []);
  const avatar = (r: Reservation) => (
    <span className="hidden min-[440px]:block">
      <GradAvatar name={r.guestName} size={44} vip={!!idx.guestById.get(r.guestId)?.tags?.includes("VIP")} />
    </span>
  );

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
    fire();
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
    fire();
    toast(`${r.guestName} ya se fue ✔ · Ya se avisó a limpieza`);
  }

  const settings = data.settings[0];
  const readyCount = data.rooms.filter((r) => roomState(r, data, t) === "lista").length;
  const pctOf = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const inTime = settings?.checkInTime ?? "14:00";
  const outTime = settings?.checkOutTime ?? "10:00";
  const events = [
    ...arrivals.map((r) => ({ r, kind: "in" as const, time: inTime, late: r.checkIn < t })),
    ...departures.map((r) => ({ r, kind: "out" as const, time: outTime, late: r.checkOut < t })),
  ].sort((a, b) => Number(b.late) - Number(a.late) || a.time.localeCompare(b.time));
  const nowIdx = nowHM ? events.findIndex((e) => !e.late && e.time > nowHM) : -1;
  const nowMarker = (
    <li key="ahora" aria-label={`Ahora, ${nowHM}`} className="relative py-1.5 pl-9">
      <span aria-hidden className="pulse-dot absolute left-[5px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-accent" />
      <div className="flex items-center gap-2">
        <span aria-hidden className="h-px flex-1 bg-accent/50" />
        <span className="label-mono text-[12.5px] font-semibold text-accent">Ahora · {nowHM}</span>
      </div>
    </li>
  );

  return (
    <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
      {burst}
      <div className="aurora">
        <PageHeader
          eyebrow={`Hoy · ${fmtDate(t)}`}
          title={<span className="serif-accent">Recepción</span>}
          subtitle={`Hoy ${fmtDate(t)} · Se puede entrar desde las ${settings?.checkInTime ?? "14:00"} · Hay que dejar la habitación antes de las ${settings?.checkOutTime ?? "10:00"}`}
          actions={
            canEdit && (
              <Button
                variant="primary"
                className="!h-12 !px-6 !text-[15px] max-sm:w-full"
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
                <Plus size={16} /> Huésped que llegó sin reserva
              </Button>
            )
          }
        />
        <div className="stagger mb-7 grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 sm:gap-4 xl:grid-cols-5">
          <PulseChip
            hero
            icon={LogIn}
            label="Todavía no llegaron"
            value={arrivals.length}
            live={arrivals.length > 0}
            sub={`${arrivedToday.length} ya entraron hoy`}
          />
          <PulseChip
            icon={LogOut}
            label="Todavía no se fueron"
            value={departures.length}
            pct={pctOf(departedToday.length, departedToday.length + departures.length)}
            tone="red"
            live={departures.length > 0}
            sub={`${departedToday.length} ya se fueron hoy`}
          />
          <PulseChip
            icon={BedDouble}
            label="Habitaciones con gente"
            value={inHouse.length}
            pct={pctOf(inHouse.length, data.rooms.length)}
            tone="green"
            sub={`${guestsInHouse} huéspedes alojados`}
          />
          <PulseChip icon={CalendarClock} label="Llegan mañana" value={tomorrow.length} />
          <PulseChip
            icon={Sparkles}
            label="Listas para alquilar"
            value={readyCount}
            pct={pctOf(readyCount, data.rooms.length)}
            tone="blue"
            sub="limpias y revisadas"
          />
        </div>
      </div>

      <Card title="Lo que viene hoy" icon={Clock} count={events.length} className="mb-5">
        {events.length === 0 ? (
          <EmptyArt kind="waves" text="No hay llegadas ni salidas pendientes. Día tranquilo." />
        ) : (
          <ol className="max-h-[320px] overflow-y-auto p-3 sm:p-4">
            {events.map((e, i) => (
              <Fragment key={`${e.kind}-${e.r.id}`}>
                {i === nowIdx && nowMarker}
                <li className="relative pl-9">
                  <span aria-hidden className="absolute bottom-0 left-[11px] top-0 w-0.5 bg-gray-200" />
                  <span
                    aria-hidden
                    className={`absolute left-[5px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full ring-4 ring-panel ${e.kind === "in" ? "bg-green-500" : "bg-red-500"}`}
                  />
                  <button
                    onClick={() => setOpenRes(e.r.id)}
                    className="flex min-h-[48px] w-full flex-wrap items-center gap-x-3 gap-y-0.5 rounded-xl px-3 py-2 text-left transition-colors duration-150 hover:bg-gray-50 motion-reduce:transition-none"
                  >
                    <span className="num w-[3.25rem] text-[20px] tabular-nums">{e.time}</span>
                    {e.kind === "in" ? <LogIn size={17} className="text-green-700" aria-hidden /> : <LogOut size={17} className="text-red-600" aria-hidden />}
                    <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">{e.r.guestName}</span>
                    <span className="text-[14px] text-gray-600">
                      {e.kind === "in" ? "Llega" : "Se va"} · hab. {room(e.r.roomId)?.number}
                      {e.late && <b className="ml-1 text-amber-700">· atrasada</b>}
                    </span>
                  </button>
                </li>
              </Fragment>
            ))}
            {nowIdx === -1 && nowHM && events.length > 0 && nowMarker}
          </ol>
        )}
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Por llegar" icon={LogIn} count={arrivals.length}>
          <ul className="stagger divide-y divide-gray-100">
            {arrivals.map((r) => {
              const rm = room(r.roomId);
              const st = rm ? roomState(rm, data, t) : "lista";
              const late = r.checkIn < t;
              return (
                <li
                  key={r.id}
                  className="group relative flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 transition-colors duration-150 hover:bg-gray-50/70 motion-reduce:transition-none"
                >
                  <span aria-hidden className="absolute inset-y-3 left-0 w-1 origin-center scale-y-0 rounded-r-full bg-accent transition-transform duration-200 group-focus-within:scale-y-100 group-hover:scale-y-100 motion-reduce:transition-none" />
                  <button
                    className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
                    onClick={() => setOpenRes(r.id)}
                  >
                    <RoomBox number={rm?.number} />
                    {avatar(r)}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[18px] font-semibold leading-snug">
                        {r.guestName}{" "}
                        <span className="font-normal text-gray-600">
                          · {r.pax} {r.pax === 1 ? "persona" : "personas"}
                        </span>
                      </span>
                      <span className="mt-1 block text-[14.5px] leading-snug text-gray-600">
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
                      </span>
                      {r.notes && (
                        <span className="mt-1.5 inline-flex rounded-md bg-amber-50 px-2 py-1 text-[14px] text-amber-800">
                          <StickyNote size={15} className="mr-1 inline-block align-[-2px]" aria-hidden /> {r.notes}
                        </span>
                      )}
                    </span>
                  </button>
                  <Link
                    href={`/mantenimiento?hab=${r.roomId}`}
                    title="Ver el estado de la habitación"
                    className="inline-flex min-h-[44px] items-center"
                  >
                    <Badge className={`${ROOM_STATE_CLASS[st]} !px-2.5 !py-1 !text-[13px]`} dot={false}>
                      {st === "lista" ? <Sparkles size={14} className="mr-1 motion-safe:animate-pulse" aria-hidden /> : <Droplets size={14} className="mr-1 motion-safe:animate-pulse" aria-hidden />}
                      {ROOM_STATE_LABEL[st]}
                    </Badge>
                  </Link>
                  {canEdit && (
                    <Button
                      variant="success"
                      className="!h-12 !px-6 !text-[16px] shadow-md max-sm:w-full"
                      onClick={() => checkIn(r)}
                    >
                      <LogIn size={18} /> Dar entrada
                    </Button>
                  )}
                </li>
              );
            })}
            {arrivals.length === 0 && (
              <li>
                <EmptyArt kind="waves" text="No queda nadie por llegar" />
              </li>
            )}
          </ul>
        </Card>

        <Card title="Por irse" icon={LogOut} count={departures.length}>
          <ul className="stagger divide-y divide-gray-100">
            {departures.map((r) => {
              const f = folio(r, idx);
              return (
                <li
                  key={r.id}
                  className="group relative flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 transition-colors duration-150 hover:bg-gray-50/70 motion-reduce:transition-none"
                >
                  <span aria-hidden className="absolute inset-y-3 left-0 w-1 origin-center scale-y-0 rounded-r-full bg-accent transition-transform duration-200 group-focus-within:scale-y-100 group-hover:scale-y-100 motion-reduce:transition-none" />
                  <button
                    className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
                    onClick={() => setOpenRes(r.id)}
                  >
                    <RoomBox number={room(r.roomId)?.number} />
                    {avatar(r)}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[18px] font-semibold leading-snug">
                        {r.guestName}
                      </span>
                      <span className="mt-1 block text-[14.5px] leading-snug text-gray-600">
                        Habitación <b>{room(r.roomId)?.number}</b> · se va el{" "}
                        {fmtDate(r.checkOut)}
                        {r.checkOut < t && (
                          <span className="ml-1 font-semibold text-red-700">
                            · ya pasó el día de salida
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                  {showMoney && (
                    <Link href={`/facturacion?r=${r.id}`} title="Ver la cuenta" className="inline-flex min-h-[44px] items-center">
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
                      className="!h-12 !px-6 !text-[16px] shadow-md max-sm:w-full"
                      onClick={() => checkOut(r)}
                    >
                      <LogOut size={18} /> Dar salida
                    </Button>
                  )}
                </li>
              );
            })}
            {departures.length === 0 && (
              <li>
                <EmptyArt kind="waves" text="No queda nadie por irse" />
              </li>
            )}
          </ul>
          <p className="rounded-b-xl border-t border-gray-200/80 bg-gray-50/60 px-4 py-3 text-[14px] leading-relaxed text-gray-600">
            Al dar la salida, el sistema le avisa solo a limpieza: cambiar
            sábanas, limpiar, reponer artículos y revisar la habitación.
          </p>
        </Card>

        <Card
          title="Alojados ahora"
          icon={BedDouble}
          count={inHouse.length}
          className="xl:col-span-2"
        >
          <div className="stagger grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {inHouse.map((r) => {
              const vs = visualStatus(r, t);
              const f = folio(r, idx);
              return (
                <button
                  key={r.id}
                  onClick={() => setOpenRes(r.id)}
                  className="lift flex min-h-[72px] items-center gap-3.5 rounded-2xl border border-gray-200/80 bg-white p-3.5 text-left"
                >
                  <span
                    className={`num flex h-14 w-16 shrink-0 items-center justify-center rounded-xl text-[26px] ${VISUAL_CLASS[vs]}`}
                  >
                    {room(r.roomId)?.number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold">
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
              <div className="sm:col-span-full">
                <EmptyArt text="No hay nadie alojado en este momento." />
              </div>
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
