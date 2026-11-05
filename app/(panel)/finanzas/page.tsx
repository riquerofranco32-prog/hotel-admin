"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BedDouble, Download, HandCoins, Percent, TrendingUp, Wallet } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Button, Card, PageHeader, Select, Stat, Table } from "@/components/ui";
import { addDays, daysInMonth, fmtDate, MONTHS, parseISO, toISO, today } from "@/lib/dates";
import { CHARGE_LABEL, folio, isActive, money } from "@/lib/logic";
import type { ChargeCategory } from "@/lib/types";

/** Barras verticales de una sola serie con tooltip al pasar el mouse. */
function Bars({ data, format, height = 180, highlight }: { data: { label: string; value: number; tip?: string }[]; format: (n: number) => string; height?: number; highlight?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0] ?? { label: "", value: 0 });
  return (
    <div className="px-4 pb-3 pt-6">
      <div className="relative flex items-end gap-[2px]" style={{ height }}>
        {/* grilla recesiva */}
        {[0.5, 1].map((g) => (
          <div key={g} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-gray-200" style={{ bottom: height * g }}>
            <span className="absolute -top-4 right-0 text-[10px] text-gray-400">{format(max * g)}</span>
          </div>
        ))}
        {data.map((d) => (
          <div key={d.label} className="group relative flex h-full flex-1 items-end justify-center">
            <div
              className={`w-full max-w-[34px] rounded-t-[4px] transition-colors ${d.label === highlight ? "bg-blue-800" : "bg-blue-600 group-hover:bg-blue-700"}`}
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 2 : 0 }}
            />
            <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow group-hover:block">
              {d.tip ?? d.label}: <b>{format(d.value)}</b>
            </div>
            {d === peak && d.value > 0 && <span className="absolute text-[10px] font-medium text-gray-700" style={{ bottom: `calc(${(d.value / max) * 100}% + 2px)` }}>{format(d.value)}</span>}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] border-t border-gray-300 pt-1">
        {data.map((d, i) => (
          <div key={d.label} className="flex-1 text-center text-[10px] text-gray-500">
            {data.length > 16 ? (i % 3 === 0 ? d.label : "") : d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Barras horizontales (ranking) de una sola serie. */
function HBars({ rows, format }: { rows: { label: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <ul className="space-y-2.5 p-4">
      {rows.map((r) => (
        <li key={r.label} className="group">
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-gray-700">{r.label}</span>
            <span className="tabular-nums text-gray-900">
              <b>{format(r.value)}</b> <span className="text-xs text-gray-400">{Math.round((r.value / total) * 100)}%</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100">
            <div className="h-2 rounded-full bg-blue-600 transition-colors group-hover:bg-blue-700" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
      {!rows.length && <li className="py-4 text-center text-sm text-gray-500">Sin datos</li>}
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
      occ: occ.map((n, i) => ({ label: String(i + 1), value: Math.round((n / rooms) * 100), tip: `${i + 1}/${month + 1} · ${n} hab.` })),
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
      ["Producción alojamiento", String(Math.round(m.lodging))],
      ["Consumos / extras", String(Math.round(m.extras))],
      ["Cobrado", String(Math.round(m.cobrado))],
      ["Ocupación %", m.occPct.toFixed(1)],
      ["ADR", String(Math.round(m.adr))],
      ["RevPAR", String(Math.round(m.revpar))],
      ...m.bySource.map((x) => [`Canal ${x.label}`, String(Math.round(x.value))]),
      ...m.byMethod.map((x) => [`Cobro ${x.label}`, String(Math.round(x.value))]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `finanzas-${year}-${String(month + 1).padStart(2, "0")}.csv`;
    a.click();
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <PageHeader
        title="Finanzas y reportes"
        subtitle="Producción, cobranzas, ocupación e indicadores hoteleros"
        actions={
          <>
            <Select value={ym} onChange={(e) => setYm(e.target.value)} className="w-[170px]">
              {months.map((d) => (
                <option key={d.toISOString()} value={`${d.getFullYear()}-${d.getMonth()}`}>
                  {MONTHS[d.getMonth()]} {d.getFullYear()}
                </option>
              ))}
            </Select>
            <Button onClick={exportCSV}>
              <Download size={15} /> Exportar
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat icon={TrendingUp} tone="blue" label="Producción del mes" value={fm(m.lodging + m.extras)} sub={`${fm(m.extras)} en consumos`} />
        <Stat icon={Wallet} tone="green" label="Cobrado en el mes" value={fm(m.cobrado)} />
        <Stat icon={Percent} tone="indigo" label="Ocupación promedio" value={`${m.occPct.toFixed(1)}%`} />
        <Stat icon={BedDouble} tone="purple" label="ADR (tarifa media)" value={fm(m.adr)} />
        <Stat icon={BedDouble} tone="gray" label="RevPAR" value={fm(m.revpar)} sub="ingreso por hab. disponible" />
        <Stat icon={HandCoins} tone="red" label="Cuentas por cobrar" value={fm(receivableTotal)} sub={`${receivables.length} folios`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card title={`Ocupación diaria · ${MONTHS[month]} ${year}`}>
          <Bars data={m.occ} format={(n) => `${Math.round(n)}%`} highlight={t.slice(0, 7) === mStart.slice(0, 7) ? String(now.getDate()) : undefined} />
        </Card>
        <Card title="Cobranzas · últimos 6 meses">
          <Bars data={last6} format={short} highlight={MONTHS[month].slice(0, 3)} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Producción de alojamiento por canal">
          <HBars rows={m.bySource} format={fm} />
        </Card>
        <Card title="Producción por concepto">
          <HBars rows={m.byCat} format={fm} />
        </Card>
        <Card title="Cobros por medio de pago">
          <HBars rows={m.byMethod} format={fm} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={`Cuentas por cobrar (${receivables.length})`}>
          <Table head={["Huésped", "Hab.", "Salida", "Saldo"]}>
            {receivables.slice(0, 15).map(({ r, f }) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <Link href={`/facturacion?r=${r.id}`} className="font-medium hover:underline">
                    {r.guestName}
                  </Link>
                  {r.status === "checkin" && <span className="ml-1 text-xs text-green-600">en casa</span>}
                </td>
                <td className="px-4 py-2">{idx.roomById.get(r.roomId)?.number}</td>
                <td className="px-4 py-2">{fmtDate(r.checkOut)}</td>
                <td className="px-4 py-2 tabular-nums text-red-600">{fm(f.balance)}</td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Mejores clientes (valor histórico)">
          <Table head={["Huésped", "Estadías", "Valor"]}>
            {topGuests.map(([id, g]) => (
              <tr key={id} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <Link href={`/huespedes?g=${id}`} className="font-medium hover:underline">
                    {g.name}
                  </Link>
                </td>
                <td className="px-4 py-2 tabular-nums">{g.stays}</td>
                <td className="px-4 py-2 tabular-nums">{fm(g.value)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </div>
  );
}
