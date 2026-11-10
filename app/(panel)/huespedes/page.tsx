"use client";
import Link from "next/link";
import { Suspense, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Ban, Award, Building2, Cake, ChevronRight, CreditCard, Crown, Mail, MessageCircle, Phone, Plus, Medal, Repeat, Star, StickyNote, Trophy, Users } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { EmptyArt, GradAvatar, PulseChip, ReservationForm } from "@/components/reservation";
import { Sparkline } from "@/components/viz";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Textarea, toast } from "@/components/ui";
import { fmtDate, nowISO, today } from "@/lib/dates";
import { cls, folio, money, RES_STATUS_BADGE, RES_STATUS_LABEL, uid } from "@/lib/logic";
import type { Guest, Reservation } from "@/lib/types";

const TAGS = ["VIP", "Frecuente", "Empresa", "Luna de miel", "Familia", "Mascota", "Prensa", "Grupo"];
const STATUS_DOT: Record<Reservation["status"], string> = {
  checkin: "bg-green-500",
  checkout: "bg-slate-400",
  confirmada: "bg-blue-500",
  pendiente: "bg-gray-400",
  cancelada: "bg-red-400",
  no_show: "bg-red-400",
};
const DAY_MS = 86400000;
const BIRTHDAY_WINDOW_DAYS = 7;

interface GuestMetrics {
  stays: number;
  nights: number;
  spent: number;
  last?: string;
  next?: string;
  inHouse: boolean;
}

/** Anillo de color por tipo de huésped: VIP dorado, empresa violeta, frecuente con el acento. */
function ringFor(g: Guest, stays: number): string {
  if (g.tags?.includes("VIP")) return "ring-[3px] ring-amber-400";
  if (g.company || g.tags?.includes("Empresa")) return "ring-[3px] ring-violet-500";
  if (stays >= 2 || g.tags?.includes("Frecuente")) return "ring-[3px] ring-accent";
  return "";
}

/** Medalla según cuántas veces se alojó (1, 5 o 10 o más). */
function VisitMedal({ stays }: { stays: number }) {
  if (stays < 1) return null;
  const m =
    stays >= 10
      ? { Icon: Trophy, label: "10 o más estadías", cls: "bg-amber-100 text-amber-800" }
      : stays >= 5
        ? { Icon: Medal, label: "5 estadías o más", cls: "bg-sky-100 text-sky-800" }
        : { Icon: Award, label: "Ya se alojó", cls: "bg-green-50 text-green-700" };
  return (
    <Badge dot={false} className={m.cls}>
      <m.Icon size={13} aria-hidden /> {m.label}
    </Badge>
  );
}

/** Globos y confeti en SVG para la tarjeta de cumpleaños. */
function BalloonArt() {
  return (
    <svg width="120" height="84" viewBox="0 0 120 84" fill="none" aria-hidden className="pointer-events-none absolute -top-1 right-2 hidden sm:block">
      <g stroke="#78350f" strokeWidth="1.5" opacity=".5">
        <path d="M34 50c2 12-4 20-6 30M64 44c-1 14 2 24 4 36M92 52c-2 10 2 18 4 28" />
      </g>
      <ellipse cx="34" cy="32" rx="15" ry="19" fill="#f43f5e" />
      <ellipse cx="64" cy="26" rx="15" ry="19" fill="#f59e0b" />
      <ellipse cx="92" cy="34" rx="14" ry="18" fill="#0ea5e9" />
      <g opacity=".9">
        <rect x="8" y="10" width="5" height="5" rx="1" fill="#8b5cf6" transform="rotate(20 10 12)" />
        <rect x="106" y="8" width="5" height="5" rx="1" fill="#f43f5e" transform="rotate(-25 108 10)" />
        <circle cx="48" cy="6" r="2.5" fill="#10b981" />
        <circle cx="112" cy="46" r="2.5" fill="#f59e0b" />
      </g>
    </svg>
  );
}

function segMatch(g: Guest, mm: GuestMetrics, seg: Segment, month: string): boolean {
  switch (seg) {
    case "vip":
      return !!g.tags?.includes("VIP");
    case "frecuentes":
      return mm.stays >= 2 || !!g.tags?.includes("Frecuente");
    case "en_casa":
      return mm.inHouse;
    case "proximos":
      return !!mm.next;
    case "empresa":
      return !!g.company || !!g.tags?.includes("Empresa");
    case "cumple":
      return g.birthday?.slice(5, 7) === month;
    case "bloqueados":
      return !!g.blacklisted;
    default:
      return true;
  }
}

type Segment = "todos" | "vip" | "frecuentes" | "en_casa" | "proximos" | "empresa" | "cumple" | "bloqueados";

export default function Page() {
  return (
    <Suspense>
      <Huespedes />
    </Suspense>
  );
}

function Huespedes() {
  const { data, idx, can, actions } = useApp();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.toLowerCase());
  const [seg, setSeg] = useState<Segment>("todos");
  const [sort, setSort] = useState<"valor" | "reciente" | "nombre" | "estadias">("reciente");
  const [sel, setSel] = useState<string | null>(params.get("g"));
  const [edit, setEdit] = useState<Partial<Guest> | null>(null);
  const [newRes, setNewRes] = useState<Partial<Reservation> | null>(null);
  const showMoney = can("ver_montos");
  const t = today();
  const month = t.slice(5, 7);

  useEffect(() => {
    if (params.get("g")) setSel(params.get("g"));
  }, [params]);

  // Métricas por huésped (una sola pasada)
  const metrics = useMemo(() => {
    const m = new Map<string, { stays: number; nights: number; spent: number; last?: string; next?: string; inHouse: boolean }>();
    for (const g of data.guests) {
      const list = (idx.resByGuest.get(g.id) ?? []).filter((r) => r.status !== "cancelada" && r.status !== "no_show");
      let spent = 0,
        nightsSum = 0,
        stays = 0,
        last: string | undefined,
        next: string | undefined,
        inHouse = false;
      for (const r of list) {
        if (r.status === "checkout" || r.status === "checkin") {
          stays++;
          spent += folio(r, idx).total;
          nightsSum += Math.max(1, Math.round((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 86400000));
          if (!last || r.checkIn > last) last = r.checkIn;
        }
        if (r.status === "checkin") inHouse = true;
        if ((r.status === "confirmada" || r.status === "pendiente") && r.checkIn >= t && (!next || r.checkIn < next)) next = r.checkIn;
      }
      m.set(g.id, { stays, nights: nightsSum, spent, last, next, inHouse });
    }
    return m;
  }, [data.guests, idx, t]);

  const list = useMemo(() => {
    const out = data.guests.filter((g) => {
      const mm = metrics.get(g.id)!;
      if (q && ![g.name, g.email, g.phone, g.document, g.company].some((x) => x?.toLowerCase().includes(q))) return false;
      return segMatch(g, mm, seg, month);
    });
    return out.sort((a, b) => {
      const ma = metrics.get(a.id)!,
        mb = metrics.get(b.id)!;
      if (sort === "valor") return mb.spent - ma.spent;
      if (sort === "estadias") return mb.stays - ma.stays;
      if (sort === "reciente") return (mb.next ?? mb.last ?? "").localeCompare(ma.next ?? ma.last ?? "");
      return a.name.localeCompare(b.name);
    });
  }, [data.guests, metrics, q, seg, sort, month]);

  const total = data.guests.length;
  const recurrentes = data.guests.filter((g) => (metrics.get(g.id)?.stays ?? 0) >= 2).length;
  const vip = data.guests.filter((g) => g.tags?.includes("VIP")).length;
  const cumple = data.guests.filter((g) => g.birthday?.slice(5, 7) === month).length;

  const segs: { k: Segment; label: string }[] = [
    { k: "todos", label: "Todos" },
    { k: "en_casa", label: "Alojados ahora" },
    { k: "proximos", label: "Van a venir" },
    { k: "vip", label: "VIP" },
    { k: "frecuentes", label: "Vienen seguido" },
    { k: "empresa", label: "Empresas" },
    { k: "cumple", label: "Cumpleaños del mes" },
    { k: "bloqueados", label: "No aceptados" },
  ];
  const segCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const sg of segs) c[sg.k] = data.guests.filter((g) => segMatch(g, metrics.get(g.id)!, sg.k, month)).length;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.guests, metrics, month]);

  const birthdays = useMemo(() => {
    const y = Number(t.slice(0, 4));
    const out: { g: Guest; days: number }[] = [];
    for (const g of data.guests) {
      if (!g.birthday) continue;
      const md = g.birthday.slice(5, 10);
      let next = `${y}-${md}`;
      if (next < t) next = `${y + 1}-${md}`;
      const days = Math.round((Date.parse(next) - Date.parse(t)) / DAY_MS);
      if (days <= BIRTHDAY_WINDOW_DAYS) out.push({ g, days });
    }
    return out.sort((a, b) => a.days - b.days || a.g.name.localeCompare(b.g.name));
  }, [data.guests, t]);

  async function save() {
    if (!edit?.name?.trim()) return toast("Escribí el nombre del huésped", "error");
    const g = { createdAt: nowISO(), ...edit, id: edit.id ?? uid("guest"), name: edit.name.trim() } as Guest;
    await actions.saveGuest(g);
    toast("Huésped guardado ✔");
    setSel(g.id);
    setEdit(null);
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="aurora">
        <PageHeader
          eyebrow="Tu libreta de contactos"
          title={<span className="serif-accent">Huéspedes</span>}
          subtitle="Tus huéspedes: quiénes son, cuántas veces vinieron, qué les gusta y cómo contactarlos."
          actions={
            <Button variant="primary" className="!h-12 !px-6 !text-[15px] max-sm:w-full" onClick={() => setEdit({ tags: [] })}>
              <Plus size={16} /> Nuevo huésped
            </Button>
          }
        />
        <div className="stagger mb-6 grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          <PulseChip icon={Users} label="Huéspedes registrados" value={total} />
          <PulseChip
            icon={Repeat}
            label="Los que vuelven"
            value={total ? Math.round((recurrentes / total) * 100) : 0}
            format={(n) => `${Math.round(n)}%`}
            pct={total ? Math.round((recurrentes / total) * 100) : 0}
            tone="green"
            sub={`${recurrentes} vinieron 2 veces o más`}
          />
          <PulseChip icon={Crown} label="Huéspedes VIP" value={vip} />
          <PulseChip hero icon={Cake} label="Cumplen años este mes" value={cumple} sub="ideal para un saludo por WhatsApp" />
        </div>
      </div>

      {birthdays.length > 0 && (
        <section aria-label="Cumpleaños de esta semana" className="relative mb-5 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 sm:p-5">
          <BalloonArt />
          <h3 className="flex items-center gap-2 text-[17px] font-semibold">
            <Cake size={20} aria-hidden /> Cumpleaños de esta semana
          </h3>
          <p className="mt-0.5 text-[14px]">Un saludo por WhatsApp les cae siempre bien. Tocá un nombre para ver su ficha.</p>
          <ul className="mt-3 flex flex-wrap gap-2 sm:pr-32">
            {birthdays.slice(0, 6).map(({ g, days }) => (
              <li key={g.id}>
                <button
                  onClick={() => setSel(g.id)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 py-2 text-[15px] font-semibold text-gray-900 shadow-card ring-1 ring-amber-200 transition-colors duration-150 hover:bg-amber-100 motion-reduce:transition-none"
                >
                  {g.name}
                  <span className={days === 0 ? "text-rose-700" : "font-normal text-gray-700"}>
                    {days === 0 ? "cumple hoy" : days === 1 ? "mañana" : `en ${days} días`}
                  </span>
                </button>
              </li>
            ))}
            {birthdays.length > 6 && <li className="self-center text-[14px]">y {birthdays.length - 6} más</li>}
          </ul>
        </section>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_420px]">
        <Card>
          <div className="space-y-3 border-b border-gray-200/80 bg-panel-2/30 p-3 sm:p-4">
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Buscar por nombre, teléfono o documento" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full sm:w-[320px]" />
              <label className="label-mono flex w-full items-center gap-2 text-[12.5px] text-gray-600 sm:w-auto">
                Ordenar:
                <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-[15px] sm:h-10 sm:flex-none">
                  <option value="reciente">Los más recientes primero</option>
                  {showMoney && <option value="valor">Los que más gastaron</option>}
                  <option value="estadias">Los que más vinieron</option>
                  <option value="nombre">Por nombre (A a Z)</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {segs.map((s) => (
                <button
                  key={s.k}
                  onClick={() => setSeg(s.k)}
                  aria-pressed={seg === s.k}
                  className={cls("min-h-[44px] rounded-full border px-4 py-2 text-[14px] font-medium transition-colors duration-150 motion-reduce:transition-none", seg === s.k ? "border-accent bg-accent text-accent-fg font-semibold shadow-sm" : "border-gray-200 bg-panel text-gray-700 hover:border-gray-300 hover:bg-gray-50")}
                >
                  {s.label}
                  <span className={cls("ml-2 rounded-full px-2 text-[13px] tabular-nums", seg === s.k ? "bg-white/25" : "bg-gray-100 text-gray-700")}>{segCounts[s.k]}</span>
                </button>
              ))}
            </div>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-gray-600">
              <span>Color del círculo:</span>
              <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-3 w-3 rounded-full bg-amber-400" /> VIP</span>
              <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-3 w-3 rounded-full bg-accent" /> viene seguido</span>
              <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-3 w-3 rounded-full bg-violet-500" /> empresa</span>
            </p>
          </div>
          <ul className="stagger divide-y divide-gray-100">
            {list.slice(0, 300).map((g) => {
              const m = metrics.get(g.id)!;
              return (
                <li key={g.id}>
                  <button
                    onClick={() => setSel(g.id)}
                    className={cls("flex w-full items-center gap-4 px-4 py-4 text-left transition-colors duration-150 hover:bg-accent/5 motion-reduce:transition-none sm:px-5", sel === g.id && "bg-accent/10")}
                  >
                    <GradAvatar name={g.name} size={52} vip={!!g.tags?.includes("VIP")} ring={ringFor(g, m.stays)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[17px] font-semibold leading-snug">{g.name}</span>
                        {g.blacklisted && <Ban size={16} className="text-red-600" aria-label="No aceptado" />}
                        {m.inHouse && <Badge className="bg-green-50 text-green-700">Alojado ahora</Badge>}
                        <VisitMedal stays={m.stays} />
                      </div>
                      <div className="truncate text-[14px] text-gray-600">{g.company ?? g.phone ?? g.email}</div>
                      {(g.tags ?? []).length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {(g.tags ?? []).map((tg) => (
                            <Badge key={tg} className={tg === "VIP" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"}>
                              {tg}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] tabular-nums text-gray-700">
                        <span>
                          <b className="num text-[18px] text-fg">{m.stays}</b> <span className="text-gray-600">({m.nights} noches)</span>
                        </span>
                        {showMoney && <span className="font-medium">{money(m.spent)}</span>}
                        <span>{m.next ? <span className="font-medium text-blue-700">Llega el {fmtDate(m.next)}</span> : m.last ? fmtDate(m.last) : "—"}</span>
                      </div>
                    </div>
                    <ChevronRight size={20} className="shrink-0 text-gray-500" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          {list.length === 0 && (
            <EmptyArt text="No hay huéspedes en este grupo." />
          )}
        </Card>

        <GuestProfile id={sel} onEdit={setEdit} onNewRes={(g) => setNewRes({ guestId: g.id })} metrics={sel ? metrics.get(sel) : undefined} />
      </div>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? "Editar huésped" : "Nuevo huésped"}
        wide
        footer={
          <>
            <Button onClick={() => setEdit(null)}>Cerrar sin guardar</Button>
            <Button variant="primary" onClick={save}>
              Guardar
            </Button>
          </>
        }
      >
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre y apellido" className="sm:col-span-2">
              <Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Teléfono (con código de país, para mandarle WhatsApp)">
              <Input value={edit.phone ?? ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} placeholder="5491155551234" />
            </Field>
            <Field label="Email">
              <Input value={edit.email ?? ""} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
            </Field>
            <Field label="Documento (DNI, pasaporte o CUIT)">
              <Input value={edit.document ?? ""} onChange={(e) => setEdit({ ...edit, document: e.target.value })} />
            </Field>
            <Field label="Nacionalidad">
              <Input value={edit.nationality ?? ""} onChange={(e) => setEdit({ ...edit, nationality: e.target.value })} />
            </Field>
            <Field label="Empresa">
              <Input value={edit.company ?? ""} onChange={(e) => setEdit({ ...edit, company: e.target.value })} />
            </Field>
            <Field label="Cumpleaños">
              <Input type="date" value={edit.birthday ?? ""} onChange={(e) => setEdit({ ...edit, birthday: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <div className="label-mono mb-1.5 text-[12.5px] text-gray-600">Etiquetas (para reconocerlo rápido)</div>
              <div className="flex flex-wrap gap-1.5">
                {TAGS.map((tg) => {
                  const on = edit.tags?.includes(tg);
                  return (
                    <button
                      key={tg}
                      type="button"
                      onClick={() => setEdit({ ...edit, tags: on ? edit.tags!.filter((x) => x !== tg) : [...(edit.tags ?? []), tg] })}
                      className={cls("rounded-full px-4 py-1.5 text-[14px] font-medium ring-1", on ? "bg-accent/10 font-semibold text-gray-900 ring-accent" : "bg-transparent text-gray-700 ring-gray-200 hover:ring-gray-300")}
                    >
                      {tg}
                    </button>
                  );
                })}
              </div>
            </div>
            <Field label="Lo que le gusta (limpieza lo ve al preparar la habitación)" className="sm:col-span-2">
              <Textarea rows={2} value={edit.preferences ?? ""} onChange={(e) => setEdit({ ...edit, preferences: e.target.value })} placeholder="Piso alto, almohada extra, sin gluten…" />
            </Field>
            <Field label="Notas solo para el hotel (el huésped no las ve)" className="sm:col-span-2">
              <Textarea rows={2} value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-[15px] text-red-700 sm:col-span-2">
              <input type="checkbox" checked={!!edit.blacklisted} onChange={(e) => setEdit({ ...edit, blacklisted: e.target.checked })} /> No aceptar nuevas reservas de este huésped
            </label>
          </div>
        )}
      </Modal>
      <ReservationForm open={!!newRes} initial={newRes ?? undefined} onClose={() => setNewRes(null)} />
    </div>
  );
}

function GuestProfile({
  id,
  onEdit,
  onNewRes,
  metrics,
}: {
  id: string | null;
  onEdit: (g: Guest) => void;
  onNewRes: (g: Guest) => void;
  metrics?: GuestMetrics;
}) {
  const { idx, can } = useApp();
  const g = id ? idx.guestById.get(id) : undefined;
  if (!g)
    return (
      <Card className="hidden xl:block">
        <EmptyArt text="Tocá un huésped de la lista para ver sus datos." />
      </Card>
    );
  const stays = (idx.resByGuest.get(g.id) ?? []).slice().sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  const spendSeries = can("ver_montos")
    ? stays
        .filter((r) => r.status === "checkin" || r.status === "checkout")
        .reverse()
        .map((r) => folio(r, idx).total)
    : [];
  const contact: { icon: React.ElementType; label: string; value: string; wide?: boolean }[] = [
    { icon: Phone, label: "Teléfono", value: g.phone ?? "—" },
    { icon: CreditCard, label: "Documento", value: g.document ?? "—" },
    { icon: Mail, label: "Email", value: g.email ?? "—", wide: true },
    { icon: Building2, label: "Empresa", value: g.company ?? "—" },
    { icon: Cake, label: "Cumpleaños", value: g.birthday ? fmtDate(g.birthday).slice(0, 5) : "—" },
  ];
  return (
    <Card className="order-first overflow-hidden xl:sticky xl:top-4 xl:order-none xl:self-start">
      <div className="aurora overflow-hidden rounded-t-xl border-b border-gray-200/80 p-5">
        <div className="flex items-center gap-4">
          <GradAvatar name={g.name} size={72} vip={!!g.tags?.includes("VIP")} ring={ringFor(g, metrics?.stays ?? 0) || "ring-[3px] ring-gray-200"} />
          <div className="min-w-0 flex-1">
            <div className="text-[22px] font-semibold leading-tight">{g.name}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(g.tags ?? []).map((tg) => (
                <Badge key={tg} className={tg === "VIP" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"}>
                  {tg}
                </Badge>
              ))}
              {g.blacklisted && <Badge className="bg-red-700 text-white">No aceptado</Badge>}
              <VisitMedal stays={metrics?.stays ?? 0} />
            </div>
          </div>
        </div>
        <Button size="sm" className="mt-4 w-full sm:w-auto" onClick={() => onEdit(g)}>
          Editar
        </Button>
      </div>
      <div className="space-y-5 p-5 text-[15px]">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border border-gray-200/80 bg-gray-50 px-1 py-3.5">
            <div className="num text-[30px] leading-none tabular-nums">{metrics?.stays ?? 0}</div>
            <div className="label-mono mt-1.5 text-[12.5px] leading-tight text-gray-600">Veces que vino</div>
          </div>
          <div className="rounded-2xl border border-gray-200/80 bg-gray-50 px-1 py-3.5">
            <div className="num text-[30px] leading-none tabular-nums">{metrics?.nights ?? 0}</div>
            <div className="label-mono mt-1.5 text-[12.5px] leading-tight text-gray-600">Noches en total</div>
          </div>
          <div className="min-w-0 rounded-2xl border border-gray-200/80 bg-gray-50 px-1 py-3.5">
            <div className="num truncate text-[24px] leading-none tabular-nums">{can("ver_montos") ? money(metrics?.spent ?? 0) : "—"}</div>
            <div className="label-mono mt-1.5 text-[12.5px] leading-tight text-gray-600">Gastó en total</div>
          </div>
        </div>

        {spendSeries.length >= 2 && (
          <div className="rounded-2xl border border-gray-200/80 bg-gray-50 p-3.5">
            <div className="label-mono text-[12.5px] text-gray-600">Lo que gastó en cada estadía</div>
            <Sparkline data={spendSeries} width={320} height={48} className="mt-2 h-auto w-full" />
          </div>
        )}

        <section>
          <h4 className="label-mono mb-2.5 text-[12.5px] font-semibold text-gray-600">Datos de contacto</h4>
          <dl className="grid gap-3 sm:grid-cols-2">
            {contact.map((c) => (
              <div key={c.label} className={cls("flex items-center gap-3", c.wide && "sm:col-span-2")}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><c.icon size={17} aria-hidden /></span>
                <div className="min-w-0">
                  <dt className="label-mono text-[12.5px] text-gray-600">{c.label}</dt>
                  <dd className="break-words font-medium">{c.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </section>

        {g.preferences && (
          <p className="flex gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-blue-900">
            <Star size={17} className="mt-0.5 shrink-0" aria-hidden /> <span>{g.preferences}</span>
          </p>
        )}
        {g.notes && (
          <p className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-amber-900">
            <StickyNote size={17} className="mt-0.5 shrink-0" aria-hidden /> <span>{g.notes}</span>
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {can("editar_reservas") && !g.blacklisted && (
            <Button variant="primary" onClick={() => onNewRes(g)}>
              <Plus size={16} /> Hacerle una reserva
            </Button>
          )}
          {g.phone && can("whatsapp") && (
            <a href={`https://wa.me/${g.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="block">
              <Button className="w-full">
                <MessageCircle size={16} /> Escribirle por WhatsApp
              </Button>
            </a>
          )}
        </div>
        <section>
          <h4 className="label-mono mb-2.5 text-[12.5px] font-semibold text-gray-600">Sus reservas</h4>
          <ul className="relative space-y-1 border-l-2 border-gray-200 pl-5">
            {stays.map((r) => (
              <li key={r.id} className="relative">
                <span aria-hidden className={`absolute -left-[27px] top-4 h-3 w-3 rounded-full border-2 border-panel ring-2 ring-gray-200 ${STATUS_DOT[r.status]}`} />
                <Link href={`/reservas?r=${r.id}`} className="flex min-h-[52px] flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-gray-50 motion-reduce:transition-none">
                  <span>
                    {fmtDate(r.checkIn)} → {fmtDate(r.checkOut).slice(0, 5)} · Habitación {idx.roomById.get(r.roomId)?.number}
                  </span>
                  <Badge className={RES_STATUS_BADGE[r.status]}>{RES_STATUS_LABEL[r.status]}</Badge>
                </Link>
              </li>
            ))}
            {!stays.length && <li className="px-3 py-2 text-gray-600">Todavía no tiene reservas</li>}
          </ul>
        </section>
      </div>
    </Card>
  );
}
