"use client";
import { Suspense, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarCheck, Clock, Moon, Plus, Wallet } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { ReservationDrawer, ReservationForm } from "@/components/reservation";
import { Avatar, Badge, Button, Card, Input, PageHeader, Select, Stat, Table } from "@/components/ui";
import { addDays, fmtDate, today } from "@/lib/dates";
import { cls, folio, money, nights, RES_STATUS_BADGE, RES_STATUS_LABEL } from "@/lib/logic";
import type { Reservation, ReservationStatus } from "@/lib/types";

const SOURCES = ["Directo", "Booking", "Expedia", "Airbnb", "Teléfono", "WhatsApp", "Walk-in"];

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
  const [status, setStatus] = useState<ReservationStatus | "activas" | "">("activas");
  const [from, setFrom] = useState(addDays(today(), -7));
  const [to, setTo] = useState(addDays(today(), 60));
  const [source, setSource] = useState("");
  const [openRes, setOpenRes] = useState<string | null>(params.get("r"));
  const [form, setForm] = useState<{ open: boolean; initial?: Partial<Reservation> }>({ open: false });
  const [page, setPage] = useState(0);
  const showMoney = can("ver_montos");
  const canEdit = can("editar_reservas");
  const PAGE = 50;

  useEffect(() => {
    if (params.get("r")) setOpenRes(params.get("r"));
  }, [params]);
  useEffect(() => setPage(0), [q, status, from, to, source]);

  const room = (id: string) => idx.roomById.get(id)?.number ?? "?";

  const list = useMemo(
    () =>
      data.reservations
        .filter((r) => (status === "activas" ? r.status !== "cancelada" && r.status !== "no_show" : !status || r.status === status))
        .filter((r) => (!from || r.checkOut >= from) && (!to || r.checkIn <= to))
        .filter((r) => !source || r.source === source)
        .filter((r) => !q || r.guestName.toLowerCase().includes(q) || room(r.roomId).includes(q) || r.id.includes(q))
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn) || room(a.roomId).localeCompare(room(b.roomId), undefined, { numeric: true })),
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
      if (r.status !== "confirmada" && r.status !== "pendiente") balance += Math.max(0, f.balance);
      n += nights(r);
      if (r.status === "pendiente") pend++;
    }
    return { total, balance, nights: n, pend };
  }, [list, idx]);

  const chips: { v: typeof status; label: string }[] = [
    { v: "activas", label: "Activas" },
    { v: "pendiente", label: "Pendientes" },
    { v: "confirmada", label: "Confirmadas" },
    { v: "checkin", label: "En casa" },
    { v: "checkout", label: "Salieron" },
    { v: "cancelada", label: "Canceladas" },
    { v: "", label: "Todas" },
  ];

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <PageHeader
        title="Reservas"
        subtitle="Todas las reservas con filtros por fecha, estado y canal"
        actions={
          canEdit && (
            <Button variant="primary" onClick={() => setForm({ open: true, initial: {} })}>
              <Plus size={15} /> Nueva reserva
            </Button>
          )
        }
      />
      <div className={cls("grid grid-cols-2 gap-3", showMoney ? "lg:grid-cols-4" : "lg:grid-cols-2")}>
        <Stat icon={CalendarCheck} tone="blue" label="Reservas en el filtro" value={list.length} />
        <Stat icon={Moon} tone="indigo" label="Noches" value={totals.nights} />
        {showMoney && <Stat icon={Wallet} tone="green" label="Producción" value={money(totals.total)} />}
        {showMoney ? (
          <Stat icon={Clock} tone="red" label="Saldo por cobrar (en casa / salidos)" value={money(totals.balance)} />
        ) : (
          <Stat icon={Clock} tone="orange" label="Pendientes de confirmar" value={totals.pend} />
        )}
      </div>

      <Card>
        <div className="space-y-2 border-b border-gray-100 p-3">
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Huésped, habitación o N°" value={query} onChange={(e) => setQuery(e.target.value)} className="w-[220px]" />
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" title="Desde" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" title="Hasta" />
            <Select value={source} onChange={(e) => setSource(e.target.value)} className="w-[150px]">
              <option value="">Todos los canales</option>
              {SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <button
                key={c.label}
                onClick={() => setStatus(c.v)}
                className={cls("rounded-full px-3 py-1 text-xs font-medium", status === c.v ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200")}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <Table head={["Huésped", "Hab.", "Entrada", "Salida", "Noches", "Pax", "Canal", "Estado", ...(showMoney ? ["Total", "Saldo"] : [])]}>
          {list.slice(page * PAGE, (page + 1) * PAGE).map((r) => {
            const f = showMoney ? folio(r, idx) : null;
            return (
              <tr key={r.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setOpenRes(r.id)}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Avatar name={r.guestName} size={26} />
                    <span className="font-medium">{r.guestName}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 font-medium">{room(r.roomId)}</td>
                <td className="px-4 py-2.5 tabular-nums">{fmtDate(r.checkIn)}</td>
                <td className="px-4 py-2.5 tabular-nums">{fmtDate(r.checkOut)}</td>
                <td className="px-4 py-2.5 tabular-nums">{nights(r)}</td>
                <td className="px-4 py-2.5 tabular-nums">{r.pax}</td>
                <td className="px-4 py-2.5 text-gray-600">{r.source}</td>
                <td className="px-4 py-2.5">
                  <Badge className={RES_STATUS_BADGE[r.status]}>{RES_STATUS_LABEL[r.status]}</Badge>
                </td>
                {f && <td className="px-4 py-2.5 tabular-nums">{money(f.total)}</td>}
                {f && <td className={`px-4 py-2.5 tabular-nums ${f.balance > 0 ? "text-red-600" : "text-green-700"}`}>{money(f.balance)}</td>}
              </tr>
            );
          })}
        </Table>
        {list.length === 0 && <p className="p-8 text-center text-sm text-gray-500">No hay reservas con esos filtros.</p>}
        {list.length > PAGE && (
          <div className="flex items-center justify-end gap-2 border-t border-gray-100 p-3 text-sm">
            <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <span>
              {page + 1} / {Math.ceil(list.length / PAGE)}
            </span>
            <Button size="sm" disabled={(page + 1) * PAGE >= list.length} onClick={() => setPage(page + 1)}>
              Siguiente
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
      <ReservationForm open={form.open} initial={form.initial} onClose={() => setForm({ open: false })} />
    </div>
  );
}
