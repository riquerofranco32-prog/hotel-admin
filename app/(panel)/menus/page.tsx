"use client";
import { useState } from "react";
import { ClipboardList, Minus, Pencil, Plus, StickyNote, Trash2, Utensils } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Tabs, Textarea, toast } from "@/components/ui";
import { fmtDateTime } from "@/lib/dates";
import { cls, money, uid } from "@/lib/logic";
import type { MenuCategory, MenuItem, Order } from "@/lib/types";

const CATEGORIES: MenuCategory[] = ["Desayuno", "Entradas", "Principales", "Postres", "Bebidas", "Minibar"];
const ORDER_STATUS: Record<Order["status"], { label: string; cls: string; strip: string }> = {
  pendiente: { label: "Pendiente", cls: "bg-amber-50 text-amber-700 ring-amber-200", strip: "border-l-amber-300" },
  preparando: { label: "Preparando", cls: "bg-blue-50 text-blue-700 ring-blue-200", strip: "border-l-blue-300" },
  entregado: { label: "Entregado", cls: "bg-green-50 text-green-700 ring-green-200", strip: "border-l-green-300" },
  cancelado: { label: "Cancelado", cls: "bg-gray-100 text-gray-600 ring-gray-200", strip: "border-l-gray-300" },
};
const STEP_BTN =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 transition duration-150 hover:bg-gray-50 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100";
const TOUCH_BTN = "";

export default function MenusPage() {
  const { data } = useApp();
  const [tab, setTab] = useState<"pedidos" | "carta">("pedidos");
  const active = data.orders.filter((o) => o.status === "pendiente" || o.status === "preparando").length;
  return (
    <div className="mx-auto max-w-[1400px] p-4 lg:p-6">
      <PageHeader title="Comidas y pedidos a la habitación" subtitle="Acá armás la carta de comidas y anotás lo que piden los huéspedes. Cada pedido se suma solo a la cuenta del huésped." />
      <div className="mb-5 max-w-full overflow-x-auto">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "pedidos", label: `Pedidos${active ? ` (${active})` : ""}` },
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
    if (!edit?.name?.trim() || !edit.price) return toast("Escribí el nombre y el precio para poder guardar", "error");
    await actions.saveMenuItem({ available: true, category: "Principales", ...edit, id: edit.id ?? uid("menu"), name: edit.name.trim(), price: Number(edit.price) } as MenuItem);
    toast("Listo ✔ Se guardó");
    setEdit(null);
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" className={`${TOUCH_BTN} w-full sm:w-auto`} onClick={() => setEdit({ category: "Principales", available: true })}>
          <Plus size={15} /> Agregar comida o bebida
        </Button>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {CATEGORIES.map((c) => (
          <Card key={c} title={c}>
            <ul className="divide-y divide-gray-100">
              {data.menuItems
                .filter((m) => m.category === c)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((m) => (
                  <li key={m.id} className="px-4 py-3.5 transition-colors duration-150 hover:bg-gray-50 motion-reduce:transition-none">
                    <div className="flex items-start justify-between gap-3">
                      <div className={cls("min-w-0 flex-1", !m.available && "opacity-60")}>
                        <div className="text-[16px] font-semibold leading-snug text-gray-900">{m.name}</div>
                        {m.description && <div className="mt-0.5 text-[14px] leading-snug text-gray-600">{m.description}</div>}
                      </div>
                      <span className={cls("shrink-0 text-[18px] font-semibold tabular-nums tracking-tight", m.available ? "text-gray-900" : "text-gray-500 line-through")}>{money(m.price, cur)}</span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                      <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-[14px] font-medium text-gray-700">
                        <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--accent))]" checked={m.available} onChange={() => actions.saveMenuItem({ ...m, available: !m.available })} /> Hay
                      </label>
                      <button className="flex h-11 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 text-[14px] font-medium text-gray-800 transition duration-150 hover:bg-gray-50 active:scale-[0.98] motion-reduce:transition-none sm:h-10" onClick={() => setEdit(m)}>
                        <Pencil size={14} /> Cambiar
                      </button>
                    </div>
                  </li>
                ))}
              {!data.menuItems.some((m) => m.category === c) && (
                <li className="flex flex-col items-center gap-2 px-4 py-8 text-center text-[15px] text-gray-600">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-500"><Utensils size={20} aria-hidden /></span>
                  Todavía no hay nada acá. Tocá «Agregar comida o bebida».
                </li>
              )}
            </ul>
          </Card>
        ))}
      </div>
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? "Cambiar comida o bebida" : "Agregar comida o bebida"}
        footer={
          <>
            {edit?.id && (
              <Button variant="ghost" className="mr-auto text-red-600" onClick={() => { actions.deleteMenuItem(edit as MenuItem); setEdit(null); }}>
                <Trash2 size={14} /> Borrar
              </Button>
            )}
            <Button onClick={() => setEdit(null)}>Cerrar sin guardar</Button>
            <Button variant="primary" onClick={save}>Guardar</Button>
          </>
        }
      >
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre (ej: Milanesa con papas)" className="sm:col-span-2"><Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Tipo">
              <Select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value as MenuCategory })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Precio"><Input type="number" value={edit.price ?? ""} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) })} /></Field>
            <Field label="Descripción (opcional)" className="sm:col-span-2"><Textarea rows={2} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <label className="flex min-h-[44px] items-center gap-2.5 text-[15px] font-medium"><input type="checkbox" className="h-5 w-5 accent-[rgb(var(--accent))]" checked={edit.available ?? true} onChange={(e) => setEdit({ ...edit, available: e.target.checked })} /> Hay disponible hoy</label>
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
    .sort((a, b) => (a.room?.number ?? "").localeCompare(b.room?.number ?? "", undefined, { numeric: true }));
  const lines = Object.entries(cart)
    .filter(([, q]) => q > 0)
    .map(([id, qty]) => {
      const m = data.menuItems.find((x) => x.id === id)!;
      return { menuItemId: id, name: m.name, qty, price: m.price };
    });
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const add = (id: string, d: number) => setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + d) }));

  async function submit() {
    const r = data.reservations.find((x) => x.id === resId);
    if (!r) return toast("Elegí primero la habitación", "error");
    if (!lines.length) return toast("Tocá el + en lo que piden", "error");
    await actions.createOrder({ reservationId: r.id, roomId: r.roomId, lines, total, notes: notes || undefined });
    toast(`Listo ✔ Pedido enviado y sumado a la cuenta (${money(total, cur)})`);
    setCart({});
    setNotes("");
  }

  const orders = data.orders
    .filter((o) => show === "todos" || o.status === "pendiente" || o.status === "preparando")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[1fr_440px]">
      <Card title="Pedidos" actions={<Tabs value={show} onChange={setShow} items={[{ value: "activos", label: "En curso" }, { value: "todos", label: "Todos" }]} />}>
        <ul className="space-y-3 p-3 sm:p-4">
          {orders.map((o) => (
            <li key={o.id} className={cls("rounded-xl border border-l-4 border-gray-200 bg-white p-3.5 shadow-card sm:p-4", ORDER_STATUS[o.status].strip)}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-lg bg-gray-900 px-2.5 py-1 text-[15px] font-semibold text-white">Hab. {data.rooms.find((x) => x.id === o.roomId)?.number}</span>
                <div className="flex items-center gap-3">
                  <Badge className={cls("px-2.5 py-1 text-[13.5px]", ORDER_STATUS[o.status].cls)}>{ORDER_STATUS[o.status].label}</Badge>
                  <b className="text-[18px] tabular-nums tracking-tight">{money(o.total, cur)}</b>
                </div>
              </div>
              <div className="mt-2.5 min-w-0 text-[15px]">
                <div className="font-medium leading-snug">{o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}</div>
                {o.notes && <div className="mt-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[14px] text-amber-800"><StickyNote size={15} className="mr-1 inline-block align-[-2px]" aria-hidden /> {o.notes}</div>}
                <div className="mt-1.5 text-[13.5px] text-gray-600">
                  {fmtDateTime(o.createdAt)} · anotado por {staffName(o.createdBy)}
                  {o.deliveredAt && ` · entregado por ${staffName(o.deliveredBy)}`}
                </div>
              </div>
              {(o.status === "pendiente" || o.status === "preparando") && (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                  {o.status === "pendiente" && <Button className={TOUCH_BTN} onClick={() => actions.setOrderStatus(o, "preparando")}>Empezar a preparar</Button>}
                  <Button variant="success" className={TOUCH_BTN} onClick={() => actions.setOrderStatus(o, "entregado")}>Ya lo entregué</Button>
                  <Button variant="ghost" className={TOUCH_BTN} onClick={() => confirm("¿Cancelar este pedido? Se saca el cobro de la cuenta del huésped.") && actions.setOrderStatus(o, "cancelado")}>Cancelar pedido</Button>
                </div>
              )}
            </li>
          ))}
          {orders.length === 0 && (
            <li className="flex flex-col items-center gap-2 px-4 py-10 text-center text-[15px] text-gray-600">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500"><ClipboardList size={22} aria-hidden /></span>
              {show === "activos" ? "No hay pedidos en curso. Cuando anotes uno, aparece acá." : "Todavía no hay pedidos."}
            </li>
          )}
        </ul>
      </Card>

      <Card title="Anotar un pedido nuevo">
        <div className="space-y-4 p-4">
          <p className="rounded-lg bg-gray-50 px-3 py-2.5 text-[14px] leading-relaxed text-gray-700">1) Elegí la habitación. 2) Tocá el + en lo que piden. 3) Tocá el botón de abajo.</p>
          {inHouse.length === 0 && <p className="text-[14px] text-amber-800">Ahora no hay huéspedes alojados, así que no se puede anotar ningún pedido.</p>}
          <Select className="text-[15px]" value={resId} onChange={(e) => setResId(e.target.value)}>
            <option value="">Elegí la habitación</option>
            {inHouse.map(({ r, room }) => (
              <option key={r.id} value={r.id}>
                Hab. {room?.number} · {r.guestName}
              </option>
            ))}
          </Select>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={cls("h-11 shrink-0 rounded-full px-4 text-[15px] font-medium transition duration-150 motion-reduce:transition-none", cat === c ? "bg-gray-900 text-white shadow-card" : "bg-gray-100 text-gray-700 hover:bg-gray-200")}>
                {c}
              </button>
            ))}
          </div>
          <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200">
            {data.menuItems
              .filter((m) => m.category === cat && m.available)
              .map((m) => (
                <li key={m.id} className={cls("flex items-center gap-2 px-3 py-2.5 text-[15px] transition-colors duration-150 motion-reduce:transition-none", (cart[m.id] ?? 0) > 0 && "bg-accent/10")}>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium leading-snug">{m.name}</div>
                    <div className="text-[14px] font-semibold tabular-nums text-gray-700">{money(m.price, cur)}</div>
                  </div>
                  <button aria-label={`Sacar uno de ${m.name}`} className={STEP_BTN} onClick={() => add(m.id, -1)}><Minus size={18} /></button>
                  <span className="w-7 text-center text-[17px] font-semibold tabular-nums">{cart[m.id] ?? 0}</span>
                  <button aria-label={`Agregar uno de ${m.name}`} className={STEP_BTN} onClick={() => add(m.id, 1)}><Plus size={18} /></button>
                </li>
              ))}
          </ul>
          {!data.menuItems.some((m) => m.category === cat && m.available) && <p className="rounded-lg bg-gray-50 px-3 py-3 text-center text-[15px] text-gray-600">No hay nada disponible en «{cat}».</p>}
          {lines.length > 0 && (
            <ul className="space-y-1 rounded-xl border border-gray-200 bg-gray-50 p-3.5 text-[15px]">
              {lines.map((l) => (
                <li key={l.menuItemId} className="flex justify-between">
                  <span>{l.qty}× {l.name}</span>
                  <span className="tabular-nums">{money(l.qty * l.price, cur)}</span>
                </li>
              ))}
              <li className="mt-2 flex items-baseline justify-between border-t border-gray-200 pt-2 text-[17px] font-semibold"><span>Total</span><span className="tabular-nums">{money(total, cur)}</span></li>
            </ul>
          )}
          <Input className="text-[15px]" placeholder="Aclaración para la cocina (ej: sin sal, para las 21 h)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button variant="primary" className="h-12 w-full text-[15px]" onClick={submit}>Enviar pedido y sumarlo a la cuenta</Button>
        </div>
      </Card>
    </div>
  );
}
