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
  Maximize2,
  Minimize2,
  Percent,
  Plus,
  Rows3,
  SearchX,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { ReservationDrawer, ReservationForm } from "@/components/reservation";
import {
  Avatar,
  Button,
  Card,
  Input,
  Select,
  Stat,
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
type Tip = { x: number; y: number; text: string } | null;
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
      className="pointer-events-none fixed z-50 max-w-[calc(100vw-24px)] rounded-lg bg-gray-900 px-3 py-2 text-[13.5px] leading-snug text-white shadow-pop"
      style={{ left: tip.x + 12, top: tip.y + 14 }}
    >
      {tip.text}
    </div>
  );
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
  const { data, idx, can, actions } = useApp();
  const t = today();
  const now = parseISO(t);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());
  const [floor, setFloor] = useState<string>("todos");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [density, setDensity] = useState<"normal" | "compacto">("compacto");
  const [full, setFull] = useState(false);
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

  // Un solo selector de fecha: "Noviembre 2026"
  const viewIdx = year * 12 + month;
  const nowIdx = now.getFullYear() * 12 + now.getMonth();
  const monthOptions = useMemo(() => {
    const from = Math.min(nowIdx - 12, viewIdx);
    const to = Math.max(nowIdx + 24, viewIdx);
    return Array.from({ length: to - from + 1 }, (_, i) => {
      const v = from + i;
      return { v, label: `${MONTHS[v % 12]} ${Math.floor(v / 12)}` };
    });
  }, [nowIdx, viewIdx]);

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

  // Pantalla completa real del navegador: el mapa ocupa todo el monitor
  const toggleFull = useCallback(() => {
    setFull((f) => {
      const next = !f;
      try {
        if (next && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
        if (!next && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      } catch {}
      return next;
    });
  }, []);
  // Al salir del modo ampliado por cualquier vía (botón, Esc), también se sale de la pantalla completa del navegador
  useEffect(() => {
    if (!full && typeof document !== "undefined" && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, [full]);
  useEffect(() => {
    const h = () => {
      if (!document.fullscreenElement) setFull(false);
    };
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  // Esc sale de pantalla completa (si no hay un panel abierto encima)
  useEffect(() => {
    if (!full) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !openRes && !form.open) setFull(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [full, openRes, form.open]);

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
      <section className="flex flex-col gap-2 p-2 lg:h-[calc(100dvh-4rem)] lg:min-h-[440px] lg:p-3">
      {/* ===== Calendario ===== */}
      <Card
        className={cls(
          "flex flex-col overflow-hidden",
          full
            ? "fixed inset-0 z-[45] !rounded-none !border-0"
            : "lg:min-h-0 lg:flex-1",
        )}
      >
        {/* Barra de controles: una sola línea, chica */}
        <div className="no-scrollbar flex shrink-0 flex-nowrap items-center gap-1 overflow-x-auto border-b border-gray-100 px-2 py-1.5 [&>*]:shrink-0">
          <Button
            size="sm"
            className="!h-7 !w-7 !px-0"
            onClick={() => shiftMonth(-1)}
            aria-label="Mes anterior"
          >
            <ChevronLeft size={14} />
          </Button>
          <Select
            value={viewIdx}
            onChange={(e) => {
              const v = Number(e.target.value);
              setYear(Math.floor(v / 12));
              setMonth(v % 12);
            }}
            className="!h-7 !w-[128px] !px-2 !text-[12px]"
            aria-label="Mes y año"
          >
            {monthOptions.map((o) => (
              <option key={o.v} value={o.v}>
                {o.label}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            className="!h-7 !w-7 !px-0"
            onClick={() => shiftMonth(1)}
            aria-label="Mes siguiente"
          >
            <ChevronRight size={14} />
          </Button>
          <Button
            size="sm"
            className="!h-7 !px-3 !text-[12px]"
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
            className="!h-7 !w-[130px] 2xl:!w-[200px] !px-2.5 !text-[12px]"
          />
          <Select
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            className="!h-7 !w-[104px] !px-2 !text-[12px]"
            aria-label="Piso"
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
            className="!h-7 !w-[138px] !px-2 !text-[12px]"
            aria-label="Estado de las reservas"
          >
            <option value="todos">Todas las reservas</option>
            <option value="ocupada">Con huéspedes</option>
            <option value="reservada">Por llegar</option>
            <option value="proxima">Se van pronto</option>
            <option value="otros">Sin confirmar o terminadas</option>
            <option value="mantenimiento">Para limpiar o arreglar</option>
          </Select>
          <Button
            size="sm"
            className="!h-7 !w-7 !px-0"
            onClick={() =>
              setDensity((d) => (d === "normal" ? "compacto" : "normal"))
            }
            title={density === "normal" ? "Achicar filas" : "Agrandar filas"}
            aria-label="Tamaño de las filas"
          >
            <Rows3 size={14} />
          </Button>
          <div className="ml-auto flex items-center gap-1 pl-1">
            <span
              className="hidden h-7 w-7 cursor-help items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 sm:flex"
              title={
                canEdit
                  ? "Cómo usarlo: tocá un día vacío para hacer una reserva · tocá una barra de color para ver los datos del huésped · arrastrá una barra para cambiarla de habitación o de fecha."
                  : "Cómo usarlo: tocá una barra de color para ver los datos del huésped."
              }
              aria-label="Ayuda"
            >
              <Info size={14} />
            </span>
            <Button
              size="sm"
              className="!h-7 !w-7 !px-0"
              onClick={exportCSV}
              title="Exportar reservas del mes (CSV)"
              aria-label="Exportar"
            >
              <Download size={14} />
            </Button>
            {canEdit && (
              <Button
                variant="primary"
                size="sm"
                className="!h-7 !px-3 !text-[12px]"
                onClick={() => setForm({ open: true, initial: {} })}
              >
                <Plus size={14} />
                <span className="hidden 2xl:inline">Nueva reserva</span>
                <span className="2xl:hidden">Reservar</span>
              </Button>
            )}
            <Button
              size="sm"
              variant={full ? "secondary" : "primary"}
              className="!h-7 !px-2.5 !text-[12px]"
              onClick={toggleFull}
              title={full ? "Salir de pantalla completa (Esc)" : "Ver el mapa de habitaciones en pantalla completa"}
              aria-label={full ? "Salir de pantalla completa" : "Ampliar mapa"}
            >
              {full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span className="hidden sm:inline">{full ? "Salir" : "Ampliar mapa"}</span>
            </Button>
          </div>
        </div>

        {/* Colores */}
        <div className="no-scrollbar flex shrink-0 flex-nowrap items-center gap-x-3 overflow-x-auto whitespace-nowrap border-b border-gray-100 px-3 py-1 text-[11.5px] text-gray-700">
          {(Object.keys(VISUAL_LABEL) as VisualStatus[]).map((v) => (
            <span key={v} className="flex items-center gap-1.5">
              <span className={cls("h-2.5 w-2.5 rounded-sm", VISUAL_DOT[v])} />{" "}
              {VISUAL_LABEL[v]}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="hatch h-2.5 w-2.5 rounded-sm border border-purple-300" />{" "}
            En arreglo
          </span>
        </div>

        <div
          ref={scrollRef}
          className={cls(
            "overflow-auto overscroll-contain",
            full
              ? "min-h-0 flex-1"
              : "max-h-[72vh] min-h-[320px] lg:max-h-none lg:min-h-0 lg:flex-1",
          )}
          onMouseLeave={() => showTip(null)}
        >
          <div
            className="flex min-h-full flex-col"
            style={{ minWidth: 72 + days * 40 }}
          >
            <div className="sticky top-0 z-20 shrink-0 border-b border-gray-200 bg-white">
              <div className="flex">
              <div className="sticky left-0 z-10 flex w-[72px] shrink-0 items-center border-r border-gray-100 bg-white px-3 text-[14px] font-semibold">
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
                        "flex flex-col items-center border-l border-gray-100 py-1.5",
                        isToday
                          ? "bg-accent text-accent-fg"
                          : dt.getDay() === 0 || dt.getDay() === 6
                            ? "bg-gray-100"
                            : "",
                      )}
                    >
                      <span
                        className={cls(
                          "text-[12px] font-medium",
                          isToday ? "text-accent-fg/80" : "text-gray-600",
                        )}
                      >
                        {WEEKDAYS_SHORT[dt.getDay()]}
                      </span>
                      <span className="text-[15px] font-semibold tabular-nums">
                        {dt.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
              </div>
              {totalRooms > 0 && (
                <div className="flex border-t border-gray-100">
                  <div
                    className="sticky left-0 z-10 flex w-[72px] shrink-0 items-center border-r border-gray-100 bg-white px-3 text-[13.5px] font-medium text-gray-700"
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
                          "flex items-center justify-center border-l border-gray-100 py-1 text-[14px] font-semibold tabular-nums",
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
                    className="sticky left-0 my-0.5 ml-1 flex min-h-[28px] shrink-0 items-center self-start gap-1.5 rounded-md px-2 py-0.5 text-[13px] font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-100 motion-reduce:transition-none"
                  >
                    <ChevronDown
                      size={14}
                      className={cls(
                        "transition duration-150 motion-reduce:transition-none",
                        collapsed.has(f) && "-rotate-90",
                      )}
                    />{" "}
                    Piso {f}
                    <span className="text-[14px] font-normal text-gray-600">
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
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-500">
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
                    className="font-medium text-blue-700 hover:underline"
                  >
                    Cargar las habitaciones o los datos de ejemplo
                  </Link>
                )}
              </div>
            )}
            </div>
          </div>
        </div>

      </Card>
      </section>

      <TooltipLayer />

      {/* ===== Debajo del primer scroll: indicadores y paneles ===== */}
      <section className="space-y-5 p-4 pt-2 lg:p-6 lg:pt-3">
      {/* ===== KPIs ===== */}
      <div
        className={cls(
          "grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4 md:grid-cols-3",
          showMoney ? "xl:grid-cols-6" : "xl:grid-cols-4",
        )}
      >
        <Stat
          icon={Percent}
          tone="indigo"
          label="Hotel lleno al"
          value={`${stats.ocupacion}%`}
          sub={`${stats.ocupadas} habitaciones con gente · ${stats.reservadas} por llegar`}
        />
        <Stat
          icon={LogIn}
          tone="blue"
          label="Llegan hoy"
          value={`${stats.llegadasHechas} de ${stats.llegadas}`}
          sub="ya entraron"
          href="/recepcion"
        />
        <Stat
          icon={LogOut}
          tone="red"
          label="Se van hoy"
          value={`${stats.salidasHechas} de ${stats.salidas}`}
          sub="ya se fueron"
          href="/recepcion"
        />
        <Stat
          icon={Sparkles}
          tone="orange"
          label="Habitaciones limpias"
          value={`${stats.listas} listas`}
          sub={`${stats.sucias} falta limpiar · ${stats.mant} en arreglo`}
          href="/mantenimiento"
        />
        {showMoney && (
          <Stat
            icon={DollarSign}
            tone="green"
            label="Cobrado hoy"
            value={money(stats.cobradoHoy)}
            href="/facturacion"
          />
        )}
        {showMoney && (
          <Stat
            icon={BedDouble}
            tone="purple"
            label="Precio promedio por noche"
            value={money(stats.adr)}
            sub="de las habitaciones ocupadas"
          />
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
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
    <div className="flex flex-1 border-b border-gray-100" style={{ minHeight: p.rowH }}>
      <Link
        href={`/mantenimiento?hab=${room.id}`}
        title={`${room.type} · ${ROOM_STATE_LABEL[p.state]}`}
        className="sticky left-0 z-10 flex w-[72px] shrink-0 items-center gap-1.5 border-r border-gray-100 bg-white px-3 text-[14px] font-semibold transition-colors duration-150 hover:bg-gray-50 motion-reduce:transition-none"
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
                  "border-l border-gray-100",
                  p.canEdit && "hover:bg-blue-50",
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
          const tipText = `${r.guestName} · Hab. ${room.number} · ${r.checkIn.split("-").reverse().join("/")} a ${r.checkOut.split("-").reverse().join("/")} · ${r.pax} huésp. · ${RES_STATUS_LABEL[r.status]}`;
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
                showTip({ x: e.clientX, y: e.clientY, text: tipText })
              }
              onMouseLeave={() => showTip(null)}
              className={cls(
                "absolute bottom-1 top-1 truncate rounded-md px-2.5 text-left font-semibold shadow-sm transition-[filter] duration-150 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent motion-reduce:transition-none",
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
      className="flex flex-col overflow-hidden"
      icon={kind === "llegadas" ? LogIn : LogOut}
      title={`${kind === "llegadas" ? "Llegadas" : "Salidas"} de hoy`}
      count={list.length}
      actions={
        <Link
          href="/recepcion"
          className="rounded-md px-1.5 py-1 text-[14px] font-semibold text-accent underline-offset-4 transition-colors hover:text-accent-hover hover:underline"
        >
          Recepción
        </Link>
      }
    >
      <ul className="max-h-72 divide-y divide-gray-200/60 overflow-y-auto text-sm">
        {list.map((r) => {
          const st = idx.roomStates.get(r.roomId);
          return (
            <li key={r.id}>
              <button
                onClick={() => onOpen(r.id)}
                className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-accent/[0.06] focus-visible:bg-accent/[0.06] focus-visible:outline-offset-[-2px] motion-reduce:transition-none sm:px-5"
              >
                <span
                  className={cls(
                    "num flex h-9 w-12 shrink-0 items-center justify-center rounded-lg text-[16px] tabular-nums",
                    done(r)
                      ? "bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-200"
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
                      done(r) ? "text-gray-500" : "text-fg",
                    )}
                  >
                    {r.guestName}
                  </span>
                  <span className="block truncate text-[13.5px] text-gray-600">
                    {done(r)
                      ? kind === "llegadas"
                        ? "Ya ingresó"
                        : "Ya salió"
                      : kind === "llegadas"
                        ? `Esperando · hab. ${st ? ROOM_STATE_LABEL[st].toLowerCase() : ""}`
                        : "Pendiente de salida"}
                  </span>
                </span>
                <ChevronRight
                  size={16}
                  className="shrink-0 text-gray-400"
                  aria-hidden
                />
              </button>
            </li>
          );
        })}
        {!list.length && (
          <li className="flex flex-col items-center gap-2.5 px-4 py-9 text-center text-[15px] text-gray-600">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-panel-2 text-accent">
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
      className="overflow-hidden"
      icon={BedDouble}
      title="Estado de habitaciones"
      actions={
        <Link
          href="/mantenimiento"
          className="rounded-md px-1.5 py-1 text-[14px] font-semibold text-accent underline-offset-4 transition-colors hover:text-accent-hover hover:underline"
        >
          Ver tablero
        </Link>
      }
    >
      <div className="px-4 pt-4 sm:px-5">
        <div className="flex h-2.5 gap-px overflow-hidden rounded-full bg-gray-200/70">
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
      <ul className="divide-y divide-gray-200/60 px-4 pb-2 pt-2 text-[15px] sm:px-5">
        {(Object.keys(ROOM_STATE_LABEL) as RoomState[]).map((s) => (
          <li key={s} className="flex items-center justify-between gap-3 py-2">
            <span className="flex min-w-0 items-center gap-2.5 text-gray-800">
              <span
                aria-hidden
                className={cls("h-2.5 w-2.5 shrink-0 rounded-full", ROOM_STATE_DOT[s])}
              />{" "}
              {ROOM_STATE_LABEL[s]}
            </span>
            <b
              className={cls(
                "num text-[18px] tabular-nums leading-none",
                counts[s] ? "text-fg" : "text-gray-400",
              )}
            >
              {counts[s] ?? 0}
            </b>
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
      className="overflow-hidden"
      title={
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="pulse-dot h-2 w-2 shrink-0 rounded-full bg-green-500 motion-reduce:animate-none"
          />{" "}
          Actividad en vivo
        </span>
      }
    >
      <ul className="max-h-72 divide-y divide-gray-200/60 overflow-y-auto">
        {events.map((e, i) => (
          <li key={i} className="flex gap-3 px-4 py-3 text-[14px] sm:px-5">
            <Avatar name={staffName(e.by)} size={28} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="break-words leading-snug">
                <b className="font-semibold text-fg">{staffName(e.by)}</b>{" "}
                <span className="text-gray-600">{e.text}</span>
              </div>
              <div className="mt-0.5 text-[13px] tabular-nums text-gray-500">
                {fmtTimeAgo(e.at)}
              </div>
            </div>
          </li>
        ))}
        {!events.length && (
          <li className="flex flex-col items-center gap-2.5 px-4 py-9 text-center text-[15px] text-gray-600">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-panel-2 text-accent">
              <Activity size={18} aria-hidden />
            </span>
            Todavía no hay actividad
          </li>
        )}
      </ul>
    </Card>
  );
}
