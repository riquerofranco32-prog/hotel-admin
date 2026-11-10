"use client";
import Link from "next/link";
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BedDouble,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Activity,
  Download,
  Info,
  LogIn,
  LogOut,
  Plus,
  SearchX,
  Sparkles,
  Wrench,
} from "lucide-react";
import {
  ArrowLeftRight,
  Check,
  ClipboardCheck,
  Clock,
  Moon,
  Sun,
  TrendingUp,
} from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { CountUp, Ring, Sparkline } from "@/components/viz";
import { ReservationDrawer, ReservationForm } from "@/components/reservation";
import {
  Avatar,
  Button,
  Card,
  Input,
  Select,
  toast,
} from "@/components/ui";
import {
  addDays,
  daysInMonth,
  diffDays,
  fmtShort,
  fmtTimeAgo,
  MONTHS,
  parseISO,
  toISO,
  today,
  WEEKDAYS_SHORT,
} from "@/lib/dates";
import {
  cls,
  folio,
  isActive,
  money,
  nights,
  RES_STATUS_LABEL,
  ROOM_STATE_CLASS,
  ROOM_STATE_DOT,
  ROOM_STATE_LABEL,
  VISUAL_CLASS,
  VISUAL_DOT,
  VISUAL_LABEL,
  visualStatus,
} from "@/lib/logic";
import type { Reservation, Room, RoomState, VisualStatus } from "@/lib/types";

type StatusFilter = "todos" | VisualStatus | "mantenimiento";

// ---------- Tooltip fuera del árbol del calendario (mover el mouse no re-renderiza la grilla) ----------
type TipCard = {
  guest: string;
  room: string;
  dates: string;
  nights: number;
  pax: number;
  status: string;
  dot: string;
};
type Tip = { x: number; y: number; card: TipCard } | null;
let setTipGlobal: ((t: Tip) => void) | null = null;
const showTip = (t: Tip) => setTipGlobal?.(t);
function TooltipLayer() {
  const [tip, setTip] = useState<Tip>(null);
  useEffect(() => {
    setTipGlobal = setTip;
    return () => {
      setTipGlobal = null;
    };
  }, []);
  if (!tip) return null;
  return (
    <div
      className="pointer-events-none fixed z-50 flex w-[260px] max-w-[calc(100vw-24px)] items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 text-[14px] leading-snug text-fg shadow-pop"
      style={{
        left: Math.max(8, Math.min(tip.x + 14, window.innerWidth - 272)),
        top:
          tip.y + 14 + 150 > window.innerHeight
            ? Math.max(8, tip.y - 160)
            : tip.y + 14,
      }}
    >
      <Avatar name={tip.card.guest} size={36} />
      <div className="min-w-0">
        <div className="truncate text-[15px] font-semibold">{tip.card.guest}</div>
        <div className="text-gray-700">Habitación {tip.card.room}</div>
        <div className="text-gray-700">{tip.card.dates}</div>
        <div className="text-gray-700">
          {tip.card.nights} {tip.card.nights === 1 ? "noche" : "noches"} ·{" "}
          {tip.card.pax} {tip.card.pax === 1 ? "persona" : "personas"}
        </div>
        <div className="mt-1 flex items-center gap-1.5 font-medium">
          <span className={cls("h-2.5 w-2.5 rounded-full", tip.card.dot)} />
          {tip.card.status}
        </div>
      </div>
    </div>
  );
}

function GreetingIcon() {
  const h = new Date().getHours();
  const Icon = h < 6 || h >= 20 ? Moon : Sun;
  return (
    <Icon
      size={24}
      aria-hidden
      className="mr-1.5 inline-block align-[-3px] text-accent"
    />
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
}

/** Rango de días [desde, hasta) en que una habitación está bloqueada (en arreglo o fuera de servicio) dentro del mes que se ve. */
function hatchRange(
  room: Room,
  blockingDue: string | undefined,
  t: string,
  monthStart: string,
  monthEnd: string,
  days: number,
): [number, number] {
  if (!blockingDue && !room.outOfService) return [-1, -1];
  const from = t < monthStart ? monthStart : t;
  const to = blockingDue
    ? addDays(blockingDue > t ? blockingDue : t, 1)
    : monthEnd;
  return [
    Math.max(0, diffDays(monthStart, from)),
    Math.min(days, diffDays(monthStart, to)),
  ];
}

export default function DashboardPage() {
  const { data, idx, me, can, actions } = useApp();
  const t = today();
  const now = parseISO(t);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());
  const [floor, setFloor] = useState<string>("todos");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [density, setDensity] = useState<"normal" | "compacto">("normal");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [openRes, setOpenRes] = useState<string | null>(null);
  const [form, setForm] = useState<{
    open: boolean;
    initial?: Partial<Reservation>;
  }>({ open: false });
  const canEdit = can("editar_reservas");
  const showMoney = can("ver_montos");

  const days = daysInMonth(year, month);
  const monthStart = toISO(new Date(year, month, 1));
  const monthEnd = addDays(monthStart, days);
  const dayList = useMemo(
    () => Array.from({ length: days }, (_, i) => addDays(monthStart, i)),
    [days, monthStart],
  );

  const floors = useMemo(
    () =>
      Array.from(new Set(data.rooms.map((r) => r.floor))).sort((a, b) => a - b),
    [data.rooms],
  );

  // Reservas del mes agrupadas por habitación
  const monthResByRoom = useMemo(() => {
    const m = new Map<string, Reservation[]>();
    for (const r of data.reservations) {
      if (!isActive(r) || r.checkIn >= monthEnd || r.checkOut <= monthStart)
        continue;
      const arr = m.get(r.roomId);
      if (arr) arr.push(r);
      else m.set(r.roomId, [r]);
    }
    return m;
  }, [data.reservations, monthStart, monthEnd]);

  const blockingByRoom = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of data.tasks)
      if (x.blocksRoom && x.status !== "completada") m.set(x.roomId, x.dueDate);
    return m;
  }, [data.tasks]);

  const visibleRooms = useMemo(
    () =>
      idx.roomsSorted
        .filter((room) => floor === "todos" || String(room.floor) === floor)
        .filter(
          (room) =>
            !q ||
            room.number.includes(q) ||
            (monthResByRoom.get(room.id) ?? []).some((r) =>
              r.guestName.toLowerCase().includes(q),
            ),
        )
        .filter((room) => {
          if (status === "todos") return true;
          const st = idx.roomStates.get(room.id);
          if (status === "mantenimiento")
            return (
              st === "mantenimiento" || st === "sucia" || st === "en_limpieza"
            );
          return (monthResByRoom.get(room.id) ?? []).some(
            (r) => visualStatus(r, t) === status,
          );
        }),
    [idx, floor, q, status, monthResByRoom, t],
  );

  // ===== Indicadores del día =====
  const stats = useMemo(() => {
    let ocupadas = 0,
      reservadas = 0,
      llegadas = 0,
      llegadasHechas = 0,
      salidas = 0,
      salidasHechas = 0,
      huespedes = 0,
      tarifas = 0;
    for (const r of data.reservations) {
      if (!isActive(r)) continue;
      if (r.status === "checkin") {
        ocupadas++;
        huespedes += r.pax;
        tarifas += r.rate;
      }
      if (
        (r.status === "confirmada" || r.status === "pendiente") &&
        r.checkIn <= t &&
        r.checkOut > t
      )
        reservadas++;
      if (r.checkIn === t && r.status !== "checkout") {
        llegadas++;
        if (r.status === "checkin") llegadasHechas++;
      }
      if (
        r.checkOut === t &&
        (r.status === "checkin" || r.status === "checkout")
      ) {
        salidas++;
        if (r.status === "checkout") salidasHechas++;
      }
    }
    let mant = 0,
      sucias = 0,
      listas = 0;
    for (const s of idx.roomStates.values()) {
      if (s === "mantenimiento" || s === "fuera_servicio") mant++;
      else if (s === "sucia" || s === "en_limpieza") sucias++;
      else if (s === "lista") listas++;
    }
    const base = data.rooms.length - mant;
    const ocupacion = base
      ? Math.round(((ocupadas + reservadas) / base) * 100)
      : 0;
    const cobradoHoy = data.payments.reduce(
      (s, p) => (p.date === t ? s + p.amount : s),
      0,
    );
    const adr = ocupadas ? tarifas / ocupadas : 0;
    return {
      ocupadas,
      reservadas,
      mant,
      sucias,
      listas,
      llegadas,
      llegadasHechas,
      salidas,
      salidasHechas,
      huespedes,
      ocupacion,
      cobradoHoy,
      adr,
    };
  }, [data.reservations, data.rooms.length, data.payments, idx.roomStates, t]);

  // Ocupación de los próximos 14 días (reservas vigentes por día / habitaciones usables)
  const ocupSerie = useMemo(() => {
    const base = Math.max(1, data.rooms.length - stats.mant);
    return Array.from({ length: 14 }, (_, i) => {
      const d = addDays(t, i);
      let n = 0;
      for (const r of data.reservations)
        if (isActive(r) && r.checkIn <= d && r.checkOut > d) n++;
      return Math.min(100, Math.round((n / base) * 100));
    });
  }, [data.reservations, data.rooms.length, stats.mant, t]);
  const totalHab = Math.max(1, data.rooms.length);

  const shiftMonth = (n: number) => {
    const d = new Date(year, month + n, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  function exportCSV() {
    const rows = [
      [
        "Reserva",
        "Habitación",
        "Huésped",
        "Entrada",
        "Salida",
        "Noches",
        "Pax",
        "Estado",
        "Canal",
        ...(showMoney ? ["Tarifa", "Total", "Saldo"] : []),
      ],
    ];
    for (const list of monthResByRoom.values())
      for (const r of list) {
        const f = folio(r, idx);
        rows.push([
          r.id,
          idx.roomById.get(r.roomId)?.number ?? "",
          r.guestName,
          r.checkIn,
          r.checkOut,
          String(nights(r)),
          String(r.pax),
          RES_STATUS_LABEL[r.status],
          r.source,
          ...(showMoney
            ? [String(r.rate), String(f.total), String(f.balance)]
            : []),
        ]);
      }
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reservas-${year}-${String(month + 1).padStart(2, "0")}.csv`;
    a.click();
  }

  // ===== Arrastrar y soltar =====
  const dragRef = useRef<{ id: string; offset: number } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<{ roomId: string; day: string } | null>(
    null,
  );

  const onDragStartRes = useCallback(
    (r: Reservation, dayIdx: number) => {
      dragRef.current = {
        id: r.id,
        offset: diffDays(r.checkIn, addDays(monthStart, dayIdx)),
      };
      setDragId(r.id);
      showTip(null);
    },
    [monthStart],
  );
  const onDragEnd = useCallback(() => {
    dragRef.current = null;
    setDragId(null);
    setDropAt(null);
  }, []);
  const onDragOverCell = useCallback((roomId: string, day: string) => {
    setDropAt((cur) =>
      cur?.roomId === roomId && cur.day === day ? cur : { roomId, day },
    );
  }, []);

  const dataRef = useRef(data);
  dataRef.current = data;
  const onDrop = useCallback(
    async (roomId: string, day: string) => {
      const drag = dragRef.current;
      onDragEnd();
      const d = dataRef.current;
      const cur = drag && d.reservations.find((x) => x.id === drag.id);
      if (!cur || !drag) return;
      const n = diffDays(cur.checkIn, cur.checkOut);
      const checkIn = addDays(day, -drag.offset);
      const moved = { ...cur, roomId, checkIn, checkOut: addDays(checkIn, n) };
      if (moved.roomId === cur.roomId && moved.checkIn === cur.checkIn) return;
      if (cur.status === "checkout")
        return toast("No se puede mover una estadía que ya terminó", "error");
      if (cur.status === "checkin" && moved.checkIn !== cur.checkIn)
        return toast(
          "El huésped ya ingresó: sólo podés cambiarlo de habitación",
          "error",
        );
      const err = actions.validateReservation(moved);
      if (err) return toast(err, "error");
      const newRoom = d.rooms.find((x) => x.id === roomId)?.number;
      const oldRoom = d.rooms.find((x) => x.id === cur.roomId)?.number;
      if (
        !confirm(
          `¿Mover a ${cur.guestName}?\n\nHab. ${oldRoom} · ${fmtShort(cur.checkIn)} → ${fmtShort(cur.checkOut)}\n→ Hab. ${newRoom} · ${fmtShort(moved.checkIn)} → ${fmtShort(moved.checkOut)}`,
        )
      )
        return;
      await actions.saveReservation(moved);
      toast("Reserva movida");
    },
    [actions, onDragEnd],
  );

  const onCellClick = useCallback(
    (room: Room, day: string) =>
      setForm({
        open: true,
        initial: {
          roomId: room.id,
          checkIn: day,
          checkOut: addDays(day, 2),
          rate: room.rate,
        },
      }),
    [],
  );
  const onOpenRes = useCallback((id: string) => setOpenRes(id), []);

  const rowH = density === "normal" ? 44 : 32;
  const todayIdx = dayList.indexOf(t);
  const gridCols = `repeat(${days}, minmax(38px, 1fr))`;

  // Habitaciones libres cada día (todo el hotel): total - reservas vigentes - bloqueadas por arreglos
  const totalRooms = data.rooms.length;
  const libresPorDia = useMemo(() => {
    const usadas = new Array<number>(days).fill(0);
    for (const room of data.rooms) {
      const [a, b] = hatchRange(
        room,
        blockingByRoom.get(room.id),
        t,
        monthStart,
        monthEnd,
        days,
      );
      for (let i = a; i < b; i++) if (i >= 0) usadas[i]++;
    }
    for (const list of monthResByRoom.values())
      for (const r of list) {
        const a = Math.max(0, diffDays(monthStart, r.checkIn));
        const b = Math.min(days, diffDays(monthStart, r.checkOut));
        for (let i = a; i < b; i++) usadas[i]++;
      }
    return usadas.map((u) => Math.max(0, totalRooms - u));
  }, [data.rooms, blockingByRoom, monthResByRoom, t, monthStart, monthEnd, days, totalRooms]);

  // Al abrir el mes actual, el mapa se centra en el día de hoy
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const i = dayList.indexOf(t);
    if (i < 0) {
      el.scrollLeft = 0;
      return;
    }
    const colW = (el.scrollWidth - 72) / days;
    el.scrollLeft = Math.max(0, 72 + i * colW - el.clientWidth / 2);
  }, [dayList, t, days]);

  return (
    <div className="mx-auto max-w-[1680px]">
      {/* ===== Pantalla principal: el mapa ocupa todo el alto hasta el primer scroll ===== */}
      <section className="flex flex-col gap-4 p-4 lg:h-[calc(100dvh-4rem)] lg:min-h-[560px] lg:p-6 lg:pb-4">
      {/* ===== Banda de encabezado ===== */}
      <div className="aurora relative flex shrink-0 flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl border border-gray-200/80 bg-panel px-4 py-3 shadow-card sm:px-5">
        <div className="min-w-0">
          <h1 className="display text-[24px] sm:text-[26px]">
            <GreetingIcon /> {greeting()},{" "}
            <span className="serif-accent">{me?.name.split(" ")[0]}</span>
          </h1>
          <p className="mt-0.5 text-[15px] text-gray-600">
            {now.toLocaleDateString("es-AR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}{" "}
            · {stats.huespedes} huéspedes alojados hoy
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="hidden items-center gap-2 xl:flex"
            title="Ocupación prevista de los próximos 14 días"
          >
            <span className="text-[13.5px] leading-tight text-gray-600">
              Próximos
              <br />
              14 días
            </span>
            <Sparkline data={ocupSerie} width={130} height={40} />
          </div>
          <Button className="!px-4" onClick={exportCSV}>
            <Download size={15} /> Exportar
          </Button>
          {canEdit && (
            <Button
              variant="primary"
              className="!px-4"
              onClick={() => setForm({ open: true, initial: {} })}
            >
              <Plus size={15} /> Nueva reserva
            </Button>
          )}
        </div>
      </div>

      {/* ===== Fichas de pulso ===== */}
      <div
        className={cls(
          "stagger -mx-4 flex shrink-0 snap-x gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:overflow-visible lg:px-0 lg:pb-0",
          showMoney
            ? "lg:grid-cols-[1.35fr_repeat(5,minmax(0,1fr))]"
            : "lg:grid-cols-[1.35fr_repeat(3,minmax(0,1fr))]",
        )}
      >
        <div className="hero-card flex min-w-[250px] shrink-0 snap-start items-center gap-3 rounded-xl px-4 py-3 lg:min-w-0">
          <span className="rounded-full bg-panel p-1 shadow-card">
            <Ring
              value={stats.ocupacion}
              size={68}
              stroke={8}
              label={`${stats.ocupacion}% de ocupación`}
            >
              <CountUp
                value={stats.ocupacion}
                format={(n) => `${Math.round(n)}%`}
                className="num text-[19px] text-fg"
              />
            </Ring>
          </span>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold">Hotel lleno al</div>
            <div className="text-[14px] leading-snug opacity-90">
              {stats.ocupadas} habitaciones con gente · {stats.reservadas} por
              llegar
            </div>
          </div>
        </div>
        <PulseTile
          icon={LogIn}
          label="Llegan hoy"
          value={stats.llegadasHechas}
          of={stats.llegadas}
          sub="ya entraron"
          pct={stats.llegadas ? (stats.llegadasHechas / stats.llegadas) * 100 : 0}
          href="/recepcion"
        />
        <PulseTile
          icon={LogOut}
          label="Se van hoy"
          value={stats.salidasHechas}
          of={stats.salidas}
          sub="ya se fueron"
          pct={stats.salidas ? (stats.salidasHechas / stats.salidas) * 100 : 0}
          href="/recepcion"
        />
        <PulseTile
          icon={Sparkles}
          label="Habitaciones limpias"
          value={stats.listas}
          suffix="listas"
          sub={`${stats.sucias} falta limpiar · ${stats.mant} en arreglo`}
          pct={(stats.listas / totalHab) * 100}
          href="/mantenimiento"
        />
        {showMoney && (
          <PulseTile
            icon={DollarSign}
            label="Cobrado hoy"
            value={stats.cobradoHoy}
            format={money}
            href="/facturacion"
          />
        )}
        {showMoney && (
          <PulseTile
            icon={BedDouble}
            label="Precio promedio por noche"
            value={stats.adr}
            format={money}
            sub="de las habitaciones ocupadas"
          />
        )}
      </div>

      {/* ===== Calendario ===== */}
      <Card className="flex flex-col overflow-hidden lg:min-h-0 lg:flex-1">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-200/80 px-3 py-3 sm:px-4">
          <Button
            size="sm"
            className="!h-11 !w-11 !px-0 sm:!h-10 sm:!w-10"
            onClick={() => shiftMonth(-1)}
            aria-label="Mes anterior"
          >
            <ChevronLeft size={16} />
          </Button>
          <Select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-[130px]"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </Select>
          <Select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-[90px]"
          >
            {[year - 2, year - 1, year, year + 1, year + 2].map((y) => (
              <option key={y}>{y}</option>
            ))}
          </Select>
          <Button
            size="sm"
            className="!h-11 !w-11 !px-0 sm:!h-10 sm:!w-10"
            onClick={() => shiftMonth(1)}
            aria-label="Mes siguiente"
          >
            <ChevronRight size={16} />
          </Button>
          <Button
            size="sm"
            className="!h-11 !px-4 !text-sm sm:!h-10"
            onClick={() => {
              setYear(now.getFullYear());
              setMonth(now.getMonth());
            }}
          >
            Hoy
          </Button>
          <Input
            placeholder="Buscar habitación o nombre"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full min-w-[200px] sm:w-[240px]"
          />
          <Select
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            className="w-[150px]"
          >
            <option value="todos">Todos los pisos</option>
            {floors.map((f) => (
              <option key={f} value={f}>
                Piso {f}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="w-[220px] max-w-full"
          >
            <option value="todos">Todas las reservas</option>
            <option value="ocupada">Con huéspedes</option>
            <option value="reservada">Por llegar</option>
            <option value="proxima">Se van pronto</option>
            <option value="otros">Sin confirmar o terminadas</option>
            <option value="mantenimiento">Para limpiar o arreglar</option>
          </Select>
          <Select
            value={density}
            onChange={(e) =>
              setDensity(e.target.value as "normal" | "compacto")
            }
            className="w-[140px]"
            aria-label="Tamaño de las filas"
          >
            <option value="normal">Filas grandes</option>
            <option value="compacto">Filas chicas</option>
          </Select>
          <div className="mt-1 flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-gray-200/80 pt-3 text-[14px] text-gray-700">
            <b className="label-mono text-[12.5px] font-semibold text-gray-600">Colores:</b>
            {(Object.keys(VISUAL_LABEL) as VisualStatus[]).map((v) => (
              <span key={v} className="flex items-center gap-1.5">
                <span
                  className={cls("h-4 w-4 rounded", VISUAL_DOT[v])}
                />{" "}
                {VISUAL_LABEL[v]}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="hatch h-4 w-4 rounded border border-purple-300" />{" "}
              En arreglo (no se puede usar)
            </span>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="max-h-[72vh] min-h-[320px] overflow-auto lg:max-h-none lg:min-h-0 lg:flex-1"
          onMouseLeave={() => showTip(null)}
        >
          <div
            className="relative flex min-h-full flex-col"
            style={{ minWidth: 72 + days * 40 }}
          >
            {todayIdx >= 0 && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 z-[5] w-0.5 bg-accent/30"
                style={{
                  left: `calc(72px + (100% - 72px) * ${(todayIdx + 0.5) / days})`,
                }}
              />
            )}
            <div className="sticky top-0 z-20 shrink-0 border-b border-gray-200/80 bg-white">
              <div className="flex">
              <div className="label-mono sticky left-0 z-10 flex w-[72px] shrink-0 items-center border-r border-gray-200/70 bg-white px-3 text-[12.5px] font-semibold text-gray-600">
                Hab.
              </div>
              <div
                className="grid flex-1"
                style={{ gridTemplateColumns: gridCols }}
              >
                {dayList.map((d) => {
                  const dt = parseISO(d);
                  const isToday = d === t;
                  return (
                    <div
                      key={d}
                      className={cls(
                        "flex flex-col items-center border-l border-gray-200/70 py-1.5",
                        isToday
                          ? "bg-accent text-accent-fg"
                          : dt.getDay() === 0 || dt.getDay() === 6
                            ? "bg-gray-100/70"
                            : "",
                      )}
                    >
                      <span
                        className={cls(
                          "label-mono text-[12.5px] font-medium leading-tight tracking-normal",
                          isToday ? "text-accent-fg/90" : "text-gray-600",
                        )}
                      >
                        {WEEKDAYS_SHORT[dt.getDay()]}
                      </span>
                      <span className="num text-[18px] leading-tight tabular-nums">
                        {dt.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
              </div>
              {totalRooms > 0 && (
                <div className="flex border-t border-gray-200/70">
                  <div
                    className="label-mono sticky left-0 z-10 flex w-[72px] shrink-0 items-center border-r border-gray-200/70 bg-white px-3 text-[12.5px] font-medium text-gray-600"
                    title="Habitaciones libres cada día (todo el hotel)"
                  >
                    Libres
                  </div>
                  <div
                    className="grid flex-1"
                    style={{ gridTemplateColumns: gridCols }}
                  >
                    {libresPorDia.map((n, i) => (
                      <div
                        key={dayList[i]}
                        title={`${n} ${n === 1 ? "habitación libre" : "habitaciones libres"} de ${totalRooms}`}
                        className={cls(
                          "num flex items-center justify-center border-l border-gray-200/70 py-1 text-[16px] tabular-nums",
                          n === 0
                            ? "bg-red-50 text-red-700"
                            : n <= Math.ceil(totalRooms * 0.25)
                              ? "bg-amber-50 text-amber-800"
                              : "text-emerald-700",
                        )}
                      >
                        {n}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col">
            {floors
              .filter((f) => visibleRooms.some((r) => r.floor === f))
              .map((f) => (
                <div
                  key={f}
                  className="flex flex-col"
                  style={{
                    flexGrow: collapsed.has(f)
                      ? 0
                      : visibleRooms.filter((r) => r.floor === f).length,
                  }}
                >
                  <button
                    onClick={() =>
                      setCollapsed((s) => {
                        const n = new Set(s);
                        if (n.has(f)) n.delete(f);
                        else n.add(f);
                        return n;
                      })
                    }
                    className="label-mono sticky left-0 my-1 ml-1 flex min-h-[36px] shrink-0 items-center self-start gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] font-semibold text-gray-700 transition-colors duration-150 hover:bg-gray-100 motion-reduce:transition-none"
                  >
                    <ChevronDown
                      size={14}
                      className={cls(
                        "transition duration-150 motion-reduce:transition-none",
                        collapsed.has(f) && "-rotate-90",
                      )}
                    />{" "}
                    Piso {f}
                    <span className="text-[12.5px] font-normal text-gray-600">
                      ({visibleRooms.filter((r) => r.floor === f).length})
                    </span>
                  </button>
                  {!collapsed.has(f) &&
                    visibleRooms
                      .filter((r) => r.floor === f)
                      .map((room) => (
                        <RoomRow
                          key={room.id}
                          room={room}
                          resList={monthResByRoom.get(room.id)}
                          state={idx.roomStates.get(room.id) ?? "lista"}
                          blockingDue={blockingByRoom.get(room.id)}
                          dayList={dayList}
                          monthStart={monthStart}
                          monthEnd={monthEnd}
                          t={t}
                          gridCols={gridCols}
                          rowH={rowH}
                          compact={density === "compacto"}
                          q={q}
                          canEdit={canEdit}
                          dragging={dragId}
                          dropDay={
                            dropAt?.roomId === room.id ? dropAt.day : null
                          }
                          onOpen={onOpenRes}
                          onCellClick={onCellClick}
                          onDragStartRes={onDragStartRes}
                          onDragEnd={onDragEnd}
                          onDragOverCell={onDragOverCell}
                          onDrop={onDrop}
                        />
                      ))}
                </div>
              ))}
            {visibleRooms.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center text-[15px] text-gray-600">
                <WaveArt />
                <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-500">
                  {totalRooms === 0 ? (
                    <BedDouble size={20} aria-hidden />
                  ) : (
                    <SearchX size={20} aria-hidden />
                  )}
                </span>
                {totalRooms === 0
                  ? "Todavía no hay habitaciones cargadas en el hotel."
                  : "No hay habitaciones que coincidan con los filtros."}
                {totalRooms === 0 && can("administradores") && (
                  <Link
                    href="/administradores"
                    className="font-medium text-accent hover:underline"
                  >
                    Cargar las habitaciones o los datos de ejemplo
                  </Link>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
        <div className="shrink-0 rounded-b-2xl border-t border-gray-200/80 bg-gray-50/60 px-4 py-3 text-[14px] leading-relaxed text-gray-700">
          <Info
            size={16}
            className="mr-1.5 inline-block align-[-3px] text-gray-500"
            aria-hidden
          />
          <b className="label-mono text-[12.5px] font-semibold text-gray-600">Cómo usarlo:</b>{" "}
          {canEdit
            ? "tocá un día vacío para hacer una reserva · tocá una barra de color para ver los datos del huésped · arrastrá una barra para cambiarla de habitación o de fecha."
            : "tocá una barra de color para ver los datos del huésped."}
        </div>
      </Card>
      </section>

      <TooltipLayer />

      {/* ===== Debajo del primer scroll: indicadores y paneles ===== */}
      <section className="space-y-5 p-4 pt-2 lg:p-6 lg:pt-3">
      <QuickLinks
        onNew={canEdit ? () => setForm({ open: true, initial: {} }) : undefined}
      />
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <FloorMap t={t} onOpen={setOpenRes} />
        <div className="space-y-4">
          <Occupancy14 serie={ocupSerie} t={t} />
          <TodayTimeline t={t} onOpen={setOpenRes} />
        </div>
      </div>
      <div className="stagger grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <TodayList kind="llegadas" onOpen={setOpenRes} />
        <TodayList kind="salidas" onOpen={setOpenRes} />
        <RoomStatesCard />
        <LiveFeed />
      </div>
      </section>

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

// ================== Fila de habitación (memorizada: sólo se re-renderiza si cambian sus datos) ==================
const RoomRow = memo(function RoomRow(p: {
  room: Room;
  resList?: Reservation[];
  state: RoomState;
  blockingDue?: string;
  dayList: string[];
  monthStart: string;
  monthEnd: string;
  t: string;
  gridCols: string;
  rowH: number;
  compact: boolean;
  q: string;
  canEdit: boolean;
  dragging: string | null;
  dropDay: string | null;
  onOpen: (id: string) => void;
  onCellClick: (room: Room, day: string) => void;
  onDragStartRes: (r: Reservation, dayIdx: number) => void;
  onDragEnd: () => void;
  onDragOverCell: (roomId: string, day: string) => void;
  onDrop: (roomId: string, day: string) => void;
}) {
  const { room, dayList, monthStart, t } = p;
  const days = dayList.length;
  const hatch = useMemo(
    () => hatchRange(room, p.blockingDue, t, monthStart, p.monthEnd, days),
    [room, p.blockingDue, t, monthStart, p.monthEnd, days],
  );

  // Un solo manejador por fila: calcula el día según la posición del mouse
  const dayAt = (e: React.MouseEvent | React.DragEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const i = Math.min(
      days - 1,
      Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * days)),
    );
    return dayList[i];
  };

  return (
    <div className="flex flex-1 border-b border-gray-200/60" style={{ minHeight: p.rowH }}>
      <Link
        href={`/mantenimiento?hab=${room.id}`}
        title={`${room.type} · ${ROOM_STATE_LABEL[p.state]}`}
        className="num sticky left-0 z-10 flex w-[72px] shrink-0 items-center gap-1.5 border-r border-gray-200/70 bg-white px-3 text-[17px] transition-colors duration-150 hover:bg-gray-50 motion-reduce:transition-none"
      >
        {room.number}
        <span
          className={cls("h-2.5 w-2.5 rounded-full", ROOM_STATE_DOT[p.state])}
        />
        {p.blockingDue && <Wrench size={11} className="text-purple-600" />}
      </Link>
      <div
        className={cls("relative flex-1", p.canEdit && "cursor-pointer")}
        onClick={(e) => {
          if (p.canEdit && (e.target as HTMLElement).dataset.cell !== undefined)
            p.onCellClick(room, dayAt(e));
        }}
        onDragOver={(e) => {
          if (!p.dragging) return;
          e.preventDefault();
          p.onDragOverCell(room.id, dayAt(e));
        }}
        onDrop={(e) => {
          e.preventDefault();
          p.onDrop(room.id, dayAt(e));
        }}
      >
        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: p.gridCols }}
        >
          {dayList.map((d, i) => {
            const wd = parseISO(d).getDay();
            return (
              <div
                key={d}
                data-cell=""
                className={cls(
                  "border-l border-gray-200/60",
                  p.canEdit && "hover:bg-accent/10",
                  d === t
                    ? "bg-accent/10"
                    : wd === 0 || wd === 6
                      ? "bg-gray-100/60"
                      : "",
                  i >= hatch[0] && i < hatch[1] && "hatch",
                  p.dropDay === d && "!bg-amber-200",
                )}
              />
            );
          })}
        </div>
        {p.resList?.map((r) => {
          const start = Math.max(0, diffDays(monthStart, r.checkIn));
          const end = Math.min(days, diffDays(monthStart, r.checkOut));
          if (end <= start) return null;
          const vs = visualStatus(r, t);
          const span = end - start;
          const label =
            span >= 5
              ? `${r.guestName} · ${fmtShort(r.checkIn)} → ${fmtShort(r.checkOut)} · ${r.pax}p`
              : span >= 3
                ? `${r.guestName} · ${r.pax}p`
                : r.guestName;
          const tipCard: TipCard = {
            guest: r.guestName,
            room: room.number,
            dates: `${fmtShort(r.checkIn)} → ${fmtShort(r.checkOut)}`,
            nights: nights(r),
            pax: r.pax,
            status: RES_STATUS_LABEL[r.status],
            dot: VISUAL_DOT[vs],
          };
          const movable = p.canEdit && r.status !== "checkout";
          return (
            <button
              key={r.id}
              draggable={movable}
              onDragStart={(e) => {
                const parent = (
                  e.currentTarget.parentElement as HTMLElement
                ).getBoundingClientRect();
                p.onDragStartRes(
                  r,
                  Math.floor(((e.clientX - parent.left) / parent.width) * days),
                );
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={p.onDragEnd}
              onClick={(e) => {
                e.stopPropagation();
                p.onOpen(r.id);
              }}
              onMouseMove={(e) =>
                showTip({ x: e.clientX, y: e.clientY, card: tipCard })
              }
              onMouseLeave={() => showTip(null)}
              className={cls(
                "absolute bottom-1 top-1 truncate rounded-md px-2.5 text-left font-semibold shadow-sm transition-[filter,box-shadow] duration-150 hover:brightness-110 hover:shadow-[0_3px_12px_-2px_rgba(0,0,0,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent motion-reduce:transition-none",
                p.compact ? "text-[12px]" : "text-[13.5px]",
                VISUAL_CLASS[vs],
                movable && "cursor-grab active:cursor-grabbing",
                p.dragging === r.id && "opacity-50",
                p.dragging && "pointer-events-none",
                p.q &&
                  r.guestName.toLowerCase().includes(p.q) &&
                  "ring-2 ring-amber-400",
              )}
              style={{
                left: `calc(${(start / days) * 100}% + 1px)`,
                width: `calc(${(span / days) * 100}% - 2px)`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
});

// ================== Ficha de pulso ==================
function PulseTile({
  icon: Icon,
  label,
  value,
  of,
  suffix,
  format,
  sub,
  pct,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  of?: number;
  suffix?: string;
  format?: (n: number) => string;
  sub?: string;
  pct?: number;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Icon size={18} aria-hidden />
        </span>
        <span className="text-[14px] font-medium leading-tight text-gray-700">
          {label}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <CountUp
          value={value}
          format={format}
          className="num text-[28px] leading-none text-fg"
        />
        {of !== undefined && (
          <span className="text-[14px] text-gray-600">de {of}</span>
        )}
        {suffix && <span className="text-[14px] text-gray-600">{suffix}</span>}
      </div>
      {pct !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-accent/60 transition-[width] duration-700 motion-reduce:transition-none"
            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          />
        </div>
      )}
      {sub && (
        <div className="mt-1.5 text-[13.5px] leading-snug text-gray-600">
          {sub}
        </div>
      )}
    </>
  );
  const box =
    "min-w-[200px] shrink-0 snap-start rounded-xl border border-gray-200/80 bg-panel px-3.5 py-3 shadow-card lg:min-w-0";
  return href ? (
    <Link href={href} className={cls(box, "lift block")}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

// ================== Paneles inferiores ==================
function TodayList({
  kind,
  onOpen,
}: {
  kind: "llegadas" | "salidas";
  onOpen: (id: string) => void;
}) {
  const { data, idx } = useApp();
  const t = today();
  const list =
    kind === "llegadas"
      ? data.reservations.filter(
          (r) => isActive(r) && r.checkIn === t && r.status !== "checkout",
        )
      : data.reservations.filter(
          (r) =>
            r.checkOut === t &&
            (r.status === "checkin" || r.status === "checkout"),
        );
  const done = (r: Reservation) =>
    kind === "llegadas" ? r.status === "checkin" : r.status === "checkout";
  list.sort((a, b) => Number(done(a)) - Number(done(b)));
  return (
    <Card
      icon={kind === "llegadas" ? LogIn : LogOut}
      count={list.length}
      title={`${kind === "llegadas" ? "Llegadas" : "Salidas"} de hoy`}
      actions={
        <Link
          href="/recepcion"
          className="text-[14px] font-medium text-accent hover:underline"
        >
          Recepción
        </Link>
      }
    >
      <ul className="stagger max-h-64 divide-y divide-gray-100 overflow-y-auto text-sm">
        {list.map((r) => {
          const st = idx.roomStates.get(r.roomId);
          return (
            <li key={r.id}>
              <button
                onClick={() => onOpen(r.id)}
                className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-gray-50 motion-reduce:transition-none"
              >
                <span
                  className={cls(
                    "num flex h-9 w-11 shrink-0 items-center justify-center rounded-lg text-[18px] shadow-sm",
                    done(r)
                      ? "bg-gray-100 text-gray-500"
                      : kind === "llegadas"
                        ? "bg-reservada text-white"
                        : "bg-proxima text-white",
                  )}
                >
                  {idx.roomById.get(r.roomId)?.number}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cls(
                      "block truncate text-[15px] font-medium",
                      done(r) && "text-gray-500",
                    )}
                  >
                    {r.guestName}
                  </span>
                  <span className="block text-[13.5px] text-gray-600">
                    {done(r)
                      ? kind === "llegadas"
                        ? "Ya ingresó"
                        : "Ya salió"
                      : kind === "llegadas"
                        ? `Esperando · hab. ${st ? ROOM_STATE_LABEL[st].toLowerCase() : ""}`
                        : "Pendiente de salida"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {!list.length && (
          <li className="flex flex-col items-center gap-2 px-4 py-8 text-center text-[15px] text-gray-600">
            <WaveArt />
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-500">
              {kind === "llegadas" ? (
                <LogIn size={18} aria-hidden />
              ) : (
                <LogOut size={18} aria-hidden />
              )}
            </span>
            Sin {kind} hoy
          </li>
        )}
      </ul>
    </Card>
  );
}

function RoomStatesCard() {
  const { idx, data } = useApp();
  const counts: Partial<Record<RoomState, number>> = {};
  for (const s of idx.roomStates.values()) counts[s] = (counts[s] ?? 0) + 1;
  const total = data.rooms.length || 1;
  return (
    <Card
      icon={BedDouble}
      title="Estado de habitaciones"
      actions={
        <Link
          href="/mantenimiento"
          className="text-[14px] font-medium text-accent hover:underline"
        >
          Ver tablero
        </Link>
      }
    >
      <div className="px-4 pt-3">
        <div className="flex h-3.5 overflow-hidden rounded-full bg-gray-100 ring-1 ring-inset ring-gray-200/70 [&>div]:shadow-[inset_0_1px_0_rgba(255,255,255,.3),inset_0_-2px_0_rgba(0,0,0,.12)]">
          {(Object.keys(ROOM_STATE_LABEL) as RoomState[]).map((s) => (
            <div
              key={s}
              className={ROOM_STATE_DOT[s]}
              style={{ width: `${((counts[s] ?? 0) / total) * 100}%` }}
              title={ROOM_STATE_LABEL[s]}
            />
          ))}
        </div>
      </div>
      <ul className="stagger space-y-2.5 px-4 py-3.5 text-[15px]">
        {(Object.keys(ROOM_STATE_LABEL) as RoomState[]).map((s) => (
          <li key={s} className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span
                className={cls("h-2.5 w-2.5 rounded-full", ROOM_STATE_DOT[s])}
              />{" "}
              {ROOM_STATE_LABEL[s]}
            </span>
            <b className="num text-[18px] tabular-nums">{counts[s] ?? 0}</b>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Feed en tiempo real: lo que hace el personal (mucamas, recepción, etc.) aparece acá al instante. */
function LiveFeed({ limit = 25 }: { limit?: number }) {
  const { data, idx, staffName } = useApp();
  const [, force] = useState(0);
  useEffect(() => {
    const i = setInterval(() => force((x) => x + 1), 30_000); // refresca los "hace X min"
    return () => clearInterval(i);
  }, []);
  const events = useMemo(() => {
    const ev: { at: string; by: string; text: string }[] = [];
    for (const task of data.tasks)
      for (const l of task.log ?? [])
        if (l.by !== "sistema" && /Complet|Inici|Report/.test(l.action))
          ev.push({
            at: l.at,
            by: l.by,
            text: `${l.action.toLowerCase()} · ${task.title} · Hab. ${idx.roomById.get(task.roomId)?.number ?? ""}`,
          });
    for (const a of data.activity)
      if (a.by !== "sistema" && !a.entity.startsWith("tasks/"))
        ev.push({
          at: a.at,
          by: a.by,
          text: `${a.action.toLowerCase()}${a.detail ? " · " + a.detail : ""}`,
        });
    return ev.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  }, [data.tasks, data.activity, idx.roomById, limit]);
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <span className="pulse-dot h-2 w-2 rounded-full bg-green-500" />{" "}
          Actividad en vivo
        </span>
      }
    >
      <ul className="stagger max-h-64 divide-y divide-gray-100 overflow-y-auto">
        {events.map((e, i) => (
          <li key={i} className="flex gap-3 px-4 py-2.5 text-[14px]">
            <Avatar name={staffName(e.by)} size={26} />
            <div className="min-w-0">
              <div className="leading-snug">
                <b className="font-medium">{staffName(e.by)}</b>{" "}
                <span className="text-gray-600">{e.text}</span>
              </div>
              <div className="text-[14px] text-gray-600">{fmtTimeAgo(e.at)}</div>
            </div>
          </li>
        ))}
        {!events.length && (
          <li className="flex flex-col items-center gap-2 px-4 py-8 text-center text-[15px] text-gray-600">
            <WaveArt />
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-500">
              <Activity size={18} aria-hidden />
            </span>
            Todavía no hay actividad
          </li>
        )}
      </ul>
    </Card>
  );
}

// ================== Chiches de abajo ==================
function WaveArt() {
  return (
    <svg
      width="120"
      height="36"
      viewBox="0 0 120 36"
      fill="none"
      aria-hidden
      className="text-accent"
    >
      <path
        d="M0 14c10 0 10-8 20-8s10 8 20 8 10-8 20-8 10 8 20 8 10-8 20-8 10 8 20 8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".55"
      />
      <path
        d="M0 28c10 0 10-8 20-8s10 8 20 8 10-8 20-8 10 8 20 8 10-8 20-8 10 8 20 8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".3"
      />
    </svg>
  );
}

function QuickLinks({ onNew }: { onNew?: () => void }) {
  const { can } = useApp();
  const box =
    "lift flex min-h-[72px] items-center gap-3 rounded-xl border border-gray-200/80 bg-panel px-4 py-3 text-left text-[16px] font-semibold shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  const icon = (I: React.ElementType) => (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
      <I size={22} aria-hidden />
    </span>
  );
  type QL = { href: string; label: string; I: React.ElementType };
  const links: QL[] = ([
    can("recepcion") && { href: "/recepcion", label: "Recepción", I: ArrowLeftRight },
    can("mi_jornada") && { href: "/mi-jornada", label: "Mi trabajo de hoy", I: ClipboardCheck },
    can("facturacion") && { href: "/facturacion", label: "Cobros", I: DollarSign },
  ] as (QL | false)[]).filter((x): x is QL => !!x);
  return (
    <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
      {onNew && (
        <button onClick={onNew} className={box}>
          {icon(Plus)}
          Nueva reserva
        </button>
      )}
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={box}>
          {icon(l.I)}
          {l.label}
        </Link>
      ))}
    </div>
  );
}

function FloorMap({ t, onOpen }: { t: string; onOpen: (id: string) => void }) {
  const { data, idx } = useApp();
  const floors = useMemo(() => {
    const guestByRoom = new Map<string, Reservation>();
    const arrivals = new Map<string, Reservation>();
    for (const r of data.reservations) {
      if (!isActive(r)) continue;
      if (r.status === "checkin") guestByRoom.set(r.roomId, r);
      else if (
        r.checkIn === t &&
        (r.status === "confirmada" || r.status === "pendiente")
      )
        arrivals.set(r.roomId, r);
    }
    const byFloor = new Map<number, Room[]>();
    for (const room of idx.roomsSorted) {
      const arr = byFloor.get(room.floor);
      if (arr) arr.push(room);
      else byFloor.set(room.floor, [room]);
    }
    return [...byFloor.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([floor, rooms]) => ({
        floor,
        tiles: rooms.map((room) => {
          const state = idx.roomStates.get(room.id) ?? "lista";
          const res = guestByRoom.get(room.id) ?? arrivals.get(room.id);
          const arriving = arrivals.has(room.id);
          const title = `Hab. ${room.number} · ${room.type} · ${ROOM_STATE_LABEL[state]}${res ? ` · ${res.guestName}${arriving ? " (llega hoy)" : ""}` : ""}`;
          return { room, state, res, arriving, title };
        }),
      }));
  }, [data.reservations, idx, t]);

  const tile =
    "num relative flex h-14 w-14 items-center justify-center rounded-xl text-[19px] ring-1 ring-inset transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none motion-reduce:hover:translate-y-0";
  return (
    <Card icon={BedDouble} title="Así está el hotel ahora">
      <div className="stagger space-y-3 px-4 py-4">
        {floors.map((f) => (
          <div key={f.floor} className="flex items-start gap-3">
            <span className="label-mono w-14 shrink-0 pt-4 text-[12.5px] font-semibold text-gray-600">
              Piso {f.floor}
            </span>
            <div className="flex flex-wrap gap-2">
              {f.tiles.map(({ room, state, res, arriving, title }) => {
                const inner = (
                  <>
                    {room.number}
                    {arriving && (
                      <span
                        aria-hidden
                        className="pulse-dot absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-white"
                      />
                    )}
                  </>
                );
                const c = cls(tile, ROOM_STATE_CLASS[state]);
                return res ? (
                  <button
                    key={room.id}
                    onClick={() => onOpen(res.id)}
                    title={title}
                    aria-label={title}
                    className={c}
                  >
                    {inner}
                  </button>
                ) : (
                  <Link
                    key={room.id}
                    href={`/mantenimiento?hab=${room.id}`}
                    title={title}
                    aria-label={title}
                    className={c}
                  >
                    {inner}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        {!floors.length && (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-[15px] text-gray-600">
            <WaveArt />
            Todavía no hay habitaciones cargadas
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-gray-200/80 pt-3 text-[14px] text-gray-700">
          {(Object.keys(ROOM_STATE_LABEL) as RoomState[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={cls("h-3.5 w-3.5 rounded", ROOM_STATE_DOT[s])} />
              {ROOM_STATE_LABEL[s]}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded-full bg-accent" />
            Llega hoy
          </span>
        </div>
      </div>
    </Card>
  );
}

function Occupancy14({ serie, t }: { serie: number[]; t: string }) {
  const info = useMemo(() => {
    const days = serie.map((v, i) => {
      const d = parseISO(addDays(t, i));
      return {
        v,
        wd: WEEKDAYS_SHORT[d.getDay()],
        n: d.getDate(),
        long: i === 0 ? "hoy" : d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric" }),
      };
    });
    const max = Math.max(...serie);
    const min = Math.min(...serie);
    return { days, busiest: days[serie.indexOf(max)], freest: days[serie.indexOf(min)], max, min };
  }, [serie, t]);
  const H = 110;
  return (
    <Card icon={TrendingUp} title="Ocupación de los próximos 14 días">
      <div className="px-4 py-4">
        <div className="no-scrollbar overflow-x-auto">
          <div
            className="flex min-w-[460px] items-end gap-1.5"
            role="list"
            aria-label="Porcentaje de habitaciones ocupadas por día"
          >
            {info.days.map((d, i) => (
              <div
                key={i}
                role="listitem"
                title={`${d.long}: ${d.v}% ocupado`}
                aria-label={`${d.long}: ${d.v}% ocupado`}
                className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
              >
                <span className={cls("num text-[13px]", i === 0 ? "font-bold text-accent" : "text-gray-700")}>
                  {d.v}%
                </span>
                <div
                  className={cls(
                    "ui-bar-grow w-full rounded-t-md bg-gradient-to-t",
                    i === 0
                      ? "from-accent to-accent/80 ring-2 ring-accent/40"
                      : "from-accent/40 to-accent/70",
                  )}
                  style={{ height: Math.max(4, (d.v / 100) * H), animationDelay: `${i * 35}ms` }}
                />
                <span className={cls("num text-[15px] leading-none", i === 0 && "text-accent")}>{d.n}</span>
                <span className="text-[12.5px] leading-none text-gray-600">{i === 0 ? "Hoy" : d.wd}</span>
              </div>
            ))}
          </div>
        </div>
        {info.max !== info.min && (
          <div className="mt-3 grid gap-2 text-[14px] sm:grid-cols-2">
            <div className="rounded-lg bg-gray-100/70 px-3 py-2">
              <span className="text-gray-600">Día más lleno</span>
              <div className="font-semibold">{info.busiest.long} · {info.max}%</div>
            </div>
            <div className="rounded-lg bg-gray-100/70 px-3 py-2">
              <span className="text-gray-600">Día más libre</span>
              <div className="font-semibold">{info.freest.long} · {info.min}%</div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function TodayTimeline({ t, onOpen }: { t: string; onOpen: (id: string) => void }) {
  const { data, idx } = useApp();
  const [nowD, setNowD] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setNowD(new Date()), 60_000);
    return () => clearInterval(i);
  }, []);
  const st = data.settings[0];
  const inTime = st?.checkInTime ?? "14:00";
  const outTime = st?.checkOutTime ?? "10:00";
  const items = useMemo(() => {
    const list: { r: Reservation; kind: "in" | "out"; time: string; done: boolean }[] = [];
    for (const r of data.reservations) {
      if (isActive(r) && r.checkIn === t && r.status !== "checkout")
        list.push({ r, kind: "in", time: inTime, done: r.status === "checkin" });
      if (r.checkOut === t && (r.status === "checkin" || r.status === "checkout"))
        list.push({ r, kind: "out", time: outTime, done: r.status === "checkout" });
    }
    return list.sort(
      (a, b) => a.time.localeCompare(b.time) || a.r.guestName.localeCompare(b.r.guestName),
    );
  }, [data.reservations, t, inTime, outTime]);
  const hhmm = `${String(nowD.getHours()).padStart(2, "0")}:${String(nowD.getMinutes()).padStart(2, "0")}`;
  const nowAt = items.findIndex((x) => x.time > hhmm);
  const marker = (
    <li key="now" className="flex items-center gap-3 py-1" aria-label={`Ahora son las ${hhmm}`}>
      <span className="num w-12 shrink-0 text-right text-[15px] text-accent">{hhmm}</span>
      <span className="pulse-dot h-3 w-3 shrink-0 rounded-full bg-accent" />
      <span className="h-px flex-1 bg-accent/40" />
      <span className="label-mono text-[12.5px] font-semibold text-accent">Ahora</span>
    </li>
  );
  const rows = items.map((x) => (
    <li key={`${x.kind}-${x.r.id}`}>
      <button
        onClick={() => onOpen(x.r.id)}
        className="flex min-h-[56px] w-full items-center gap-3 rounded-lg py-1.5 text-left transition-colors duration-150 hover:bg-gray-50 motion-reduce:transition-none"
      >
        <span className="num w-12 shrink-0 text-right text-[15px] text-gray-700">{x.time}</span>
        <span
          className={cls(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            x.done ? "bg-gray-100 text-gray-500" : x.kind === "in" ? "bg-reservada text-white" : "bg-proxima text-white",
          )}
        >
          {x.done ? <Check size={18} aria-hidden /> : x.kind === "in" ? <LogIn size={18} aria-hidden /> : <LogOut size={18} aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cls("block truncate text-[15px] font-medium", x.done && "text-gray-500")}>
            {x.r.guestName}
          </span>
          <span className="block text-[13.5px] text-gray-600">
            Hab. {idx.roomById.get(x.r.roomId)?.number} ·{" "}
            {x.kind === "in" ? (x.done ? "Ya entró" : "Falta que entre") : x.done ? "Ya salió" : "Falta que salga"}
          </span>
        </span>
      </button>
    </li>
  ));
  const out = rows.slice();
  out.splice(nowAt < 0 ? rows.length : nowAt, 0, marker);
  return (
    <Card icon={Clock} title="Hoy en el hotel" count={items.length}>
      {items.length ? (
        <ul className="max-h-80 space-y-1 overflow-y-auto px-4 py-3">{out}</ul>
      ) : (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-[15px] text-gray-600">
          <WaveArt />
          Hoy no hay llegadas ni salidas
        </div>
      )}
    </Card>
  );
}
