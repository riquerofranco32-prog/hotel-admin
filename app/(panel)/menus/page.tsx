"use client";
import { useEffect, useState } from "react";
import type { ElementType } from "react";
import {
  Beer,
  Check,
  ChefHat,
  ClipboardList,
  Clock,
  Coffee,
  Cookie,
  IceCreamCone,
  Minus,
  Pencil,
  Plus,
  Salad,
  ShoppingBag,
  StickyNote,
  Trash2,
  Utensils,
  UtensilsCrossed,
  Wine,
} from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { CountUp, Ring } from "@/components/viz";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Tabs,
  Textarea,
  toast,
} from "@/components/ui";
import { fmtDateTime, today } from "@/lib/dates";
import { cls, money, uid } from "@/lib/logic";
import type { MenuCategory, MenuItem, Order } from "@/lib/types";

const CATEGORIES: MenuCategory[] = [
  "Desayuno",
  "Entradas",
  "Principales",
  "Postres",
  "Bebidas",
  "Minibar",
];
const ORDER_STATUS: Record<
  Order["status"],
  { label: string; cls: string; strip: string }
> = {
  pendiente: {
    label: "Pendiente",
    cls: "bg-amber-50 text-amber-700 ring-amber-200",
    strip: "border-l-amber-300",
  },
  preparando: {
    label: "Preparando",
    cls: "bg-blue-50 text-blue-700 ring-blue-200",
    strip: "border-l-blue-300",
  },
  entregado: {
    label: "Entregado",
    cls: "bg-green-50 text-green-700 ring-green-200",
    strip: "border-l-green-300",
  },
  cancelado: {
    label: "Cancelado",
    cls: "bg-gray-100 text-gray-600 ring-gray-200",
    strip: "border-l-gray-300",
  },
};
const STEP_BTN =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 transition duration-150 hover:bg-gray-50 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100";
const TOUCH_BTN = "";

// Cada tipo de comida tiene su "portada": degradé propio e ícono grande.
const CAT_STYLE: Record<
  MenuCategory,
  { icon: ElementType; grad: string; hint: string }
> = {
  Desayuno: {
    icon: Coffee,
    grad: "from-amber-400 to-orange-500",
    hint: "Para arrancar el día",
  },
  Entradas: {
    icon: Salad,
    grad: "from-lime-500 to-emerald-600",
    hint: "Para empezar",
  },
  Principales: {
    icon: UtensilsCrossed,
    grad: "from-rose-500 to-red-700",
    hint: "Los platos fuertes",
  },
  Postres: {
    icon: IceCreamCone,
    grad: "from-pink-400 to-fuchsia-600",
    hint: "Para cerrar con algo rico",
  },
  Bebidas: {
    icon: Wine,
    grad: "from-sky-500 to-indigo-600",
    hint: "Para acompañar",
  },
  Minibar: {
    icon: Beer,
    grad: "from-slate-500 to-slate-800",
    hint: "Lo que hay en la habitación",
  },
};

const STYLES = `
@media (prefers-reduced-motion: no-preference){
  @keyframes mn-bump{0%{transform:scale(1)}40%{transform:scale(1.2)}100%{transform:scale(1)}}
  @keyframes mn-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
  .mn-bump{display:inline-block;animation:mn-bump .35s ease-out}
  .mn-float{animation:mn-float 3.2s ease-in-out infinite}
}`;

// Semáforo de demora para los pedidos en curso (en minutos).
const WARN_MIN = 10;
const LATE_MIN = 20;

function agoText(mins: number) {
  if (mins < 1) return "recién";
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  return `hace ${h} h${mins % 60 ? ` ${mins % 60} min` : ""}`;
}

/** Tiempo transcurrido en vivo ("hace 8 min"); se actualiza cada 30 segundos. Con semáforo si el pedido sigue en curso. */
function Elapsed({ since, live }: { since: string; live: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (now === null)
    return (
      <span
        className="ui-skeleton inline-block h-6 w-28 rounded-full"
        aria-hidden
      />
    );
  const mins = Math.max(
    0,
    Math.floor((now - new Date(since).getTime()) / 60000),
  );
  const tone = !live
    ? "bg-gray-100 text-gray-700 ring-gray-200"
    : mins >= LATE_MIN
      ? "bg-red-50 text-red-700 ring-red-200"
      : mins >= WARN_MIN
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-green-50 text-green-700 ring-green-200";
  const hint = !live
    ? ""
    : mins >= LATE_MIN
      ? " · demorado"
      : mins >= WARN_MIN
        ? " · ya tarda"
        : " · a tiempo";
  return (
    <span
      className={cls(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13.5px] font-medium ring-1 ring-inset",
        tone,
      )}
      title={`Anotado ${agoText(mins)}`}
    >
      <Clock size={14} aria-hidden /> {agoText(mins)}
      {hint}
    </span>
  );
}

const STEPS: { key: Order["status"]; label: string }[] = [
  { key: "pendiente", label: "Esperando" },
  { key: "preparando", label: "Preparando" },
  { key: "entregado", label: "Entregado" },
];

/** Cinta de 3 pasos que muestra en qué va el pedido. */
function Stepper({ status }: { status: Order["status"] }) {
  const at = STEPS.findIndex((s) => s.key === status);
  return (
    <ol
      className="mt-3 flex items-center"
      aria-label={`Pedido: ${ORDER_STATUS[status].label}`}
    >
      {STEPS.map((st, i) => (
        <li
          key={st.key}
          className={cls("flex items-center", i < STEPS.length - 1 && "flex-1")}
          title={st.label}
        >
          <span
            className={cls(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ring-2 transition-colors duration-300 motion-reduce:transition-none",
              i <= at
                ? "bg-accent text-accent-fg ring-accent"
                : "bg-gray-100 text-gray-500 ring-gray-300",
            )}
          >
            {i < at || status === "entregado" ? (
              <Check size={13} aria-hidden />
            ) : (
              i + 1
            )}
          </span>
          {i < STEPS.length - 1 && (
            <span
              className="mx-1 h-1 flex-1 overflow-hidden rounded-full bg-gray-200"
              aria-hidden
            >
              {i < at && (
                <span className="ui-fill block h-full w-full rounded-full bg-accent" />
              )}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

export default function MenusPage() {
  const { data } = useApp();
  const [tab, setTab] = useState<"pedidos" | "carta">("pedidos");
  const active = data.orders.filter(
    (o) => o.status === "pendiente" || o.status === "preparando",
  ).length;
  const pending = data.orders.filter((o) => o.status === "pendiente").length;
  const cooking = data.orders.filter((o) => o.status === "preparando").length;
  const t = today();
  const deliveredToday = data.orders.filter(
    (o) => o.status === "entregado" && (o.deliveredAt ?? "").slice(0, 10) === t,
  ).length;
  const available = data.menuItems.filter((m) => m.available).length;
  const availPct = data.menuItems.length
    ? (available / data.menuItems.length) * 100
    : 0;
  return (
    <div className="mx-auto max-w-[1400px] p-4 lg:p-6">
      <style>{STYLES}</style>
      <div className="aurora mb-5">
        <PageHeader
          title={
            <>
              Comidas y <span className="serif-accent">pedidos</span> a la
              habitación
            </>
          }
          subtitle="Acá armás la carta de comidas y anotás lo que piden los huéspedes. Cada pedido se suma solo a la cuenta del huésped."
        />
        <div className="stagger grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 lg:grid-cols-4">
          <div className="hero-card flex items-center justify-between gap-3 rounded-2xl p-5">
            <div>
              <div className="flex items-center gap-2 text-[15px] font-medium opacity-90">
                <ChefHat size={18} aria-hidden /> Pedidos en curso
              </div>
              <div className="num mt-2 text-[48px] leading-none">
                <CountUp value={active} />
              </div>
            </div>
            {active > 0 && (
              <span
                className="pulse-dot h-3 w-3 rounded-full bg-white"
                aria-hidden
              />
            )}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
            <div className="label-mono text-[12.5px] text-gray-600">
              Esperando
            </div>
            <div className="num mt-1 text-[32px] leading-none text-amber-700">
              <CountUp value={pending} />
            </div>
            <div className="mt-2 text-[14px] text-gray-600">
              todavía no empezaron
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
            <div className="label-mono text-[12.5px] text-gray-600">
              Preparando
            </div>
            <div className="num mt-1 text-[32px] leading-none text-blue-700">
              <CountUp value={cooking} />
            </div>
            <div className="mt-2 text-[14px] text-gray-600">
              {deliveredToday} entregados hoy
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
            <Ring
              value={availPct}
              size={72}
              stroke={8}
              label={`${Math.round(availPct)}% de la carta disponible`}
            >
              <span className="num text-[18px]">{Math.round(availPct)}%</span>
            </Ring>
            <div>
              <div className="label-mono text-[12.5px] text-gray-600">
                Carta disponible
              </div>
              <div className="mt-1 text-[14px] text-gray-700">
                {available} de {data.menuItems.length} platos y bebidas
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mb-5 max-w-full overflow-x-auto">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            {
              value: "pedidos",
              label: `Pedidos${active ? ` (${active})` : ""}`,
            },
            { value: "carta", label: "Carta de comidas" },
          ]}
        />
      </div>
      {tab === "pedidos" ? <Orders /> : <Carta />}
    </div>
  );
}

function Carta() {
  const { data, actions } = useApp();
  const [edit, setEdit] = useState<Partial<MenuItem> | null>(null);
  const cur = data.settings[0]?.currency ?? "$";

  async function save() {
    if (!edit?.name?.trim() || !edit.price)
      return toast("Escribí el nombre y el precio para poder guardar", "error");
    await actions.saveMenuItem({
      available: true,
      category: "Principales",
      ...edit,
      id: edit.id ?? uid("menu"),
      name: edit.name.trim(),
      price: Number(edit.price),
    } as MenuItem);
    toast("Listo ✔ Se guardó");
    setEdit(null);
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          variant="primary"
          className={`${TOUCH_BTN} w-full sm:w-auto`}
          onClick={() => setEdit({ category: "Principales", available: true })}
        >
          <Plus size={15} /> Agregar comida o bebida
        </Button>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {CATEGORIES.map((c) => {
          const cs = CAT_STYLE[c];
          const items = data.menuItems
            .filter((m) => m.category === c)
            .sort((a, b) => a.name.localeCompare(b.name));
          return (
            <Card
              key={c}
              title={c}
              icon={c === "Bebidas" || c === "Desayuno" ? Coffee : Utensils}
              count={items.length}
              className="overflow-hidden"
            >
              <div
                className={cls(
                  "relative flex h-24 items-center justify-between overflow-hidden bg-gradient-to-br px-5 text-white",
                  cs.grad,
                )}
              >
                <span
                  aria-hidden
                  className="absolute -right-6 -top-8 h-32 w-32 rounded-full bg-white/10"
                />
                <span
                  aria-hidden
                  className="absolute bottom-[-30px] left-1/3 h-20 w-20 rounded-full bg-white/10"
                />
                <div className="relative">
                  <div className="display text-[20px] leading-none">{c}</div>
                  <div className="mt-1.5 text-[14px] font-medium text-white/90">
                    {cs.hint}
                  </div>
                </div>
                <cs.icon
                  size={52}
                  strokeWidth={1.5}
                  aria-hidden
                  className="mn-float relative text-white/90 drop-shadow"
                />
              </div>
              <ul className="stagger grid gap-3 p-3">
                {items.map((m) => (
                  <li
                    key={m.id}
                    className="lift relative rounded-2xl border border-gray-200 bg-white p-3.5 pt-5 shadow-card"
                  >
                    <span
                      className={cls(
                        "num absolute -top-px right-4 flex items-center rounded-b-xl px-3 pb-1 pt-2.5 text-[20px] tabular-nums shadow-md",
                        m.available
                          ? "bg-accent text-accent-fg"
                          : "bg-gray-300 text-gray-700 line-through",
                      )}
                      aria-label={`Precio ${money(m.price, cur)}`}
                    >
                      <span
                        aria-hidden
                        className="absolute left-1/2 top-[3px] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/70"
                      />
                      {money(m.price, cur)}
                    </span>
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className={cls(
                          "flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-inner",
                          cs.grad,
                          !m.available && "opacity-50 grayscale",
                        )}
                      >
                        <cs.icon size={28} strokeWidth={1.75} />
                      </span>
                      <div
                        className={cls(
                          "min-w-0 flex-1 pt-3",
                          !m.available && "opacity-60",
                        )}
                      >
                        <div className="text-[16px] font-semibold leading-snug text-gray-900">
                          {m.name}
                        </div>
                        {m.description && (
                          <div className="mt-0.5 text-[14px] leading-snug text-gray-600">
                            {m.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                      <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-[14px] font-medium text-gray-700">
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-[rgb(var(--accent))]"
                          checked={m.available}
                          onChange={() =>
                            actions.saveMenuItem({
                              ...m,
                              available: !m.available,
                            })
                          }
                        />{" "}
                        Hay
                      </label>
                      <button
                        className="flex h-11 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 text-[14px] font-medium text-gray-800 transition duration-150 hover:bg-gray-50 active:scale-[0.98] motion-reduce:transition-none sm:h-10"
                        onClick={() => setEdit(m)}
                      >
                        <Pencil size={14} /> Cambiar
                      </button>
                    </div>
                  </li>
                ))}
                {items.length === 0 && (
                  <li className="flex flex-col items-center gap-2 px-4 py-8 text-center text-[15px] text-gray-600">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500">
                      <Cookie size={24} aria-hidden />
                    </span>
                    Todavía no hay nada acá. Tocá «Agregar comida o bebida».
                  </li>
                )}
              </ul>
            </Card>
          );
        })}
      </div>
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? "Cambiar comida o bebida" : "Agregar comida o bebida"}
        footer={
          <>
            {edit?.id && (
              <Button
                variant="ghost"
                className="mr-auto text-red-600"
                onClick={() => {
                  actions.deleteMenuItem(edit as MenuItem);
                  setEdit(null);
                }}
              >
                <Trash2 size={14} /> Borrar
              </Button>
            )}
            <Button onClick={() => setEdit(null)}>Cerrar sin guardar</Button>
            <Button variant="primary" onClick={save}>
              Guardar
            </Button>
          </>
        }
      >
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Nombre (ej: Milanesa con papas)"
              className="sm:col-span-2"
            >
              <Input
                value={edit.name ?? ""}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </Field>
            <Field label="Tipo">
              <Select
                value={edit.category}
                onChange={(e) =>
                  setEdit({ ...edit, category: e.target.value as MenuCategory })
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Precio">
              <Input
                type="number"
                value={edit.price ?? ""}
                onChange={(e) =>
                  setEdit({ ...edit, price: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Descripción (opcional)" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={edit.description ?? ""}
                onChange={(e) =>
                  setEdit({ ...edit, description: e.target.value })
                }
              />
            </Field>
            <label className="flex min-h-[44px] items-center gap-2.5 text-[15px] font-medium">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[rgb(var(--accent))]"
                checked={edit.available ?? true}
                onChange={(e) =>
                  setEdit({ ...edit, available: e.target.checked })
                }
              />{" "}
              Hay disponible hoy
            </label>
          </div>
        )}
      </Modal>
    </>
  );
}

function Orders() {
  const { data, actions, staffName } = useApp();
  const cur = data.settings[0]?.currency ?? "$";
  const [resId, setResId] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [cat, setCat] = useState<MenuCategory>("Principales");
  const [show, setShow] = useState<"activos" | "todos">("activos");

  const inHouse = data.reservations
    .filter((r) => r.status === "checkin")
    .map((r) => ({ r, room: data.rooms.find((x) => x.id === r.roomId) }))
    .sort((a, b) =>
      (a.room?.number ?? "").localeCompare(b.room?.number ?? "", undefined, {
        numeric: true,
      }),
    );
  const lines = Object.entries(cart)
    .filter(([, q]) => q > 0)
    .map(([id, qty]) => {
      const m = data.menuItems.find((x) => x.id === id)!;
      return { menuItemId: id, name: m.name, qty, price: m.price };
    });
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  const add = (id: string, d: number) =>
    setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + d) }));

  async function submit() {
    const r = data.reservations.find((x) => x.id === resId);
    if (!r) return toast("Elegí primero la habitación", "error");
    if (!lines.length) return toast("Tocá el + en lo que piden", "error");
    await actions.createOrder({
      reservationId: r.id,
      roomId: r.roomId,
      lines,
      total,
      notes: notes || undefined,
    });
    toast(`Listo ✔ Pedido enviado y sumado a la cuenta (${money(total, cur)})`);
    setCart({});
    setNotes("");
  }

  const t = today();
  const orders = data.orders
    .filter(
      (o) =>
        show === "todos" ||
        o.status === "pendiente" ||
        o.status === "preparando" ||
        (o.status === "entregado" && (o.deliveredAt ?? "").slice(0, 10) === t),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const columns = STEPS.map((st) => ({
    ...st,
    items: orders.filter((o) => o.status === st.key),
  }));
  const cancelled =
    show === "todos" ? orders.filter((o) => o.status === "cancelado") : [];
  const roomOf = (o: Order) =>
    data.rooms.find((x) => x.id === o.roomId)?.number;
  const hasAny =
    orders.some((o) => o.status !== "cancelado") || cancelled.length > 0;

  const orderCard = (o: Order) => {
    const live = o.status === "pendiente" || o.status === "preparando";
    return (
      <li
        key={o.id}
        className={cls(
          "lift rounded-2xl border border-l-[6px] border-gray-200 bg-white p-3.5 shadow-card",
          ORDER_STATUS[o.status].strip,
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="label-mono rounded-md border border-gray-300 bg-gray-50 px-2.5 py-1 text-[13px] font-semibold text-gray-900">
            Hab. {roomOf(o)}
          </span>
          <b className="num text-[22px] tabular-nums">{money(o.total, cur)}</b>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Elapsed
            since={
              o.status === "entregado" && o.deliveredAt
                ? o.deliveredAt
                : o.createdAt
            }
            live={live}
          />
          {o.status === "cancelado" && (
            <Badge className={ORDER_STATUS.cancelado.cls}>Cancelado</Badge>
          )}
        </div>
        {o.status !== "cancelado" && <Stepper status={o.status} />}
        <div className="mt-2.5 min-w-0 text-[15px]">
          <div className="font-medium leading-snug">
            {o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
          </div>
          {o.notes && (
            <div className="mt-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[14px] text-amber-800">
              <StickyNote
                size={15}
                className="mr-1 inline-block align-[-2px]"
                aria-hidden
              />{" "}
              {o.notes}
            </div>
          )}
          <div className="mt-1.5 text-[13.5px] text-gray-600">
            {fmtDateTime(o.createdAt)} · anotado por {staffName(o.createdBy)}
            {o.deliveredAt && ` · entregado por ${staffName(o.deliveredBy)}`}
          </div>
        </div>
        {live && (
          <div className="mt-3 grid grid-cols-1 gap-2">
            {o.status === "pendiente" && (
              <Button
                className={TOUCH_BTN}
                onClick={() => actions.setOrderStatus(o, "preparando")}
              >
                Empezar a preparar
              </Button>
            )}
            <Button
              variant="success"
              className={TOUCH_BTN}
              onClick={() => actions.setOrderStatus(o, "entregado")}
            >
              Ya lo entregué
            </Button>
            <Button
              variant="ghost"
              className={TOUCH_BTN}
              onClick={() =>
                confirm(
                  "¿Cancelar este pedido? Se saca el cobro de la cuenta del huésped.",
                ) && actions.setOrderStatus(o, "cancelado")
              }
            >
              Cancelar pedido
            </Button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[1fr_440px]">
      <Card
        title="Pedidos"
        actions={
          <Tabs
            value={show}
            onChange={setShow}
            items={[
              { value: "activos", label: "En curso" },
              { value: "todos", label: "Todos" },
            ]}
          />
        }
      >
        {hasAny ? (
          <div className="p-3 sm:p-4">
            <div className="grid gap-4 md:grid-cols-3">
              {columns.map((col) => (
                <section
                  key={col.key}
                  aria-label={col.label}
                  className="min-w-0 rounded-2xl bg-gray-50 p-2.5 ring-1 ring-gray-200"
                >
                  <h3 className="mb-2.5 flex items-center justify-between gap-2 px-1 text-[15px] font-semibold text-gray-900">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={cls(
                          "h-2.5 w-2.5 rounded-full",
                          col.key === "pendiente"
                            ? "bg-amber-500"
                            : col.key === "preparando"
                              ? "bg-blue-500"
                              : "bg-green-500",
                        )}
                      />
                      {col.label}
                    </span>
                    <span className="num rounded-full bg-white px-2.5 py-0.5 text-[15px] tabular-nums ring-1 ring-gray-200">
                      {col.items.length}
                    </span>
                  </h3>
                  <ul className="stagger space-y-3">
                    {col.items.map(orderCard)}
                    {col.items.length === 0 && (
                      <li className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 px-3 py-6 text-center text-[14px] text-gray-600">
                        <ClipboardList size={20} aria-hidden />
                        {col.key === "entregado"
                          ? "Acá van los que ya entregaste."
                          : "Nada por acá."}
                      </li>
                    )}
                  </ul>
                </section>
              ))}
            </div>
            {cancelled.length > 0 && (
              <div className="mt-4">
                <div className="label-mono mb-2 text-[12.5px] text-gray-600">
                  Cancelados
                </div>
                <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {cancelled.map(orderCard)}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center text-[15px] text-gray-600">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500">
              <ClipboardList size={26} aria-hidden />
            </span>
            {show === "activos"
              ? "No hay pedidos en curso. Cuando anotes uno, aparece acá."
              : "Todavía no hay pedidos."}
          </div>
        )}
      </Card>

      <div id="pedido-nuevo" className="scroll-mt-4">
        <Card title="Anotar un pedido nuevo">
          <div className="space-y-4 p-4">
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-[14px] leading-relaxed text-gray-700">
              1) Elegí la habitación. 2) Tocá el + en lo que piden. 3) Tocá el
              botón de abajo.
            </p>
            {inHouse.length === 0 && (
              <p className="text-[14px] text-amber-800">
                Ahora no hay huéspedes alojados, así que no se puede anotar
                ningún pedido.
              </p>
            )}
            <Select
              className="text-[15px]"
              value={resId}
              onChange={(e) => setResId(e.target.value)}
            >
              <option value="">Elegí la habitación</option>
              {inHouse.map(({ r, room }) => (
                <option key={r.id} value={r.id}>
                  Hab. {room?.number} · {r.guestName}
                </option>
              ))}
            </Select>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {CATEGORIES.map((c) => {
                const CIcon = CAT_STYLE[c].icon;
                return (
                  <button
                    key={c}
                    onClick={() => setCat(c)}
                    className={cls(
                      "flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[15px] font-medium transition duration-150 motion-reduce:transition-none",
                      cat === c
                        ? "border border-accent bg-accent/10 font-semibold text-gray-900"
                        : "border border-gray-200 bg-white text-gray-700 hover:border-gray-300",
                    )}
                  >
                    <CIcon size={16} aria-hidden /> {c}
                  </button>
                );
              })}
            </div>
            <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200">
              {data.menuItems
                .filter((m) => m.category === cat && m.available)
                .map((m) => {
                  const CIcon = CAT_STYLE[m.category].icon;
                  return (
                    <li
                      key={m.id}
                      className={cls(
                        "flex items-center gap-2 border-l-4 px-3 py-3 text-[15px] transition-colors duration-150 motion-reduce:transition-none",
                        (cart[m.id] ?? 0) > 0
                          ? "border-l-accent bg-accent/10"
                          : "border-l-transparent",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cls(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white",
                          CAT_STYLE[m.category].grad,
                        )}
                      >
                        <CIcon size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium leading-snug">{m.name}</div>
                        <div className="num text-[18px] tabular-nums text-accent">
                          {money(m.price, cur)}
                        </div>
                      </div>
                      <button
                        aria-label={`Sacar uno de ${m.name}`}
                        className={STEP_BTN}
                        onClick={() => add(m.id, -1)}
                      >
                        <Minus size={18} />
                      </button>
                      <span
                        key={cart[m.id] ?? 0}
                        className="num mn-bump w-8 text-center text-[22px] tabular-nums"
                      >
                        {cart[m.id] ?? 0}
                      </span>
                      <button
                        aria-label={`Agregar uno de ${m.name}`}
                        className={STEP_BTN}
                        onClick={() => add(m.id, 1)}
                      >
                        <Plus size={18} />
                      </button>
                    </li>
                  );
                })}
            </ul>
            {!data.menuItems.some((m) => m.category === cat && m.available) && (
              <p className="flex flex-col items-center gap-2 rounded-lg bg-gray-50 px-3 py-4 text-center text-[15px] text-gray-600">
                <Cookie size={22} aria-hidden /> No hay nada disponible en «
                {cat}».
              </p>
            )}
            {lines.length > 0 && (
              <ul className="space-y-1 rounded-xl border border-gray-200 bg-gray-50 p-3.5 text-[15px]">
                {lines.map((l) => (
                  <li
                    key={l.menuItemId}
                    className="ui-pop flex justify-between"
                  >
                    <span>
                      {l.qty}× {l.name}
                    </span>
                    <span className="tabular-nums">
                      {money(l.qty * l.price, cur)}
                    </span>
                  </li>
                ))}
                <li className="mt-2 flex items-baseline justify-between border-t border-gray-200 pt-2.5">
                  <span className="label-mono text-[12.5px] font-semibold text-gray-700">
                    Total
                  </span>
                  <span
                    key={total}
                    className="num mn-bump text-[34px] leading-none tabular-nums text-accent"
                  >
                    <CountUp
                      value={total}
                      format={(n) => money(Math.round(n), cur)}
                      duration={400}
                    />
                  </span>
                </li>
              </ul>
            )}
            <Input
              className="text-[15px]"
              placeholder="Aclaración para la cocina (ej: sin sal, para las 21 h)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button
              variant="primary"
              className="h-12 w-full text-[15px]"
              onClick={submit}
            >
              Enviar pedido y sumarlo a la cuenta
            </Button>
          </div>
        </Card>
      </div>

      {lines.length > 0 && (
        <button
          onClick={() =>
            document
              .getElementById("pedido-nuevo")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          className="ui-pop btn-primary fixed bottom-5 right-4 z-30 flex min-h-[52px] items-center gap-3 rounded-full bg-accent px-5 text-accent-fg shadow-lg xl:hidden"
          aria-label={`Ver el pedido: ${itemCount} productos, total ${money(total, cur)}`}
        >
          <ShoppingBag size={20} aria-hidden />
          <span className="text-[15px] font-semibold">
            {itemCount} {itemCount === 1 ? "producto" : "productos"}
          </span>
          <span className="num text-[20px] tabular-nums">
            {money(total, cur)}
          </span>
        </button>
      )}
    </div>
  );
}
