"use client";
import { useState } from "react";
import { Database, Plus } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Table, Tabs, toast } from "@/components/ui";
import { fmtDateTime, nowISO } from "@/lib/dates";
import { cls, money, ROLE_LABEL, ROLE_SECTIONS, roomState, ROOM_STATE_CLASS, ROOM_STATE_LABEL, uid, type Section } from "@/lib/logic";
import { DEFAULT_SETTINGS } from "@/lib/seed";
import type { Role, Room, RoomType, Settings, Staff } from "@/lib/types";

const SECTION_LABEL: Record<Section, string> = {
  dashboard: "Dashboard",
  reservas: "Reservas",
  recepcion: "Recepción",
  facturacion: "Facturación",
  menus: "Menús",
  mantenimiento: "Mantenimiento",
  whatsapp: "WhatsApp",
  administradores: "Administradores",
};

export default function AdminPage() {
  const [tab, setTab] = useState<"usuarios" | "habitaciones" | "config" | "auditoria" | "datos">("usuarios");
  return (
    <div className="p-4 lg:p-6">
      <PageHeader title="Administradores" subtitle="Usuarios y permisos, habitaciones, configuración del hotel y auditoría" />
      <div className="mb-4 overflow-x-auto">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "usuarios", label: "Usuarios y roles" },
            { value: "habitaciones", label: "Habitaciones" },
            { value: "config", label: "Configuración" },
            { value: "auditoria", label: "Auditoría" },
            { value: "datos", label: "Base de datos" },
          ]}
        />
      </div>
      {tab === "usuarios" && <Users />}
      {tab === "habitaciones" && <Rooms />}
      {tab === "config" && <Config />}
      {tab === "auditoria" && <Audit />}
      {tab === "datos" && <DataTab />}
    </div>
  );
}

function Users() {
  const { data, actions, mode, me } = useApp();
  const [edit, setEdit] = useState<Partial<Staff> | null>(null);

  async function save() {
    if (!edit?.name?.trim() || !edit.email?.trim()) return toast("Completá nombre y email", "error");
    const email = edit.email.trim().toLowerCase();
    if (!edit.id && data.staff.some((s) => s.email.toLowerCase() === email)) return toast("Ya existe un usuario con ese email", "error");
    // En Firebase el ID del documento es el email (lo usan las reglas de seguridad)
    const id = edit.id ?? (mode === "firebase" ? email : uid("st"));
    await actions.saveStaff({ role: "recepcion", active: true, createdAt: nowISO(), ...edit, id, email, name: edit.name.trim() } as Staff);
    toast("Usuario guardado");
    setEdit(null);
  }

  const load = (id: string) => data.tasks.filter((t) => t.assignedTo === id && t.status !== "completada").length;
  const done = (id: string) => data.tasks.filter((t) => t.completedBy === id).length;

  return (
    <div className="space-y-4">
      <Card
        title={`Personal (${data.staff.length})`}
        actions={
          <Button size="sm" variant="primary" onClick={() => setEdit({ role: "limpieza", active: true })}>
            <Plus size={14} /> Nuevo usuario
          </Button>
        }
      >
        <Table head={["Nombre", "Email", "Teléfono", "Rol", "Tareas abiertas", "Tareas hechas", "Estado", ""]}>
          {data.staff
            .slice()
            .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name))
            .map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2.5 font-medium">{s.name} {s.id === me?.id && <span className="text-xs text-gray-400">(vos)</span>}</td>
                <td className="px-4 py-2.5 text-gray-600">{s.email}</td>
                <td className="px-4 py-2.5">{s.phone ?? "—"}</td>
                <td className="px-4 py-2.5"><Badge className="bg-gray-100 text-gray-700">{ROLE_LABEL[s.role]}</Badge></td>
                <td className="px-4 py-2.5 tabular-nums">{load(s.id)}</td>
                <td className="px-4 py-2.5 tabular-nums">{done(s.id)}</td>
                <td className="px-4 py-2.5">{s.active ? <Badge className="bg-green-50 text-green-700">Activo</Badge> : <Badge className="bg-gray-100 text-gray-500">Inactivo</Badge>}</td>
                <td className="px-4 py-2.5 text-right"><Button size="sm" variant="ghost" onClick={() => setEdit(s)}>Editar</Button></td>
              </tr>
            ))}
        </Table>
        {mode === "firebase" && (
          <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
            Para dar acceso: creá el usuario acá con su email y pedile que entre a la app y elija “Crear cuenta” con ese mismo email.
          </p>
        )}
      </Card>

      <Card title="Permisos por rol">
        <Table head={["Sección", ...(Object.keys(ROLE_LABEL) as Role[]).map((r) => ROLE_LABEL[r])]}>
          {(Object.keys(SECTION_LABEL) as Section[]).map((sec) => (
            <tr key={sec}>
              <td className="px-4 py-2 font-medium">{SECTION_LABEL[sec]}</td>
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <td key={r} className="px-4 py-2 text-center">{ROLE_SECTIONS[r].includes(sec) ? "✅" : "—"}</td>
              ))}
            </tr>
          ))}
        </Table>
      </Card>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? "Editar usuario" : "Nuevo usuario"}
        footer={
          <>
            {edit?.id && edit.id !== me?.id && (
              <Button variant="ghost" className="mr-auto text-red-600" onClick={() => { if (confirm("¿Eliminar usuario? Su historial de tareas se conserva.")) { actions.deleteStaff(edit as Staff); setEdit(null); } }}>
                Eliminar
              </Button>
            )}
            <Button onClick={() => setEdit(null)}>Cancelar</Button>
            <Button variant="primary" onClick={save}>Guardar</Button>
          </>
        }
      >
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre y apellido" className="sm:col-span-2"><Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Email (con el que inicia sesión)"><Input type="email" value={edit.email ?? ""} disabled={!!edit.id && mode === "firebase"} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Teléfono WhatsApp (ej 5491155551234)"><Input value={edit.phone ?? ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label="Rol">
              <Select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })} disabled={edit.id === me?.id}>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </Select>
            </Field>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" checked={edit.active ?? true} disabled={edit.id === me?.id} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Activo
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Rooms() {
  const { data, actions } = useApp();
  const [edit, setEdit] = useState<Partial<Room> | null>(null);
  const cur = data.settings[0]?.currency ?? "$";
  const TYPES: RoomType[] = ["Simple", "Doble", "Triple", "Suite", "Familiar"];

  async function save() {
    if (!edit?.number?.trim()) return toast("Ingresá el número", "error");
    const number = edit.number.trim();
    if (data.rooms.some((r) => r.number === number && r.id !== edit.id)) return toast("Ya existe esa habitación", "error");
    await actions.saveRoom({
      type: "Doble",
      capacity: 2,
      rate: 60000,
      ...edit,
      id: edit.id ?? `room_${number}`,
      number,
      floor: Number(edit.floor) || Math.floor(Number(number) / 100) * 100,
    } as Room);
    toast("Habitación guardada");
    setEdit(null);
  }

  return (
    <Card title={`Habitaciones (${data.rooms.length})`} actions={<Button size="sm" variant="primary" onClick={() => setEdit({ type: "Doble", capacity: 2 })}><Plus size={14} /> Nueva</Button>}>
      <Table head={["Hab.", "Piso", "Tipo", "Capacidad", "Tarifa", "Estado", ""]}>
        {data.rooms
          .slice()
          .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
          .map((r) => {
            const st = roomState(r, data);
            return (
              <tr key={r.id}>
                <td className="px-4 py-2 font-semibold">{r.number}</td>
                <td className="px-4 py-2">{r.floor}</td>
                <td className="px-4 py-2">{r.type}</td>
                <td className="px-4 py-2">{r.capacity}</td>
                <td className="px-4 py-2 tabular-nums">{money(r.rate, cur)}</td>
                <td className="px-4 py-2"><Badge className={ROOM_STATE_CLASS[st]}>{ROOM_STATE_LABEL[st]}</Badge></td>
                <td className="px-4 py-2 text-right"><Button size="sm" variant="ghost" onClick={() => setEdit(r)}>Editar</Button></td>
              </tr>
            );
          })}
      </Table>
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? `Habitación ${edit.number}` : "Nueva habitación"}
        footer={
          <>
            {edit?.id && (
              <Button variant="ghost" className="mr-auto text-red-600" onClick={() => {
                if (data.reservations.some((r) => r.roomId === edit.id && r.status !== "cancelada")) return toast("Tiene reservas: marcala fuera de servicio en lugar de eliminarla", "error");
                if (confirm("¿Eliminar habitación?")) { actions.deleteRoom(edit as Room); setEdit(null); }
              }}>Eliminar</Button>
            )}
            <Button onClick={() => setEdit(null)}>Cancelar</Button>
            <Button variant="primary" onClick={save}>Guardar</Button>
          </>
        }
      >
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Número"><Input value={edit.number ?? ""} disabled={!!edit.id} onChange={(e) => setEdit({ ...edit, number: e.target.value })} /></Field>
            <Field label="Piso"><Input type="number" value={edit.floor ?? ""} onChange={(e) => setEdit({ ...edit, floor: Number(e.target.value) })} placeholder="100" /></Field>
            <Field label="Tipo">
              <Select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as RoomType })}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Capacidad"><Input type="number" value={edit.capacity ?? ""} onChange={(e) => setEdit({ ...edit, capacity: Number(e.target.value) })} /></Field>
            <Field label="Tarifa por noche"><Input type="number" value={edit.rate ?? ""} onChange={(e) => setEdit({ ...edit, rate: Number(e.target.value) })} /></Field>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" checked={!!edit.outOfService} onChange={(e) => setEdit({ ...edit, outOfService: e.target.checked })} /> Fuera de servicio
            </label>
            <Field label="Notas" className="sm:col-span-2"><Input value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </Card>
  );
}

function Config() {
  const { data, actions } = useApp();
  const [s, setS] = useState<Settings>(data.settings[0] ?? DEFAULT_SETTINGS);
  return (
    <Card title="Configuración del hotel">
      <div className="grid max-w-2xl gap-4 p-4 sm:grid-cols-2">
        <Field label="Nombre del hotel" className="sm:col-span-2"><Input value={s.hotelName} onChange={(e) => setS({ ...s, hotelName: e.target.value })} /></Field>
        <Field label="Moneda (símbolo)"><Input value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value })} /></Field>
        <Field label="IVA incluido en precios (%)"><Input type="number" value={s.taxRate} onChange={(e) => setS({ ...s, taxRate: Number(e.target.value) })} /></Field>
        <Field label="Hora de check-in"><Input type="time" value={s.checkInTime} onChange={(e) => setS({ ...s, checkInTime: e.target.value })} /></Field>
        <Field label="Hora de check-out"><Input type="time" value={s.checkOutTime} onChange={(e) => setS({ ...s, checkOutTime: e.target.value })} /></Field>
        <Field label="Próximo N° de factura"><Input type="number" value={s.invoiceSeq} onChange={(e) => setS({ ...s, invoiceSeq: Number(e.target.value) })} /></Field>
        <div className="sm:col-span-2">
          <Button variant="primary" onClick={() => actions.saveSettings(s).then(() => toast("Configuración guardada"))}>Guardar</Button>
        </div>
      </div>
    </Card>
  );
}

function Audit() {
  const { data, staffName } = useApp();
  const [who, setWho] = useState("");
  const [q, setQ] = useState("");
  const list = data.activity
    .filter((a) => !who || a.by === who)
    .filter((a) => !q || `${a.action} ${a.detail ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 300);
  return (
    <Card
      title="Registro de actividad"
      actions={
        <>
          <Input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} className="w-[180px]" />
          <Select value={who} onChange={(e) => setWho(e.target.value)} className="w-[180px]">
            <option value="">Todos</option>
            <option value="sistema">Sistema</option>
            {data.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </>
      }
    >
      <Table head={["Fecha", "Usuario", "Acción", "Detalle"]}>
        {list.map((a) => (
          <tr key={a.id}>
            <td className="whitespace-nowrap px-4 py-2 text-gray-500">{fmtDateTime(a.at)}</td>
            <td className="px-4 py-2 font-medium">{staffName(a.by)}</td>
            <td className="px-4 py-2">{a.action}</td>
            <td className="px-4 py-2 text-gray-600">{a.detail}</td>
          </tr>
        ))}
      </Table>
      {list.length === 0 && <p className="p-8 text-center text-sm text-gray-500">Sin actividad registrada.</p>}
    </Card>
  );
}

function DataTab() {
  const { data, actions, mode } = useApp();
  const [busy, setBusy] = useState(false);
  const counts: [string, number][] = [
    ["Habitaciones", data.rooms.length],
    ["Huéspedes", data.guests.length],
    ["Reservas", data.reservations.length],
    ["Tareas", data.tasks.length],
    ["Cargos", data.charges.length],
    ["Pagos", data.payments.length],
    ["Facturas", data.invoices.length],
    ["Pedidos", data.orders.length],
    ["Mensajes", data.messages.length],
    ["Actividad", data.activity.length],
  ];
  async function run(fn: () => Promise<void>, msg: string) {
    setBusy(true);
    try {
      await fn();
      toast(msg);
    } catch (e) {
      toast("Error: " + (e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={<span className="flex items-center gap-2"><Database size={15} /> Conexión</span>}>
        <div className="space-y-3 p-4 text-sm">
          <div>
            Modo actual:{" "}
            <Badge className={cls(mode === "firebase" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700")}>
              {mode === "firebase" ? `Firebase Firestore · ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}` : "Demo (localStorage del navegador)"}
            </Badge>
          </div>
          {mode === "demo" && (
            <p className="text-gray-600">
              Para usar Firebase, cargá las variables <code className="rounded bg-gray-100 px-1">NEXT_PUBLIC_FIREBASE_*</code> en Vercel (o en{" "}
              <code className="rounded bg-gray-100 px-1">.env.local</code>) y volvé a desplegar. Ver README.
            </p>
          )}
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
            {counts.map(([k, v]) => (
              <li key={k} className="flex justify-between border-b border-gray-100 py-1"><span className="text-gray-600">{k}</span><b className="tabular-nums">{v}</b></li>
            ))}
          </ul>
        </div>
      </Card>
      <Card title="Acciones">
        <div className="space-y-3 p-4 text-sm">
          <div>
            <Button disabled={busy} onClick={() => confirm("Esto REEMPLAZA todos los datos (salvo usuarios) por datos de demostración. ¿Continuar?") && run(() => actions.loadDemoData(true), "Datos de demostración cargados")}>
              Cargar datos de demostración
            </Button>
            <p className="mt-1 text-xs text-gray-500">Crea 39 habitaciones, huéspedes, reservas, tareas, menú y plantillas. Útil para probar.</p>
          </div>
          <div>
            <Button variant="danger" disabled={busy} onClick={() => prompt('Escribí "BORRAR" para eliminar todos los datos operativos (se conservan los usuarios)') === "BORRAR" && run(() => actions.wipeAll(true), "Datos eliminados")}>
              Empezar de cero
            </Button>
            <p className="mt-1 text-xs text-gray-500">Borra habitaciones, reservas, tareas, etc. Después cargá tus habitaciones reales en la pestaña Habitaciones.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
