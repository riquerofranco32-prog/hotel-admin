"use client";
import Link from "next/link";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  BedDouble,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  LogIn,
  LogOut,
  Percent,
  Plus,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { ReservationDrawer, ReservationForm } from "@/components/reservation";
import { Avatar, Button, Card, Input, Select, Stat, toast } from "@/components/ui";
import { addDays, daysInMonth, diffDays, fmtShort, fmtTimeAgo, MONTHS, parseISO, toISO, today, WEEKDAYS_SHORT } from "@/lib/dates";
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
    <div className="pointer-events-none fixed z-50 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-[12.5px] text-white shadow-lg" style={{ left: tip.x + 12, top: tip.y + 14 }}>
      {tip.text}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
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
  const [form, setForm] = useState<{ open: boolean; initial?: Partial<Reservation> }>({ open: false });
  const canEdit = can("editar_reservas");
  const showMoney = can("ver_montos");

  const days = daysInMonth(year, month);
  const monthStart = toISO(new Date(year, month, 1));
  const monthEnd = addDays(monthStart, days);
  const dayList = useMemo(() => Array.from({ length: days }, (_, i) => addDays(monthStart, i)), [days, monthStart]);

  const floors = useMemo(() => Array.from(new Set(data.rooms.map((r) => r.floor))).sort((a, b) => a - b), [data.rooms]);

  // Reservas del mes agrupadas por habitación
  const monthResByRoom = useMemo(() => {
    const m = new Map<string, Reservation[]>();
    for (const r of data.reservations) {
      if (!isActive(r) || r.checkIn >= monthEnd || r.checkOut <= monthStart) continue;
      const arr = m.get(r.roomId);
      if (arr) arr.push(r);
      else m.set(r.roomId, [r]);
    }
    return m;
  }, [data.reservations, monthStart, monthEnd]);

  const blockingByRoom = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of data.tasks) if (x.blocksRoom && x.status !== "completada") m.set(x.roomId, x.dueDate);
    return m;
  }, [data.tasks]);

  const visibleRooms = useMemo(
    () =>
      idx.roomsSorted
        .filter((room) => floor === "todos" || String(room.floor) === floor)
        .filter((room) => !q || room.number.includes(q) || (monthResByRoom.get(room.id) ?? []).some((r) => r.guestName.toLowerCase().includes(q)))
        .filter((room) => {
          if (status === "todos") return true;
          const st = idx.roomStates.get(room.id);
          if (status === "mantenimiento") return st === "mantenimiento" || st === "sucia" || st === "en_limpieza";
          return (monthResByRoom.get(room.id) ?? []).some((r) => visualStatus(r, t) === status);
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
      if ((r.status === "confirmada" || r.status === "pendiente") && r.checkIn <= t && r.checkOut > t) reservadas++;
      if (r.checkIn === t && r.status !== "checkout") {
        llegadas++;
        if (r.status === "checkin") llegadasHechas++;
      }
      if (r.checkOut === t && (r.status === "checkin" || r.status === "checkout")) {
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
    const ocupacion = base ? Math.round(((ocupadas + reservadas) / base) * 100) : 0;
    const cobradoHoy = data.payments.reduce((s, p) => (p.date === t ? s + p.amount : s), 0);
    const adr = ocupadas ? tarifas / ocupadas : 0;
    return { ocupadas, reservadas, mant, sucias, listas, llegadas, llegadasHechas, salidas, salidasHechas, huespedes, ocupacion, cobradoHoy, adr };
  }, [data.reservations, data.rooms.length, data.payments, idx.roomStates, t]);

  const shiftMonth = (n: number) => {
    const d = new Date(year, month + n, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  function exportCSV() {
    const rows = [["Reserva", "Habitación", "Huésped", "Entrada", "Salida", "Noches", "Pax", "Estado", "Canal", ...(showMoney ? ["Tarifa", "Total", "Saldo"] : [])]];
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
          ...(showMoney ? [String(r.rate), String(f.total), String(f.balance)] : []),
        ]);
      }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reservas-${year}-${String(month + 1).padStart(2, "0")}.csv`;
    a.click();
  }

  // ===== Arrastrar y soltar =====
  const dragRef = useRef<{ id: string; offset: number } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<{ roomId: string; day: string } | null>(null);

  const onDragStartRes = useCallback(
    (r: Reservation, dayIdx: number) => {
      dragRef.current = { id: r.id, offset: diffDays(r.checkIn, addDays(monthStart, dayIdx)) };
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
    setDropAt((cur) => (cur?.roomId === roomId && cur.day === day ? cur : { roomId, day }));
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
      if (cur.status === "checkout") return toast("No se puede mover una estadía que ya terminó", "error");
      if (cur.status === "checkin" && moved.checkIn !== cur.checkIn) return toast("El huésped ya ingresó: sólo podés cambiarlo de habitación", "error");
      const err = actions.validateReservation(moved);
      if (err) return toast(err, "error");
      const newRoom = d.rooms.find((x) => x.id === roomId)?.number;
      const oldRoom = d.rooms.find((x) => x.id === cur.roomId)?.number;
      if (!confirm(`¿Mover a ${cur.guestName}?\n\nHab. ${oldRoom} · ${fmtShort(cur.checkIn)} → ${fmtShort(cur.checkOut)}\n→ Hab. ${newRoom} · ${fmtShort(moved.checkIn)} → ${fmtShort(moved.checkOut)}`)) return;
      await actions.saveReservation(moved);
      toast("Reserva movida");
    },
    [actions, onDragEnd],
  );

  const onCellClick = useCallback(
    (room: Room, day: string) => setForm({ open: true, initial: { roomId: room.id, checkIn: day, checkOut: addDays(day, 2), rate: room.rate } }),
    [],
  );
  const onOpenRes = useCallback((id: string) => setOpenRes(id), []);

  const rowH = density === "normal" ? 42 : 30;
  const gridCols = `repeat(${days}, minmax(38px, 1fr))`;

  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* ===== Encabezado ===== */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">
            {greeting()}, {me?.name.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-gray-500">
            {now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })} · {stats.huespedes} huéspedes en casa
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportCSV}>
            <Download size={15} /> Exportar
          </Button>
          {canEdit && (
            <Button variant="primary" onClick={() => setForm({ open: true, initial: {} })}>
              <Plus size={15} /> Nueva reserva
            </Button>
          )}
        </div>
      </div>

      {/* ===== KPIs ===== */}
      <div className={cls("grid grid-cols-2 gap-3 md:grid-cols-3", showMoney ? "xl:grid-cols-6" : "xl:grid-cols-4")}>
        <Stat icon={Percent} tone="indigo" label="Ocupación hoy" value={`${stats.ocupacion}%`} sub={`${stats.ocupadas} ocupadas · ${stats.reservadas} por llegar`} />
        <Stat icon={LogIn} tone="blue" label="Llegadas" value={`${stats.llegadasHechas}/${stats.llegadas}`} sub="ingresaron / esperadas" href="/recepcion" />
        <Stat icon={LogOut} tone="red" label="Salidas" value={`${stats.salidasHechas}/${stats.salidas}`} sub="salieron / previstas" href="/recepcion" />
        <Stat icon={Sparkles} tone="orange" label="Housekeeping" value={`${stats.listas} listas`} sub={`${stats.sucias} por limpiar · ${stats.mant} en mant.`} href="/mantenimiento" />
        {showMoney && <Stat icon={DollarSign} tone="green" label="Cobrado hoy" value={money(stats.cobradoHoy)} href="/facturacion" />}
        {showMoney && <Stat icon={BedDouble} tone="purple" label="Tarifa promedio (ADR)" value={money(stats.adr)} sub="habitaciones ocupadas" />}
      </div>

      {/* ===== Calendario ===== */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-3 py-2.5">
          <Button size="sm" onClick={() => shiftMonth(-1)} aria-label="Mes anterior">
            <ChevronLeft size={16} />
          </Button>
          <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-8 w-[125px]">
            {MONTHS.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </Select>
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-8 w-[85px]">
            {[year - 2, year - 1, year, year + 1, year + 2].map((y) => (
              <option key={y}>{y}</option>
            ))}
          </Select>
          <Button size="sm" onClick={() => shiftMonth(1)} aria-label="Mes siguiente">
            <ChevronRight size={16} />
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setYear(now.getFullYear());
              setMonth(now.getMonth());
            }}
          >
            Hoy
          </Button>
          <Input placeholder="Hab. o huésped" value={query} onChange={(e) => setQuery(e.target.value)} className="h-8 w-[160px]" />
          <Select value={floor} onChange={(e) => setFloor(e.target.value)} className="h-8 w-[140px]">
            <option value="todos">Todos los pisos</option>
            {floors.map((f) => (
              <option key={f} value={f}>
                Piso {f}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="h-8 w-[165px]">
            <option value="todos">Todos los estados</option>
            <option value="ocupada">Ocupada</option>
            <option value="reservada">Reservada</option>
            <option value="proxima">Próxima a salir</option>
            <option value="otros">Otros estados</option>
            <option value="mantenimiento">Limpieza / mantenimiento</option>
          </Select>
          <Select value={density} onChange={(e) => setDensity(e.target.value as "normal" | "compacto")} className="h-8 w-[110px]">
            <option value="normal">Normal</option>
            <option value="compacto">Compacto</option>
          </Select>
          <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-gray-600">
            {(Object.keys(VISUAL_LABEL) as VisualStatus[]).map((v) => (
              <span key={v} className="flex items-center gap-1.5">
                <span className={cls("h-2.5 w-2.5 rounded-sm", VISUAL_DOT[v])} /> {VISUAL_LABEL[v]}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="hatch h-2.5 w-2.5 rounded-sm border border-purple-300" /> Mantenimiento
            </span>
          </div>
        </div>

        <div className="max-h-[calc(100vh-150px)] overflow-auto" onMouseLeave={() => showTip(null)}>
          <div style={{ minWidth: 72 + days * 40 }}>
            <div className="sticky top-0 z-20 flex border-b border-gray-200 bg-white">
              <div className="sticky left-0 z-10 flex w-[72px] shrink-0 items-center bg-white px-3 text-[14px] font-semibold">Hab.</div>
              <div className="grid flex-1" style={{ gridTemplateColumns: gridCols }}>
                {dayList.map((d) => {
                  const dt = parseISO(d);
                  const isToday = d === t;
                  return (
                    <div
                      key={d}
                      className={cls(
                        "flex flex-col items-center border-l border-gray-100 py-1",
                        isToday ? "bg-gray-900 text-white" : dt.getDay() === 0 || dt.getDay() === 6 ? "bg-gray-50" : "",
                      )}
                    >
                      <span className={cls("text-[10px]", isToday ? "text-gray-300" : "text-gray-500")}>{WEEKDAYS_SHORT[dt.getDay()]}</span>
                      <span className="text-[14px] font-semibold tabular-nums">{dt.getDate()}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {floors
              .filter((f) => visibleRooms.some((r) => r.floor === f))
              .map((f) => (
                <div key={f}>
                  <button
                    onClick={() =>
                      setCollapsed((s) => {
                        const n = new Set(s);
                        if (n.has(f)) n.delete(f);
                        else n.add(f);
                        return n;
                      })
                    }
                    className="sticky left-0 flex items-center gap-1.5 px-3 py-2 text-[14px] font-medium text-gray-800"
                  >
                    <ChevronDown size={14} className={cls("transition", collapsed.has(f) && "-rotate-90")} /> Piso {f}
                    <span className="text-xs font-normal text-gray-400">({visibleRooms.filter((r) => r.floor === f).length})</span>
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
                          dropDay={dropAt?.roomId === room.id ? dropAt.day : null}
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
            {visibleRooms.length === 0 && <div className="p-10 text-center text-sm text-gray-500">No hay habitaciones que coincidan con los filtros.</div>}
          </div>
        </div>
        {canEdit && <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400">Clic en un día libre para reservar · arrastrá una reserva para cambiarla de habitación o de fecha</div>}
      </Card>

      <TooltipLayer />

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        <TodayList kind="llegadas" onOpen={setOpenRes} />
        <TodayList kind="salidas" onOpen={setOpenRes} />
        <RoomStatesCard />
        <LiveFeed />
      </div>

      <ReservationDrawer
        id={openRes}
        onClose={() => setOpenRes(null)}
        onEdit={(r) => {
          setOpenRes(null);
          setForm({ open: true, initial: r });
        }}
      />
      <ReservationForm open={form.open} initial={form.initial} onClose={() => setForm({ open: false })} />
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
  const hatch = useMemo(() => {
    if (!p.blockingDue && !room.outOfService) return [-1, -1];
    const from = t < monthStart ? monthStart : t;
    const to = p.blockingDue ? addDays(p.blockingDue > t ? p.blockingDue : t, 1) : p.monthEnd;
    return [Math.max(0, diffDays(monthStart, from)), Math.min(days, diffDays(monthStart, to))];
  }, [p.blockingDue, room.outOfService, t, monthStart, p.monthEnd, days]);

  // Un solo manejador por fila: calcula el día según la posición del mouse
  const dayAt = (e: React.MouseEvent | React.DragEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const i = Math.min(days - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * days)));
    return dayList[i];
  };

  return (
    <div className="flex border-b border-gray-100" style={{ height: p.rowH }}>
      <Link
        href={`/mantenimiento?hab=${room.id}`}
        title={`${room.type} · ${ROOM_STATE_LABEL[p.state]}`}
        className="sticky left-0 z-10 flex w-[72px] shrink-0 items-center gap-1.5 bg-white px-3 text-[14px] font-medium hover:bg-gray-50"
      >
        {room.number}
        <span className={cls("h-2 w-2 rounded-full", ROOM_STATE_DOT[p.state])} />
        {p.blockingDue && <Wrench size={11} className="text-purple-600" />}
      </Link>
      <div
        className={cls("relative flex-1", p.canEdit && "cursor-pointer")}
        onClick={(e) => {
          if (p.canEdit && (e.target as HTMLElement).dataset.cell !== undefined) p.onCellClick(room, dayAt(e));
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
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: p.gridCols }}>
          {dayList.map((d, i) => {
            const wd = parseISO(d).getDay();
            return (
              <div
                key={d}
                data-cell=""
                className={cls(
                  "border-l border-gray-100",
                  p.canEdit && "hover:bg-blue-50",
                  d === t ? "bg-gray-100" : wd === 0 || wd === 6 ? "bg-gray-50/60" : "",
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
            span >= 5 ? `${r.guestName} · ${fmtShort(r.checkIn)} → ${fmtShort(r.checkOut)} · ${r.pax}p` : span >= 3 ? `${r.guestName} · ${r.pax}p` : r.guestName;
          const tipText = `${r.guestName} · Hab. ${room.number} · ${r.checkIn.split("-").reverse().join("/")} a ${r.checkOut.split("-").reverse().join("/")} · ${r.pax} huésp. · ${RES_STATUS_LABEL[r.status]}`;
          const movable = p.canEdit && r.status !== "checkout";
          return (
            <button
              key={r.id}
              draggable={movable}
              onDragStart={(e) => {
                const parent = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                p.onDragStartRes(r, Math.floor(((e.clientX - parent.left) / parent.width) * days));
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={p.onDragEnd}
              onClick={(e) => {
                e.stopPropagation();
                p.onOpen(r.id);
              }}
              onMouseMove={(e) => showTip({ x: e.clientX, y: e.clientY, text: tipText })}
              onMouseLeave={() => showTip(null)}
              className={cls(
                "absolute bottom-[3px] top-[3px] truncate rounded-[3px] px-2 text-left font-medium transition-[filter] hover:brightness-110",
                p.compact ? "text-[11.5px]" : "text-[12.5px]",
                VISUAL_CLASS[vs],
                movable && "cursor-grab active:cursor-grabbing",
                p.dragging === r.id && "opacity-50",
                p.dragging && "pointer-events-none",
                p.q && r.guestName.toLowerCase().includes(p.q) && "ring-2 ring-amber-400",
              )}
              style={{ left: `calc(${(start / days) * 100}% + 1px)`, width: `calc(${(span / days) * 100}% - 2px)` }}
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
function TodayList({ kind, onOpen }: { kind: "llegadas" | "salidas"; onOpen: (id: string) => void }) {
  const { data, idx } = useApp();
  const t = today();
  const list =
    kind === "llegadas"
      ? data.reservations.filter((r) => isActive(r) && r.checkIn === t && r.status !== "checkout")
      : data.reservations.filter((r) => r.checkOut === t && (r.status === "checkin" || r.status === "checkout"));
  const done = (r: Reservation) => (kind === "llegadas" ? r.status === "checkin" : r.status === "checkout");
  list.sort((a, b) => Number(done(a)) - Number(done(b)));
  return (
    <Card
      title={`${kind === "llegadas" ? "Llegadas" : "Salidas"} de hoy (${list.length})`}
      actions={
        <Link href="/recepcion" className="text-xs font-medium text-blue-600 hover:underline">
          Recepción
        </Link>
      }
    >
      <ul className="max-h-64 divide-y divide-gray-100 overflow-y-auto text-sm">
        {list.map((r) => {
          const st = idx.roomStates.get(r.roomId);
          return (
            <li key={r.id}>
              <button onClick={() => onOpen(r.id)} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-gray-50">
                <span
                  className={cls(
                    "flex h-8 w-10 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
                    done(r) ? "bg-gray-100 text-gray-500" : kind === "llegadas" ? "bg-reservada text-white" : "bg-proxima text-white",
                  )}
                >
                  {idx.roomById.get(r.roomId)?.number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cls("block truncate font-medium", done(r) && "text-gray-500")}>{r.guestName}</span>
                  <span className="block text-xs text-gray-500">
                    {done(r)
                      ? kind === "llegadas"
                        ? "✅ Ingresó"
                        : "✅ Salió"
                      : kind === "llegadas"
                        ? `Esperando · hab. ${st ? ROOM_STATE_LABEL[st].toLowerCase() : ""}`
                        : "Pendiente de salida"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {!list.length && <li className="px-4 py-6 text-center text-gray-500">Sin {kind} hoy</li>}
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
      title="Estado de habitaciones"
      actions={
        <Link href="/mantenimiento" className="text-xs font-medium text-blue-600 hover:underline">
          Ver tablero
        </Link>
      }
    >
      <div className="px-4 pt-3">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-100">
          {(Object.keys(ROOM_STATE_LABEL) as RoomState[]).map((s) => (
            <div key={s} className={ROOM_STATE_DOT[s]} style={{ width: `${((counts[s] ?? 0) / total) * 100}%` }} title={ROOM_STATE_LABEL[s]} />
          ))}
        </div>
      </div>
      <ul className="space-y-1.5 px-4 py-3 text-sm">
        {(Object.keys(ROOM_STATE_LABEL) as RoomState[]).map((s) => (
          <li key={s} className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className={cls("h-2.5 w-2.5 rounded-full", ROOM_STATE_DOT[s])} /> {ROOM_STATE_LABEL[s]}
            </span>
            <b className="tabular-nums">{counts[s] ?? 0}</b>
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
          ev.push({ at: l.at, by: l.by, text: `${l.action.toLowerCase()} · ${task.title} · Hab. ${idx.roomById.get(task.roomId)?.number ?? ""}` });
    for (const a of data.activity)
      if (a.by !== "sistema" && !a.entity.startsWith("tasks/")) ev.push({ at: a.at, by: a.by, text: `${a.action.toLowerCase()}${a.detail ? " · " + a.detail : ""}` });
    return ev.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  }, [data.tasks, data.activity, idx.roomById, limit]);
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" /> Actividad en vivo
        </span>
      }
    >
      <ul className="max-h-64 divide-y divide-gray-100 overflow-y-auto">
        {events.map((e, i) => (
          <li key={i} className="flex gap-2.5 px-4 py-2 text-sm">
            <Avatar name={staffName(e.by)} size={26} />
            <div className="min-w-0">
              <div className="leading-snug">
                <b className="font-medium">{staffName(e.by)}</b> <span className="text-gray-600">{e.text}</span>
              </div>
              <div className="text-xs text-gray-400">{fmtTimeAgo(e.at)}</div>
            </div>
          </li>
        ))}
        {!events.length && <li className="px-4 py-6 text-center text-sm text-gray-500">Todavía no hay actividad</li>}
      </ul>
    </Card>
  );
}
