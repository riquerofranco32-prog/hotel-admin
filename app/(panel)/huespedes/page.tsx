"use client";
import Link from "next/link";
import { Suspense, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Ban, Building2, Cake, ChevronRight, CreditCard, Crown, Mail, MessageCircle, Phone, Plus, Repeat, Star, StickyNote, Users } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { ReservationForm } from "@/components/reservation";
import { Avatar, Badge, Button, Card, Field, Input, Modal, PageHeader, Stat, Table, Textarea, toast } from "@/components/ui";
import { fmtDate, nowISO, today } from "@/lib/dates";
import { cls, folio, money, RES_STATUS_BADGE, RES_STATUS_LABEL, uid } from "@/lib/logic";
import type { Guest, Reservation } from "@/lib/types";

const TAGS = ["VIP", "Frecuente", "Empresa", "Luna de miel", "Familia", "Mascota", "Prensa", "Grupo"];
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
      switch (seg) {
        case "vip":
          return g.tags?.includes("VIP");
        case "frecuentes":
          return mm.stays >= 2 || g.tags?.includes("Frecuente");
        case "en_casa":
          return mm.inHouse;
        case "proximos":
          return !!mm.next;
        case "empresa":
          return !!g.company || g.tags?.includes("Empresa");
        case "cumple":
          return g.birthday?.slice(5, 7) === month;
        case "bloqueados":
          return g.blacklisted;
        default:
          return true;
      }
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

  async function save() {
    if (!edit?.name?.trim()) return toast("Escribí el nombre del huésped", "error");
    const g = { createdAt: nowISO(), ...edit, id: edit.id ?? uid("guest"), name: edit.name.trim() } as Guest;
    await actions.saveGuest(g);
    toast("Huésped guardado ✔");
    setSel(g.id);
    setEdit(null);
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <PageHeader
        title="Huéspedes"
        subtitle="Tus huéspedes: quiénes son, cuántas veces vinieron, qué les gusta y cómo contactarlos."
        actions={
          <Button variant="primary" onClick={() => setEdit({ tags: [] })}>
            <Plus size={15} /> Nuevo huésped
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Users} tone="blue" label="Huéspedes registrados" value={total} />
        <Stat icon={Repeat} tone="green" label="Los que vuelven" value={`${total ? Math.round((recurrentes / total) * 100) : 0}%`} sub={`${recurrentes} vinieron 2 veces o más`} />
        <Stat icon={Crown} tone="orange" label="Huéspedes VIP" value={vip} />
        <Stat icon={Cake} tone="purple" label="Cumplen años este mes" value={cumple} sub="ideal para un saludo por WhatsApp" />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_400px]">
        <Card>
          <div className="space-y-2 border-b border-gray-100 p-3">
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Buscar por nombre, teléfono o documento" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full sm:w-[320px]" />
              <label className="flex w-full items-center gap-2 text-[14px] text-gray-700 sm:w-auto">
                Ordenar:
                <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-[15px] sm:h-10 sm:flex-none">
                  <option value="reciente">Los más recientes primero</option>
                  {showMoney && <option value="valor">Los que más gastaron</option>}
                  <option value="estadias">Los que más vinieron</option>
                  <option value="nombre">Por nombre (A a Z)</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {segs.map((s) => (
                <button
                  key={s.k}
                  onClick={() => setSeg(s.k)}
                  className={cls("min-h-[40px] rounded-full px-4 py-2 text-[14px] font-medium transition-colors duration-150 motion-reduce:transition-none", seg === s.k ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="hidden md:block">
          <Table head={["Huésped", "Etiquetas", "Veces que vino", ...(showMoney ? ["Gastó en total"] : []), "Última visita o próxima"]}>
            {list.slice(0, 300).map((g) => {
              const m = metrics.get(g.id)!;
              return (
                <tr key={g.id} className={cls("cursor-pointer hover:bg-gray-50", sel === g.id && "bg-blue-50/60")} onClick={() => setSel(g.id)}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={g.name} size={36} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {g.name} {g.blacklisted && <Ban size={16} className="inline-block align-[-3px] text-red-600" aria-label="No aceptado" />} {m.inHouse && <Badge className="ml-1 bg-green-50 text-green-700">Alojado ahora</Badge>}
                        </div>
                        <div className="truncate text-[13.5px] text-gray-600">{g.company ?? g.phone ?? g.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {(g.tags ?? []).map((tg) => (
                        <Badge key={tg} className={tg === "VIP" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"}>
                          {tg}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {m.stays} <span className="text-[13.5px] text-gray-600">({m.nights} noches)</span>
                  </td>
                  {showMoney && <td className="px-4 py-2.5 tabular-nums">{money(m.spent)}</td>}
                  <td className="px-4 py-2.5 text-[14px] text-gray-700">{m.next ? <span className="text-blue-700">Llega el {fmtDate(m.next)}</span> : m.last ? fmtDate(m.last) : "—"}</td>
                </tr>
              );
            })}
          </Table>
          </div>
          <ul className="divide-y divide-gray-100 md:hidden">
            {list.slice(0, 300).map((g) => {
              const m = metrics.get(g.id)!;
              return (
                <li key={g.id}>
                  <button
                    onClick={() => setSel(g.id)}
                    className={cls("flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 active:bg-gray-100 motion-reduce:transition-none", sel === g.id && "bg-blue-50/60")}
                  >
                    <Avatar name={g.name} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[16px] font-semibold leading-snug">{g.name}</span>
                        {g.blacklisted && <Ban size={16} className="text-red-600" aria-label="No aceptado" />}
                        {m.inHouse && <Badge className="bg-green-50 text-green-700">Alojado ahora</Badge>}
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
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[14px] tabular-nums text-gray-700">
                        <span>
                          {m.stays} ({m.nights} noches)
                        </span>
                        {showMoney && <span>{money(m.spent)}</span>}
                        <span>{m.next ? <span className="text-blue-700">Llega el {fmtDate(m.next)}</span> : m.last ? fmtDate(m.last) : "—"}</span>
                      </div>
                    </div>
                    <ChevronRight size={20} className="shrink-0 text-gray-500" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          {list.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                <Users size={26} aria-hidden />
              </span>
              <p className="text-[15px] text-gray-600">No hay huéspedes en este grupo.</p>
            </div>
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
              <div className="mb-1 text-[14px] font-medium text-gray-700">Etiquetas (para reconocerlo rápido)</div>
              <div className="flex flex-wrap gap-1.5">
                {TAGS.map((tg) => {
                  const on = edit.tags?.includes(tg);
                  return (
                    <button
                      key={tg}
                      type="button"
                      onClick={() => setEdit({ ...edit, tags: on ? edit.tags!.filter((x) => x !== tg) : [...(edit.tags ?? []), tg] })}
                      className={cls("rounded-full px-4 py-1.5 text-[14px] font-medium ring-1", on ? "bg-gray-900 text-white ring-gray-900" : "bg-white text-gray-700 ring-gray-200")}
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
  metrics?: { stays: number; nights: number; spent: number; last?: string; next?: string };
}) {
  const { idx, can } = useApp();
  const g = id ? idx.guestById.get(id) : undefined;
  if (!g)
    return (
      <Card className="hidden xl:block">
        <div className="flex flex-col items-center gap-2 p-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-500">
            <Users size={26} aria-hidden />
          </span>
          <p className="text-[15px] text-gray-600">Tocá un huésped de la lista para ver sus datos.</p>
        </div>
      </Card>
    );
  const stays = (idx.resByGuest.get(g.id) ?? []).slice().sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  const contact: { icon: React.ElementType; label: string; value: string; wide?: boolean }[] = [
    { icon: Phone, label: "Teléfono", value: g.phone ?? "—" },
    { icon: CreditCard, label: "Documento", value: g.document ?? "—" },
    { icon: Mail, label: "Email", value: g.email ?? "—", wide: true },
    { icon: Building2, label: "Empresa", value: g.company ?? "—" },
    { icon: Cake, label: "Cumpleaños", value: g.birthday ? fmtDate(g.birthday).slice(0, 5) : "—" },
  ];
  return (
    <Card className="order-first xl:sticky xl:top-4 xl:order-none xl:self-start">
      <div className="flex items-start gap-4 border-b border-gray-100 p-5">
        <Avatar name={g.name} size={56} />
        <div className="min-w-0 flex-1">
          <div className="text-[19px] font-semibold leading-snug">{g.name}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(g.tags ?? []).map((tg) => (
              <Badge key={tg} className={tg === "VIP" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"}>
                {tg}
              </Badge>
            ))}
            {g.blacklisted && <Badge className="bg-red-700 text-white">No aceptado</Badge>}
          </div>
        </div>
        <Button size="sm" onClick={() => onEdit(g)}>
          Editar
        </Button>
      </div>
      <div className="space-y-5 p-5 text-[15px]">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-gray-50 px-1 py-3">
            <div className="text-[20px] font-semibold tabular-nums">{metrics?.stays ?? 0}</div>
            <div className="text-[14px] leading-tight text-gray-600">Veces que vino</div>
          </div>
          <div className="rounded-xl bg-gray-50 px-1 py-3">
            <div className="text-[20px] font-semibold tabular-nums">{metrics?.nights ?? 0}</div>
            <div className="text-[14px] leading-tight text-gray-600">Noches en total</div>
          </div>
          <div className="min-w-0 rounded-xl bg-gray-50 px-1 py-3">
            <div className="truncate text-[20px] font-semibold tabular-nums">{can("ver_montos") ? money(metrics?.spent ?? 0) : "—"}</div>
            <div className="text-[14px] leading-tight text-gray-600">Gastó en total</div>
          </div>
        </div>

        <section>
          <h4 className="mb-2.5 text-[15px] font-semibold text-gray-900">Datos de contacto</h4>
          <dl className="grid gap-3 sm:grid-cols-2">
            {contact.map((c) => (
              <div key={c.label} className={cls("flex items-start gap-3", c.wide && "sm:col-span-2")}>
                <c.icon size={18} className="mt-0.5 shrink-0 text-gray-500" aria-hidden />
                <div className="min-w-0">
                  <dt className="text-[14px] text-gray-600">{c.label}</dt>
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
          <h4 className="mb-2.5 text-[15px] font-semibold text-gray-900">Sus reservas</h4>
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
            {stays.map((r) => (
              <li key={r.id}>
                <Link href={`/reservas?r=${r.id}`} className="flex min-h-[52px] flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3.5 py-2.5 transition-colors duration-150 hover:bg-gray-50 motion-reduce:transition-none">
                  <span>
                    {fmtDate(r.checkIn)} → {fmtDate(r.checkOut).slice(0, 5)} · Habitación {idx.roomById.get(r.roomId)?.number}
                  </span>
                  <Badge className={RES_STATUS_BADGE[r.status]}>{RES_STATUS_LABEL[r.status]}</Badge>
                </Link>
              </li>
            ))}
            {!stays.length && <li className="px-3.5 py-3 text-gray-600">Todavía no tiene reservas</li>}
          </ul>
        </section>
      </div>
    </Card>
  );
}
