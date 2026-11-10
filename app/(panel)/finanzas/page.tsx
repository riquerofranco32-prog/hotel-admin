"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BedDouble, BarChart3, CheckCircle2, Download, HandCoins, Percent, TrendingUp, Users, Wallet } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Button, Card, PageHeader, Select, Stat, Table } from "@/components/ui";
import { addDays, daysInMonth, fmtDate, MONTHS, parseISO, toISO, today } from "@/lib/dates";
import { CHARGE_LABEL, folio, isActive, money } from "@/lib/logic";
import type { ChargeCategory } from "@/lib/types";

/** Barras verticales de una sola serie con tooltip al pasar el mouse. */
function Bars({ data, format, height = 180, highlight }: { data: { label: string; value: number; tip?: string }[]; format: (n: number) => string; height?: number; highlight?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0] ?? { label: "", value: 0 });
  const wide = data.length > 16;
  return (
    <div className="overflow-x-auto px-4 pb-4 pt-8">
      <div className={wide ? "min-w-[560px]" : ""}>
        <div className="relative flex items-end gap-[3px]" style={{ height }}>
          {/* grilla recesiva */}
          {[0.5, 1].map((g) => (
            <div key={g} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-gray-200" style={{ bottom: height * g }}>
              <span className="absolute -top-6 left-0 text-[13.5px] font-medium tabular-nums text-gray-600">{format(max * g)}</span>
            </div>
          ))}
          {data.map((d) => (
            <div key={d.label} tabIndex={0} className="group relative flex h-full flex-1 items-end justify-center rounded-t-md outline-none focus-visible:ring-2 focus-visible:ring-accent/50">
              <div
                className={`w-full max-w-[40px] rounded-t-[6px] transition-colors duration-150 motion-reduce:transition-none ${d.label === highlight ? "bg-accent" : "bg-accent/60 group-hover:bg-accent/85 group-focus:bg-accent/85"}`}
                style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 3 : 0 }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[14px] text-white shadow-pop group-hover:block group-focus:block">
                {d.tip ?? d.label}: <b>{format(d.value)}</b>
              </div>
              {d === peak && d.value > 0 && <span className="absolute text-[13.5px] font-semibold tabular-nums text-gray-800" style={{ bottom: `calc(${(d.value / max) * 100}% + 3px)` }}>{format(d.value)}</span>}
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-[3px] border-t border-gray-300 pt-1.5">
          {data.map((d, i) => (
            <div key={d.label} className="flex-1 text-center text-[13.5px] font-medium tabular-nums text-gray-700">
              {wide ? (i % 3 === 0 ? d.label : "") : d.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Barras horizontales (ranking) de una sola serie. */
function HBars({ rows, format }: { rows: { label: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <ul className="space-y-4 p-4">
      {rows.map((r) => (
        <li key={r.label} className="group">
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-[15px]">
            <span className="font-medium text-gray-800">{r.label}</span>
            <span className="tabular-nums text-gray-900">
              <b>{format(r.value)}</b> <span className="text-[13.5px] text-gray-600">{Math.round((r.value / total) * 100)}%</span>
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-accent/85 transition-all duration-200 group-hover:bg-accent motion-reduce:transition-none" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
      {!rows.length && (
        <li className="flex flex-col items-center gap-2 py-6 text-center text-[15px] text-gray-600">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-500"><BarChart3 size={20} aria-hidden /></span>
          Todavía no hay datos en este mes.
        </li>
      )}
    </ul>
  );
}

export default function FinanzasPage() {
  const { data, idx } = useApp();
  const t = today();
  const now = parseISO(t);
  const [ym, setYm] = useState(`${now.getFullYear()}-${now.getMonth()}`);
  const [year, month] = ym.split("-").map(Number);
  const days = daysInMonth(year, month);
  const mStart = toISO(new Date(year, month, 1));
  const mEnd = addDays(mStart, days);
  const cur = data.settings[0]?.currency ?? "$";
  const fm = (n: number) => money(n, cur);
  const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n)));

  const m = useMemo(() => {
    const rooms = data.rooms.length || 1;
    const occ = new Array(days).fill(0);
    let lodging = 0,
      roomNights = 0;
    const bySource = new Map<string, number>();
    for (const r of data.reservations) {
      if (!isActive(r) || r.checkIn >= mEnd || r.checkOut <= mStart) continue;
      for (let d = r.checkIn < mStart ? mStart : r.checkIn; d < r.checkOut && d < mEnd; d = addDays(d, 1)) {
        const i = Math.round((parseISO(d).getTime() - parseISO(mStart).getTime()) / 86400000);
        occ[i]++;
        lodging += r.rate;
        roomNights++;
        bySource.set(r.source, (bySource.get(r.source) ?? 0) + r.rate);
      }
    }
    const byCat = new Map<ChargeCategory, number>();
    let extras = 0;
    for (const c of data.charges)
      if (c.date >= mStart && c.date < mEnd) {
        byCat.set(c.category, (byCat.get(c.category) ?? 0) + c.amount);
        extras += c.amount;
      }
    const byMethod = new Map<string, number>();
    let cobrado = 0;
    for (const p of data.payments)
      if (p.date >= mStart && p.date < mEnd) {
        byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount);
        cobrado += p.amount;
      }
    const available = rooms * days;
    const occPct = (roomNights / available) * 100;
    const adr = roomNights ? lodging / roomNights : 0;
    const revpar = lodging / available;
    return {
      occ: occ.map((n, i) => ({ label: String(i + 1), value: Math.round((n / rooms) * 100), tip: `${i + 1}/${month + 1} · ${n} habitaciones ocupadas` })),
      lodging,
      extras,
      cobrado,
      occPct,
      adr,
      revpar,
      bySource: [...bySource.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
      byCat: [{ label: "Alojamiento", value: lodging }, ...[...byCat.entries()].map(([k, value]) => ({ label: CHARGE_LABEL[k], value }))].sort((a, b) => b.value - a.value),
      byMethod: [...byMethod.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    };
  }, [data.reservations, data.charges, data.payments, data.rooms.length, mStart, mEnd, days, month]);

  // Cobranzas de los últimos 6 meses
  const last6 = useMemo(() => {
    const out: { label: string; value: number; tip: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - i, 1);
      const key = toISO(d).slice(0, 7);
      const v = data.payments.reduce((s, p) => (p.date.slice(0, 7) === key ? s + p.amount : s), 0);
      out.push({ label: MONTHS[d.getMonth()].slice(0, 3), value: v, tip: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
    }
    return out;
  }, [data.payments, year, month]);

  const receivables = useMemo(
    () =>
      data.reservations
        .filter((r) => r.status === "checkout" || r.status === "checkin")
        .map((r) => ({ r, f: folio(r, idx) }))
        .filter((x) => x.f.balance > 1)
        .sort((a, b) => b.f.balance - a.f.balance),
    [data.reservations, idx],
  );
  const receivableTotal = receivables.reduce((s, x) => s + x.f.balance, 0);

  const topGuests = useMemo(() => {
    const m2 = new Map<string, { name: string; value: number; stays: number }>();
    for (const r of data.reservations) {
      if (r.status !== "checkout" && r.status !== "checkin") continue;
      const cur2 = m2.get(r.guestId) ?? { name: r.guestName, value: 0, stays: 0 };
      cur2.value += folio(r, idx).total;
      cur2.stays++;
      m2.set(r.guestId, cur2);
    }
    return [...m2.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 8);
  }, [data.reservations, idx]);

  const months = Array.from({ length: 13 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 9 + i, 1));

  function exportCSV() {
    const rows = [
      ["Concepto", "Valor"],
      ["Mes", `${MONTHS[month]} ${year}`],
      ["Ventas de hospedaje", String(Math.round(m.lodging))],
      ["Gastos extra (consumos)", String(Math.round(m.extras))],
      ["Se cobró", String(Math.round(m.cobrado))],
      ["Habitaciones ocupadas (%)", m.occPct.toFixed(1)],
      ["Precio promedio por noche", String(Math.round(m.adr))],
      ["Ingreso por habitación disponible", String(Math.round(m.revpar))],
      ...m.bySource.map((x) => [`Por dónde llegó: ${x.label}`, String(Math.round(x.value))]),
      ...m.byMethod.map((x) => [`Cobrado con ${x.label}`, String(Math.round(x.value))]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `finanzas-${year}-${String(month + 1).padStart(2, "0")}.csv`;
    a.click();
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
      <PageHeader
        title="Plata y resultados del hotel"
        subtitle="Acá ves cuánto se vendió y cuánto se cobró en el mes, cuántas habitaciones estuvieron ocupadas y quién todavía debe plata. Elegí el mes en la lista de arriba."
        actions={
          <>
            <Select value={ym} onChange={(e) => setYm(e.target.value)} className="w-full text-[15px] sm:w-[190px]">
              {months.map((d) => (
                <option key={d.toISOString()} value={`${d.getFullYear()}-${d.getMonth()}`}>
                  {MONTHS[d.getMonth()]} {d.getFullYear()}
                </option>
              ))}
            </Select>
            <Button className="h-11 sm:h-10" onClick={exportCSV}>
              <Download size={15} /> Bajar planilla (Excel)
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat icon={TrendingUp} tone="blue" label="Vendido en el mes" value={fm(m.lodging + m.extras)} sub={`${fm(m.extras)} son gastos extra (consumos)`} />
        <Stat icon={Wallet} tone="green" label="Se cobró en el mes" value={fm(m.cobrado)} sub="plata que ya entró" />
        <Stat icon={Percent} tone="indigo" label="Habitaciones ocupadas" value={`${m.occPct.toFixed(1)}%`} sub="promedio del mes sobre todas las habitaciones" />
        <Stat icon={BedDouble} tone="purple" label="Precio promedio por noche" value={fm(m.adr)} sub="lo que se cobra en promedio por habitación y noche" />
        <Stat icon={BedDouble} tone="gray" label="Ingreso por habitación disponible" value={fm(m.revpar)} sub="lo vendido, repartido entre todas las habitaciones y días del mes" />
        <Stat icon={HandCoins} tone="red" label="Falta cobrar" value={fm(receivableTotal)} sub={`${receivables.length} cuentas con deuda`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Card title={`Habitaciones ocupadas cada día · ${MONTHS[month]} ${year}`}>
          <Bars data={m.occ} format={(n) => `${Math.round(n)}%`} highlight={t.slice(0, 7) === mStart.slice(0, 7) ? String(now.getDate()) : undefined} />
        </Card>
        <Card title="Lo que se cobró en los últimos 6 meses">
          <Bars data={last6} format={short} highlight={MONTHS[month].slice(0, 3)} />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Ventas de hospedaje, según por dónde llegó la reserva">
          <HBars rows={m.bySource} format={fm} />
        </Card>
        <Card title="Ventas, según el tipo">
          <HBars rows={m.byCat} format={fm} />
        </Card>
        <Card title="Lo que se cobró, según cómo pagaron">
          <HBars rows={m.byMethod} format={fm} />
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title={`Plata que falta cobrar (${receivables.length})`}>
          <Table head={["Huésped", "Habitación", "Salida", "Debe"]}>
            {receivables.slice(0, 15).map(({ r, f }) => (
              <tr key={r.id} className="transition-colors duration-150 hover:bg-gray-50 motion-reduce:transition-none">
                <td className="px-4 py-3 text-[15px]">
                  <Link href={`/facturacion?r=${r.id}`} className="font-medium hover:underline">
                    {r.guestName}
                  </Link>
                  {r.status === "checkin" && <span className="ml-1 text-[13.5px] text-green-700">está en el hotel</span>}
                </td>
                <td className="px-4 py-3 text-[15px]">{idx.roomById.get(r.roomId)?.number}</td>
                <td className="whitespace-nowrap px-4 py-3 text-[15px]">{fmtDate(r.checkOut)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-[16px] font-semibold tabular-nums text-red-700">{fm(f.balance)}</td>
              </tr>
            ))}
          </Table>
          {receivables.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-8 text-center text-[15px] text-gray-600">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-green-50 text-green-700"><CheckCircle2 size={20} aria-hidden /></span>
              Nadie debe plata por ahora.
            </div>
          )}
        </Card>
        <Card title="Huéspedes que más gastaron (en total)">
          <Table head={["Huésped", "Veces que se alojó", "Total gastado"]}>
            {topGuests.map(([id, g]) => (
              <tr key={id} className="transition-colors duration-150 hover:bg-gray-50 motion-reduce:transition-none">
                <td className="px-4 py-3 text-[15px]">
                  <Link href={`/huespedes?g=${id}`} className="font-medium hover:underline">
                    {g.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[15px] tabular-nums">{g.stays}</td>
                <td className="whitespace-nowrap px-4 py-3 text-[15px] font-semibold tabular-nums">{fm(g.value)}</td>
              </tr>
            ))}
          </Table>
          {topGuests.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-8 text-center text-[15px] text-gray-600">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-500"><Users size={20} aria-hidden /></span>
              Todavía no hay huéspedes con estadías.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
