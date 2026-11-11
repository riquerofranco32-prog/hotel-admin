"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Banknote, BedDouble, CheckCircle2, CreditCard, FileText, HandCoins, Landmark, Plus, Printer, Receipt, Search, ShoppingBag, Smartphone, Trash2, Users, Wallet } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { CountUp, Ring, Sparkline } from "@/components/viz";
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Table, Tabs, toast } from "@/components/ui";
import { fmtDate, fmtDateTime, today } from "@/lib/dates";
import { cls, CHARGE_LABEL, folio, isActive, money, nights, RES_STATUS_BADGE, RES_STATUS_LABEL } from "@/lib/logic";
import type { ChargeCategory, Invoice, PaymentMethod } from "@/lib/types";

const METHODS: PaymentMethod[] = ["Efectivo", "Tarjeta de crédito", "Tarjeta de débito", "Transferencia", "Mercado Pago"];

function balanceText(balance: number, cur: string) {
  if (balance > 0) return `Debe ${money(balance, cur)}`;
  if (balance < 0) return `A favor ${money(-balance, cur)}`;
  return "Está al día";
}

/** Pasa a true un instante después de aparecer: dispara las animaciones de entrada. */
function useEntered() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return on;
}

const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const AVATAR_GRADS = [
  "from-rose-500 to-amber-500",
  "from-sky-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-violet-500 to-fuchsia-600",
  "from-amber-500 to-orange-600",
  "from-teal-500 to-sky-600",
];

/** Avatar con las iniciales sobre un degradé (el color depende del nombre). */
function GradAvatar({ name, size = 40 }: { name: string; size?: number }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const ini = name.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("");
  return (
    <span
      aria-hidden
      className={cls("flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white shadow-sm", AVATAR_GRADS[h % AVATAR_GRADS.length])}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {ini}
    </span>
  );
}

function MethodIcon({ method, size = 16 }: { method: PaymentMethod; size?: number }) {
  const Icon = method === "Efectivo" ? Banknote : method === "Transferencia" ? Landmark : method === "Mercado Pago" ? Smartphone : CreditCard;
  return <Icon size={size} aria-hidden />;
}

/** Embudo: vendido, cobrado y falta cobrar, con porcentajes. */
function Funnel({ sold, paid, due, cur }: { sold: number; paid: number; due: number; cur: string }) {
  const on = useEntered();
  const rows = [
    { label: "Vendido", sub: "todo lo anotado en las cuentas", value: sold, pct: sold > 0 ? 100 : 0, bar: "from-accent/50 to-accent" },
    { label: "Cobrado", sub: "plata que ya entró", value: paid, pct: sold > 0 ? (paid / sold) * 100 : 0, bar: "from-green-400 to-green-600" },
    { label: "Falta cobrar", sub: "lo que todavía deben", value: due, pct: sold > 0 ? (due / sold) * 100 : 0, bar: "from-red-400 to-red-600" },
  ];
  return (
    <ul className="space-y-4 p-4 sm:p-5">
      {rows.map((r, i) => (
        <li key={r.label} aria-label={`${r.label}: ${money(r.value, cur)}, ${clampPct(r.pct)}% de lo vendido`}>
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-[15px]">
            <span className="min-w-0 font-medium text-fg">
              {r.label} <span className="text-[13.5px] font-normal text-gray-600">· {r.sub}</span>
            </span>
            <span className="ml-auto flex items-baseline gap-2 whitespace-nowrap tabular-nums">
              <b className="num text-[18px] text-fg">{money(r.value, cur)}</b>
              <span className="w-10 text-right text-[13.5px] text-gray-600">{clampPct(r.pct)}%</span>
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-gray-200/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]">
            <div
              className={cls("h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out motion-reduce:transition-none", r.bar)}
              style={{ width: on ? `${r.pct}%` : 0, transitionDelay: `${i * 120}ms` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

interface TimelineEvent {
  key: string;
  date: string;
  kind: "hospedaje" | "gasto" | "pago";
  label: string;
  note?: string;
  amount: number;
  balance: number;
}

/** Línea de tiempo vertical de la cuenta: gastos y pagos por fecha, con el saldo después de cada uno. */
function Timeline({ events, cur }: { events: TimelineEvent[]; cur: string }) {
  return (
    <ol className="relative ml-4 space-y-5 border-l-2 border-gray-200/80">
      {events.map((e) => {
        const pay = e.kind === "pago";
        const Icon = pay ? CheckCircle2 : e.kind === "hospedaje" ? BedDouble : ShoppingBag;
        return (
          <li key={e.key} className="relative pl-7">
            <span
              className={cls("absolute -left-[17px] top-0 flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-panel", pay ? "bg-green-100 text-green-700" : e.kind === "hospedaje" ? "bg-accent/15 text-accent" : "bg-gray-100 text-gray-700")}
              aria-hidden
            >
              <Icon size={16} />
            </span>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-0.5">
              <div className="min-w-0 flex-1 basis-[180px]">
                <div className="break-words text-[15px] font-medium leading-snug text-fg">{e.label}</div>
                <div className="text-[13.5px] text-gray-600">
                  {fmtDate(e.date)}
                  {e.note ? ` · ${e.note}` : ""}
                </div>
              </div>
              <div className="ml-auto whitespace-nowrap text-right">
                <b className={cls("num text-[18px] tabular-nums leading-snug", pay ? "text-green-700" : "text-fg")}>
                  {pay ? "+ " : ""}
                  {money(e.amount, cur)}
                </b>
                <div className="text-[13.5px] tabular-nums text-gray-600">Saldo: {balanceText(e.balance, cur)}</div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
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
  const monthTotal = payMonth.reduce((s, p) => s + p.amount, 0);
  const todayTotal = payToday.reduce((s, p) => s + p.amount, 0);
  const invoiceCount = data.invoices.filter((i) => !i.voided).length;
  const monthSeries = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const p of data.payments) if (p.date.slice(0, 7) === monthKey) byDay.set(p.date, (byDay.get(p.date) ?? 0) + p.amount);
    return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map((x) => x[1]);
  }, [data.payments, monthKey]);
  const pendingTotal = data.reservations
    .filter((r) => r.status === "checkin" || r.status === "checkout")
    .reduce((s, r) => s + Math.max(0, folio(r, idx).balance), 0);

  const soldTotal = data.reservations
    .filter((r) => r.status === "checkin" || r.status === "checkout")
    .reduce((s, r) => s + folio(r, idx).total, 0);
  const paidTotal = Math.max(0, soldTotal - pendingTotal);

  return (
    <div className="mx-auto max-w-[1400px] p-4 lg:p-6">
      <div className="aurora mb-6">
        <PageHeader title={<>Cobros y <span className="serif-accent">facturas</span></>} subtitle="Acá ves cuánta plata debe cada huésped, anotás sus pagos y gastos, y hacés la factura." />
        <div className="stagger grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 lg:grid-cols-4">
          <div className="hero-card flex flex-col justify-between gap-3 rounded-2xl p-5 lg:col-span-2">
            <div className="flex items-center gap-2 text-[15px] font-medium opacity-90">
              <Wallet size={18} aria-hidden /> Se cobró este mes
            </div>
            <div className="flex items-end justify-between gap-3">
              <div className="num min-w-0 text-[40px] leading-none tabular-nums sm:text-[52px]">
                <CountUp value={monthTotal} format={(n) => money(n, cur)} />
              </div>
              {monthSeries.length > 1 && <div className="hidden shrink-0 rounded-xl bg-white/90 px-2 py-1.5 min-[400px]:block"><Sparkline data={monthSeries} width={130} height={44} /></div>}
            </div>
            <div className="text-[14px] opacity-90">
              Hoy entraron <b className="tabular-nums">{money(todayTotal, cur)}</b>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200/80 bg-panel p-5 shadow-card">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-700 ring-1 ring-inset ring-red-200"><HandCoins size={20} aria-hidden /></span>
            <div className="label-mono mt-3 text-[12.5px] text-gray-600">Falta cobrar</div>
            <div className="num mt-1.5 text-[30px] leading-none tabular-nums text-red-700"><CountUp value={pendingTotal} format={(n) => money(n, cur)} /></div>
            <div className="mt-2 text-[14px] text-gray-600">de huéspedes que están o ya se fueron</div>
          </div>
          <div className="rounded-2xl border border-gray-200/80 bg-panel p-5 shadow-card">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-inset ring-accent/20"><FileText size={20} aria-hidden /></span>
            <div className="label-mono mt-3 text-[12.5px] text-gray-600">Facturas hechas</div>
            <div className="num mt-1.5 text-[30px] leading-none tabular-nums text-fg"><CountUp value={invoiceCount} /></div>
            <div className="mt-2 text-[14px] text-gray-600">sin contar las anuladas</div>
          </div>
        </div>
        <Card className="mt-4" icon={Wallet} title="De todo lo vendido, cuánto ya se cobró">
          <Funnel sold={soldTotal} paid={paidTotal} due={pendingTotal} cur={cur} />
        </Card>
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
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
          <Card>
            <div className="space-y-3 border-b border-gray-200/70 bg-panel-2/40 p-3">
              <div className="relative">
                <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input className="pl-9 text-[15px]" placeholder="Buscar por nombre o número de habitación" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
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
            <ul className="max-h-[calc(100vh-380px)] min-h-[200px] divide-y divide-gray-200/60 overflow-y-auto overscroll-contain lg:min-h-[320px]">
              {folios.slice(0, 200).map(({ r, f }) => (
                <li key={r.id}>
                  <button onClick={() => setSel(r.id)} aria-current={sel === r.id ? "true" : undefined} className={cls("flex min-h-[64px] w-full items-center gap-3 border-l-4 py-3 pl-3 pr-4 text-left transition-colors duration-150 focus-visible:-outline-offset-2 motion-reduce:transition-none", sel === r.id ? "border-l-accent bg-accent/10" : "border-l-transparent hover:bg-accent/[0.06]")}>
                    <GradAvatar name={r.guestName} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-[15.5px] font-semibold text-fg">{r.guestName}</span>
                        <span className={cls("shrink-0 whitespace-nowrap text-[14px] font-semibold tabular-nums", f.balance > 0 ? "text-red-700" : "text-green-700")}>{balanceText(f.balance, cur)}</span>
                      </span>
                      <span className="block truncate text-[13.5px] tabular-nums text-gray-600">
                        Habitación {room(r.roomId)} · {fmtDate(r.checkIn).slice(0, 5)} → {fmtDate(r.checkOut).slice(0, 5)}
                      </span>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-gray-200/70" role="img" aria-label={`Pagó el ${f.total > 0 ? clampPct((f.paid / f.total) * 100) : 0}% de la cuenta`}>
                        <span className={cls("block h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none", f.balance > 0 ? "bg-accent" : "bg-green-600")} style={{ width: `${f.total > 0 ? clampPct((f.paid / f.total) * 100) : 0}%` }} />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {folios.length === 0 && (
                <li>
                  <Empty icon={Users}>No hay cuentas para mostrar. Probá con otra pestaña o cambiá lo que buscaste.</Empty>
                </li>
              )}
            </ul>
          </Card>
          {sel ? <Folio key={sel} id={sel} onInvoice={setInvoice} /> : <Card><Empty icon={Receipt}>Tocá un huésped de la lista para ver su cuenta.</Empty></Card>}
        </div>
      )}

      {tab === "facturas" && (
        <Card>
          {data.invoices.length > 0 ? (
            <Table head={["N°", "Fecha", "Huésped", "Habitación", <span key="t" className="block text-right">Total</span>, "La hizo", ""]}>
              {data.invoices
                .slice()
                .sort((a, b) => b.number - a.number)
                .map((inv) => (
                  <tr key={inv.id} className={cls(inv.voided && "text-gray-600")}>
                    <td className="label-mono whitespace-nowrap px-4 py-2.5 text-[13px] font-semibold tabular-nums">{String(inv.number).padStart(6, "0")}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-[14.5px] tabular-nums text-gray-700">{fmtDateTime(inv.issuedAt)}</td>
                    <td className="min-w-[160px] px-4 py-2.5 text-[15px] font-medium">
                      <span className={cls(inv.voided && "line-through")}>{inv.guestName}</span>
                      {inv.voided && <Badge dot={false} className="ml-2 bg-red-50 text-red-700 ring-red-200">Anulada</Badge>}
                    </td>
                    <td className="px-4 py-2.5 text-[15px] tabular-nums">{inv.roomNumber}</td>
                    <td className={cls("num whitespace-nowrap px-4 py-2.5 text-right text-[17px] tabular-nums", inv.voided && "line-through")}>{money(inv.total, cur)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-[14.5px] text-gray-700">{staffName(inv.issuedBy)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setInvoice(inv)}>Ver factura</Button>
                      {!inv.voided && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-700 hover:bg-red-50 hover:text-red-700"
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
          ) : (
            <Empty icon={FileText} title="Todavía no hiciste ninguna factura">
              Para hacer una, entrá a «Cuentas de huéspedes», elegí un huésped y tocá «Hacer factura».
            </Empty>
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
          <ul className="space-y-4 p-4 sm:p-5">
            {byMethod.map(({ m, total }) => (
              <li key={m}>
                <div className="flex items-baseline justify-between gap-3 text-[15px]">
                  <span className="flex min-w-0 items-center gap-2 font-medium"><span className="shrink-0 text-accent"><MethodIcon method={m} /></span><span className="truncate">{m}</span></span>
                  <b className={cls("num whitespace-nowrap text-[18px] tabular-nums", !total && "text-gray-500")}>{money(total, cur)}</b>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-gray-200/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]">
                  <div className="h-full rounded-full bg-gradient-to-r from-accent/55 to-accent transition-all duration-700 motion-reduce:transition-none" style={{ width: `${(total / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Lo que se vendió este mes (reservas que entran este mes)">
          <ul className="divide-y divide-gray-200/60 text-[15px]">
            <li className="flex items-baseline justify-between gap-3 px-4 py-3 sm:px-5">
              <span className="min-w-0 font-medium">Hospedaje <span className="font-normal text-gray-600">({monthRes.length} reservas)</span></span>
              <b className="num whitespace-nowrap text-[18px] tabular-nums">{money(lodging, cur)}</b>
            </li>
            {cats.map(({ c, total }) => (
              <li key={c} className="flex items-baseline justify-between gap-3 px-4 py-3 sm:px-5">
                <span className="min-w-0">{CHARGE_LABEL[c]}</span>
                <b className={cls("num whitespace-nowrap text-[18px] tabular-nums", !total && "text-gray-500")}>{money(total, cur)}</b>
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
  if (!r) return <Card><Empty icon={Receipt}>No encontramos esta reserva.</Empty></Card>;
  const f = folio(r, idx);
  const canPay = can("registrar_pagos");
  const invoices = data.invoices.filter((i) => i.reservationId === r.id && !i.voided);
  const pctPaid = f.total > 0 ? clampPct((f.paid / f.total) * 100) : 0;
  const byMethod = METHODS.map((m) => ({ m, total: f.payments.filter((p) => p.method === m).reduce((s, p) => s + p.amount, 0) })).filter((x) => x.total > 0);
  const rawEvents: Omit<TimelineEvent, "balance">[] = [
    { key: "hospedaje", date: r.checkIn, kind: "hospedaje", label: `Hospedaje · ${nights(r)} noches × ${money(r.rate, cur)}`, amount: f.lodging },
    ...f.charges.map((c) => ({ key: c.id, date: c.date, kind: "gasto" as const, label: c.description, note: CHARGE_LABEL[c.category], amount: c.amount })),
    ...f.payments.map((p) => ({ key: p.id, date: p.date, kind: "pago" as const, label: `Pago · ${p.method}`, note: p.reference, amount: p.amount })),
  ];
  const KIND_ORDER = { hospedaje: 0, gasto: 1, pago: 2 };
  const events = rawEvents
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
    .reduce<TimelineEvent[]>((acc, e) => {
      const prev = acc.length ? acc[acc.length - 1].balance : 0;
      return [...acc, { ...e, balance: prev + (e.kind === "pago" ? -e.amount : e.amount) }];
    }, []);

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
          <Printer size={15} aria-hidden /> Hacer factura
        </Button>
      }
    >
      <div className="space-y-6 p-4 sm:p-5">
        <div className="stagger grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
          <div className="rounded-xl border border-gray-200/80 bg-panel-2/60 px-4 py-4">
            <div className="label-mono text-[12.5px] text-gray-600">Total de la cuenta</div>
            <div className="num mt-1.5 text-[28px] tabular-nums leading-none text-fg"><CountUp value={f.total} format={(n) => money(n, cur)} /></div>
          </div>
          <div className="rounded-xl border border-gray-200/80 bg-panel-2/60 px-4 py-4">
            <div className="label-mono text-[12.5px] text-gray-600">Pagó</div>
            <div className="num mt-1.5 text-[28px] tabular-nums leading-none text-fg"><CountUp value={f.paid} format={(n) => money(n, cur)} /></div>
          </div>
          <div className={cls("rounded-xl border bg-gradient-to-br px-4 py-4", f.balance > 0 ? "border-red-200 from-red-50 to-red-100 text-red-700" : "border-green-200 from-green-50 to-green-100 text-green-700")}>
            <div className="label-mono flex items-center gap-1.5 text-[12.5px] font-semibold">
              {f.balance <= 0 && <CheckCircle2 size={16} aria-hidden />}
              {f.balance > 0 ? "Debe" : f.balance < 0 ? "A favor del huésped" : "Está al día"}
            </div>
            <div className="num mt-1.5 text-[28px] tabular-nums leading-none"><CountUp value={Math.abs(f.balance)} format={(n) => money(n, cur)} /></div>
          </div>
        </div>
        {f.total > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4 rounded-xl border border-gray-200/80 p-4 sm:justify-start">
            <Ring value={pctPaid} size={148} stroke={12} tone={f.balance > 0 ? "accent" : "green"} label={`Pagó el ${pctPaid}% de la cuenta. ${balanceText(f.balance, cur)}`}>
              <span className="label-mono text-[12.5px] text-gray-600">{f.balance > 0 ? "Debe" : f.balance < 0 ? "A favor" : "Al día"}</span>
              <span className="num text-[21px] leading-tight tabular-nums text-fg">{money(Math.abs(f.balance), cur)}</span>
              <span className="text-[13.5px] text-gray-600">pagó el {pctPaid}%</span>
            </Ring>
            <div className="min-w-0 flex-1 basis-[220px]">
              <div className="label-mono mb-2 text-[12.5px] text-gray-600">Con qué pagó</div>
              {byMethod.length ? (
                <ul className="flex flex-wrap gap-2">
                  {byMethod.map(({ m, total }) => (
                    <li key={m} className="inline-flex min-h-[36px] items-center gap-2 rounded-full bg-accent/10 px-3.5 py-1 text-[14.5px] font-medium text-fg ring-1 ring-inset ring-accent/20">
                      <span className="text-accent"><MethodIcon method={m} /></span>
                      {m} · <b className="tabular-nums">{money(total, cur)}</b>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[15px] text-gray-600">Todavía no pagó nada.</p>
              )}
            </div>
          </div>
        )}
        <div>
          <h4 className="label-mono mb-3.5 text-[12.5px] font-medium text-gray-600">Qué pasó en la cuenta, día por día</h4>
          <Timeline events={events} cur={cur} />
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200/80">
        <Table head={["Fecha", "Qué es", "Tipo", <span key="m" className="block text-right">Monto</span>, ""]}>
          <tr>
            <td className="whitespace-nowrap px-4 py-2.5 text-[14.5px] tabular-nums text-gray-700">{fmtDate(r.checkIn)}</td>
            <td className="min-w-[180px] px-4 py-2.5 text-[15px] font-medium">
              Hospedaje · {nights(r)} noches × {money(r.rate, cur)}
            </td>
            <td className="whitespace-nowrap px-4 py-2.5 text-[14.5px] text-gray-600">Hospedaje</td>
            <td className="num whitespace-nowrap px-4 py-2.5 text-right text-[17px] tabular-nums">{money(f.lodging, cur)}</td>
            <td />
          </tr>
          {f.charges.map((c) => (
            <tr key={c.id}>
              <td className="whitespace-nowrap px-4 py-2.5 text-[14.5px] tabular-nums text-gray-700">{fmtDate(c.date)}</td>
              <td className="min-w-[180px] px-4 py-2.5 text-[15px] font-medium">
                {c.description}
                <div className="text-[13.5px] font-normal text-gray-600">lo anotó {staffName(c.createdBy)}</div>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-[14.5px] text-gray-600">{CHARGE_LABEL[c.category]}</td>
              <td className="num whitespace-nowrap px-4 py-2.5 text-right text-[17px] tabular-nums">{money(c.amount, cur)}</td>
              <td className="px-2 text-right">
                <button
                  className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[14px] font-medium text-red-700 transition-colors duration-150 hover:bg-red-50 motion-reduce:transition-none sm:min-h-[36px]"
                  onClick={() => confirm(`¿Borrar "${c.description}" por ${money(c.amount, cur)} de la cuenta? No se puede deshacer.`) && actions.removeCharge(c)}
                >
                  <Trash2 size={14} aria-hidden /> Borrar
                </button>
              </td>
            </tr>
          ))}
        </Table>
        </div>
        {canPay && <form
          className="grid grid-cols-2 items-end gap-3 rounded-xl border border-gray-200/80 bg-panel-2/60 p-4 sm:flex sm:flex-wrap"
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
          <Field label="Anotar un gasto: ¿qué es?" className="col-span-2 min-w-[180px] flex-1"><Input className="text-[15px]" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ej: 2 botellas de agua del frigobar" /></Field>
          <Field label="Tipo">
            <Select className="text-[15px]" value={cat} onChange={(e) => setCat(e.target.value as ChargeCategory)}>
              {(Object.keys(CHARGE_LABEL) as ChargeCategory[]).map((c) => (
                <option key={c} value={c}>{CHARGE_LABEL[c]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Monto"><Input type="number" className="w-full text-right text-[15px] tabular-nums sm:w-[130px]" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Button type="submit" className="col-span-2"><Plus size={15} aria-hidden /> Agregar gasto</Button>
        </form>}

        <div>
          <h4 className="label-mono mb-3 text-[12.5px] font-medium text-gray-600">Pagos que hizo el huésped</h4>
          <ul className="divide-y divide-gray-200/60 overflow-hidden rounded-xl border border-gray-200/80 text-[15px]">
            {f.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 pl-4 pr-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700 ring-1 ring-inset ring-green-200" aria-hidden><MethodIcon method={p.method} size={17} /></span>
                <span className="min-w-0 flex-1 basis-[150px]">
                  <span className="block font-medium leading-snug"><span className="tabular-nums">{fmtDate(p.date)}</span> · {p.method} {p.reference && <span className="font-normal text-gray-600">· {p.reference}</span>}</span>
                  <span className="block text-[13.5px] text-gray-600">lo anotó {staffName(p.createdBy)}</span>
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <b className="num whitespace-nowrap text-[19px] tabular-nums text-green-700">{money(p.amount, cur)}</b>
                  <button
                    className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[14px] font-medium text-red-700 transition-colors duration-150 hover:bg-red-50 motion-reduce:transition-none sm:min-h-[36px]"
                    onClick={() =>
                      confirm(`¿Anular este pago de ${money(p.amount, cur)} del ${fmtDate(p.date)}? La cuenta vuelve a deber ese monto. No se puede deshacer.`) &&
                      actions.removePayment(p)
                    }
                  >
                    <Trash2 size={14} aria-hidden /> Anular este pago
                  </button>
                </span>
              </li>
            ))}
            {f.payments.length === 0 && <li className="px-4 py-5 text-center text-gray-600">Todavía no pagó nada.</li>}
          </ul>
          {canPay && <form
            className="mt-3 grid grid-cols-2 items-end gap-3 rounded-xl border border-gray-200/80 bg-panel-2/60 p-4 sm:flex sm:flex-wrap"
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
            <Field label="Anotar un pago: ¿cuánto pagó?" className="col-span-2 sm:col-span-1"><Input type="number" className="w-full text-right text-[15px] tabular-nums sm:w-[150px]" value={pay} onChange={(e) => setPay(e.target.value)} /></Field>
            <Field label="Cómo pagó" className="col-span-2 sm:col-span-1">
              <Select className="text-[15px]" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {METHODS.map((m) => <option key={m}>{m}</option>)}
              </Select>
            </Field>
            <Field label="Nota (opcional)" className="col-span-2 min-w-[120px] flex-1"><Input className="text-[15px]" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Ej: número de comprobante" /></Field>
            {f.balance > 0 && (
              <Button type="button" variant="ghost" className="col-span-2 px-3" onClick={() => setPay(String(Math.round(f.balance)))}>Poner lo que debe</Button>
            )}
            <Button type="submit" variant="success" className="col-span-2"><CheckCircle2 size={15} aria-hidden /> Anotar pago</Button>
          </form>}
        </div>

        {invoices.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-gray-200/70 pt-4 text-[14px] text-gray-600">
            <FileText size={15} aria-hidden className="mr-1 shrink-0" />
            Facturas hechas: {invoices.map((i) => (
              <button key={i.id} className="inline-flex min-h-[44px] items-center rounded-md px-2 font-semibold tabular-nums text-accent underline-offset-4 hover:underline sm:min-h-[32px]" onClick={() => onInvoice(i)}>Factura N° {i.number}</button>
            ))}
          </p>
        )}
      </div>
    </Card>
  );
}

function InvoiceModal({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const { data, idx, staffName } = useApp();
  const settings = data.settings[0];
  const cur = settings?.currency ?? "$";
  if (!invoice) return null;
  const invRes = data.reservations.find((x) => x.id === invoice.reservationId);
  const isPaid = !invoice.voided && !!invRes && folio(invRes, idx).balance <= 0;
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={`Factura N° ${String(invoice.number).padStart(6, "0")}`}
      footer={
        <>
          <Button onClick={onClose}>Cerrar</Button>
          <Button variant="primary" onClick={() => window.print()}><Printer size={15} aria-hidden /> Imprimir o guardar en PDF</Button>
        </>
      }
    >
      <div className="rounded-md bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.18)] ring-1 ring-gray-200 sm:p-8">
      <div className="no-print flex h-0 justify-end" aria-hidden>
        <span className="-mr-5 -mt-5 block h-8 w-8 shrink-0 sm:-mr-8 sm:-mt-8" style={{ background: "linear-gradient(225deg, rgb(var(--panel)) 50%, rgb(var(--gray-300)) 50%)", boxShadow: "-2px 2px 4px rgba(0,0,0,0.15)" }} />
      </div>
      {isPaid && (
        <div className="no-print pointer-events-none flex h-0 justify-end pr-4 sm:pr-10">
          <span className="num relative z-10 mt-24 -rotate-12 rounded-md border-4 border-green-600 px-4 py-1 text-[34px] uppercase leading-none tracking-wider text-green-700 opacity-80">Pagado</span>
        </div>
      )}
      {/* En impresión todo va con colores fijos (negro y grises neutros) para que salga bien sobre blanco aunque el panel esté en tema oscuro. */}
      <div className="print-area text-[15px] leading-normal text-fg print:text-black">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b-2 border-fg/80 pb-4 print:border-black">
          <div className="min-w-0">
            <div className="break-words text-xl font-bold uppercase leading-tight tracking-[0.14em]">{settings?.hotelName}</div>
            <div className="label-mono mt-1.5 text-[12.5px] text-gray-600 print:text-neutral-600">Comprobante de estadía</div>
          </div>
          <div className="ml-auto text-right">
            <div className="num text-[24px] leading-tight tabular-nums">N° {String(invoice.number).padStart(6, "0")}</div>
            <div className="text-[14px] tabular-nums text-gray-600 print:text-neutral-600">{fmtDateTime(invoice.issuedAt)}</div>
            {invoice.voided && <div className="mt-1.5 inline-block rounded border-2 border-red-600 px-2 py-0.5 text-[13px] font-bold tracking-widest text-red-600">ANULADA</div>}
          </div>
        </div>
        <div className="my-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 print:border-neutral-300 print:bg-transparent">
          Huésped: <b>{invoice.guestName}</b> · Habitación {invoice.roomNumber}
        </div>
        <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full border-collapse">
          <thead>
            <tr className="label-mono border-b border-gray-300 text-left text-[12.5px] text-gray-600 print:border-neutral-400 print:text-neutral-600">
              <th className="py-2 pr-3 font-medium">Qué es</th><th className="whitespace-nowrap px-3 py-2 text-right font-medium">Cantidad</th><th className="whitespace-nowrap px-3 py-2 text-right font-medium">Precio c/u</th><th className="whitespace-nowrap py-2 pl-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l, i) => (
              <tr key={i} className="border-b border-gray-200/70 align-top print:border-neutral-200">
                <td className="py-2 pr-3">{l.description}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.qty}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{money(l.unit, cur)}</td>
                <td className="whitespace-nowrap py-2 pl-3 text-right font-medium tabular-nums">{money(l.total, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="ml-auto mt-5 w-full max-w-[280px] space-y-1.5">
          <div className="flex justify-between gap-4 text-gray-700 print:text-neutral-700"><span>Subtotal</span><span className="tabular-nums">{money(invoice.subtotal, cur)}</span></div>
          <div className="flex justify-between gap-4 text-gray-700 print:text-neutral-700"><span>IVA ({settings?.taxRate ?? 21}%)</span><span className="tabular-nums">{money(invoice.tax, cur)}</span></div>
          <div className="flex items-baseline justify-between gap-4 border-t-2 border-fg/80 pt-2 font-bold print:border-black"><span className="text-base">Total</span><span className="num text-[24px] leading-none tabular-nums">{money(invoice.total, cur)}</span></div>
        </div>
        <p className="mt-8 border-t border-gray-200 pt-3 text-[13px] leading-relaxed text-gray-600 print:border-neutral-300 print:text-neutral-600">Hecha por {staffName(invoice.issuedBy)}. Este papel no vale como factura oficial (factura electrónica).</p>
      </div>
      </div>
    </Modal>
  );
}
