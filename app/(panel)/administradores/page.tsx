"use client";
import { Fragment, useState } from "react";
import {
  AlertTriangle,
  BedDouble,
  Building2,
  Check,
  Clock,
  Database,
  FileText,
  History,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users as UsersIcon,
} from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { CountUp, Ring } from "@/components/viz";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Table,
  Tabs,
  toast,
} from "@/components/ui";
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

const TOUCH = "min-h-[44px] sm:min-h-0";
const STYLES = `
@media (prefers-reduced-motion: no-preference){
  @keyframes ad-tick{0%{transform:scale(0) rotate(-20deg)}60%{transform:scale(1.25) rotate(4deg)}100%{transform:scale(1) rotate(0)}}
  .ad-tick{animation:ad-tick .3s cubic-bezier(.34,1.56,.64,1) both}
}`;
const TH = "whitespace-nowrap px-4 py-2.5";

function TabLabel({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <Icon size={16} aria-hidden /> {children}
    </span>
  );
}

function EmptyState({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center text-[15px] text-gray-700">
      <span aria-hidden className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 rounded-full border-2 border-dashed border-gray-300 bg-gray-50" />
        <span className="absolute -right-1 top-1 h-3 w-3 rounded-full bg-accent/30" />
        <span className="absolute -left-1 bottom-2 h-2 w-2 rounded-full bg-gray-300" />
        <Icon size={30} className="relative text-gray-500" />
      </span>
      <p className="max-w-md">{children}</p>
    </div>
  );
}

export default function AdminPage() {
  const { data } = useApp();
  const [tab, setTab] = useState<
    "usuarios" | "permisos" | "habitaciones" | "config" | "auditoria" | "datos"
  >("usuarios");
  const activeStaff = data.staff.filter((s) => s.active).length;
  const onlineStaff = data.staff.filter(
    (s) => s.active && !!s.lastSeen && Date.now() - new Date(s.lastSeen).getTime() < 4 * 60_000,
  ).length;
  const onlinePct = activeStaff ? (onlineStaff / activeStaff) * 100 : 0;
  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
      <style>{STYLES}</style>
      <div className="aurora">
        <PageHeader
          title={<span className="serif-accent">Administradores</span>}
          subtitle="Acá manejás a las personas que trabajan en el hotel, qué puede ver cada una, las habitaciones y los datos del hotel."
        />
        <div className="stagger grid grid-cols-1 gap-4 min-[560px]:grid-cols-3">
          <div className="hero-card flex items-center justify-between gap-3 rounded-2xl p-5">
            <div>
              <div className="flex items-center gap-2 text-[15px] font-medium opacity-90">
                <UsersIcon size={18} aria-hidden /> Personas activas
              </div>
              <div className="num mt-2 text-[48px] leading-none">
                <CountUp value={activeStaff} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
            <Ring value={onlinePct} size={72} stroke={8} tone="green" label={`${onlineStaff} conectadas ahora`}>
              <span className="num text-[20px]">{onlineStaff}</span>
            </Ring>
            <div>
              <div className="label-mono flex items-center gap-2 text-[12.5px] text-gray-600">
                <span className={cls("h-2.5 w-2.5 rounded-full bg-green-500", onlineStaff > 0 && "pulse-dot")} aria-hidden /> Conectadas ahora
              </div>
              <div className="mt-1 text-[14px] text-gray-700">de {activeStaff} personas activas</div>
            </div>
          </div>
          <div className="lift rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/20">
              <BedDouble size={20} aria-hidden />
            </span>
            <div className="label-mono mt-3 text-[12.5px] text-gray-600">Habitaciones</div>
            <div className="num mt-1 text-[30px] leading-none text-gray-900">
              <CountUp value={data.rooms.length} />
            </div>
          </div>
        </div>
      </div>
      <div className="-mx-4 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            {
              value: "usuarios",
              label: <TabLabel icon={UsersIcon}>Personal</TabLabel>,
            },
            {
              value: "permisos",
              label: (
                <TabLabel icon={ShieldCheck}>Qué puede ver cada cargo</TabLabel>
              ),
            },
            {
              value: "habitaciones",
              label: <TabLabel icon={BedDouble}>Habitaciones</TabLabel>,
            },
            {
              value: "config",
              label: <TabLabel icon={Building2}>Datos del hotel</TabLabel>,
            },
            {
              value: "auditoria",
              label: <TabLabel icon={History}>Registro de actividad</TabLabel>,
            },
            {
              value: "datos",
              label: <TabLabel icon={Database}>Datos guardados</TabLabel>,
            },
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
    if (!edit?.name?.trim() || !edit.email?.trim())
      return toast("Falta completar el nombre y el email", "error");
    const email = edit.email.trim().toLowerCase();
    if (!edit.id && data.staff.some((s) => s.email.toLowerCase() === email))
      return toast(
        "Ya hay una persona con ese email. Probá con otro.",
        "error",
      );
    // En Firebase el ID del documento es el email (lo usan las reglas de seguridad)
    const id = edit.id ?? (mode === "firebase" ? email : uid("st"));
    await actions.saveStaff({
      role: "recepcion",
      active: true,
      createdAt: nowISO(),
      ...edit,
      id,
      email,
      name: edit.name.trim(),
    } as Staff);
    toast("Listo ✔ Persona guardada");
    setEdit(null);
  }

  const open = new Map<string, number>();
  const done = new Map<string, number>();
  for (const t of data.tasks) {
    if (t.assignedTo && t.status !== "completada")
      open.set(t.assignedTo, (open.get(t.assignedTo) ?? 0) + 1);
    if (t.completedBy)
      done.set(t.completedBy, (done.get(t.completedBy) ?? 0) + 1);
  }
  const isOnline = (s: Staff) =>
    !!s.lastSeen && Date.now() - new Date(s.lastSeen).getTime() < 4 * 60_000;
  const list = data.staff
    .filter((s) => !roleFilter || s.role === roleFilter)
    .slice()
    .sort(
      (a, b) =>
        ALL_ROLES.indexOf(a.role) - ALL_ROLES.indexOf(b.role) ||
        a.name.localeCompare(b.name),
    );

  return (
    <div className="space-y-4">
      <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {ALL_ROLES.map((r) => {
          const selected = roleFilter === r;
          return (
            <button
              key={r}
              onClick={() => setRoleFilter(selected ? "" : r)}
              aria-pressed={selected}
              className={cls(
                "lift flex min-h-[80px] items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3.5 text-left shadow-card outline-none focus-visible:ring-[3px] focus-visible:ring-accent/30",
                selected
                  ? "border-accent bg-accent/5 ring-1 ring-accent"
                  : "border-gray-200",
              )}
            >
              <span className="min-w-0">
                <span className="label-mono block text-[12px] leading-snug text-gray-600">
                  {ROLE_LABEL[r]}
                </span>
                <span className="num mt-1 block text-[32px] tabular-nums leading-none">
                  {data.staff.filter((s) => s.role === r && s.active).length}
                </span>
              </span>
              {selected && (
                <Check size={18} className="shrink-0 text-accent" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
      <Card
        className="overflow-hidden"
        title={`Personal (${list.length}). Tocá un cargo de arriba para ver solo esos.`}
        actions={
          <Button
            variant="primary"
            className={cn(TOUCH, "w-full px-4 sm:w-auto")}
            onClick={() => setEdit({ role: "mucama", active: true })}
          >
            <Plus size={16} /> Agregar persona
          </Button>
        }
      >
        <div className="space-y-6 p-3 sm:p-4">
          {ALL_ROLES.map((role) => {
            const group = list.filter((x) => x.role === role);
            if (!group.length) return null;
            return (
              <section key={role} aria-label={ROLE_LABEL[role]}>
                <h3 className="mb-3 flex items-center gap-2.5">
                  <Badge className={cls(ROLE_COLOR[role], "px-3 py-1 text-[14px]")}>{ROLE_LABEL[role]}</Badge>
                  <span className="num text-[18px] tabular-nums text-gray-700">{group.length}</span>
                  <span aria-hidden className="h-px flex-1 bg-gray-200" />
                </h3>
                <ul className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {group.map((s) => {
                    const online = isOnline(s);
                    return (
                      <li key={s.id} className={cls("lift flex flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-card", !s.active && "opacity-70 grayscale")}>
                        <div className="flex items-center gap-4">
                          <span className="relative shrink-0" title={online ? "Conectado ahora" : undefined}>
                            <span className={cls("block rounded-full p-1 ring-[3px]", online ? "ring-green-500" : "ring-gray-300")}>
                              <Avatar name={s.name} size={64} />
                            </span>
                            {online && <span aria-hidden className="pulse-dot absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white bg-green-500" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="break-words text-[17px] font-semibold leading-snug text-gray-900">
                              {s.name}{" "}
                              {s.id === me?.id && <span className="text-[14px] font-normal text-gray-600">(vos)</span>}
                            </div>
                            <Badge className={cls(ROLE_COLOR[s.role], "mt-1 px-2.5 py-0.5 text-[13px]")}>{ROLE_LABEL[s.role]}</Badge>
                          </div>
                        </div>
                        <dl className="mt-3.5 space-y-1.5 text-[14.5px] text-gray-700">
                          <div className="flex items-center gap-2"><Phone size={15} className="shrink-0 text-gray-500" aria-hidden /><dt className="sr-only">Teléfono</dt><dd className="min-w-0 break-all">{s.phone ?? "Sin teléfono"}</dd></div>
                          <div className="flex items-center gap-2">
                            <Clock size={15} className="shrink-0 text-gray-500" aria-hidden />
                            <dt className="sr-only">Última vez que entró</dt>
                            <dd className={online ? "font-medium text-green-700" : undefined}>{online ? "Conectado ahora" : s.lastSeen ? `Entró ${fmtTimeAgo(s.lastSeen)}` : "Nunca entró"}</dd>
                          </div>
                        </dl>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                          <div className="rounded-xl bg-gray-50 px-2 py-2 ring-1 ring-gray-200"><div className="num text-[22px] leading-none tabular-nums">{open.get(s.id) ?? 0}</div><div className="mt-1 text-[13px] text-gray-600">sin terminar</div></div>
                          <div className="rounded-xl bg-gray-50 px-2 py-2 ring-1 ring-gray-200"><div className="num text-[22px] leading-none tabular-nums">{done.get(s.id) ?? 0}</div><div className="mt-1 text-[13px] text-gray-600">hechas</div></div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className={cls("inline-flex items-center gap-2 text-[14px] font-medium", s.active ? "text-green-700" : "text-gray-700")}>
                            <span className={cls("h-2.5 w-2.5 rounded-full", s.active ? "bg-green-500" : "bg-gray-400")} aria-hidden />
                            {s.active ? "Activo" : "Dado de baja"}
                          </span>
                          <Button variant="ghost" className={TOUCH} onClick={() => setEdit(s)}>
                            <Pencil size={15} aria-hidden /> Editar datos
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
        {list.length === 0 && (
          <EmptyState icon={UsersIcon}>
            No hay personas con ese cargo. Tocá el mismo cargo de arriba otra
            vez para ver a todos.
          </EmptyState>
        )}
        {mode === "firebase" && (
          <p className="border-t border-gray-100 bg-gray-50 px-4 py-3 text-[14px] leading-relaxed text-gray-700">
            Para darle acceso a alguien: agregalo acá con su email. Después
            pedile que abra la app, toque “Crear cuenta” y use ese mismo email.
          </p>
        )}
      </Card>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? "Editar datos de la persona" : "Agregar persona"}
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {edit?.id && edit.id !== me?.id && (
              <Button
                variant="ghost"
                className={cn(TOUCH, "text-red-600 hover:bg-red-50 sm:mr-auto")}
                onClick={() => {
                  if (
                    confirm(
                      "¿Borrar a esta persona? Ya no va a poder entrar al panel. Lo que hizo antes (sus tareas) se guarda. No se puede deshacer.",
                    )
                  ) {
                    actions.deleteStaff(edit as Staff);
                    setEdit(null);
                  }
                }}
              >
                <Trash2 size={15} aria-hidden /> Borrar persona
              </Button>
            )}
            <Button className={TOUCH} onClick={() => setEdit(null)}>
              Cerrar sin guardar
            </Button>
            <Button variant="primary" className={TOUCH} onClick={save}>
              Guardar cambios
            </Button>
          </div>
        }
      >
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre y apellido" className="sm:col-span-2">
                <Input
                  className={TOUCH}
                  value={edit.name ?? ""}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
              </Field>
              <Field label="Email (con el que entra al panel)">
                <Input
                  className={TOUCH}
                  type="email"
                  value={edit.email ?? ""}
                  disabled={!!edit.id && mode === "firebase"}
                  onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                />
              </Field>
              <Field label="Teléfono de WhatsApp (ej: 5491155551234)">
                <Input
                  className={TOUCH}
                  value={edit.phone ?? ""}
                  onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid gap-4 border-t border-gray-100 pt-4">
              <Field
                label="Cargo"
                hint={
                  edit.role
                    ? `Puede ver: ${permsFor(
                        edit.role as Role,
                        data.settings[0],
                      )
                        .filter((p) => PERM_INFO[p].group === "Secciones")
                        .map((p) => PERM_INFO[p].label)
                        .join(", ")}`
                    : undefined
                }
              >
                <Select
                  className={TOUCH}
                  value={edit.role}
                  onChange={(e) =>
                    setEdit({ ...edit, role: e.target.value as Role })
                  }
                  disabled={edit.id === me?.id}
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </Select>
              </Field>
              <label className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] leading-snug">
                <input
                  type="checkbox"
                  className="h-6 w-6 shrink-0 accent-green-600"
                  checked={edit.active ?? true}
                  disabled={edit.id === me?.id}
                  onChange={(e) =>
                    setEdit({ ...edit, active: e.target.checked })
                  }
                />
                <span>
                  Puede entrar al panel (si lo destildás, queda dada de baja)
                </span>
              </label>
            </div>
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
  const [hovCol, setHovCol] = useState<Role | null>(null);

  async function toggle(role: Role, p: Perm) {
    const cur = permsFor(role, settings);
    const next = cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p];
    await actions.saveSettings({
      ...settings,
      permissions: { ...(settings.permissions ?? {}), [role]: next },
    });
  }
  async function reset(role: Role) {
    if (
      !confirm(
        `¿Volver a lo de siempre para “${ROLE_LABEL[role]}”? Se pierden los cambios que hiciste para este cargo. Después podés volver a cambiarlos.`,
      )
    )
      return;
    const rest = { ...(settings.permissions ?? {}) };
    delete rest[role];
    await actions.saveSettings({ ...settings, permissions: rest });
    toast(`Listo ✔ ${ROLE_LABEL[role]} vuelve a tener lo de siempre`);
  }

  return (
    <Card title="Qué puede ver y hacer cada cargo" className="overflow-hidden">
      <div className="m-4 flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3.5 text-[15px] leading-relaxed text-gray-800">
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <p>
          <b className="label-mono text-[12.5px] text-accent">Cómo usarlo:</b> cada columna es un cargo. Tocá una casilla para{" "}
          <b>darle</b> (tildada) o <b>sacarle</b> (sin tilde) ese permiso a
          todos los que tienen ese cargo. El cambio vale al instante. Si algo
          sale mal, tocá “Volver a lo de siempre” abajo del nombre del cargo.
        </p>
      </div>
      <div className="max-h-[70vh] overflow-auto border-t border-gray-100">
        <table className="w-full border-separate border-spacing-0 text-[15px]">
          <thead>
            <tr className="label-mono text-[12.5px] text-gray-700">
              <th className="sticky left-0 top-0 z-30 min-w-[180px] border-b border-gray-200 bg-gray-50 px-4 py-3 text-left font-semibold">
                Qué puede hacer
              </th>
              <th className="sticky top-0 z-20 min-w-[96px] border-b border-gray-200 bg-gray-50 px-3 py-3 text-center font-semibold">
                {ROLE_LABEL.admin}
              </th>
              {roles.map((r) => (
                <th
                  key={r}
                  onMouseEnter={() => setHovCol(r)}
                  onMouseLeave={() => setHovCol(null)}
                  className={cls("sticky top-0 z-20 min-w-[136px] border-b border-gray-200 px-3 py-3 text-center font-semibold transition-colors motion-reduce:transition-none", hovCol === r ? "bg-accent/10 text-accent" : "bg-gray-50")}
                >
                  <div>{ROLE_LABEL[r]}</div>
                  {settings.permissions?.[r] && (
                    <button
                      onClick={() => reset(r)}
                      className="mx-auto mt-1 inline-flex min-h-[44px] items-center gap-1 rounded-md px-1.5 text-[13.5px] font-normal normal-case leading-tight tracking-normal text-blue-700 hover:bg-blue-50 hover:underline"
                    >
                      <RotateCcw size={12} className="shrink-0" /> Volver a lo
                      de siempre
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(["Secciones", "Capacidades"] as const).map((g) => (
              <Fragment key={g}>
                <tr>
                  <td
                    colSpan={roles.length + 2}
                    className="border-b border-gray-200 bg-gray-100 p-0"
                  >
                    <div className="label-mono sticky left-0 w-fit px-4 py-2 text-[12.5px] font-semibold text-gray-700">
                      {g === "Secciones"
                        ? "Pantallas que puede ver"
                        : "Cosas que puede hacer"}
                    </div>
                  </td>
                </tr>
                {perms
                  .filter((p) => PERM_INFO[p].group === g)
                  .map((p) => (
                    <tr key={p} className="group">
                      <td className="sticky left-0 z-10 border-b border-gray-100 bg-white px-4 py-2 transition-colors group-hover:bg-gray-50">
                        {PERM_INFO[p].label}
                      </td>
                      <td className="border-b border-gray-100 px-3 py-2 text-center text-green-700 group-hover:bg-gray-50">
                        <Check size={20} className="mx-auto" aria-hidden />
                      </td>
                      {roles.map((r) => {
                        const allowed = PERM_CEILING[r].includes(p);
                        const on = permsFor(r, settings).includes(p);
                        const changed =
                          on !== DEFAULT_PERMISSIONS[r].includes(p);
                        return (
                          <td
                            key={r}
                            onMouseEnter={() => setHovCol(r)}
                            onMouseLeave={() => setHovCol(null)}
                            className={cls(
                              "border-b border-gray-100 p-0 text-center transition-colors motion-reduce:transition-none group-hover:bg-gray-50",
                              hovCol === r && "bg-accent/5",
                              changed && "bg-amber-50",
                            )}
                          >
                            {allowed ? (
                              <label className="flex h-12 w-full cursor-pointer items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() => toggle(r, p)}
                                  aria-label={`${ROLE_LABEL[r]}: ${PERM_INFO[p].label}`}
                                  className="peer sr-only"
                                />
                                <span
                                  aria-hidden
                                  className={cls(
                                    "flex h-7 w-7 items-center justify-center rounded-lg border-2 transition-colors duration-150 peer-focus-visible:ring-[3px] peer-focus-visible:ring-accent/40 motion-reduce:transition-none",
                                    on
                                      ? changed
                                        ? "border-amber-500 bg-amber-500 text-white"
                                        : "border-green-600 bg-green-600 text-white"
                                      : "border-gray-400 bg-white",
                                  )}
                                >
                                  {on && <Check key={String(on)} size={18} strokeWidth={3} className="ad-tick" />}
                                </span>
                              </label>
                            ) : (
                              <span
                                className="flex h-12 items-center justify-center text-gray-500"
                                title="Este permiso no se puede dar, por seguridad"
                              >
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
      <p className="border-t border-gray-100 bg-gray-50 px-4 py-3 text-[14px] leading-relaxed text-gray-700">
        Los cambios valen al instante para todo el personal. “—” quiere decir
        que ese permiso no se puede dar por seguridad (por ejemplo, las mucamas
        nunca pueden ver pagos ni facturas). Las casillas en color ámbar son las
        que cambiaste respecto de lo de siempre.
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
    if (!edit?.number?.trim())
      return toast("Falta escribir el número de la habitación", "error");
    const number = edit.number.trim();
    if (data.rooms.some((r) => r.number === number && r.id !== edit.id))
      return toast("Ya hay una habitación con ese número", "error");
    await actions.saveRoom({
      type: "Doble",
      capacity: 2,
      rate: 60000,
      ...edit,
      id: edit.id ?? `room_${number}`,
      number,
      floor: Number(edit.floor) || Math.floor(Number(number) / 100) * 100,
    } as Room);
    toast("Listo ✔ Habitación guardada");
    setEdit(null);
  }

  return (
    <Card
      className="overflow-hidden"
      title={`Habitaciones (${data.rooms.length})`}
      actions={
        <Button
          variant="primary"
          className={cn(TOUCH, "w-full px-4 sm:w-auto")}
          onClick={() => setEdit({ type: "Doble", capacity: 2 })}
        >
          <Plus size={16} /> Agregar habitación
        </Button>
      }
    >
      <Table
        head={[
          "Habitación",
          "Piso",
          "Tipo",
          "Personas que entran",
          "Precio por noche",
          "Estado",
          "",
        ]}
      >
        {data.rooms
          .slice()
          .sort((a, b) =>
            a.number.localeCompare(b.number, undefined, { numeric: true }),
          )
          .map((r) => {
            const st = roomState(r, data);
            return (
              <tr
                key={r.id}
                className="transition-colors duration-150 hover:bg-gray-50 motion-reduce:transition-none"
              >
                <td className="px-4 py-2.5">
                  <span className="num inline-flex min-w-[48px] items-center justify-center rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-[16px] tabular-nums">
                    {r.number}
                  </span>
                </td>
                <td className="px-4 py-2.5 tabular-nums">{r.floor}</td>
                <td className="px-4 py-2.5">{r.type}</td>
                <td className="px-4 py-2.5 tabular-nums">{r.capacity}</td>
                <td className="whitespace-nowrap px-4 py-2.5 font-medium tabular-nums">
                  {money(r.rate, cur)}
                </td>
                <td className="px-4 py-2.5">
                  <Badge
                    className={cls(
                      ROOM_STATE_CLASS[st],
                      "px-2.5 py-1 text-[13.5px]",
                    )}
                  >
                    {ROOM_STATE_LABEL[st]}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button
                    variant="ghost"
                    className={TOUCH}
                    onClick={() => setEdit(r)}
                  >
                    <Pencil size={15} aria-hidden /> Editar datos
                  </Button>
                </td>
              </tr>
            );
          })}
      </Table>
      {data.rooms.length === 0 && (
        <EmptyState icon={BedDouble}>
          Todavía no hay habitaciones cargadas. Tocá “Agregar habitación” para
          empezar.
        </EmptyState>
      )}
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? `Habitación ${edit.number}` : "Agregar habitación"}
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {edit?.id && (
              <Button
                variant="ghost"
                className={cn(TOUCH, "text-red-600 hover:bg-red-50 sm:mr-auto")}
                onClick={() => {
                  if (
                    data.reservations.some(
                      (r) => r.roomId === edit.id && r.status !== "cancelada",
                    )
                  )
                    return toast(
                      "Esta habitación tiene reservas, así que no se puede borrar. Tildá “No se puede usar” para sacarla de servicio.",
                      "error",
                    );
                  if (
                    confirm(
                      `¿Borrar la habitación ${edit.number}? No se puede deshacer.`,
                    )
                  ) {
                    actions.deleteRoom(edit as Room);
                    setEdit(null);
                  }
                }}
              >
                <Trash2 size={15} aria-hidden /> Borrar habitación
              </Button>
            )}
            <Button className={TOUCH} onClick={() => setEdit(null)}>
              Cerrar sin guardar
            </Button>
            <Button variant="primary" className={TOUCH} onClick={save}>
              Guardar cambios
            </Button>
          </div>
        }
      >
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Número de habitación">
                <Input
                  className={TOUCH}
                  value={edit.number ?? ""}
                  disabled={!!edit.id}
                  onChange={(e) => setEdit({ ...edit, number: e.target.value })}
                />
              </Field>
              <Field label="Piso">
                <Input
                  className={TOUCH}
                  type="number"
                  value={edit.floor ?? ""}
                  onChange={(e) =>
                    setEdit({ ...edit, floor: Number(e.target.value) })
                  }
                  placeholder="100"
                />
              </Field>
              <Field label="Tipo">
                <Select
                  className={TOUCH}
                  value={edit.type}
                  onChange={(e) =>
                    setEdit({ ...edit, type: e.target.value as RoomType })
                  }
                >
                  {TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Cuántas personas entran">
                <Input
                  className={TOUCH}
                  type="number"
                  value={edit.capacity ?? ""}
                  onChange={(e) =>
                    setEdit({ ...edit, capacity: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Precio por noche" className="sm:col-span-2">
                <Input
                  className={TOUCH}
                  type="number"
                  value={edit.rate ?? ""}
                  onChange={(e) =>
                    setEdit({ ...edit, rate: Number(e.target.value) })
                  }
                />
              </Field>
            </div>
            <div className="grid gap-4 border-t border-gray-100 pt-4">
              <label className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] leading-snug">
                <input
                  type="checkbox"
                  className="h-6 w-6 shrink-0 accent-green-600"
                  checked={!!edit.outOfService}
                  onChange={(e) =>
                    setEdit({ ...edit, outOfService: e.target.checked })
                  }
                />
                <span>No se puede usar (rota o en arreglo)</span>
              </label>
              <Field label="Anotaciones (opcional)">
                <Input
                  className={TOUCH}
                  value={edit.notes ?? ""}
                  onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                />
              </Field>
            </div>
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
    <Card
      title={
        <span className="flex items-center gap-2">
          <Building2 size={18} className="shrink-0 text-gray-600" aria-hidden />{" "}
          Datos generales del hotel
        </span>
      }
    >
      <div className="max-w-2xl space-y-5 p-4 sm:p-5">
        <Field label="Nombre del hotel">
          <Input
            className={TOUCH}
            value={s.hotelName}
            onChange={(e) => setS({ ...s, hotelName: e.target.value })}
          />
        </Field>
        <div className="grid gap-4 border-t border-gray-100 pt-5 sm:grid-cols-2">
          <Field label="Signo de la moneda (ej: $)">
            <Input
              className={TOUCH}
              value={s.currency}
              onChange={(e) => setS({ ...s, currency: e.target.value })}
            />
          </Field>
          <Field label="IVA que ya está incluido en los precios (%)">
            <Input
              className={TOUCH}
              type="number"
              value={s.taxRate}
              onChange={(e) => setS({ ...s, taxRate: Number(e.target.value) })}
            />
          </Field>
          <Field label="Número de la próxima factura" className="sm:col-span-2">
            <Input
              className={TOUCH}
              type="number"
              value={s.invoiceSeq}
              onChange={(e) =>
                setS({ ...s, invoiceSeq: Number(e.target.value) })
              }
            />
          </Field>
        </div>
        <div className="grid gap-4 border-t border-gray-100 pt-5 sm:grid-cols-2">
          <Field label="Hora de entrada de los huéspedes">
            <Input
              className={TOUCH}
              type="time"
              value={s.checkInTime}
              onChange={(e) => setS({ ...s, checkInTime: e.target.value })}
            />
          </Field>
          <Field label="Hora de salida de los huéspedes">
            <Input
              className={TOUCH}
              type="time"
              value={s.checkOutTime}
              onChange={(e) => setS({ ...s, checkOutTime: e.target.value })}
            />
          </Field>
        </div>
        <div className="border-t border-gray-100 pt-5">
          <Button
            variant="primary"
            className={cn(TOUCH, "w-full px-6 sm:w-auto")}
            onClick={() =>
              actions
                .saveSettings(s)
                .then(() => toast("Listo ✔ Cambios guardados"))
            }
          >
            Guardar cambios
          </Button>
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
    .filter(
      (a) =>
        !q ||
        `${a.action} ${a.detail ?? ""}`.toLowerCase().includes(q.toLowerCase()),
    )
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 300);
  return (
    <Card
      className="overflow-hidden"
      title="Registro de lo que hizo cada persona"
      actions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Input
            placeholder="Escribí para buscar"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={cn(TOUCH, "w-full sm:w-[220px]")}
          />
          <Select
            value={who}
            onChange={(e) => setWho(e.target.value)}
            className={cn(TOUCH, "w-full sm:w-[220px]")}
          >
            <option value="">Todas las personas</option>
            <option value="sistema">El sistema (solo)</option>
            {data.staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      }
    >
      <Table head={["Fecha", "Persona", "Qué hizo", "Detalle"]}>
        {list.map((a) => (
          <tr
            key={a.id}
            className="transition-colors duration-150 hover:bg-gray-50 motion-reduce:transition-none"
          >
            <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-gray-700">
              {fmtDateTime(a.at)}
            </td>
            <td className="whitespace-nowrap px-4 py-2.5 font-medium">
              {staffName(a.by)}
            </td>
            <td className="px-4 py-2.5">{a.action}</td>
            <td className="px-4 py-2.5 text-gray-700">{a.detail}</td>
          </tr>
        ))}
      </Table>
      {list.length === 0 && (
        <EmptyState icon={History}>
          Todavía no hay nada anotado. Cuando alguien haga algo en el panel, lo
          vas a ver acá.
        </EmptyState>
      )}
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
    ["Cobros cargados", data.charges.length],
    ["Pagos", data.payments.length],
    ["Facturas", data.invoices.length],
    ["Pedidos", data.orders.length],
    ["Mensajes", data.messages.length],
    ["Movimientos anotados", data.activity.length],
  ];
  async function run(fn: () => Promise<void>, msg: string) {
    setBusy(true);
    try {
      await fn();
      toast(msg);
    } catch (e) {
      toast("No se pudo hacer: " + (e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  const health: [string, number, React.ElementType][] = [
    ["habitaciones", data.rooms.length, BedDouble],
    ["reservas", data.reservations.length, FileText],
    ["huéspedes", data.guests.length, UserCheck],
  ];
  return (
    <div className="space-y-4">
    <div
      className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-card sm:flex-row sm:items-center"
      role="group"
      aria-label={`Datos guardados: ${health.map(([k, v]) => `${v} ${k}`).join(", ")}`}
    >
      <div className="flex items-center gap-2.5 sm:w-[180px]">
        <span aria-hidden className={cls("h-3 w-3 rounded-full", data.rooms.length ? "pulse-dot bg-green-500" : "bg-amber-500")} />
        <span className="text-[15px] font-semibold text-gray-900">{data.rooms.length ? "Datos cargados" : "Faltan cargar datos"}</span>
      </div>
      <ul className="grid flex-1 grid-cols-3 gap-2">
        {health.map(([k, v, HIcon]) => (
          <li key={k} className="rounded-xl bg-gray-50 px-3 py-2.5 ring-1 ring-gray-200">
            <HIcon size={16} className="text-accent" aria-hidden />
            <div className="num mt-1 text-[28px] leading-none tabular-nums"><CountUp value={v} /></div>
            <div className="mt-1 text-[13.5px] text-gray-600">{k}</div>
          </li>
        ))}
      </ul>
    </div>
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <Card
        title={
          <span className="flex items-center gap-2">
            <Database
              size={18}
              className="shrink-0 text-gray-600"
              aria-hidden
            />{" "}
            Dónde se guardan los datos
          </span>
        }
      >
        <div className="space-y-4 p-4 text-[15px]">
          <div className="flex flex-wrap items-center gap-2">
            Ahora se usa:{" "}
            <Badge
              className={cn(
                mode === "firebase"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-blue-50 text-blue-700",
                "whitespace-normal px-3 py-1 text-[14px]",
              )}
            >
              {mode === "firebase"
                ? `Datos en internet (Firebase) · ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`
                : "Modo de prueba (los datos quedan solo en este navegador)"}
            </Badge>
          </div>
          {mode === "demo" && (
            <p className="leading-relaxed text-gray-700">
              Para guardar los datos reales del hotel en internet hay que cargar
              las variables{" "}
              <code className="rounded bg-gray-100 px-1">
                NEXT_PUBLIC_FIREBASE_*
              </code>{" "}
              en Vercel (o en{" "}
              <code className="rounded bg-gray-100 px-1">.env.local</code>) y
              volver a publicar el sistema. Pedile ayuda a quien lo armó (está
              explicado en el README).
            </p>
          )}
          <ul className="stagger grid grid-cols-2 gap-2">
            {counts.map(([k, v]) => (
              <li
                key={k}
                className="flex flex-col gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3"
              >
                <b className="num text-[26px] tabular-nums leading-none">
                  <CountUp value={v} />
                </b>
                <span className="label-mono text-[12px] leading-snug text-gray-600">
                  {k}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
      <div className="space-y-4">
        <Card title="Cosas que se pueden hacer con los datos">
          <div className="space-y-4 p-4 text-[15px]">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <Button
                disabled={busy}
                className={cn(TOUCH, "w-full sm:w-auto")}
                onClick={() =>
                  confirm(
                    "Atención: esto BORRA los datos que hay (menos las personas) y los reemplaza por datos de ejemplo. No se puede deshacer. ¿Querés seguir?",
                  ) &&
                  run(
                    () => actions.loadDemoData(true),
                    "Listo ✔ Datos de ejemplo cargados",
                  )
                }
              >
                <Database size={16} aria-hidden /> Cargar datos de ejemplo
              </Button>
              <p className="mt-2 text-[14px] leading-relaxed text-gray-700">
                Crea 39 habitaciones, huéspedes, reservas, tareas, menú y
                mensajes de ejemplo. Sirve para probar el sistema.
              </p>
            </div>
          </div>
        </Card>
      <div
        className="rounded-2xl p-[3px]"
        style={{ backgroundImage: "repeating-linear-gradient(-45deg, #dc2626 0 12px, #fca5a5 12px 24px)" }}
      >
      <div className="rounded-[13px] bg-gradient-to-br from-red-50 to-red-100 p-4 sm:p-5">
        <div className="label-mono mb-3 flex items-center gap-2 text-[12.5px] font-semibold text-red-700">
          <AlertTriangle size={16} aria-hidden /> Zona peligrosa
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 text-[14px] leading-relaxed text-gray-800">
                Borra habitaciones, reservas, tareas, etc. Después cargá tus
                habitaciones reales en la pestaña “Habitaciones”.
              </p>
        <Button
                variant="danger"
                disabled={busy}
                className={cn(TOUCH, "w-full shrink-0 sm:w-auto")}
                onClick={() =>
                  prompt(
                    "Esto borra TODO: habitaciones, reservas, tareas, cobros y demás (las personas se quedan). No se puede deshacer. Si estás seguro, escribí BORRAR (con mayúsculas):",
                  ) === "BORRAR" &&
                  run(
                    () => actions.wipeAll(true),
                    "Listo ✔ Se borraron los datos",
                  )
                }
              >
                <AlertTriangle size={16} aria-hidden /> Borrar todo y empezar de
                cero
              </Button>
        </div>
      </div>
      </div>
      </div>
    </div>
    </div>
  );
}

function cn(...parts: (string | false | undefined)[]): string {
  return cls(...parts);
}
