"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, BedDouble, Building2, CalendarDays, CalendarRange, Check, Compass, Crown, Footprints, Globe, Home, LogIn, LogOut, MessageCircle, Pencil, Phone, Plane, Receipt, Star, StickyNote, Tag, Trash2, UserRound, Users, Wallet, Waves } from "lucide-react";
import { useApp } from "./AppProvider";
import { Badge, Button, Drawer, Empty, Field, Input, Modal, Select, Textarea, toast } from "./ui";
import { CountUp, Ring } from "./viz";
import { addDays, fmtDate, fmtDateTime, nowISO, today } from "@/lib/dates";
import { folio, isActive, money, nights, PRIORITY_CLASS, RES_STATUS_BADGE, RES_STATUS_LABEL, roomState, ROOM_STATE_CLASS, ROOM_STATE_LABEL, TASK_STATUS_LABEL, uid, VISUAL_DOT, VISUAL_LABEL, visualStatus } from "@/lib/logic";
import { overlaps } from "@/lib/dates";
import type { Guest, Reservation } from "@/lib/types";
import { TaskIcon } from "./TaskIcon";

function FormSection({ title, icon: Icon, action, children }: { title: string; icon?: React.ElementType; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200/80 bg-panel p-4 shadow-card sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-gray-200/70 pb-3">
        <h4 className="flex min-w-0 items-center gap-2.5 text-base font-semibold tracking-tight text-fg">
          {Icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Icon size={17} aria-hidden />
            </span>
          )}
          {title}
        </h4>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Ficha de pulso para las bandas de encabezado: cifra grande que cuenta, con anillo o ícono. */
export function PulseChip({
  icon: Icon,
  label,
  value,
  sub,
  pct,
  tone = "accent",
  hero,
  format,
  live,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  sub?: string;
  /** Si viene, muestra un anillo con ese porcentaje. */
  pct?: number;
  tone?: "accent" | "green" | "amber" | "red" | "blue";
  hero?: boolean;
  format?: (n: number) => string;
  /** Si es true, muestra un puntito que late (hay algo pendiente). */
  live?: boolean;
}) {
  const fmt = format ?? ((n: number) => String(Math.round(n)));
  return (
    <div className={`flex h-full items-center gap-3.5 rounded-xl border p-4 ${hero ? "hero-card border-transparent" : "border-gray-200/80 bg-panel shadow-card"}`}>
      {pct !== undefined ? (
        <Ring value={pct} size={64} stroke={7} tone={tone} label={`${label}: ${fmt(value)}`}>
          <CountUp value={value} format={fmt} className="num text-[24px] leading-none tabular-nums" />
        </Ring>
      ) : (
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${hero ? "bg-white/20" : "bg-accent/10 text-accent"}`}>
          <Icon size={22} aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className={`label-mono flex items-center gap-2 text-[12.5px] font-medium leading-snug ${hero ? "" : "text-gray-600"}`}>
          {live && <span aria-hidden className={`pulse-dot h-2.5 w-2.5 shrink-0 rounded-full ${hero ? "bg-white" : "bg-accent"}`} />}
          {label}
        </div>
        {pct === undefined && <CountUp value={value} format={fmt} className="num mt-1.5 block truncate text-[30px] leading-none tabular-nums sm:text-[32px]" />}
        {sub && <div className={`mt-1.5 text-[13px] leading-snug ${hero ? "opacity-90" : "text-gray-600"}`}>{sub}</div>}
      </div>
    </div>
  );
}


/* ---------- Piezas visuales compartidas (recepción, reservas, huéspedes) ---------- */

const GRADS = [
  "from-rose-500 to-orange-700",
  "from-sky-500 to-indigo-700",
  "from-emerald-500 to-teal-700",
  "from-amber-600 to-rose-700",
  "from-violet-500 to-fuchsia-700",
  "from-teal-500 to-sky-700",
  "from-fuchsia-500 to-pink-700",
  "from-slate-500 to-slate-800",
];

/** Avatar con degradé (color estable por nombre). `vip` agrega una corona; `ring` un anillo de color por tipo. */
export function GradAvatar({ name, size = 44, vip, ring, className }: { name: string; size?: number; vip?: boolean; ring?: string; className?: string }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const ini = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span className={`relative inline-flex shrink-0 ${className ?? ""}`} style={{ width: size, height: size }}>
      <span
        aria-hidden
        className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white shadow-card ${GRADS[h % GRADS.length]} ${ring ?? ""}`}
        style={{ fontSize: Math.max(13, size * 0.38) }}
      >
        {ini || "?"}
      </span>
      {vip && (
        <span aria-label="Huésped VIP" role="img" className="absolute -right-1 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-amber-950 ring-2 ring-panel">
          <Crown size={12} aria-hidden />
        </span>
      )}
    </span>
  );
}

const SOURCE_ICON: Record<Reservation["source"], React.ElementType> = {
  Directo: Globe,
  Booking: Building2,
  Expedia: Plane,
  Airbnb: Home,
  Teléfono: Phone,
  WhatsApp: MessageCircle,
  "Walk-in": Footprints,
};

/** Ícono del canal por donde llegó la reserva. */
export function SourceIcon({ source, size = 15, className }: { source: Reservation["source"]; size?: number; className?: string }) {
  const Icon = SOURCE_ICON[source] ?? Compass;
  return <Icon size={size} className={className} aria-hidden />;
}

/** Estado vacío de estas pantallas: el `Empty` del sistema con el ícono que corresponde (cama u olas). */
export function EmptyArt({ text, kind = "bed" }: { text: string; kind?: "bed" | "waves" }) {
  return (
    <Empty icon={kind === "bed" ? BedDouble : Waves}>
      <p className="max-w-[36ch] text-pretty">{text}</p>
    </Empty>
  );
}

const BURST_COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6", "#ef4444"];
const BURST_N = 26;

function BurstPieces() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const anims = Array.from(el.children).map((c, i) => {
      const a = (i / BURST_N) * Math.PI * 2 + Math.random() * 0.4;
      const d = 90 + Math.random() * 130;
      return c.animate(
        [
          { transform: "translate(0,0) rotate(0) scale(1)", opacity: 1 },
          { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d + 60}px) rotate(${Math.random() * 540}deg) scale(.6)`, opacity: 0 },
        ],
        { duration: 700 + Math.random() * 200, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" },
      );
    });
    return () => anims.forEach((x) => x.cancel());
  }, []);
  return (
    <div ref={ref} aria-hidden className="pointer-events-none fixed left-1/2 top-1/3 z-[100]">
      {Array.from({ length: BURST_N }, (_, i) => (
        <span key={i} className="absolute h-2.5 w-2.5 rounded-sm" style={{ background: BURST_COLORS[i % BURST_COLORS.length], opacity: 0 }} />
      ))}
    </div>
  );
}

/** Confeti simple: `fire()` lo dispara, `node` va en cualquier parte del JSX. */
export function useBurst() {
  const [n, setN] = useState(0);
  const fire = useCallback(() => setN((x) => x + 1), []);
  return { fire, node: n > 0 ? <BurstPieces key={n} /> : null };
}

const STEPS = ["Reservada", "Alojado", "Se fue"];

function stepIndex(status: Reservation["status"]): number {
  return status === "checkout" ? 2 : status === "checkin" ? 1 : 0;
}

/** Recorrido de la reserva: Reservada, Alojado, Se fue. */
function Stepper({ status }: { status: Reservation["status"] }) {
  const cur = stepIndex(status);
  return (
    <ol aria-label="Recorrido de la reserva" className="relative flex items-start">
      <span aria-hidden className="absolute left-[16.66%] right-[16.66%] top-[17px] h-1 rounded-full bg-gray-200" />
      <span aria-hidden className="absolute left-[16.66%] top-[17px] h-1 rounded-full bg-accent transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${(cur / 2) * 66.68}%` }} />
      {STEPS.map((label, i) => {
        const done = i < cur;
        const now = i === cur;
        return (
          <li key={label} className="relative flex-1 text-center" aria-current={now ? "step" : undefined}>
            <span
              className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full border-2 text-[14px] font-semibold tabular-nums ${
                done ? "border-accent bg-accent text-accent-fg" : now ? "border-accent bg-panel text-accent ring-4 ring-accent/25" : "border-gray-300 bg-panel text-gray-500"
              }`}
            >
              {done ? <Check size={16} aria-hidden /> : i + 1}
            </span>
            <span className={`mt-1.5 block text-[14px] leading-tight ${now ? "font-semibold text-fg" : "text-gray-600"}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

const DAY_MS = 86400000;

/** Barra de días de estadía con marcador de hoy. */
function StayBar({ checkIn, checkOut, today: t, n }: { checkIn: string; checkOut: string; today: string; n: number }) {
  const total = Math.max(1, n);
  const elapsed = Math.round((Date.parse(t) - Date.parse(checkIn)) / DAY_MS);
  const clamped = Math.min(total, Math.max(0, elapsed));
  const pct = (clamped / total) * 100;
  const text =
    elapsed < 0
      ? `Faltan ${-elapsed} ${-elapsed === 1 ? "día" : "días"} para que llegue`
      : elapsed >= total
        ? `La estadía terminó (${total} ${total === 1 ? "noche" : "noches"})`
        : `Día ${elapsed + 1} de ${total}`;
  return (
    <div role="img" aria-label={text}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <span className="text-[15px] font-semibold">{text}</span>
        <span className="label-mono whitespace-nowrap text-[12.5px] tabular-nums text-gray-600">{fmtDate(checkIn).slice(0, 5)} → {fmtDate(checkOut).slice(0, 5)}</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-gray-200/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]">
        <div className="h-full rounded-full bg-gradient-to-r from-accent/70 to-accent" style={{ width: `${pct}%` }} />
        {elapsed >= 0 && elapsed < total && (
          <span aria-hidden className="absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-accent bg-panel shadow-card" style={{ left: `${Math.max(3, Math.min(97, pct))}%` }} />
        )}
      </div>
      <div className="label-mono mt-1.5 flex justify-between text-[12.5px] text-gray-600">
        <span>Entrada</span>
        <span>Salida</span>
      </div>
    </div>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-[30px] items-center gap-1.5 rounded-full bg-panel px-3 py-0.5 text-[13.5px] font-medium text-gray-700 ring-1 ring-inset ring-gray-200 [&>svg]:shrink-0 [&>svg]:text-gray-500">
      {icon}
      {children}
    </span>
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
          <Button className="max-sm:flex-1" onClick={onClose}>Cerrar sin guardar</Button>
          <Button variant="primary" className="max-sm:flex-1" onClick={save}>
            {editing ? "Guardar cambios" : "Crear reserva"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormSection
          title="Huésped"
          icon={UserRound}
          action={
            <button
              type="button"
              className="-mr-2 min-h-[44px] rounded-lg px-3 py-2 text-[14px] font-semibold text-accent transition-colors duration-150 hover:bg-accent/10 motion-reduce:transition-none sm:min-h-9 sm:py-1.5"
              onClick={() => setNewGuest(!newGuest)}
            >
              {newGuest ? "Elegir uno que ya conocemos" : "+ Es un huésped nuevo"}
            </button>
          }
        >
          {newGuest ? (
            <div className="grid gap-3 rounded-lg border border-dashed border-gray-300 bg-panel-2/50 p-3 sm:grid-cols-2">
              <Input placeholder="Nombre y apellido *" value={g.name ?? ""} onChange={(e) => setG({ ...g, name: e.target.value })} />
              <Input placeholder="Teléfono con código de área (ej. 5491155551234)" value={g.phone ?? ""} onChange={(e) => setG({ ...g, phone: e.target.value })} />
              <Input placeholder="Email" value={g.email ?? ""} onChange={(e) => setG({ ...g, email: e.target.value })} />
              <Input placeholder="DNI / Pasaporte" value={g.document ?? ""} onChange={(e) => setG({ ...g, document: e.target.value })} />
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input placeholder="Buscar por nombre" className="w-full sm:w-[200px] sm:shrink-0" value={guestQuery} onChange={(e) => setGuestQuery(e.target.value)} />
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

        <FormSection title="Fechas y habitación" icon={CalendarRange}>
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

        <FormSection title="Precio y detalles" icon={Wallet}>
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
            <div className="hero-card flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl px-4 py-3.5 text-[15px] sm:self-end">
              <span className="label-mono text-[12.5px] font-medium">
                {n} noche{n === 1 ? "" : "s"} · Total de la estadía
              </span>
              <b className="num text-[28px] leading-none tabular-nums">
                <CountUp value={n * (Number(r.rate) || 0)} format={money} duration={400} />
              </b>
            </div>
            <Field label="Pedidos especiales o notas" className="sm:col-span-2" hint="Limpieza lo ve y deja la habitación lista antes de que llegue.">
              <Textarea rows={2} value={r.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
            </Field>
          </div>
        </FormSection>
      </div>
      {error && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-[14px] font-medium text-red-700 ring-1 ring-inset ring-red-200">
          <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </Modal>
  );
}

export function ReservationDrawer({ id, onClose, onEdit }: { id: string | null; onClose: () => void; onEdit: (r: Reservation) => void }) {
  const { data, idx, actions, staffName, me, can } = useApp();
  const { fire, node: burst } = useBurst();
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
    fire();
    toast("Ya entró al hotel ✔");
  }
  async function doCheckOut() {
    if (f.balance > 0 && !confirm(`Todavía debe ${money(f.balance)}.\n\n¿Querés darle la salida igual?`)) return;
    await actions.checkOut(r!);
    fire();
    toast("Ya se fue ✔ · Ya se avisó a limpieza");
  }

  const paidPct = f.total > 0 ? Math.min(100, Math.max(0, (f.paid / f.total) * 100)) : 100;

  return (
    <>
    {burst}
    <Drawer open={!!id} onClose={onClose} title={`Reserva · ${r.guestName}`}>
      <div className="space-y-6">
        <div className="aurora -mx-5 -mt-5 overflow-hidden border-b border-gray-200/70 px-5 pb-5 pt-5">
          <div className="flex items-center gap-4">
            <GradAvatar name={r.guestName} size={60} vip={guestTags.includes("VIP")} ring="ring-4 ring-accent/20" />
            <div className="min-w-0 flex-1">
              <div className="break-words text-[21px] font-semibold leading-tight tracking-tight">{r.guestName}</div>
              <div className="label-mono mt-1.5 text-[12.5px] text-gray-600">N° {r.id.slice(-6)}</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge className={`${RES_STATUS_BADGE[r.status]} !px-3 !py-1`}>{RES_STATUS_LABEL[r.status]}</Badge>
            {isActive(r) && r.status !== "checkout" && (
              <Badge className="bg-panel !px-3 !py-1 text-gray-700 ring-gray-200" dot={false}>
                <span aria-hidden className={`mr-0.5 h-2 w-2 shrink-0 rounded-full ${VISUAL_DOT[vs]}`} /> {VISUAL_LABEL[vs]}
              </Badge>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip icon={<SourceIcon source={r.source} />}>{r.source}</Chip>
            <Chip icon={<Users size={15} aria-hidden />}>{r.pax} {r.pax === 1 ? "persona" : "personas"}</Chip>
            {r.notes && <Chip icon={<StickyNote size={15} aria-hidden />}>Con notas</Chip>}
          </div>
        </div>

        {r.status !== "cancelada" && r.status !== "no_show" && (
          <section className="space-y-5 rounded-xl border border-gray-200/80 bg-panel p-4 shadow-card">
            <Stepper status={r.status} />
            <StayBar checkIn={r.checkIn} checkOut={r.checkOut} today={t} n={nights(r)} />
          </section>
        )}

        <dl className="grid grid-cols-2 gap-2 text-[15px]">
          <Info icon={<BedDouble size={15} />} label="Habitación" value={`${room?.number ?? "?"} · ${room?.type ?? ""}`} />
          <Info icon={<Users size={15} />} label="Personas" value={`${r.pax} ${r.pax === 1 ? "persona" : "personas"}`} />
          <Info icon={<CalendarDays size={15} />} label="Entrada" value={fmtDate(r.checkIn)} />
          <Info icon={<CalendarDays size={15} />} label="Salida" value={`${fmtDate(r.checkOut)} (${nights(r)} ${nights(r) === 1 ? "noche" : "noches"})`} />
          <Info icon={<Compass size={15} />} label="Llegó por" value={r.source} />
          <Info icon={<Phone size={15} />} label="Teléfono" value={guest?.phone ?? "—"} />
        </dl>
        {(guestTags.length > 0 || guest?.preferences) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg bg-blue-50 px-3.5 py-3 text-[15px] leading-snug text-blue-900 ring-1 ring-inset ring-blue-200">
            {guestTags.map((tg) => (
              <Badge key={tg} dot={false} className={tg === "VIP" ? "bg-amber-100 text-amber-800" : "bg-panel text-gray-700"}>
                <Tag size={12} aria-hidden /> {tg}
              </Badge>
            ))}
            {guest?.preferences && <span className="min-w-0 break-words"><Star size={15} className="mr-1 inline-block align-[-2px]" aria-hidden /> {guest.preferences}</span>}
          </div>
        )}
        {r.notes && (
          <p className="flex gap-2 rounded-lg bg-amber-50 px-3.5 py-3 text-[15px] leading-snug text-amber-900 ring-1 ring-inset ring-amber-200">
            <StickyNote size={16} className="mt-0.5 shrink-0" aria-hidden /> <span className="min-w-0 break-words">{r.notes}</span>
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          {canEdit && r.status === "pendiente" && (
            <Button variant="primary" className="col-span-2 !h-12 !text-[16px]" onClick={() => actions.setReservationStatus(r, "confirmada").then(() => toast("Reserva confirmada"))}>
              Confirmar reserva
            </Button>
          )}
          {canCheckIn && (
            <Button variant="success" className="col-span-2 !h-12 !text-[16px]" onClick={doCheckIn}>
              <LogIn size={18} /> Dar entrada
            </Button>
          )}
          {canCheckOut && (
            <Button variant="danger" className="col-span-2 !h-12 !text-[16px]" onClick={doCheckOut}>
              <LogOut size={18} /> Dar salida
            </Button>
          )}
          {canEdit && (
            <Button className="w-full" onClick={() => onEdit(r)}>
              <Pencil size={15} /> Editar
            </Button>
          )}
          {can("facturacion") && (
            <Link href={`/facturacion?r=${r.id}`} className="contents">
              <Button className="!h-auto min-h-[44px] w-full !whitespace-normal !py-2 text-center leading-tight sm:min-h-10">
                <Receipt size={16} className="shrink-0" /> Ver cuenta y factura
              </Button>
            </Link>
          )}
          {can("whatsapp") && (
            <Link href={`/whatsapp?r=${r.id}`} className="contents">
              <Button className="!h-auto min-h-[44px] w-full !whitespace-normal !py-2 text-center leading-tight sm:min-h-10">
                <MessageCircle size={16} className="shrink-0" /> WhatsApp
              </Button>
            </Link>
          )}
        </div>

        {showMoney && (
          <section>
            <h4 className="label-mono mb-2 text-[12.5px] font-medium text-gray-600">Cuenta</h4>
            <div className="overflow-hidden rounded-xl border border-gray-200/80 bg-panel text-[15px] shadow-card">
              <Row label={`Alojamiento (${nights(r)} × ${money(r.rate)})`} value={money(f.lodging)} />
              <Row label={`Consumos (${f.charges.length})`} value={money(f.extras)} />
              <Row label="Pagado" value={`− ${money(f.paid)}`} />
              <div className="flex items-center gap-4 border-b border-gray-200/70 px-4 py-3">
                <Ring value={paidPct} size={68} stroke={7} tone={paidPct >= 100 ? "green" : "amber"} label={`${Math.round(paidPct)}% pagado`}>
                  <span className="num text-[18px] leading-none tabular-nums">{Math.round(paidPct)}%</span>
                </Ring>
                <div className="min-w-0">
                  <div className="label-mono text-[12.5px] text-gray-600">{Math.round(paidPct)}% pagado</div>
                  <div className={`mt-0.5 text-[15px] font-semibold tabular-nums ${f.balance > 0 ? "text-red-600" : "text-green-700"}`}>
                    {f.balance > 0 ? `Falta cobrar ${money(f.balance)}` : "Todo pagado"}
                  </div>
                </div>
              </div>
              <Row label="Saldo" value={money(f.balance)} strong tone={f.balance > 0 ? "text-red-600" : "text-green-700"} />
            </div>
          </section>
        )}

        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 className="label-mono text-[12.5px] font-medium text-gray-600">Estado de la habitación</h4>
            {state && <Badge className={ROOM_STATE_CLASS[state]}>{ROOM_STATE_LABEL[state]}</Badge>}
          </div>
          {tasks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 px-3.5 py-3 text-[14px] text-gray-600">No hay tareas para esta habitación.</p>
          ) : (
            <ul className="divide-y divide-gray-200/70 overflow-hidden rounded-xl border border-gray-200/80 bg-panel shadow-card">
              {tasks.slice(0, 10).map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[15px]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium" title={task.title}>
                      <TaskIcon type={task.type} /> {task.title}
                    </span>
                    <span className="block truncate text-[13px] text-gray-600">
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
          <Link href={`/mantenimiento?hab=${r.roomId}`} className="mt-2 inline-flex min-h-[44px] items-center rounded-md text-[14px] font-semibold text-accent underline-offset-4 hover:underline sm:min-h-9">
            Ver limpieza y arreglos →
          </Link>
        </section>

        <section className="space-y-1 border-t border-gray-200/70 pt-4 text-[13.5px] leading-snug text-gray-600">
          <div>Reserva cargada el {fmtDateTime(r.createdAt)} por {staffName(r.createdBy)}</div>
          {r.checkedInAt && <div>Entró el {fmtDateTime(r.checkedInAt)} (lo registró {staffName(r.checkedInBy)})</div>}
          {r.checkedOutAt && <div>Se fue el {fmtDateTime(r.checkedOutAt)} (lo registró {staffName(r.checkedOutBy)})</div>}
        </section>

        {canEdit && isActive(r) && r.status !== "checkout" && (
          <div className="-mx-1 flex flex-wrap gap-1 border-t border-gray-200/70 pt-3">
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
            className="-mx-1 text-red-600 hover:!bg-red-50 hover:!text-red-700"
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
    </>
  );
}

function Info({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-gray-200/80 bg-panel-2/60 px-3 py-2.5">
      <dt className="label-mono flex items-center gap-1.5 text-[12.5px] text-gray-600 [&>svg]:shrink-0 [&>svg]:text-gray-500">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium leading-snug tabular-nums text-fg">{value}</dd>
    </div>
  );
}
function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 border-b border-gray-200/70 px-4 last:border-0 ${strong ? "bg-accent/5 py-3.5" : "py-2.5"}`}>
      <span className={strong ? "label-mono text-[12.5px] font-medium text-gray-700" : "min-w-0 text-gray-600"}>{label}</span>
      <span className={`whitespace-nowrap tabular-nums ${strong ? "num text-[26px] leading-none" : "font-medium text-fg"} ${tone ?? ""}`}>{value}</span>
    </div>
  );
}
