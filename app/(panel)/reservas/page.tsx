"use client";
import {
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  BarChart3,
  CalendarCheck,
  Clock,
  LayoutGrid,
  Moon,
  Plus,
  Search,
  Table2,
  Wallet,
  X,
} from "lucide-react";
import { useApp } from "@/components/AppProvider";
import {
  EmptyArt,
  GradAvatar,
  PulseChip,
  ReservationDrawer,
  ReservationForm,
  SourceIcon,
} from "@/components/reservation";
import { BarChart } from "@/components/viz";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Input,
  PageHeader,
  Progress,
  Select,
  Table,
} from "@/components/ui";
import { addDays, fmtDate, today } from "@/lib/dates";
import {
  cls,
  folio,
  money,
  nights,
  RES_STATUS_BADGE,
  RES_STATUS_LABEL,
} from "@/lib/logic";
import type { Reservation, ReservationStatus } from "@/lib/types";

const SOURCES = [
  "Directo",
  "Booking",
  "Expedia",
  "Airbnb",
  "Teléfono",
  "WhatsApp",
  "Walk-in",
];

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const WEEK_MS = 7 * 86400000;
const WEEKS_SHOWN = 8;
const VIEW_KEY = "hotel-reservas-vista";
type View = "tabla" | "tarjetas";

/** Fecha como hoja de calendario: mes arriba, día grande abajo. */
function DateTile({ iso, label }: { iso: string; label: string }) {
  return (
    <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-gray-200 bg-panel-2/50 text-center">
      <div className="label-mono truncate bg-accent/10 px-2 py-1 text-[12.5px] font-medium text-accent">
        {label} · {MONTHS[Number(iso.slice(5, 7)) - 1]}
      </div>
      <div className="num py-2 text-[28px] leading-none tabular-nums text-fg">{iso.slice(8, 10)}</div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Reservas />
    </Suspense>
  );
}

function Reservas() {
  const { data, idx, can } = useApp();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.toLowerCase());
  const [status, setStatus] = useState<ReservationStatus | "activas" | "">(
    "activas",
  );
  const [from, setFrom] = useState(addDays(today(), -7));
  const [to, setTo] = useState(addDays(today(), 60));
  const [source, setSource] = useState("");
  const [openRes, setOpenRes] = useState<string | null>(params.get("r"));
  const [form, setForm] = useState<{
    open: boolean;
    initial?: Partial<Reservation>;
  }>({ open: false });
  const [page, setPage] = useState(0);
  const showMoney = can("ver_montos");
  const canEdit = can("editar_reservas");
  const PAGE = 50;
  const [view, setView] = useState<View>("tabla");
  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "tabla" || v === "tarjetas") setView(v);
    } catch {
      /* sin almacenamiento: queda la tabla */
    }
  }, []);
  function chooseView(v: View) {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* no pasa nada si no se puede guardar */
    }
  }

  useEffect(() => {
    if (params.get("r")) setOpenRes(params.get("r"));
  }, [params]);
  useEffect(() => setPage(0), [q, status, from, to, source]);

  const room = (id: string) => idx.roomById.get(id)?.number ?? "?";

  const list = useMemo(
    () =>
      data.reservations
        .filter((r) =>
          status === "activas"
            ? r.status !== "cancelada" && r.status !== "no_show"
            : !status || r.status === status,
        )
        .filter(
          (r) => (!from || r.checkOut >= from) && (!to || r.checkIn <= to),
        )
        .filter((r) => !source || r.source === source)
        .filter(
          (r) =>
            !q ||
            r.guestName.toLowerCase().includes(q) ||
            room(r.roomId).includes(q) ||
            r.id.includes(q),
        )
        .sort(
          (a, b) =>
            a.checkIn.localeCompare(b.checkIn) ||
            room(a.roomId).localeCompare(room(b.roomId), undefined, {
              numeric: true,
            }),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.reservations, status, from, to, source, q, idx.roomById],
  );

  const totals = useMemo(() => {
    let total = 0,
      balance = 0,
      n = 0,
      pend = 0;
    for (const r of list) {
      const f = folio(r, idx);
      total += f.total;
      if (r.status !== "confirmada" && r.status !== "pendiente")
        balance += Math.max(0, f.balance);
      n += nights(r);
      if (r.status === "pendiente") pend++;
    }
    return { total, balance, nights: n, pend };
  }, [list, idx]);

  const weekly = useMemo(() => {
    const t0 = today();
    const dow = (new Date(`${t0}T00:00:00`).getDay() + 6) % 7;
    const start = addDays(t0, -dow - 14);
    const counts: number[] = Array.from({ length: WEEKS_SHOWN }, () => 0);
    for (const r of data.reservations) {
      if (r.status === "cancelada" || r.status === "no_show") continue;
      const w = Math.floor((Date.parse(r.checkIn) - Date.parse(start)) / WEEK_MS);
      if (w >= 0 && w < WEEKS_SHOWN) counts[w]++;
    }
    return counts.map((value, i) => ({ label: fmtDate(addDays(start, i * 7)).slice(0, 5), value }));
  }, [data.reservations]);

  const chips: { v: typeof status; label: string }[] = [
    { v: "activas", label: "Vigentes" },
    { v: "pendiente", label: "Sin confirmar" },
    { v: "confirmada", label: "Confirmadas" },
    { v: "checkin", label: "Alojados" },
    { v: "checkout", label: "Ya se fueron" },
    { v: "cancelada", label: "Canceladas" },
    { v: "", label: "Todas" },
  ];

  return (
    <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
      <div className="aurora">
        <PageHeader
          eyebrow="Todas las reservas"
          title={<span className="serif-accent">Reservas</span>}
          subtitle="Todas las reservas del hotel. Buscá por nombre, por fechas o por dónde llegó la reserva."
          actions={
            canEdit && (
              <Button
                variant="primary"
                className="!h-12 !px-6 !text-[15px] max-sm:w-full"
                onClick={() => setForm({ open: true, initial: {} })}
              >
                <Plus size={16} /> Nueva reserva
              </Button>
            )
          }
        />
        <div
          className={cls(
            "stagger mb-6 grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 sm:gap-4",
            showMoney ? "xl:grid-cols-4" : "xl:grid-cols-3",
          )}
        >
          <PulseChip
            icon={CalendarCheck}
            label="Reservas que ves abajo"
            value={list.length}
          />
          <PulseChip
            icon={Moon}
            label="Noches reservadas"
            value={totals.nights}
          />
          {showMoney && (
            <PulseChip
              icon={Wallet}
              label="Total de esas reservas"
              value={totals.total}
              format={money}
            />
          )}
          {showMoney ? (
            <PulseChip
              hero
              icon={Clock}
              label="Falta cobrar (alojados y ya idos)"
              value={totals.balance}
              format={money}
            />
          ) : (
            <PulseChip
              hero
              icon={Clock}
              label="Sin confirmar"
              value={totals.pend}
            />
          )}
        </div>
      </div>

      <Card title="Cuántas reservas llegan cada semana" icon={BarChart3} className="mb-5">
        <div className="p-4 sm:px-5">
          <BarChart data={weekly} height={56} />
          <p className="mt-2 text-[13.5px] leading-snug text-gray-600">Cada barra es una semana (la fecha es el lunes). Pasá el dedo o el mouse por una barra para ver el número.</p>
        </div>
      </Card>

      <Card>
        <div className="space-y-3 rounded-t-xl border-b border-gray-200/70 bg-panel-2/40 p-3 sm:px-5 sm:py-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="relative w-full sm:w-[280px]">
              <Search size={18} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <Input
                placeholder="Buscar por nombre o habitación"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full !pl-10 !pr-11"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Borrar la búsqueda"
                  onClick={() => setQuery("")}
                  className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 transition-colors hover:text-fg sm:h-10 sm:w-10"
                >
                  <X size={18} aria-hidden />
                </button>
              )}
            </div>
            <label className="label-mono flex min-w-0 flex-1 basis-[150px] items-center gap-2 text-[12.5px] text-gray-600 sm:flex-none sm:basis-auto">
              Desde{" "}
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="min-w-0 flex-1 tabular-nums sm:w-[160px] sm:flex-none"
              />
            </label>
            <label className="label-mono flex min-w-0 flex-1 basis-[150px] items-center gap-2 text-[12.5px] text-gray-600 sm:flex-none sm:basis-auto">
              Hasta{" "}
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="min-w-0 flex-1 tabular-nums sm:w-[160px] sm:flex-none"
              />
            </label>
            <Select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full sm:w-[240px]"
            >
              <option value="">Llegó por: todas las vías</option>
              {SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <div role="group" aria-label="Cómo ver las reservas" className="flex w-full gap-1 rounded-xl border border-gray-200 bg-[rgb(var(--well))] p-1 sm:ml-auto sm:w-auto">
              {([["tabla", "Tabla", Table2], ["tarjetas", "Tarjetas", LayoutGrid]] as const).map(([v, label, Icon]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => chooseView(v)}
                  aria-pressed={view === v}
                  className={cls(
                    "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3.5 text-[14px] font-medium transition-colors duration-150 motion-reduce:transition-none sm:h-8 sm:flex-none",
                    view === v ? "bg-panel font-semibold text-accent shadow-card ring-1 ring-inset ring-accent/30" : "text-gray-600 hover:bg-panel/60 hover:text-fg",
                  )}
                >
                  <Icon size={16} aria-hidden /> {label}
                </button>
              ))}
            </div>
          </div>
          <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1.5 sm:gap-2">
            {chips.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => setStatus(c.v)}
                aria-pressed={status === c.v}
                className={cls(
                  "min-h-[44px] rounded-full border px-3.5 py-2 text-[14px] font-medium transition-colors duration-150 motion-reduce:transition-none sm:min-h-9 sm:py-1",
                  status === c.v
                    ? "border-accent bg-accent text-accent-fg font-semibold shadow-sm"
                    : "border-gray-200 bg-panel text-gray-700 hover:border-gray-400 hover:bg-gray-100 hover:text-fg",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        {list.length === 0 ? null : view === "tabla" ? (
        <Table
          head={[
            "Huésped",
            "Habitación",
            "Entrada",
            "Salida",
            <span key="n" className="block text-right">Noches</span>,
            <span key="p" className="block text-right">Personas</span>,
            "Llegó por",
            "Estado",
            ...(showMoney
              ? [
                  <span key="t" className="block text-right">Total</span>,
                  <span key="d" className="block text-right">Debe</span>,
                ]
              : []),
          ]}
        >
          {list.slice(page * PAGE, (page + 1) * PAGE).map((r) => {
            const f = showMoney ? folio(r, idx) : null;
            return (
              <tr
                key={r.id}
                className="cursor-pointer text-[14.5px] text-gray-700"
                onClick={() => setOpenRes(r.id)}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.guestName} size={34} />
                    <span className="max-w-[240px] truncate text-[15px] font-semibold text-fg" title={r.guestName}>
                      {r.guestName}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span className="num inline-flex h-8 min-w-[2.75rem] items-center justify-center rounded-md border border-gray-200 bg-panel-2 px-2 text-[16px] tabular-nums text-fg">
                    {room(r.roomId)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{fmtDate(r.checkIn)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
                  {fmtDate(r.checkOut)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{nights(r)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.pax}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                  <span className="inline-flex items-center gap-1.5">
                    <SourceIcon source={r.source} className="shrink-0 text-gray-500" /> {r.source}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <Badge className={RES_STATUS_BADGE[r.status]}>
                    {RES_STATUS_LABEL[r.status]}
                  </Badge>
                </td>
                {f && (
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{money(f.total)}</td>
                )}
                {f && (
                  <td
                    className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums ${f.balance > 0 ? "text-red-600" : "text-green-700"}`}
                  >
                    {money(f.balance)}
                  </td>
                )}
              </tr>
            );
          })}
        </Table>
        ) : (
          <ul className="stagger grid gap-3 p-3 sm:grid-cols-2 sm:gap-4 sm:p-5 xl:grid-cols-3 min-[1700px]:grid-cols-4">
            {list.slice(page * PAGE, (page + 1) * PAGE).map((r) => {
              const f = showMoney ? folio(r, idx) : null;
              const paid = f && f.total > 0 ? Math.min(100, Math.max(0, (f.paid / f.total) * 100)) : 100;
              return (
                <li key={r.id}>
                  <button
                    onClick={() => setOpenRes(r.id)}
                    className="lift flex h-full w-full flex-col gap-3.5 rounded-xl border border-gray-200/80 bg-panel p-4 text-left shadow-card"
                  >
                    <span className="flex items-center gap-3">
                      <GradAvatar name={r.guestName} size={44} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-semibold leading-snug text-fg">{r.guestName}</span>
                        <span className="block truncate text-[14px] text-gray-600">Habitación <b className="font-semibold text-gray-800">{room(r.roomId)}</b> · {r.pax} {r.pax === 1 ? "persona" : "personas"}</span>
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <DateTile iso={r.checkIn} label="Entra" />
                      <span className="flex w-8 shrink-0 flex-col items-center gap-0.5 text-[14px] font-semibold tabular-nums text-gray-600">
                        <Moon size={14} aria-hidden />
                        {nights(r)}
                        <span className="sr-only">{nights(r) === 1 ? "noche" : "noches"}</span>
                      </span>
                      <DateTile iso={r.checkOut} label="Sale" />
                    </span>
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[14px] text-gray-600">
                        <SourceIcon source={r.source} className="text-gray-500" /> {r.source}
                      </span>
                      <Badge className={RES_STATUS_BADGE[r.status]}>{RES_STATUS_LABEL[r.status]}</Badge>
                    </span>
                    {f && (
                      <span className="mt-auto block border-t border-gray-200/70 pt-3">
                        <Progress value={paid} tone={paid >= 100 ? "bg-green-500" : "bg-amber-500"} />
                        <span className="mt-2 flex justify-between gap-2 text-[14px] tabular-nums">
                          <span className="text-gray-600">{money(f.total)}</span>
                          <span className={f.balance > 0 ? "font-semibold text-red-600" : "font-semibold text-green-700"}>
                            {f.balance > 0 ? `Debe ${money(f.balance)}` : "Pagado"}
                          </span>
                        </span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {list.length === 0 && (
          <EmptyArt text="No encontramos reservas. Probá cambiar las fechas o el botón de arriba." />
        )}
        {list.length > PAGE && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-gray-200/70 bg-panel-2/40 p-3 text-[14px] text-gray-600 sm:px-5">
            <Button
              size="sm"
              className="!px-4"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              ← Anterior
            </Button>
            <span className="label-mono text-[12.5px] tabular-nums">
              Página {page + 1} de {Math.ceil(list.length / PAGE)}
            </span>
            <Button
              size="sm"
              className="!px-4"
              disabled={(page + 1) * PAGE >= list.length}
              onClick={() => setPage(page + 1)}
            >
              Siguiente →
            </Button>
          </div>
        )}
      </Card>

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
