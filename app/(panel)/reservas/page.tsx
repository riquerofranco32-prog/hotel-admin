"use client";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { ReservationDrawer, ReservationForm } from "@/components/reservation";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Table, Tabs, toast } from "@/components/ui";
import { addDays, fmtDate, nowISO, today } from "@/lib/dates";
import { folio, money, nights, RES_STATUS_BADGE, RES_STATUS_LABEL, uid } from "@/lib/logic";
import type { Guest, Reservation, ReservationStatus } from "@/lib/types";

export default function ReservasPage() {
  const { data } = useApp();
  const [tab, setTab] = useState<"reservas" | "huespedes">("reservas");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ReservationStatus | "activas" | "">("activas");
  const [from, setFrom] = useState(addDays(today(), -7));
  const [to, setTo] = useState(addDays(today(), 60));
  const [source, setSource] = useState("");
  const [openRes, setOpenRes] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; initial?: Partial<Reservation> }>({ open: false });
  const [page, setPage] = useState(0);
  const PAGE = 50;

  const room = (id: string) => data.rooms.find((r) => r.id === id)?.number ?? "?";

  const list = useMemo(
    () =>
      data.reservations
        .filter((r) => (status === "activas" ? r.status !== "cancelada" && r.status !== "no_show" : !status || r.status === status))
        .filter((r) => (!from || r.checkOut >= from) && (!to || r.checkIn <= to))
        .filter((r) => !source || r.source === source)
        .filter((r) => !q || r.guestName.toLowerCase().includes(q.toLowerCase()) || room(r.roomId).includes(q) || r.id.includes(q))
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn) || room(a.roomId).localeCompare(room(b.roomId), undefined, { numeric: true })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.reservations, status, from, to, source, q],
  );

  const totals = list.reduce(
    (acc, r) => {
      const f = folio(r, data);
      acc.total += f.total;
      acc.balance += Math.max(0, f.balance);
      acc.nights += nights(r);
      return acc;
    },
    { total: 0, balance: 0, nights: 0 },
  );

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Reservas"
        subtitle={`${list.length} reservas · ${totals.nights} noches · Facturación ${money(totals.total)} · Saldo pendiente ${money(totals.balance)}`}
        actions={
          <Button variant="primary" onClick={() => setForm({ open: true, initial: {} })}>
            <Plus size={15} /> Nueva reserva
          </Button>
        }
      />
      <div className="mb-4">
        <Tabs value={tab} onChange={setTab} items={[{ value: "reservas", label: "Reservas" }, { value: "huespedes", label: `Huéspedes (${data.guests.length})` }]} />
      </div>

      {tab === "reservas" ? (
        <Card>
          <div className="flex flex-wrap gap-2 border-b border-gray-100 p-3">
            <Input placeholder="Huésped, habitación o N°" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} className="w-[220px]" />
            <Select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(0); }} className="w-[180px]">
              <option value="activas">Activas</option>
              <option value="">Todas</option>
              {(Object.keys(RES_STATUS_LABEL) as ReservationStatus[]).map((s) => (
                <option key={s} value={s}>
                  {RES_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" title="Desde" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" title="Hasta" />
            <Select value={source} onChange={(e) => setSource(e.target.value)} className="w-[140px]">
              <option value="">Todos los canales</option>
              {["Directo", "Booking", "Expedia", "Airbnb", "Teléfono", "WhatsApp", "Walk-in"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </div>
          <Table head={["Huésped", "Hab.", "Entrada", "Salida", "Noches", "Pax", "Canal", "Estado", "Total", "Saldo"]}>
            {list.slice(page * PAGE, (page + 1) * PAGE).map((r) => {
              const f = folio(r, data);
              return (
                <tr key={r.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setOpenRes(r.id)}>
                  <td className="px-4 py-2.5 font-medium">{r.guestName}</td>
                  <td className="px-4 py-2.5">{room(r.roomId)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{fmtDate(r.checkIn)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{fmtDate(r.checkOut)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{nights(r)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{r.pax}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.source}</td>
                  <td className="px-4 py-2.5">
                    <Badge className={RES_STATUS_BADGE[r.status]}>{RES_STATUS_LABEL[r.status]}</Badge>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{money(f.total)}</td>
                  <td className={`px-4 py-2.5 tabular-nums ${f.balance > 0 ? "text-red-600" : "text-green-700"}`}>{money(f.balance)}</td>
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
      ) : (
        <Guests onOpenRes={setOpenRes} />
      )}

      <ReservationDrawer id={openRes} onClose={() => setOpenRes(null)} onEdit={(r) => { setOpenRes(null); setForm({ open: true, initial: r }); }} />
      <ReservationForm open={form.open} initial={form.initial} onClose={() => setForm({ open: false })} />
    </div>
  );
}

function Guests({ onOpenRes }: { onOpenRes: (id: string) => void }) {
  const { data, actions } = useApp();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Partial<Guest> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const list = data.guests
    .filter((g) => !q || [g.name, g.email, g.phone, g.document].some((x) => x?.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => a.name.localeCompare(b.name));
  const stays = (id: string) => data.reservations.filter((r) => r.guestId === id && r.status !== "cancelada");
  const sel = data.guests.find((g) => g.id === selected);

  async function save() {
    if (!edit?.name?.trim()) return toast("Ingresá el nombre", "error");
    await actions.saveGuest({ createdAt: nowISO(), ...edit, id: edit.id ?? uid("guest"), name: edit.name.trim() } as Guest);
    toast("Huésped guardado");
    setEdit(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <Card
        title="Huéspedes"
        actions={
          <>
            <Input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} className="w-[200px]" />
            <Button size="sm" variant="primary" onClick={() => setEdit({})}>
              <Plus size={14} /> Nuevo
            </Button>
          </>
        }
      >
        <Table head={["Nombre", "Teléfono", "Email", "Documento", "Estadías"]}>
          {list.map((g) => (
            <tr key={g.id} className={`cursor-pointer hover:bg-gray-50 ${selected === g.id ? "bg-blue-50" : ""}`} onClick={() => setSelected(g.id)}>
              <td className="px-4 py-2.5 font-medium">{g.name}</td>
              <td className="px-4 py-2.5">{g.phone ?? "—"}</td>
              <td className="px-4 py-2.5 text-gray-600">{g.email ?? "—"}</td>
              <td className="px-4 py-2.5">{g.document ?? "—"}</td>
              <td className="px-4 py-2.5 tabular-nums">{stays(g.id).length}</td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card title={sel ? sel.name : "Ficha del huésped"} actions={sel && <Button size="sm" onClick={() => setEdit(sel)}>Editar</Button>}>
        {sel ? (
          <div className="space-y-3 p-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-gray-500">Tel:</span> {sel.phone ?? "—"}</div>
              <div><span className="text-gray-500">Doc:</span> {sel.document ?? "—"}</div>
              <div className="col-span-2"><span className="text-gray-500">Email:</span> {sel.email ?? "—"}</div>
              <div><span className="text-gray-500">Nacionalidad:</span> {sel.nationality ?? "—"}</div>
            </div>
            {sel.notes && <p className="rounded bg-amber-50 p-2">{sel.notes}</p>}
            <h4 className="pt-2 text-xs font-semibold uppercase text-gray-500">Historial de estadías</h4>
            <ul className="divide-y divide-gray-100 rounded border border-gray-200">
              {stays(sel.id)
                .sort((a, b) => b.checkIn.localeCompare(a.checkIn))
                .map((r) => (
                  <li key={r.id}>
                    <button className="flex w-full justify-between px-3 py-2 text-left hover:bg-gray-50" onClick={() => onOpenRes(r.id)}>
                      <span>
                        {fmtDate(r.checkIn)} → {fmtDate(r.checkOut)} · Hab. {data.rooms.find((x) => x.id === r.roomId)?.number}
                      </span>
                      <Badge className={RES_STATUS_BADGE[r.status]}>{RES_STATUS_LABEL[r.status]}</Badge>
                    </button>
                  </li>
                ))}
            </ul>
            <div className="text-gray-600">
              Total facturado: <b>{money(stays(sel.id).reduce((s, r) => s + folio(r, data).total, 0))}</b>
            </div>
          </div>
        ) : (
          <p className="p-6 text-sm text-gray-500">Elegí un huésped para ver su historial.</p>
        )}
      </Card>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? "Editar huésped" : "Nuevo huésped"}
        footer={
          <>
            <Button onClick={() => setEdit(null)}>Cancelar</Button>
            <Button variant="primary" onClick={save}>Guardar</Button>
          </>
        }
      >
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre y apellido" className="sm:col-span-2"><Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Teléfono (con código país, para WhatsApp)"><Input value={edit.phone ?? ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label="Email"><Input value={edit.email ?? ""} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Documento"><Input value={edit.document ?? ""} onChange={(e) => setEdit({ ...edit, document: e.target.value })} /></Field>
            <Field label="Nacionalidad"><Input value={edit.nationality ?? ""} onChange={(e) => setEdit({ ...edit, nationality: e.target.value })} /></Field>
            <Field label="Notas" className="sm:col-span-2"><Input value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
