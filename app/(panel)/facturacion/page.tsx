"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer, Trash2 } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Stat, Table, Tabs, toast } from "@/components/ui";
import { fmtDate, fmtDateTime, today } from "@/lib/dates";
import { CHARGE_LABEL, folio, isActive, money, nights, RES_STATUS_BADGE, RES_STATUS_LABEL } from "@/lib/logic";
import type { ChargeCategory, Invoice, PaymentMethod } from "@/lib/types";

const METHODS: PaymentMethod[] = ["Efectivo", "Tarjeta de crédito", "Tarjeta de débito", "Transferencia", "Mercado Pago"];

export default function Page() {
  return (
    <Suspense>
      <Facturacion />
    </Suspense>
  );
}

function Facturacion() {
  const { data, actions, staffName } = useApp();
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
        .map((r) => ({ r, f: folio(r, data) }))
        .filter(({ r, f }) => (filter === "saldo" ? f.balance > 0 && r.checkIn <= t : filter === "casa" ? r.status === "checkin" : true))
        .filter(({ r }) => !q || r.guestName.toLowerCase().includes(q.toLowerCase()) || room(r.roomId).includes(q))
        .sort((a, b) => b.r.checkIn.localeCompare(a.r.checkIn)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, filter, q, t],
  );

  const monthKey = t.slice(0, 7);
  const payMonth = data.payments.filter((p) => p.date.slice(0, 7) === monthKey);
  const payToday = data.payments.filter((p) => p.date === t);
  const pendingTotal = data.reservations
    .filter((r) => r.status === "checkin" || r.status === "checkout")
    .reduce((s, r) => s + Math.max(0, folio(r, data).balance), 0);

  return (
    <div className="p-4 lg:p-6">
      <PageHeader title="Facturación" subtitle="Folios por reserva, cargos, pagos y emisión de facturas" />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Cobrado hoy" value={money(payToday.reduce((s, p) => s + p.amount, 0), cur)} tone="green" />
        <Stat label="Cobrado este mes" value={money(payMonth.reduce((s, p) => s + p.amount, 0), cur)} tone="blue" />
        <Stat label="Saldos pendientes (en casa y salidos)" value={money(pendingTotal, cur)} tone="red" />
        <Stat label="Facturas emitidas" value={data.invoices.filter((i) => !i.voided).length} tone="gray" />
      </div>
      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "folios", label: "Folios" },
            { value: "facturas", label: "Facturas emitidas" },
            { value: "resumen", label: "Resumen del mes" },
          ]}
        />
      </div>

      {tab === "folios" && (
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <Card>
            <div className="space-y-2 border-b border-gray-100 p-3">
              <Input placeholder="Buscar huésped o habitación" value={q} onChange={(e) => setQ(e.target.value)} />
              <Tabs
                value={filter}
                onChange={setFilter}
                items={[
                  { value: "saldo", label: "Con saldo" },
                  { value: "casa", label: "En casa" },
                  { value: "todas", label: "Todas" },
                ]}
              />
            </div>
            <ul className="max-h-[calc(100vh-380px)] divide-y divide-gray-100 overflow-y-auto">
              {folios.slice(0, 200).map(({ r, f }) => (
                <li key={r.id}>
                  <button onClick={() => setSel(r.id)} className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-gray-50 ${sel === r.id ? "bg-blue-50" : ""}`}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{r.guestName}</span>
                      <span className="block text-xs text-gray-500">
                        Hab. {room(r.roomId)} · {fmtDate(r.checkIn).slice(0, 5)} → {fmtDate(r.checkOut).slice(0, 5)}
                      </span>
                    </span>
                    <span className={`text-sm font-semibold tabular-nums ${f.balance > 0 ? "text-red-600" : "text-green-700"}`}>{money(f.balance, cur)}</span>
                  </button>
                </li>
              ))}
              {folios.length === 0 && <li className="px-4 py-8 text-center text-sm text-gray-500">Sin folios</li>}
            </ul>
          </Card>
          {sel ? <Folio key={sel} id={sel} onInvoice={setInvoice} /> : <Card><p className="p-10 text-center text-sm text-gray-500">Elegí un folio de la lista.</p></Card>}
        </div>
      )}

      {tab === "facturas" && (
        <Card>
          <Table head={["N°", "Fecha", "Huésped", "Hab.", "Total", "Emitida por", ""]}>
            {data.invoices
              .slice()
              .sort((a, b) => b.number - a.number)
              .map((inv) => (
                <tr key={inv.id} className={inv.voided ? "text-gray-400 line-through" : ""}>
                  <td className="px-4 py-2.5 font-medium">{String(inv.number).padStart(6, "0")}</td>
                  <td className="px-4 py-2.5">{fmtDateTime(inv.issuedAt)}</td>
                  <td className="px-4 py-2.5">{inv.guestName}</td>
                  <td className="px-4 py-2.5">{inv.roomNumber}</td>
                  <td className="px-4 py-2.5 tabular-nums">{money(inv.total, cur)}</td>
                  <td className="px-4 py-2.5">{staffName(inv.issuedBy)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setInvoice(inv)}>Ver</Button>
                    {!inv.voided && (
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => confirm("¿Anular factura?") && actions.voidInvoice(inv)}>
                        Anular
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
          </Table>
          {data.invoices.length === 0 && <p className="p-8 text-center text-sm text-gray-500">Todavía no se emitieron facturas.</p>}
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
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Cobros del mes por medio de pago">
          <ul className="space-y-3 p-4">
            {byMethod.map(({ m, total }) => (
              <li key={m}>
                <div className="flex justify-between text-sm">
                  <span>{m}</span>
                  <b className="tabular-nums">{money(total, cur)}</b>
                </div>
                <div className="mt-1 h-2 rounded bg-gray-100">
                  <div className="h-2 rounded bg-blue-600" style={{ width: `${(total / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Producción del mes (por fecha de entrada)">
          <ul className="divide-y divide-gray-100 text-sm">
            <li className="flex justify-between px-4 py-2.5">
              <span>Alojamiento ({monthRes.length} reservas)</span>
              <b className="tabular-nums">{money(lodging, cur)}</b>
            </li>
            {cats.map(({ c, total }) => (
              <li key={c} className="flex justify-between px-4 py-2.5">
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
  const { data, actions, staffName } = useApp();
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
  if (!r) return <Card><p className="p-10 text-center text-sm text-gray-500">Reserva no encontrada.</p></Card>;
  const f = folio(r, data);
  const invoices = data.invoices.filter((i) => i.reservationId === r.id && !i.voided);

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {r.guestName} · Hab. {room(r.roomId)} <Badge className={RES_STATUS_BADGE[r.status]}>{RES_STATUS_LABEL[r.status]}</Badge>
        </span>
      }
      actions={
        <Button
          size="sm"
          variant="primary"
          onClick={async () => {
            if (invoices.length && !confirm("Esta reserva ya tiene factura. ¿Emitir otra?")) return;
            const inv = await actions.issueInvoice(r);
            toast(`Factura N° ${inv.number} emitida`);
            onInvoice(inv);
          }}
        >
          <Printer size={14} /> Emitir factura
        </Button>
      }
    >
      <div className="space-y-5 p-4">
        <Table head={["Fecha", "Concepto", "Categoría", "Importe", ""]}>
          <tr>
            <td className="px-4 py-2">{fmtDate(r.checkIn)}</td>
            <td className="px-4 py-2">
              Alojamiento · {nights(r)} noches × {money(r.rate, cur)}
            </td>
            <td className="px-4 py-2 text-gray-500">Alojamiento</td>
            <td className="px-4 py-2 tabular-nums">{money(f.lodging, cur)}</td>
            <td />
          </tr>
          {f.charges.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-2">{fmtDate(c.date)}</td>
              <td className="px-4 py-2">
                {c.description}
                <div className="text-xs text-gray-400">por {staffName(c.createdBy)}</div>
              </td>
              <td className="px-4 py-2 text-gray-500">{CHARGE_LABEL[c.category]}</td>
              <td className="px-4 py-2 tabular-nums">{money(c.amount, cur)}</td>
              <td className="px-2 text-right">
                <button className="p-1 text-gray-400 hover:text-red-600" onClick={() => confirm("¿Eliminar cargo?") && actions.removeCharge(c)}>
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </Table>
        <form
          className="flex flex-wrap items-end gap-2 rounded-md bg-gray-50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const a = Number(amount);
            if (!desc.trim() || !a) return toast("Completá concepto e importe", "error");
            actions.addCharge({ reservationId: r.id, description: desc.trim(), category: cat, amount: a, date: t });
            setDesc("");
            setAmount("");
          }}
        >
          <Field label="Nuevo cargo" className="min-w-[180px] flex-1"><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ej: 2 aguas minibar" /></Field>
          <Field label="Categoría">
            <Select value={cat} onChange={(e) => setCat(e.target.value as ChargeCategory)}>
              {(Object.keys(CHARGE_LABEL) as ChargeCategory[]).map((c) => (
                <option key={c} value={c}>{CHARGE_LABEL[c]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Importe"><Input type="number" className="w-[120px]" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Button type="submit">Agregar</Button>
        </form>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Pagos</h4>
          <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 text-sm">
            {f.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-3 py-2">
                <span>
                  {fmtDate(p.date)} · {p.method} {p.reference && <span className="text-gray-500">· {p.reference}</span>}
                  <span className="block text-xs text-gray-400">registrado por {staffName(p.createdBy)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <b className="tabular-nums text-green-700">{money(p.amount, cur)}</b>
                  <button className="p-1 text-gray-400 hover:text-red-600" onClick={() => confirm("¿Anular pago?") && actions.removePayment(p)}>
                    <Trash2 size={14} />
                  </button>
                </span>
              </li>
            ))}
            {f.payments.length === 0 && <li className="px-3 py-3 text-gray-500">Sin pagos registrados</li>}
          </ul>
          <form
            className="mt-2 flex flex-wrap items-end gap-2 rounded-md bg-gray-50 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const a = Number(pay);
              if (!a) return toast("Ingresá el importe", "error");
              actions.addPayment({ reservationId: r.id, amount: a, method, date: t, reference: ref || undefined });
              toast("Pago registrado");
              setPay("");
              setRef("");
            }}
          >
            <Field label="Registrar pago"><Input type="number" className="w-[140px]" value={pay} onChange={(e) => setPay(e.target.value)} /></Field>
            <Field label="Medio">
              <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {METHODS.map((m) => <option key={m}>{m}</option>)}
              </Select>
            </Field>
            <Field label="Referencia" className="min-w-[120px] flex-1"><Input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
            {f.balance > 0 && (
              <Button type="button" variant="ghost" onClick={() => setPay(String(Math.round(f.balance)))}>Saldo total</Button>
            )}
            <Button type="submit" variant="success">Cobrar</Button>
          </form>
        </div>

        <div className="ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Total</span><b className="tabular-nums">{money(f.total, cur)}</b></div>
          <div className="flex justify-between"><span className="text-gray-500">Pagado</span><span className="tabular-nums">{money(f.paid, cur)}</span></div>
          <div className={`flex justify-between border-t pt-1 text-base font-semibold ${f.balance > 0 ? "text-red-600" : "text-green-700"}`}>
            <span>Saldo</span><span className="tabular-nums">{money(f.balance, cur)}</span>
          </div>
        </div>
        {invoices.length > 0 && (
          <p className="text-xs text-gray-500">
            Facturas: {invoices.map((i) => (
              <button key={i.id} className="mr-2 font-medium text-blue-600 hover:underline" onClick={() => onInvoice(i)}>N° {i.number}</button>
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
          <Button variant="primary" onClick={() => window.print()}><Printer size={14} /> Imprimir / PDF</Button>
        </>
      }
    >
      <div className="print-area text-sm">
        <div className="flex justify-between">
          <div>
            <div className="text-lg font-bold uppercase tracking-widest">{settings?.hotelName}</div>
            <div className="text-gray-500">Comprobante de estadía</div>
          </div>
          <div className="text-right">
            <div className="font-semibold">N° {String(invoice.number).padStart(6, "0")}</div>
            <div>{fmtDateTime(invoice.issuedAt)}</div>
            {invoice.voided && <div className="font-bold text-red-600">ANULADA</div>}
          </div>
        </div>
        <div className="my-4 rounded bg-gray-50 p-3">
          Huésped: <b>{invoice.guestName}</b> · Habitación {invoice.roomNumber}
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-gray-500">
              <th className="py-2">Concepto</th><th className="py-2 text-right">Cant.</th><th className="py-2 text-right">Unit.</th><th className="py-2 text-right">Total</th>
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
        <p className="mt-6 text-xs text-gray-400">Emitida por {staffName(invoice.issuedBy)}. Documento no válido como factura fiscal electrónica.</p>
      </div>
    </Modal>
  );
}
