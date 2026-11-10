"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, FileText, Printer, Receipt, Trash2, Users } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Stat, Table, Tabs, toast } from "@/components/ui";
import { fmtDate, fmtDateTime, today } from "@/lib/dates";
import { cls, CHARGE_LABEL, folio, isActive, money, nights, RES_STATUS_BADGE, RES_STATUS_LABEL } from "@/lib/logic";
import type { ChargeCategory, Invoice, PaymentMethod } from "@/lib/types";

const METHODS: PaymentMethod[] = ["Efectivo", "Tarjeta de crédito", "Tarjeta de débito", "Transferencia", "Mercado Pago"];

function balanceText(balance: number, cur: string) {
  if (balance > 0) return `Debe ${money(balance, cur)}`;
  if (balance < 0) return `A favor ${money(-balance, cur)}`;
  return "Está al día";
}

export default function Page() {
  return (
    <Suspense>
      <Facturacion />
    </Suspense>
  );
}

function Facturacion() {
  const { data, idx, actions, staffName } = useApp();
  const params = useSearchParams();
  const [tab, setTab] = useState<"folios" | "facturas" | "resumen">("folios");
  const [filter, setFilter] = useState<"saldo" | "casa" | "todas">("saldo");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(params.get("r"));
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const t = today();
  const settings = data.settings[0];
  const cur = settings?.currency ?? "$";

  useEffect(() => {
    if (params.get("r")) {
      setSel(params.get("r"));
      setFilter("todas");
    }
  }, [params]);

  const room = (id: string) => data.rooms.find((r) => r.id === id)?.number ?? "?";
  const folios = useMemo(
    () =>
      data.reservations
        .filter((r) => isActive(r) && r.status !== "pendiente")
        .map((r) => ({ r, f: folio(r, idx) }))
        .filter(({ r, f }) => (filter === "saldo" ? f.balance > 0 && r.checkIn <= t : filter === "casa" ? r.status === "checkin" : true))
        .filter(({ r }) => !q || r.guestName.toLowerCase().includes(q.toLowerCase()) || room(r.roomId).includes(q))
        .sort((a, b) => b.r.checkIn.localeCompare(a.r.checkIn)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.reservations, idx, filter, q, t],
  );

  const monthKey = t.slice(0, 7);
  const payMonth = data.payments.filter((p) => p.date.slice(0, 7) === monthKey);
  const payToday = data.payments.filter((p) => p.date === t);
  const pendingTotal = data.reservations
    .filter((r) => r.status === "checkin" || r.status === "checkout")
    .reduce((s, r) => s + Math.max(0, folio(r, idx).balance), 0);

  return (
    <div className="mx-auto max-w-[1400px] p-4 lg:p-6">
      <PageHeader title="Cobros y facturas" subtitle="Acá ves cuánta plata debe cada huésped, anotás sus pagos y gastos, y hacés la factura." />
      <div className="mb-6 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <Stat label="Se cobró hoy" value={money(payToday.reduce((s, p) => s + p.amount, 0), cur)} tone="green" />
        <Stat label="Se cobró este mes" value={money(payMonth.reduce((s, p) => s + p.amount, 0), cur)} tone="blue" />
        <Stat label="Falta cobrar (huéspedes que están o ya se fueron)" value={money(pendingTotal, cur)} tone="red" />
        <Stat label="Facturas hechas" value={data.invoices.filter((i) => !i.voided).length} tone="gray" />
      </div>
      <div className="mb-5 max-w-full overflow-x-auto">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "folios", label: "Cuentas de huéspedes" },
            { value: "facturas", label: "Facturas hechas" },
            { value: "resumen", label: "Resumen del mes" },
          ]}
        />
      </div>

      {tab === "folios" && (
        <div className="grid items-start gap-5 lg:grid-cols-[380px_1fr]">
          <Card>
            <div className="space-y-3 border-b border-gray-100 p-3">
              <Input className="text-[15px]" placeholder="Buscar por nombre o número de habitación" value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="max-w-full overflow-x-auto">
              <Tabs
                value={filter}
                onChange={setFilter}
                items={[
                  { value: "saldo", label: "Deben plata" },
                  { value: "casa", label: "Están en el hotel" },
                  { value: "todas", label: "Todas" },
                ]}
              />
              </div>
            </div>
            <ul className="max-h-[calc(100vh-380px)] min-h-[200px] divide-y divide-gray-100 overflow-y-auto">
              {folios.slice(0, 200).map(({ r, f }) => (
                <li key={r.id}>
                  <button onClick={() => setSel(r.id)} className={cls("flex min-h-[64px] w-full items-center justify-between gap-3 border-l-4 px-4 py-3 text-left transition-colors duration-150 hover:bg-gray-50 motion-reduce:transition-none", sel === r.id ? "border-l-accent bg-accent/10" : "border-l-transparent")}>
                    <span className="min-w-0">
                      <span className="block truncate text-[16px] font-semibold text-gray-900">{r.guestName}</span>
                      <span className="block text-[14px] text-gray-600">
                        Habitación {room(r.roomId)} · {fmtDate(r.checkIn).slice(0, 5)} → {fmtDate(r.checkOut).slice(0, 5)}
                      </span>
                    </span>
                    <span className={cls("shrink-0 rounded-lg px-2.5 py-1 text-[15px] font-semibold tabular-nums", f.balance > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700")}>{balanceText(f.balance, cur)}</span>
                  </button>
                </li>
              ))}
              {folios.length === 0 && (
                <li className="flex flex-col items-center gap-2 px-4 py-10 text-center text-[15px] text-gray-600">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500"><Users size={22} aria-hidden /></span>
                  No hay cuentas para mostrar. Probá con otra pestaña o cambiá lo que buscaste.
                </li>
              )}
            </ul>
          </Card>
          {sel ? <Folio key={sel} id={sel} onInvoice={setInvoice} /> : <Card><div className="flex flex-col items-center gap-2 p-10 text-center text-[15px] text-gray-600"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500"><Receipt size={22} aria-hidden /></span>Tocá un huésped de la lista para ver su cuenta.</div></Card>}
        </div>
      )}

      {tab === "facturas" && (
        <Card>
          <Table head={["N°", "Fecha", "Huésped", "Habitación", "Total", "La hizo", ""]}>
            {data.invoices
              .slice()
              .sort((a, b) => b.number - a.number)
              .map((inv) => (
                <tr key={inv.id} className={cls("transition-colors duration-150 hover:bg-gray-50 motion-reduce:transition-none", inv.voided && "text-gray-600 line-through")}>
                  <td className="px-4 py-2.5 text-[15px] font-medium">{String(inv.number).padStart(6, "0")}</td>
                  <td className="px-4 py-2.5 text-[15px]">{fmtDateTime(inv.issuedAt)}</td>
                  <td className="px-4 py-2.5 text-[15px]">{inv.guestName}</td>
                  <td className="px-4 py-2.5 text-[15px]">{inv.roomNumber}</td>
                  <td className="px-4 py-2.5 text-[15px] font-semibold tabular-nums">{money(inv.total, cur)}</td>
                  <td className="px-4 py-2.5 text-[15px]">{staffName(inv.issuedBy)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right text-[15px]">
                    <Button variant="ghost" onClick={() => setInvoice(inv)}>Ver factura</Button>
                    {!inv.voided && (
                      <Button
                        variant="ghost"
                        className="text-red-700"
                        onClick={() =>
                          confirm(`¿Anular la factura N° ${String(inv.number).padStart(6, "0")} de ${inv.guestName} por ${money(inv.total, cur)}? No se puede deshacer.`) &&
                          actions.voidInvoice(inv)
                        }
                      >
                        Anular factura
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
          </Table>
          {data.invoices.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-[15px] text-gray-600">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500"><FileText size={22} aria-hidden /></span>
              Todavía no hiciste ninguna factura. Para hacer una, entrá a «Cuentas de huéspedes», elegí un huésped y tocá «Hacer factura».
            </div>
          )}
        </Card>
      )}

      {tab === "resumen" && <Resumen />}

      <InvoiceModal invoice={invoice} onClose={() => setInvoice(null)} />
    </div>
  );

  function Resumen() {
    const byMethod = METHODS.map((m) => ({ m, total: payMonth.filter((p) => p.method === m).reduce((s, p) => s + p.amount, 0) }));
    const monthRes = data.reservations.filter((r) => isActive(r) && r.checkIn.slice(0, 7) === monthKey);
    const lodging = monthRes.reduce((s, r) => s + nights(r) * r.rate, 0);
    const cats = (Object.keys(CHARGE_LABEL) as ChargeCategory[])
      .filter((c) => c !== "alojamiento")
      .map((c) => ({ c, total: data.charges.filter((x) => x.category === c && x.date.slice(0, 7) === monthKey).reduce((s, x) => s + x.amount, 0) }));
    const max = Math.max(1, ...byMethod.map((x) => x.total));
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Lo que se cobró este mes, según cómo pagaron">
          <ul className="space-y-4 p-4">
            {byMethod.map(({ m, total }) => (
              <li key={m}>
                <div className="flex justify-between text-[15px]">
                  <span>{m}</span>
                  <b className="tabular-nums">{money(total, cur)}</b>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-accent transition-all duration-200 motion-reduce:transition-none" style={{ width: `${(total / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Lo que se vendió este mes (reservas que entran este mes)">
          <ul className="divide-y divide-gray-100 text-[15px]">
            <li className="flex justify-between gap-3 px-4 py-3">
              <span>Hospedaje ({monthRes.length} reservas)</span>
              <b className="tabular-nums">{money(lodging, cur)}</b>
            </li>
            {cats.map(({ c, total }) => (
              <li key={c} className="flex justify-between gap-3 px-4 py-3">
                <span>{CHARGE_LABEL[c]}</span>
                <b className="tabular-nums">{money(total, cur)}</b>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    );
  }
}

function Folio({ id, onInvoice }: { id: string; onInvoice: (i: Invoice) => void }) {
  const { data, idx, actions, staffName, can } = useApp();
  const t = today();
  const cur = data.settings[0]?.currency ?? "$";
  const room = (rid: string) => data.rooms.find((x) => x.id === rid)?.number ?? "?";
  const r = data.reservations.find((x) => x.id === id);
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState<ChargeCategory>("minibar");
  const [amount, setAmount] = useState("");
  const [pay, setPay] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("Efectivo");
  const [ref, setRef] = useState("");
  if (!r) return <Card><p className="p-10 text-center text-[15px] text-gray-600">No encontramos esta reserva.</p></Card>;
  const f = folio(r, idx);
  const canPay = can("registrar_pagos");
  const invoices = data.invoices.filter((i) => i.reservationId === r.id && !i.voided);

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          {r.guestName} · Hab. {room(r.roomId)} <Badge className={RES_STATUS_BADGE[r.status]}>{RES_STATUS_LABEL[r.status]}</Badge>
        </span>
      }
      actions={
        canPay && <Button
          variant="primary"
          className="h-11 sm:h-10"
          onClick={async () => {
            if (invoices.length && !confirm("Esta reserva ya tiene una factura. ¿Querés hacer otra?")) return;
            const inv = await actions.issueInvoice(r);
            toast(`Listo ✔ Se hizo la factura N° ${inv.number}`);
            onInvoice(inv);
          }}
        >
          <Printer size={14} /> Hacer factura
        </Button>
      }
    >
      <div className="space-y-6 p-4">
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-[14px] font-medium text-gray-600">Total de la cuenta</div>
            <div className="mt-0.5 text-[24px] font-semibold tabular-nums tracking-tight text-gray-900">{money(f.total, cur)}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-[14px] font-medium text-gray-600">Pagó</div>
            <div className="mt-0.5 text-[24px] font-semibold tabular-nums tracking-tight text-gray-900">{money(f.paid, cur)}</div>
          </div>
          <div className={cls("rounded-xl border px-4 py-3", f.balance > 0 ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700")}>
            <div className="flex items-center gap-1.5 text-[14px] font-semibold">
              {f.balance <= 0 && <CheckCircle2 size={16} aria-hidden />}
              {f.balance > 0 ? "Debe" : f.balance < 0 ? "A favor del huésped" : "Está al día"}
            </div>
            <div className="mt-0.5 text-[28px] font-bold tabular-nums leading-tight tracking-tight">{money(Math.abs(f.balance), cur)}</div>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200">
        <Table head={["Fecha", "Qué es", "Tipo", "Monto", ""]}>
          <tr>
            <td className="px-4 py-2 text-[15px]">{fmtDate(r.checkIn)}</td>
            <td className="px-4 py-2 text-[15px]">
              Hospedaje · {nights(r)} noches × {money(r.rate, cur)}
            </td>
            <td className="px-4 py-2 text-[15px] text-gray-600">Hospedaje</td>
            <td className="px-4 py-2 text-[15px] tabular-nums">{money(f.lodging, cur)}</td>
            <td />
          </tr>
          {f.charges.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-2 text-[15px]">{fmtDate(c.date)}</td>
              <td className="px-4 py-2 text-[15px]">
                {c.description}
                <div className="text-[13.5px] text-gray-600">lo anotó {staffName(c.createdBy)}</div>
              </td>
              <td className="px-4 py-2 text-[15px] text-gray-600">{CHARGE_LABEL[c.category]}</td>
              <td className="px-4 py-2 text-[15px] tabular-nums">{money(c.amount, cur)}</td>
              <td className="px-2 text-right">
                <button
                  className="inline-flex min-h-[44px] items-center gap-1 whitespace-nowrap rounded-lg px-2.5 text-[14px] font-medium text-red-700 transition-colors duration-150 hover:bg-red-50 motion-reduce:transition-none sm:min-h-[40px]"
                  onClick={() => confirm(`¿Borrar "${c.description}" por ${money(c.amount, cur)} de la cuenta? No se puede deshacer.`) && actions.removeCharge(c)}
                >
                  <Trash2 size={14} /> Borrar
                </button>
              </td>
            </tr>
          ))}
        </Table>
        </div>
        {canPay && <form
          className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const a = Number(amount);
            if (!desc.trim() || !a) return toast("Escribí qué es y cuánto cuesta", "error");
            if (!confirm(`¿Agregar "${desc.trim()}" por ${money(a, cur)} a la cuenta?`)) return;
            actions.addCharge({ reservationId: r.id, description: desc.trim(), category: cat, amount: a, date: t });
            setDesc("");
            setAmount("");
          }}
        >
          <Field label="Anotar un gasto: ¿qué es?" className="min-w-[180px] flex-1"><Input className="text-[15px]" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ej: 2 botellas de agua del frigobar" /></Field>
          <Field label="Tipo">
            <Select className="text-[15px]" value={cat} onChange={(e) => setCat(e.target.value as ChargeCategory)}>
              {(Object.keys(CHARGE_LABEL) as ChargeCategory[]).map((c) => (
                <option key={c} value={c}>{CHARGE_LABEL[c]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Monto"><Input type="number" className="w-[130px] text-[15px]" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Button type="submit" className="">Agregar gasto</Button>
        </form>}

        <div>
          <h4 className="mb-2 text-[15px] font-semibold text-gray-800">Pagos que hizo el huésped</h4>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 text-[15px]">
            {f.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span>
                  {fmtDate(p.date)} · {p.method} {p.reference && <span className="text-gray-600">· {p.reference}</span>}
                  <span className="block text-[13.5px] text-gray-600">lo anotó {staffName(p.createdBy)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <b className="text-[17px] tabular-nums text-green-700">{money(p.amount, cur)}</b>
                  <button
                    className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2.5 text-[14px] font-medium text-red-700 transition-colors duration-150 hover:bg-red-50 motion-reduce:transition-none sm:min-h-[40px]"
                    onClick={() =>
                      confirm(`¿Anular este pago de ${money(p.amount, cur)} del ${fmtDate(p.date)}? La cuenta vuelve a deber ese monto. No se puede deshacer.`) &&
                      actions.removePayment(p)
                    }
                  >
                    <Trash2 size={14} /> Anular este pago
                  </button>
                </span>
              </li>
            ))}
            {f.payments.length === 0 && <li className="px-4 py-4 text-center text-gray-600">Todavía no pagó nada.</li>}
          </ul>
          {canPay && <form
            className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const a = Number(pay);
              if (!a) return toast("Escribí cuánto pagó", "error");
              if (!confirm(`¿Anotar un pago de ${money(a, cur)} (${method})?`)) return;
              actions.addPayment({ reservationId: r.id, amount: a, method, date: t, reference: ref || undefined });
              toast(`Listo ✔ Se anotó el pago de ${money(a, cur)}`);
              setPay("");
              setRef("");
            }}
          >
            <Field label="Anotar un pago: ¿cuánto pagó?"><Input type="number" className="w-[150px] text-[15px]" value={pay} onChange={(e) => setPay(e.target.value)} /></Field>
            <Field label="Cómo pagó">
              <Select className="text-[15px]" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {METHODS.map((m) => <option key={m}>{m}</option>)}
              </Select>
            </Field>
            <Field label="Nota (opcional)" className="min-w-[120px] flex-1"><Input className="text-[15px]" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Ej: número de comprobante" /></Field>
            {f.balance > 0 && (
              <Button type="button" variant="ghost" className="" onClick={() => setPay(String(Math.round(f.balance)))}>Poner lo que debe</Button>
            )}
            <Button type="submit" variant="success" className="">Anotar pago</Button>
          </form>}
        </div>

        {invoices.length > 0 && (
          <p className="text-[14px] text-gray-600">
            Facturas hechas: {invoices.map((i) => (
              <button key={i.id} className="mr-3 inline-flex min-h-[44px] items-center font-medium text-blue-600 hover:underline sm:min-h-0" onClick={() => onInvoice(i)}>Factura N° {i.number}</button>
            ))}
          </p>
        )}
      </div>
    </Card>
  );
}

function InvoiceModal({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const { data, staffName } = useApp();
  const settings = data.settings[0];
  const cur = settings?.currency ?? "$";
  if (!invoice) return null;
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={`Factura N° ${String(invoice.number).padStart(6, "0")}`}
      footer={
        <>
          <Button onClick={onClose}>Cerrar</Button>
          <Button variant="primary" onClick={() => window.print()}><Printer size={14} /> Imprimir o guardar en PDF</Button>
        </>
      }
    >
      <div className="print-area text-[15px]">
        <div className="flex justify-between border-b border-gray-200 pb-4">
          <div>
            <div className="text-lg font-bold uppercase tracking-widest">{settings?.hotelName}</div>
            <div className="text-gray-600">Comprobante de estadía</div>
          </div>
          <div className="text-right">
            <div className="font-semibold">N° {String(invoice.number).padStart(6, "0")}</div>
            <div>{fmtDateTime(invoice.issuedAt)}</div>
            {invoice.voided && <div className="font-bold text-red-600">ANULADA</div>}
          </div>
        </div>
        <div className="my-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          Huésped: <b>{invoice.guestName}</b> · Habitación {invoice.roomNumber}
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-[13.5px] uppercase text-gray-600">
              <th className="py-2">Qué es</th><th className="py-2 text-right">Cantidad</th><th className="py-2 text-right">Precio c/u</th><th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-1.5">{l.description}</td>
                <td className="py-1.5 text-right">{l.qty}</td>
                <td className="py-1.5 text-right tabular-nums">{money(l.unit, cur)}</td>
                <td className="py-1.5 text-right tabular-nums">{money(l.total, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto mt-4 max-w-[260px] space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{money(invoice.subtotal, cur)}</span></div>
          <div className="flex justify-between"><span>IVA ({settings?.taxRate ?? 21}%)</span><span className="tabular-nums">{money(invoice.tax, cur)}</span></div>
          <div className="flex justify-between border-t pt-1 text-base font-bold"><span>Total</span><span className="tabular-nums">{money(invoice.total, cur)}</span></div>
        </div>
        <p className="mt-6 text-[13.5px] text-gray-600">Hecha por {staffName(invoice.issuedBy)}. Este papel no vale como factura oficial (factura electrónica).</p>
      </div>
    </Modal>
  );
}
