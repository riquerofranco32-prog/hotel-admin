"use client";
import { Fragment, useState } from "react";
import { Database, Plus, RotateCcw } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Avatar, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Table, Tabs, toast } from "@/components/ui";
import { fmtDateTime, fmtTimeAgo, nowISO } from "@/lib/dates";
import {
  ALL_ROLES,
  cls,
  DEFAULT_PERMISSIONS,
  money,
  PERM_CEILING,
  PERM_INFO,
  permsFor,
  ROLE_COLOR,
  ROLE_LABEL,
  roomState,
  ROOM_STATE_CLASS,
  ROOM_STATE_LABEL,
  uid,
} from "@/lib/logic";
import { DEFAULT_SETTINGS } from "@/lib/seed";
import type { Perm, Role, Room, RoomType, Settings, Staff } from "@/lib/types";

export default function AdminPage() {
  const [tab, setTab] = useState<"usuarios" | "permisos" | "habitaciones" | "config" | "auditoria" | "datos">("usuarios");
  return (
    <div className="space-y-4 p-4 lg:p-6">
      <PageHeader title="Administradores" subtitle="Personal y cargos, permisos por rol, habitaciones, configuración y auditoría" />
      <div className="overflow-x-auto">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "usuarios", label: "Personal" },
            { value: "permisos", label: "Permisos por cargo" },
            { value: "habitaciones", label: "Habitaciones" },
            { value: "config", label: "Configuración" },
            { value: "auditoria", label: "Auditoría" },
            { value: "datos", label: "Base de datos" },
          ]}
        />
      </div>
      {tab === "usuarios" && <Users />}
      {tab === "permisos" && <Permissions />}
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
  const [roleFilter, setRoleFilter] = useState<Role | "">("");

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

  const open = new Map<string, number>();
  const done = new Map<string, number>();
  for (const t of data.tasks) {
    if (t.assignedTo && t.status !== "completada") open.set(t.assignedTo, (open.get(t.assignedTo) ?? 0) + 1);
    if (t.completedBy) done.set(t.completedBy, (done.get(t.completedBy) ?? 0) + 1);
  }
  const isOnline = (s: Staff) => !!s.lastSeen && Date.now() - new Date(s.lastSeen).getTime() < 4 * 60_000;
  const list = data.staff
    .filter((s) => !roleFilter || s.role === roleFilter)
    .slice()
    .sort((a, b) => ALL_ROLES.indexOf(a.role) - ALL_ROLES.indexOf(b.role) || a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {ALL_ROLES.map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(roleFilter === r ? "" : r)}
            className={cls("rounded-xl border bg-white px-4 py-3 text-left transition", roleFilter === r ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-200 hover:border-gray-300")}
          >
            <div className="text-xs text-gray-500">{ROLE_LABEL[r]}</div>
            <div className="text-xl font-semibold">{data.staff.filter((s) => s.role === r && s.active).length}</div>
          </button>
        ))}
      </div>
      <Card
        title={`Personal (${list.length})`}
        actions={
          <Button size="sm" variant="primary" onClick={() => setEdit({ role: "mucama", active: true })}>
            <Plus size={14} /> Nuevo usuario
          </Button>
        }
      >
        <Table head={["Persona", "Cargo", "Teléfono", "Tareas abiertas", "Tareas hechas", "Conexión", "Estado", ""]}>
          {list.map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="relative">
                    <Avatar name={s.name} size={30} />
                    {isOnline(s) && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500" />}
                  </span>
                  <div>
                    <div className="font-medium">
                      {s.name} {s.id === me?.id && <span className="text-xs text-gray-400">(vos)</span>}
                    </div>
                    <div className="text-xs text-gray-500">{s.email}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-2.5">
                <Badge className={ROLE_COLOR[s.role]}>{ROLE_LABEL[s.role]}</Badge>
              </td>
              <td className="px-4 py-2.5">{s.phone ?? "—"}</td>
              <td className="px-4 py-2.5 tabular-nums">{open.get(s.id) ?? 0}</td>
              <td className="px-4 py-2.5 tabular-nums">{done.get(s.id) ?? 0}</td>
              <td className="px-4 py-2.5 text-xs text-gray-500">{isOnline(s) ? <span className="font-medium text-green-600">En línea</span> : s.lastSeen ? fmtTimeAgo(s.lastSeen) : "Nunca"}</td>
              <td className="px-4 py-2.5">{s.active ? <Badge className="bg-green-50 text-green-700">Activo</Badge> : <Badge className="bg-gray-100 text-gray-500">Inactivo</Badge>}</td>
              <td className="px-4 py-2.5 text-right">
                <Button size="sm" variant="ghost" onClick={() => setEdit(s)}>
                  Editar
                </Button>
              </td>
            </tr>
          ))}
        </Table>
        {mode === "firebase" && (
          <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
            Para dar acceso: creá el usuario acá con su email y pedile que entre a la app y elija “Crear cuenta” con ese mismo email.
          </p>
        )}
      </Card>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? "Editar usuario" : "Nuevo usuario"}
        footer={
          <>
            {edit?.id && edit.id !== me?.id && (
              <Button
                variant="ghost"
                className="mr-auto text-red-600"
                onClick={() => {
                  if (confirm("¿Eliminar usuario? Su historial de tareas se conserva.")) {
                    actions.deleteStaff(edit as Staff);
                    setEdit(null);
                  }
                }}
              >
                Eliminar
              </Button>
            )}
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
            <Field label="Email (con el que inicia sesión)">
              <Input type="email" value={edit.email ?? ""} disabled={!!edit.id && mode === "firebase"} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
            </Field>
            <Field label="Teléfono WhatsApp (ej 5491155551234)">
              <Input value={edit.phone ?? ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
            </Field>
            <Field label="Cargo" hint={edit.role ? `Accede a: ${permsFor(edit.role as Role, data.settings[0]).filter((p) => PERM_INFO[p].group === "Secciones").map((p) => PERM_INFO[p].label).join(", ")}` : undefined}>
              <Select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })} disabled={edit.id === me?.id}>
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
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

function Permissions() {
  const { data, actions } = useApp();
  const settings = data.settings[0] ?? DEFAULT_SETTINGS;
  const roles = ALL_ROLES.filter((r) => r !== "admin");
  const perms = Object.keys(PERM_INFO) as Perm[];

  async function toggle(role: Role, p: Perm) {
    const cur = permsFor(role, settings);
    const next = cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p];
    await actions.saveSettings({ ...settings, permissions: { ...(settings.permissions ?? {}), [role]: next } });
  }
  async function reset(role: Role) {
    const rest = { ...(settings.permissions ?? {}) };
    delete rest[role];
    await actions.saveSettings({ ...settings, permissions: rest });
    toast(`Permisos de ${ROLE_LABEL[role]} restablecidos`);
  }

  return (
    <Card title="Qué puede ver y hacer cada cargo">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
              <th className="px-4 py-2.5 text-left font-medium">Permiso</th>
              <th className="px-3 py-2.5 text-center font-medium">{ROLE_LABEL.admin}</th>
              {roles.map((r) => (
                <th key={r} className="px-3 py-2.5 text-center font-medium">
                  <div>{ROLE_LABEL[r]}</div>
                  {settings.permissions?.[r] && (
                    <button onClick={() => reset(r)} className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-normal text-blue-600 hover:underline">
                      <RotateCcw size={10} /> restablecer
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(["Secciones", "Capacidades"] as const).map((g) => (
              <Fragment key={g}>
                <tr className="bg-gray-50/60">
                  <td colSpan={roles.length + 2} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    {g}
                  </td>
                </tr>
                {perms
                  .filter((p) => PERM_INFO[p].group === g)
                  .map((p) => (
                    <tr key={p}>
                      <td className="px-4 py-2">{PERM_INFO[p].label}</td>
                      <td className="px-3 py-2 text-center text-gray-400">✓</td>
                      {roles.map((r) => {
                        const allowed = PERM_CEILING[r].includes(p);
                        const on = permsFor(r, settings).includes(p);
                        const changed = on !== DEFAULT_PERMISSIONS[r].includes(p);
                        return (
                          <td key={r} className="px-3 py-2 text-center">
                            {allowed ? (
                              <input type="checkbox" checked={on} onChange={() => toggle(r, p)} className={cls("h-4 w-4 cursor-pointer", changed && "accent-amber-500")} />
                            ) : (
                              <span className="text-gray-300" title="Bloqueado por seguridad de datos">
                                —
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
        Los cambios se aplican al instante para todo el personal. “—” = bloqueado por las reglas de seguridad de la base de datos (por ejemplo, las mucamas
        nunca pueden leer pagos ni facturas). Las casillas en ámbar difieren del valor por defecto.
      </p>
    </Card>
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
