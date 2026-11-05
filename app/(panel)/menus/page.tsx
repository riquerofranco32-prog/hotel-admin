"use client";
import { useState } from "react";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Tabs, Textarea, toast } from "@/components/ui";
import { fmtDateTime } from "@/lib/dates";
import { cls, money, uid } from "@/lib/logic";
import type { MenuCategory, MenuItem, Order } from "@/lib/types";

const CATEGORIES: MenuCategory[] = ["Desayuno", "Entradas", "Principales", "Postres", "Bebidas", "Minibar"];
const ORDER_STATUS: Record<Order["status"], { label: string; cls: string }> = {
  pendiente: { label: "Pendiente", cls: "bg-amber-50 text-amber-700" },
  preparando: { label: "Preparando", cls: "bg-blue-50 text-blue-700" },
  entregado: { label: "Entregado", cls: "bg-green-50 text-green-700" },
  cancelado: { label: "Cancelado", cls: "bg-gray-100 text-gray-500" },
};

export default function MenusPage() {
  const { data } = useApp();
  const [tab, setTab] = useState<"pedidos" | "carta">("pedidos");
  const active = data.orders.filter((o) => o.status === "pendiente" || o.status === "preparando").length;
  return (
    <div className="p-4 lg:p-6">
      <PageHeader title="Menús y room service" subtitle="Carta del restaurante y pedidos a la habitación. Cada pedido se carga automáticamente al folio del huésped." />
      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "pedidos", label: `Pedidos${active ? ` (${active})` : ""}` },
            { value: "carta", label: "Carta" },
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
    if (!edit?.name?.trim() || !edit.price) return toast("Completá nombre y precio", "error");
    await actions.saveMenuItem({ available: true, category: "Principales", ...edit, id: edit.id ?? uid("menu"), name: edit.name.trim(), price: Number(edit.price) } as MenuItem);
    toast("Ítem guardado");
    setEdit(null);
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button variant="primary" onClick={() => setEdit({ category: "Principales", available: true })}>
          <Plus size={15} /> Nuevo ítem
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CATEGORIES.map((c) => (
          <Card key={c} title={c}>
            <ul className="divide-y divide-gray-100">
              {data.menuItems
                .filter((m) => m.category === c)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((m) => (
                  <li key={m.id} className="flex items-center gap-2 px-4 py-2.5">
                    <div className={cls("min-w-0 flex-1", !m.available && "opacity-50")}>
                      <div className="text-sm font-medium">{m.name}</div>
                      {m.description && <div className="truncate text-xs text-gray-500">{m.description}</div>}
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{money(m.price, cur)}</span>
                    <label className="flex items-center" title="Disponible">
                      <input type="checkbox" checked={m.available} onChange={() => actions.saveMenuItem({ ...m, available: !m.available })} />
                    </label>
                    <button className="p-1 text-gray-400 hover:text-gray-800" onClick={() => setEdit(m)}>
                      <Pencil size={14} />
                    </button>
                  </li>
                ))}
              {!data.menuItems.some((m) => m.category === c) && <li className="px-4 py-3 text-sm text-gray-400">Sin ítems</li>}
            </ul>
          </Card>
        ))}
      </div>
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? "Editar ítem" : "Nuevo ítem"}
        footer={
          <>
            {edit?.id && (
              <Button variant="ghost" className="mr-auto text-red-600" onClick={() => { actions.deleteMenuItem(edit as MenuItem); setEdit(null); }}>
                <Trash2 size={14} /> Eliminar
              </Button>
            )}
            <Button onClick={() => setEdit(null)}>Cancelar</Button>
            <Button variant="primary" onClick={save}>Guardar</Button>
          </>
        }
      >
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre" className="sm:col-span-2"><Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Categoría">
              <Select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value as MenuCategory })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Precio"><Input type="number" value={edit.price ?? ""} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) })} /></Field>
            <Field label="Descripción" className="sm:col-span-2"><Textarea rows={2} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.available ?? true} onChange={(e) => setEdit({ ...edit, available: e.target.checked })} /> Disponible</label>
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
    if (!r) return toast("Elegí la habitación", "error");
    if (!lines.length) return toast("Agregá productos", "error");
    await actions.createOrder({ reservationId: r.id, roomId: r.roomId, lines, total, notes: notes || undefined });
    toast(`Pedido enviado y cargado al folio (${money(total, cur)})`);
    setCart({});
    setNotes("");
  }

  const orders = data.orders
    .filter((o) => show === "todos" || o.status === "pendiente" || o.status === "preparando")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <Card title="Pedidos" actions={<Tabs value={show} onChange={setShow} items={[{ value: "activos", label: "Activos" }, { value: "todos", label: "Todos" }]} />}>
        <ul className="divide-y divide-gray-100">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
              <span className="rounded bg-gray-900 px-2 py-1 text-sm font-semibold text-white">{data.rooms.find((x) => x.id === o.roomId)?.number}</span>
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-medium">{o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}</div>
                {o.notes && <div className="text-xs text-amber-700">📝 {o.notes}</div>}
                <div className="text-xs text-gray-500">
                  {fmtDateTime(o.createdAt)} · tomado por {staffName(o.createdBy)}
                  {o.deliveredAt && ` · entregado por ${staffName(o.deliveredBy)}`}
                </div>
              </div>
              <b className="tabular-nums text-sm">{money(o.total, cur)}</b>
              <Badge className={ORDER_STATUS[o.status].cls}>{ORDER_STATUS[o.status].label}</Badge>
              <div className="flex gap-1">
                {o.status === "pendiente" && <Button size="sm" onClick={() => actions.setOrderStatus(o, "preparando")}>Preparar</Button>}
                {(o.status === "pendiente" || o.status === "preparando") && (
                  <>
                    <Button size="sm" variant="success" onClick={() => actions.setOrderStatus(o, "entregado")}>Entregado</Button>
                    <Button size="sm" variant="ghost" onClick={() => confirm("¿Cancelar pedido? Se quita el cargo del folio.") && actions.setOrderStatus(o, "cancelado")}>✕</Button>
                  </>
                )}
              </div>
            </li>
          ))}
          {orders.length === 0 && <li className="px-4 py-10 text-center text-sm text-gray-500">No hay pedidos {show === "activos" ? "activos" : ""}</li>}
        </ul>
      </Card>

      <Card title="Nuevo pedido a habitación">
        <div className="space-y-3 p-4">
          <Select value={resId} onChange={(e) => setResId(e.target.value)}>
            <option value="">— Habitación (huéspedes en casa) —</option>
            {inHouse.map(({ r, room }) => (
              <option key={r.id} value={r.id}>
                Hab. {room?.number} · {r.guestName}
              </option>
            ))}
          </Select>
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={cls("rounded-full px-3 py-1 text-xs font-medium", cat === c ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700")}>
                {c}
              </button>
            ))}
          </div>
          <ul className="max-h-64 divide-y divide-gray-100 overflow-y-auto rounded border border-gray-200">
            {data.menuItems
              .filter((m) => m.category === cat && m.available)
              .map((m) => (
                <li key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="flex-1">{m.name}</span>
                  <span className="tabular-nums text-gray-600">{money(m.price, cur)}</span>
                  <button className="rounded border p-1" onClick={() => add(m.id, -1)}><Minus size={12} /></button>
                  <span className="w-5 text-center tabular-nums">{cart[m.id] ?? 0}</span>
                  <button className="rounded border p-1" onClick={() => add(m.id, 1)}><Plus size={12} /></button>
                </li>
              ))}
          </ul>
          {lines.length > 0 && (
            <ul className="rounded bg-gray-50 p-3 text-sm">
              {lines.map((l) => (
                <li key={l.menuItemId} className="flex justify-between">
                  <span>{l.qty}× {l.name}</span>
                  <span className="tabular-nums">{money(l.qty * l.price, cur)}</span>
                </li>
              ))}
              <li className="mt-1 flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>{money(total, cur)}</span></li>
            </ul>
          )}
          <Input placeholder="Notas (sin sal, para las 21 h…)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button variant="primary" className="w-full" onClick={submit}>Enviar pedido y cargar al folio</Button>
        </div>
      </Card>
    </div>
  );
}
