"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Bell, ChevronDown, ChevronLeft, ChevronRight, Download, Plus, Wrench } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { ReservationDrawer, ReservationForm } from "@/components/reservation";
import { Button, Card, Input, Select } from "@/components/ui";
import { alerts } from "@/lib/automation";
import { addDays, daysInMonth, diffDays, fmtShort, MONTHS, parseISO, toISO, today, WEEKDAYS_SHORT } from "@/lib/dates";
import {
  cls,
  isActive,
  roomState,
  ROOM_STATE_DOT,
  ROOM_STATE_LABEL,
  RES_STATUS_LABEL,
  VISUAL_CLASS,
  VISUAL_DOT,
  VISUAL_LABEL,
  visualStatus,
} from "@/lib/logic";
import type { Reservation, RoomState, VisualStatus } from "@/lib/types";

type StatusFilter = "todos" | VisualStatus | "mantenimiento";

export default function DashboardPage() {
  const { data, me } = useApp();
  const t = today();
  const now = parseISO(t);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [query, setQuery] = useState("");
  const [floor, setFloor] = useState<string>("todos");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [density, setDensity] = useState<"normal" | "compacto">("normal");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [openRes, setOpenRes] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; initial?: Partial<Reservation> }>({ open: false });
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const canEdit = me?.role === "admin" || me?.role === "recepcion";

  const days = daysInMonth(year, month);
  const monthStart = toISO(new Date(year, month, 1));
  const monthEnd = addDays(monthStart, days); // exclusivo
  const dayList = Array.from({ length: days }, (_, i) => addDays(monthStart, i));

  const floors = useMemo(() => Array.from(new Set(data.rooms.map((r) => r.floor))).sort((a, b) => a - b), [data.rooms]);
  const states = useMemo(() => {
    const m = new Map<string, RoomState>();
    data.rooms.forEach((room) => m.set(room.id, roomState(room, data, t)));
    return m;
  }, [data, t]);

  const monthRes = useMemo(
    () => data.reservations.filter((r) => isActive(r) && r.checkIn < monthEnd && r.checkOut > monthStart),
    [data.reservations, monthStart, monthEnd],
  );

  const q = query.trim().toLowerCase();
  const visibleRooms = data.rooms
    .filter((room) => floor === "todos" || String(room.floor) === floor)
    .filter((room) => {
      if (!q) return true;
      if (room.number.includes(q)) return true;
      return monthRes.some((r) => r.roomId === room.id && r.guestName.toLowerCase().includes(q));
    })
    .filter((room) => {
      if (status === "todos") return true;
      if (status === "mantenimiento") return states.get(room.id) === "mantenimiento" || states.get(room.id) === "sucia" || states.get(room.id) === "en_limpieza";
      return monthRes.some((r) => r.roomId === room.id && visualStatus(r, t) === status);
    })
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));

  // ===== Indicadores del día =====
  const stats = useMemo(() => {
    const active = data.reservations.filter(isActive);
    const ocupadas = active.filter((r) => r.status === "checkin").length;
    const reservadas = active.filter((r) => (r.status === "confirmada" || r.status === "pendiente") && r.checkIn <= t && r.checkOut > t).length;
    const mant = Array.from(states.values()).filter((s) => s === "mantenimiento" || s === "fuera_servicio").length;
    const libres = Math.max(0, data.rooms.length - ocupadas - reservadas - mant);
    const llegadas = active.filter((r) => r.checkIn === t && r.status !== "checkout").length;
    const salidas = active.filter((r) => r.checkOut === t && (r.status === "checkin" || r.status === "checkout")).length;
    const base = data.rooms.length - mant;
    return { ocupadas, reservadas, mant, libres, llegadas, salidas, ocupacion: base ? Math.round(((ocupadas + reservadas) / base) * 100) : 0 };
  }, [data.reservations, data.rooms.length, states, t]);

  const alertList = useMemo(() => alerts(data, t), [data, t]);

  function shiftMonth(n: number) {
    const d = new Date(year, month + n, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function exportCSV() {
    const rows = [["Reserva", "Habitación", "Huésped", "Entrada", "Salida", "Pax", "Estado", "Canal", "Tarifa"]];
    monthRes.forEach((r) =>
      rows.push([r.id, data.rooms.find((x) => x.id === r.roomId)?.number ?? "", r.guestName, r.checkIn, r.checkOut, String(r.pax), RES_STATUS_LABEL[r.status], r.source, String(r.rate)]),
    );
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reservas-${year}-${String(month + 1).padStart(2, "0")}.csv`;
    a.click();
  }

  const rowH = density === "normal" ? 43 : 30;
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      {/* ===== Barra de herramientas ===== */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-2.5">
        <Button size="md" onClick={() => shiftMonth(-1)} aria-label="Mes anterior">
          <ChevronLeft size={16} />
        </Button>
        <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-[130px]">
          {MONTHS.map((m, i) => (
            <option key={m} value={i}>
              {m}
            </option>
          ))}
        </Select>
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-[90px]">
          {[year - 2, year - 1, year, year + 1, year + 2].map((y) => (
            <option key={y}>{y}</option>
          ))}
        </Select>
        <Button onClick={() => shiftMonth(1)} aria-label="Mes siguiente">
          <ChevronRight size={16} />
        </Button>
        <Button
          onClick={() => {
            setYear(now.getFullYear());
            setMonth(now.getMonth());
          }}
        >
          Hoy
        </Button>
        <Input placeholder="Hab. o huésped" value={query} onChange={(e) => setQuery(e.target.value)} className="w-[170px]" />
        <Select value={floor} onChange={(e) => setFloor(e.target.value)} className="w-[150px]">
          <option value="todos">Todos los pisos</option>
          {floors.map((f) => (
            <option key={f} value={f}>
              Piso {f}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="w-[170px]">
          <option value="todos">Todos los estados</option>
          <option value="ocupada">Ocupada</option>
          <option value="reservada">Reservada</option>
          <option value="proxima">Próxima a salir</option>
          <option value="otros">Otros estados</option>
          <option value="mantenimiento">Limpieza / mantenimiento</option>
        </Select>
        <Select value={density} onChange={(e) => setDensity(e.target.value as "normal" | "compacto")} className="w-[115px]">
          <option value="normal">Normal</option>
          <option value="compacto">Compacto</option>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Button onClick={() => setBellOpen(!bellOpen)} aria-label="Alertas">
              <Bell size={16} className={alertList.length ? "fill-amber-400 text-amber-500" : ""} /> {alertList.length}
            </Button>
            {bellOpen && (
              <div className="absolute right-0 top-11 z-30 w-[360px] rounded-lg border border-gray-200 bg-white shadow-xl">
                <div className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold">Alertas</div>
                <ul className="max-h-[360px] divide-y divide-gray-100 overflow-y-auto">
                  {alertList.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-500">Todo en orden 👌</li>}
                  {alertList.map((a, i) => (
                    <li key={i}>
                      <Link href={a.href} className="flex gap-2 px-4 py-2.5 text-sm hover:bg-gray-50">
                        <span className={cls("mt-1.5 h-2 w-2 shrink-0 rounded-full", a.level === "alta" ? "bg-red-500" : "bg-amber-400")} />
                        {a.text}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
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

      {/* ===== Leyenda + indicadores ===== */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-gray-200 bg-white px-4 py-2 text-[13px]">
        {(Object.keys(VISUAL_LABEL) as VisualStatus[]).map((v) => (
          <span key={v} className="flex items-center gap-1.5 text-gray-700">
            <span className={cls("h-3 w-3 rounded-sm", VISUAL_DOT[v])} /> {VISUAL_LABEL[v]}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-gray-700">
          <span className="hatch h-3 w-3 rounded-sm border border-purple-300" /> Mantenimiento
        </span>
        <span className="ml-auto text-gray-500">
          Libres hoy <b className="text-gray-800">{stats.libres}</b> · Reservadas <b className="text-gray-800">{stats.reservadas}</b> · Ocupadas{" "}
          <b className="text-gray-800">{stats.ocupadas}</b> · En mantenimiento <b className="text-gray-800">{stats.mant}</b> · Ocupación{" "}
          <b className="text-gray-800">{stats.ocupacion}%</b> · Llegadas hoy <b className="text-gray-800">{stats.llegadas}</b> · Salidas hoy{" "}
          <b className="text-gray-800">{stats.salidas}</b>
        </span>
      </div>

      {/* ===== Calendario ===== */}
      <div ref={scrollRef} className="max-h-[calc(100vh-112px)] overflow-auto bg-white" onMouseLeave={() => setTip(null)}>
        <div style={{ minWidth: 72 + days * 40 }}>
          {/* Cabecera de días */}
          <div className="sticky top-0 z-20 flex border-b border-gray-200 bg-white">
            <div className="sticky left-0 z-10 flex w-[72px] shrink-0 items-center bg-white px-3 text-[15px] font-semibold">Hab.</div>
            <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${days}, minmax(38px, 1fr))` }}>
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
                    <span className="text-[15px] font-semibold tabular-nums">{dt.getDate()}</span>
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
                      n.has(f) ? n.delete(f) : n.add(f);
                      return n;
                    })
                  }
                  className="sticky left-0 flex items-center gap-1.5 px-3 py-2 text-[15px] font-medium text-gray-800"
                >
                  <ChevronDown size={14} className={cls("transition", collapsed.has(f) && "-rotate-90")} /> Piso {f}
                </button>
                {!collapsed.has(f) &&
                  visibleRooms
                    .filter((r) => r.floor === f)
                    .map((room) => {
                      const st = states.get(room.id) ?? "lista";
                      const blocking = data.tasks.find((x) => x.roomId === room.id && x.blocksRoom && x.status !== "completada");
                      const resList = monthRes.filter((r) => r.roomId === room.id);
                      let hatchStart = -1,
                        hatchEnd = -1;
                      if (blocking || room.outOfService) {
                        const from = t < monthStart ? monthStart : t;
                        const to = blocking ? (blocking.dueDate > t ? addDays(blocking.dueDate, 1) : addDays(t, 1)) : monthEnd;
                        hatchStart = Math.max(0, diffDays(monthStart, from));
                        hatchEnd = Math.min(days, diffDays(monthStart, to));
                      }
                      return (
                        <div key={room.id} className="flex border-b border-gray-100" style={{ height: rowH }}>
                          <Link
                            href={`/mantenimiento?hab=${room.id}`}
                            title={`${room.type} · ${ROOM_STATE_LABEL[st]}`}
                            className="sticky left-0 z-10 flex w-[72px] shrink-0 items-center gap-1.5 bg-white px-3 text-[15px] font-medium hover:bg-gray-50"
                          >
                            {room.number}
                            <span className={cls("h-2 w-2 rounded-full", ROOM_STATE_DOT[st])} />
                            {blocking && <Wrench size={11} className="text-purple-600" />}
                          </Link>
                          <div className="relative flex-1">
                            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${days}, minmax(38px, 1fr))` }}>
                              {dayList.map((d, i) => {
                                const wd = parseISO(d).getDay();
                                return (
                                  <div
                                    key={d}
                                    onClick={() => canEdit && setForm({ open: true, initial: { roomId: room.id, checkIn: d, checkOut: addDays(d, 2), rate: room.rate } })}
                                    className={cls(
                                      "border-l border-gray-100",
                                      canEdit && "cursor-pointer hover:bg-blue-50",
                                      d === t ? "bg-gray-100" : wd === 0 || wd === 6 ? "bg-gray-50/60" : "",
                                      i >= hatchStart && i < hatchEnd && "hatch",
                                    )}
                                  />
                                );
                              })}
                            </div>
                            {resList.map((r) => {
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
                              const tipText = `${r.guestName} · Hab. ${room.number} · ${r.checkIn.split("-").reverse().join("/")} a ${r.checkOut
                                .split("-")
                                .reverse()
                                .join("/")} · ${r.pax} huésp. · ${RES_STATUS_LABEL[r.status]}`;
                              return (
                                <button
                                  key={r.id}
                                  onClick={() => setOpenRes(r.id)}
                                  onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, text: tipText })}
                                  onMouseLeave={() => setTip(null)}
                                  className={cls(
                                    "absolute top-[3px] bottom-[3px] truncate px-2 text-left text-[13px] font-medium transition hover:brightness-110",
                                    VISUAL_CLASS[vs],
                                    density === "compacto" && "text-[12px]",
                                    q && r.guestName.toLowerCase().includes(q) && "ring-2 ring-amber-400",
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
                    })}
              </div>
            ))}
          {visibleRooms.length === 0 && <div className="p-10 text-center text-sm text-gray-500">No hay habitaciones que coincidan con los filtros.</div>}
        </div>
      </div>

      {tip && (
        <div
          className="pointer-events-none fixed z-50 whitespace-nowrap bg-gray-900 px-2 py-1 text-[13px] text-white shadow"
          style={{ left: tip.x + 12, top: tip.y + 14 }}
        >
          {tip.text}
        </div>
      )}

      {/* ===== Resumen del día ===== */}
      <DaySummary onOpen={setOpenRes} />

      <ReservationDrawer id={openRes} onClose={() => setOpenRes(null)} onEdit={(r) => { setOpenRes(null); setForm({ open: true, initial: r }); }} />
      <ReservationForm open={form.open} initial={form.initial} onClose={() => setForm({ open: false })} />
    </div>
  );
}

function DaySummary({ onOpen }: { onOpen: (id: string) => void }) {
  const { data, staffName } = useApp();
  const t = today();
  const room = (id: string) => data.rooms.find((r) => r.id === id)?.number ?? "?";
  const arrivals = data.reservations.filter((r) => isActive(r) && r.checkIn === t);
  const departures = data.reservations.filter((r) => r.checkOut === t && (r.status === "checkin" || r.status === "checkout"));
  const open = data.tasks.filter((x) => x.status !== "completada");
  const doneToday = data.tasks.filter((x) => x.completedAt?.slice(0, 10) === t);
  const counts = data.rooms.reduce<Record<string, number>>((acc, r) => {
    const s = roomState(r, data, t);
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid gap-3 border-t border-gray-200 bg-gray-50 p-4 md:grid-cols-2 xl:grid-cols-4">
      <Card title={`Llegadas hoy (${arrivals.length})`}>
        <ul className="max-h-48 divide-y divide-gray-100 overflow-y-auto text-sm">
          {arrivals.map((r) => (
            <li key={r.id}>
              <button onClick={() => onOpen(r.id)} className="flex w-full justify-between px-4 py-2 text-left hover:bg-gray-50">
                <span>{r.guestName}</span>
                <span className="text-gray-500">
                  Hab. {room(r.roomId)} · {r.status === "checkin" ? "✅ ingresó" : "esperando"}
                </span>
              </button>
            </li>
          ))}
          {!arrivals.length && <li className="px-4 py-3 text-gray-500">Sin llegadas</li>}
        </ul>
      </Card>
      <Card title={`Salidas hoy (${departures.length})`}>
        <ul className="max-h-48 divide-y divide-gray-100 overflow-y-auto text-sm">
          {departures.map((r) => (
            <li key={r.id}>
              <button onClick={() => onOpen(r.id)} className="flex w-full justify-between px-4 py-2 text-left hover:bg-gray-50">
                <span>{r.guestName}</span>
                <span className="text-gray-500">
                  Hab. {room(r.roomId)} · {r.status === "checkout" ? "✅ salió" : "pendiente"}
                </span>
              </button>
            </li>
          ))}
          {!departures.length && <li className="px-4 py-3 text-gray-500">Sin salidas</li>}
        </ul>
      </Card>
      <Card title="Estado de habitaciones">
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
      <Card title={`Mantenimiento · ${open.length} abiertas`} actions={<Link href="/mantenimiento" className="text-xs font-medium text-blue-600 hover:underline">Ver todo</Link>}>
        <ul className="max-h-48 divide-y divide-gray-100 overflow-y-auto text-sm">
          {doneToday
            .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
            .slice(0, 8)
            .map((x) => (
              <li key={x.id} className="px-4 py-2">
                ✅ {x.title} · Hab. {room(x.roomId)}
                <div className="text-xs text-gray-500">por {staffName(x.completedBy)}</div>
              </li>
            ))}
          {!doneToday.length && <li className="px-4 py-3 text-gray-500">Aún no se completaron tareas hoy</li>}
        </ul>
      </Card>
    </div>
  );
}
