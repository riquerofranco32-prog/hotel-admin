"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Send, Trash2 } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { fillTemplate, waLink } from "@/components/tasks";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Table, Tabs, Textarea, toast } from "@/components/ui";
import { addDays, fmtDate, fmtDateTime, today } from "@/lib/dates";
import { folio, isActive, money, nights, uid } from "@/lib/logic";
import type { DataState, MessageTemplate, Reservation } from "@/lib/types";

function varsFor(r: Reservation, data: DataState): Record<string, string> {
  const s = data.settings[0];
  return {
    nombre: r.guestName.split(" ")[0],
    hotel: s?.hotelName ?? "",
    habitacion: data.rooms.find((x) => x.id === r.roomId)?.number ?? "",
    checkin: fmtDate(r.checkIn),
    checkout: fmtDate(r.checkOut),
    noches: String(nights(r)),
    saldo: money(Math.max(0, folio(r, data).balance), s?.currency),
    hora_checkin: s?.checkInTime ?? "14:00",
    hora_checkout: s?.checkOutTime ?? "10:00",
  };
}

export default function Page() {
  return (
    <Suspense>
      <WhatsApp />
    </Suspense>
  );
}

function WhatsApp() {
  const { data, actions, staffName } = useApp();
  const params = useSearchParams();
  const [tab, setTab] = useState<"enviar" | "plantillas" | "historial">("enviar");
  const [resId, setResId] = useState(params.get("r") ?? "");
  const [tplId, setTplId] = useState("tpl_confirm");
  const [body, setBody] = useState("");
  const [editTpl, setEditTpl] = useState<Partial<MessageTemplate> | null>(null);
  const t = today();

  useEffect(() => {
    if (params.get("r")) setResId(params.get("r")!);
  }, [params]);

  const r = data.reservations.find((x) => x.id === resId);
  const guest = r ? data.guests.find((g) => g.id === r.guestId) : undefined;

  useEffect(() => {
    const tpl = data.templates.find((x) => x.id === tplId);
    if (tpl && r) setBody(fillTemplate(tpl.body, varsFor(r, data)));
    else if (tpl) setBody(tpl.body);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tplId, resId, data.templates]);

  function send(res: Reservation, text: string) {
    const g = data.guests.find((x) => x.id === res.guestId);
    if (!g?.phone) return toast("El huésped no tiene teléfono cargado", "error");
    window.open(waLink(g.phone, text), "_blank");
    actions.logMessage({ to: g.id, toName: g.name, phone: g.phone, body: text, reservationId: res.id });
  }

  const suggestions = useMemo(() => {
    const out: { r: Reservation; tpl: string; reason: string }[] = [];
    const sent = (rid: string, tpl: string) => data.messages.some((m) => m.reservationId === rid && m.body.startsWith((data.templates.find((x) => x.id === tpl)?.body ?? "").slice(0, 12)));
    data.reservations.filter(isActive).forEach((x) => {
      if (x.checkIn === addDays(t, 1) && x.status !== "checkin") out.push({ r: x, tpl: "tpl_prellegada", reason: "Llega mañana" });
      if (x.status === "checkin" && x.checkOut <= addDays(t, 1)) out.push({ r: x, tpl: "tpl_checkout", reason: x.checkOut === t ? "Sale hoy" : "Sale mañana" });
      if (x.status === "checkout" && x.checkOut >= addDays(t, -1)) out.push({ r: x, tpl: "tpl_gracias", reason: "Salió recientemente" });
      if (x.status === "confirmada" && x.createdAt.slice(0, 10) >= addDays(t, -1)) out.push({ r: x, tpl: "tpl_confirm", reason: "Reserva nueva" });
    });
    return out.filter((s) => data.templates.some((x) => x.id === s.tpl)).map((s) => ({ ...s, done: sent(s.r.id, s.tpl) }));
  }, [data, t]);

  return (
    <div className="p-4 lg:p-6">
      <PageHeader title="WhatsApp" subtitle="Mensajes a huéspedes y personal con plantillas. Se abren en WhatsApp Web/App con el texto listo y quedan registrados." />
      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "enviar", label: "Enviar" },
            { value: "plantillas", label: `Plantillas (${data.templates.length})` },
            { value: "historial", label: `Historial (${data.messages.length})` },
          ]}
        />
      </div>

      {tab === "enviar" && (
        <div className="grid gap-4 xl:grid-cols-[1fr_460px]">
          <Card title={`Envíos sugeridos (${suggestions.filter((s) => !s.done).length} pendientes)`}>
            <ul className="divide-y divide-gray-100">
              {suggestions.map((s) => {
                const tpl = data.templates.find((x) => x.id === s.tpl)!;
                return (
                  <li key={s.r.id + s.tpl} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="font-medium">
                        {s.r.guestName} <span className="text-gray-400">· Hab. {data.rooms.find((x) => x.id === s.r.roomId)?.number}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {s.reason} · {tpl.name}
                      </div>
                    </div>
                    {s.done && <Badge className="bg-green-50 text-green-700">Enviado</Badge>}
                    <Button size="sm" onClick={() => { setResId(s.r.id); setTplId(s.tpl); }}>
                      Editar
                    </Button>
                    <Button size="sm" variant="success" onClick={() => send(s.r, fillTemplate(tpl.body, varsFor(s.r, data)))}>
                      <Send size={13} /> Enviar
                    </Button>
                  </li>
                );
              })}
              {suggestions.length === 0 && <li className="px-4 py-10 text-center text-sm text-gray-500">No hay envíos sugeridos para hoy.</li>}
            </ul>
          </Card>

          <Card title="Redactar mensaje">
            <div className="space-y-3 p-4">
              <Field label="Reserva / huésped">
                <Select value={resId} onChange={(e) => setResId(e.target.value)}>
                  <option value="">— Elegir —</option>
                  {data.reservations
                    .filter((x) => isActive(x) && x.checkOut >= addDays(t, -7) && x.checkIn <= addDays(t, 30))
                    .sort((a, b) => a.guestName.localeCompare(b.guestName))
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.guestName} · Hab. {data.rooms.find((y) => y.id === x.roomId)?.number} · {fmtDate(x.checkIn).slice(0, 5)}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Plantilla">
                <Select value={tplId} onChange={(e) => setTplId(e.target.value)}>
                  {data.templates
                    .filter((x) => x.audience === "huesped")
                    .map((x) => (
                      <option key={x.id} value={x.id}>{x.name}</option>
                    ))}
                </Select>
              </Field>
              <Field label={`Mensaje ${guest?.phone ? `→ +${guest.phone}` : ""}`}>
                <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
              </Field>
              <div className="rounded-lg bg-[#e7ffdb] p-3 text-sm shadow-inner">
                <div className="whitespace-pre-wrap">{body || "…"}</div>
              </div>
              <Button variant="success" className="w-full" disabled={!r} onClick={() => r && send(r, body)}>
                <Send size={15} /> Abrir en WhatsApp
              </Button>
            </div>
          </Card>
        </div>
      )}

      {tab === "plantillas" && (
        <Card
          title="Plantillas"
          actions={
            <Button size="sm" variant="primary" onClick={() => setEditTpl({ audience: "huesped", body: "" })}>
              <Plus size={14} /> Nueva
            </Button>
          }
        >
          <ul className="divide-y divide-gray-100">
            {data.templates.map((x) => (
              <li key={x.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {x.name} <Badge className="ml-1 bg-gray-100 text-gray-600">{x.audience === "huesped" ? "Huésped" : "Personal"}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-gray-600">{x.body}</div>
                </div>
                <Button size="sm" onClick={() => setEditTpl(x)}>Editar</Button>
              </li>
            ))}
          </ul>
          <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
            Variables: {"{{nombre}} {{hotel}} {{habitacion}} {{checkin}} {{checkout}} {{noches}} {{saldo}} {{hora_checkin}} {{hora_checkout}}"} · Para personal:{" "}
            {"{{tarea}} {{prioridad}} {{vence}}"}
          </p>
        </Card>
      )}

      {tab === "historial" && (
        <Card>
          <Table head={["Fecha", "Para", "Teléfono", "Mensaje", "Enviado por"]}>
            {data.messages
              .slice()
              .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
              .map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">{fmtDateTime(m.sentAt)}</td>
                  <td className="px-4 py-2.5 font-medium">
                    {m.toName} {m.taskId && <Badge className="bg-indigo-50 text-indigo-700">Tarea</Badge>}
                  </td>
                  <td className="px-4 py-2.5">+{m.phone}</td>
                  <td className="max-w-[420px] truncate px-4 py-2.5 text-gray-600" title={m.body}>{m.body}</td>
                  <td className="px-4 py-2.5">{staffName(m.sentBy)}</td>
                </tr>
              ))}
          </Table>
          {data.messages.length === 0 && <p className="p-8 text-center text-sm text-gray-500">Todavía no se enviaron mensajes.</p>}
        </Card>
      )}

      <Modal
        open={!!editTpl}
        onClose={() => setEditTpl(null)}
        title={editTpl?.id ? "Editar plantilla" : "Nueva plantilla"}
        footer={
          <>
            {editTpl?.id && (
              <Button variant="ghost" className="mr-auto text-red-600" onClick={() => { actions.deleteTemplate(editTpl as MessageTemplate); setEditTpl(null); }}>
                <Trash2 size={14} /> Eliminar
              </Button>
            )}
            <Button onClick={() => setEditTpl(null)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!editTpl?.name || !editTpl.body) return toast("Completá nombre y texto", "error");
                await actions.saveTemplate({ ...(editTpl as MessageTemplate), id: editTpl.id ?? uid("tpl") });
                setEditTpl(null);
                toast("Plantilla guardada");
              }}
            >
              Guardar
            </Button>
          </>
        }
      >
        {editTpl && (
          <div className="space-y-3">
            <Field label="Nombre"><Input value={editTpl.name ?? ""} onChange={(e) => setEditTpl({ ...editTpl, name: e.target.value })} /></Field>
            <Field label="Destinatario">
              <Select value={editTpl.audience} onChange={(e) => setEditTpl({ ...editTpl, audience: e.target.value as MessageTemplate["audience"] })}>
                <option value="huesped">Huésped</option>
                <option value="staff">Personal</option>
              </Select>
            </Field>
            <Field label="Texto"><Textarea rows={5} value={editTpl.body ?? ""} onChange={(e) => setEditTpl({ ...editTpl, body: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
