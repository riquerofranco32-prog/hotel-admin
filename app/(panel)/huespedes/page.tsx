"use client";
import Link from "next/link";
import { Suspense, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Cake, Crown, MessageCircle, Plus, Repeat, Users } from "lucide-react";
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
    { k: "en_casa", label: "En casa" },
    { k: "proximos", label: "Próximas llegadas" },
    { k: "vip", label: "VIP" },
    { k: "frecuentes", label: "Frecuentes" },
    { k: "empresa", label: "Empresas" },
    { k: "cumple", label: "Cumpleaños del mes" },
    { k: "bloqueados", label: "Bloqueados" },
  ];

  async function save() {
    if (!edit?.name?.trim()) return toast("Ingresá el nombre", "error");
    const g = { createdAt: nowISO(), ...edit, id: edit.id ?? uid("guest"), name: edit.name.trim() } as Guest;
    await actions.saveGuest(g);
    toast("Huésped guardado");
    setSel(g.id);
    setEdit(null);
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <PageHeader
        title="Huéspedes"
        subtitle="CRM: historial, valor, preferencias y segmentos para fidelizar"
        actions={
          <Button variant="primary" onClick={() => setEdit({ tags: [] })}>
            <Plus size={15} /> Nuevo huésped
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Users} tone="blue" label="Huéspedes" value={total} />
        <Stat icon={Repeat} tone="green" label="Recurrentes" value={`${total ? Math.round((recurrentes / total) * 100) : 0}%`} sub={`${recurrentes} con 2+ estadías`} />
        <Stat icon={Crown} tone="orange" label="VIP" value={vip} />
        <Stat icon={Cake} tone="purple" label="Cumplen años este mes" value={cumple} sub="ideal para un saludo por WhatsApp" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <Card>
          <div className="space-y-2 border-b border-gray-100 p-3">
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Buscar por nombre, teléfono, DNI, empresa…" value={query} onChange={(e) => setQuery(e.target.value)} className="w-[280px]" />
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-9 rounded-lg border border-gray-200 px-2 text-sm">
                <option value="reciente">Más recientes</option>
                {showMoney && <option value="valor">Mayor valor</option>}
                <option value="estadias">Más estadías</option>
                <option value="nombre">Nombre</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {segs.map((s) => (
                <button
                  key={s.k}
                  onClick={() => setSeg(s.k)}
                  className={cls("rounded-full px-3 py-1 text-xs font-medium", seg === s.k ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <Table head={["Huésped", "Etiquetas", "Estadías", ...(showMoney ? ["Valor"] : []), "Última / próxima"]}>
            {list.slice(0, 300).map((g) => {
              const m = metrics.get(g.id)!;
              return (
                <tr key={g.id} className={cls("cursor-pointer hover:bg-gray-50", sel === g.id && "bg-blue-50/60")} onClick={() => setSel(g.id)}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={g.name} size={30} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {g.name} {g.blacklisted && "⛔"} {m.inHouse && <Badge className="ml-1 bg-green-50 text-green-700">En casa</Badge>}
                        </div>
                        <div className="truncate text-xs text-gray-500">{g.company ?? g.phone ?? g.email}</div>
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
                    {m.stays} <span className="text-xs text-gray-400">({m.nights} n.)</span>
                  </td>
                  {showMoney && <td className="px-4 py-2.5 tabular-nums">{money(m.spent)}</td>}
                  <td className="px-4 py-2.5 text-xs text-gray-600">{m.next ? <span className="text-blue-700">Llega {fmtDate(m.next)}</span> : m.last ? fmtDate(m.last) : "—"}</td>
                </tr>
              );
            })}
          </Table>
          {list.length === 0 && <p className="p-8 text-center text-sm text-gray-500">No hay huéspedes en este segmento.</p>}
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
            <Button onClick={() => setEdit(null)}>Cancelar</Button>
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
            <Field label="Teléfono (con código país, para WhatsApp)">
              <Input value={edit.phone ?? ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} placeholder="5491155551234" />
            </Field>
            <Field label="Email">
              <Input value={edit.email ?? ""} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
            </Field>
            <Field label="DNI / Pasaporte / CUIT">
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
              <div className="mb-1 text-xs font-medium text-gray-600">Etiquetas</div>
              <div className="flex flex-wrap gap-1.5">
                {TAGS.map((tg) => {
                  const on = edit.tags?.includes(tg);
                  return (
                    <button
                      key={tg}
                      type="button"
                      onClick={() => setEdit({ ...edit, tags: on ? edit.tags!.filter((x) => x !== tg) : [...(edit.tags ?? []), tg] })}
                      className={cls("rounded-full px-3 py-1 text-xs font-medium ring-1", on ? "bg-gray-900 text-white ring-gray-900" : "bg-white text-gray-700 ring-gray-200")}
                    >
                      {tg}
                    </button>
                  );
                })}
              </div>
            </div>
            <Field label="Preferencias (se muestran al preparar la habitación)" className="sm:col-span-2">
              <Textarea rows={2} value={edit.preferences ?? ""} onChange={(e) => setEdit({ ...edit, preferences: e.target.value })} placeholder="Piso alto, almohada extra, sin gluten…" />
            </Field>
            <Field label="Notas internas" className="sm:col-span-2">
              <Textarea rows={2} value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-red-700 sm:col-span-2">
              <input type="checkbox" checked={!!edit.blacklisted} onChange={(e) => setEdit({ ...edit, blacklisted: e.target.checked })} /> Bloqueado (no aceptar nuevas reservas)
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
      <Card>
        <p className="p-10 text-center text-sm text-gray-500">Elegí un huésped para ver su ficha.</p>
      </Card>
    );
  const stays = (idx.resByGuest.get(g.id) ?? []).slice().sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  return (
    <Card className="xl:sticky xl:top-4 xl:self-start">
      <div className="flex items-center gap-3 border-b border-gray-100 p-4">
        <Avatar name={g.name} size={48} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{g.name}</div>
          <div className="flex flex-wrap gap-1">
            {(g.tags ?? []).map((tg) => (
              <Badge key={tg} className={tg === "VIP" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"}>
                {tg}
              </Badge>
            ))}
            {g.blacklisted && <Badge className="bg-red-600 text-white">Bloqueado</Badge>}
          </div>
        </div>
        <Button size="sm" onClick={() => onEdit(g)}>
          Editar
        </Button>
      </div>
      <div className="space-y-4 p-4 text-sm">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-gray-50 p-2">
            <div className="text-lg font-semibold">{metrics?.stays ?? 0}</div>
            <div className="text-[11px] text-gray-500">Estadías</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-2">
            <div className="text-lg font-semibold">{metrics?.nights ?? 0}</div>
            <div className="text-[11px] text-gray-500">Noches</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-2">
            <div className="truncate text-lg font-semibold">{can("ver_montos") ? money(metrics?.spent ?? 0) : "—"}</div>
            <div className="text-[11px] text-gray-500">Valor total</div>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2">
          <div>
            <dt className="text-xs text-gray-500">Teléfono</dt>
            <dd>{g.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Documento</dt>
            <dd>{g.document ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-gray-500">Email</dt>
            <dd className="truncate">{g.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Empresa</dt>
            <dd>{g.company ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Cumpleaños</dt>
            <dd>{g.birthday ? fmtDate(g.birthday).slice(0, 5) : "—"}</dd>
          </div>
        </dl>
        {g.preferences && <p className="rounded-md bg-blue-50 px-3 py-2 text-blue-900">⭐ {g.preferences}</p>}
        {g.notes && <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">📝 {g.notes}</p>}
        <div className="flex gap-2">
          {can("editar_reservas") && !g.blacklisted && (
            <Button size="sm" variant="primary" onClick={() => onNewRes(g)}>
              <Plus size={14} /> Reservar
            </Button>
          )}
          {g.phone && can("whatsapp") && (
            <a href={`https://wa.me/${g.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
              <Button size="sm">
                <MessageCircle size={14} /> WhatsApp
              </Button>
            </a>
          )}
        </div>
        <div>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Historial</h4>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {stays.map((r) => (
              <li key={r.id}>
                <Link href={`/reservas?r=${r.id}`} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-gray-50">
                  <span>
                    {fmtDate(r.checkIn)} → {fmtDate(r.checkOut).slice(0, 5)} · Hab. {idx.roomById.get(r.roomId)?.number}
                  </span>
                  <Badge className={RES_STATUS_BADGE[r.status]}>{RES_STATUS_LABEL[r.status]}</Badge>
                </Link>
              </li>
            ))}
            {!stays.length && <li className="px-3 py-3 text-gray-500">Sin estadías</li>}
          </ul>
        </div>
      </div>
    </Card>
  );
}
