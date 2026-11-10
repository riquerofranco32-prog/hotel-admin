"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BedDouble, Check, MessageCircle, Plus, Send, Trash2 } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { fillTemplate, waLink } from "@/components/tasks";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Table, Tabs, Textarea, toast } from "@/components/ui";
import { addDays, fmtDate, fmtDateTime, today } from "@/lib/dates";
import { cls, folio, isActive, money, nights, uid } from "@/lib/logic";
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
    if (!g?.phone) return toast("Este huésped no tiene teléfono cargado. Cargale el teléfono primero.", "error");
    window.open(waLink(g.phone, text), "_blank");
    actions.logMessage({ to: g.id, toName: g.name, phone: g.phone, body: text, reservationId: res.id });
  }

  const suggestions = useMemo(() => {
    const out: { r: Reservation; tpl: string; reason: string }[] = [];
    const sent = (rid: string, tpl: string) => data.messages.some((m) => m.reservationId === rid && m.body.startsWith((data.templates.find((x) => x.id === tpl)?.body ?? "").slice(0, 12)));
    data.reservations.filter(isActive).forEach((x) => {
      if (x.checkIn === addDays(t, 1) && x.status !== "checkin") out.push({ r: x, tpl: "tpl_prellegada", reason: "Llega mañana" });
      if (x.status === "checkin" && x.checkOut <= addDays(t, 1)) out.push({ r: x, tpl: "tpl_checkout", reason: x.checkOut === t ? "Sale hoy" : "Sale mañana" });
      if (x.status === "checkout" && x.checkOut >= addDays(t, -1)) out.push({ r: x, tpl: "tpl_gracias", reason: "Se fue hace poco" });
      if (x.status === "confirmada" && x.createdAt.slice(0, 10) >= addDays(t, -1)) out.push({ r: x, tpl: "tpl_confirm", reason: "Reserva nueva" });
    });
    return out.filter((s) => data.templates.some((x) => x.id === s.tpl)).map((s) => ({ ...s, done: sent(s.r.id, s.tpl) }));
  }, [data, t]);

  return (
    <div className="mx-auto max-w-[1400px] p-4 lg:p-6">
      <PageHeader title="WhatsApp" subtitle="Mandá mensajes por WhatsApp a los huéspedes. Elegís el mensaje, se abre WhatsApp con el texto ya escrito y vos solo tocás enviar. Todo queda anotado." />
      <div className="mb-5 max-w-full overflow-x-auto">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "enviar", label: "Mandar mensaje" },
            { value: "plantillas", label: `Mensajes armados (${data.templates.length})` },
            { value: "historial", label: `Mensajes enviados (${data.messages.length})` },
          ]}
        />
      </div>

      {tab === "enviar" && (
        <div className="grid items-start gap-5 xl:grid-cols-[1fr_460px]">
          <Card title={`Mensajes para mandar hoy (${suggestions.filter((s) => !s.done).length} sin mandar)`}>
            <ul className="space-y-3 p-3 sm:p-4">
              {suggestions.map((s) => {
                const tpl = data.templates.find((x) => x.id === s.tpl)!;
                return (
                  <li key={s.r.id + s.tpl} className={cls("rounded-xl border bg-white p-3.5 shadow-card transition-colors duration-150 motion-reduce:transition-none sm:p-4", s.done ? "border-gray-200 opacity-90" : "border-gray-200 hover:border-gray-300")}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[17px] font-semibold leading-snug text-gray-900">{s.r.guestName}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-gray-700">
                          <span className="inline-flex items-center gap-1 font-medium"><BedDouble size={15} aria-hidden /> Hab. {data.rooms.find((x) => x.id === s.r.roomId)?.number}</span>
                          <span aria-hidden className="text-gray-600">·</span>
                          <span>{s.reason}</span>
                        </div>
                      </div>
                      {s.done && <Badge className="bg-green-50 px-2.5 py-1 text-[13.5px] text-green-700 ring-green-200"><Check size={14} aria-hidden /> Ya enviado</Badge>}
                    </div>
                    <div className="mt-2 text-[14px] text-gray-600">{tpl.name}</div>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                      <Button variant="success" className="h-11 text-[15px] sm:h-10" onClick={() => send(s.r, fillTemplate(tpl.body, varsFor(s.r, data)))}>
                        <Send size={15} /> Mandar por WhatsApp
                      </Button>
                      <Button className="h-11 sm:h-10" onClick={() => { setResId(s.r.id); setTplId(s.tpl); }}>
                        Cambiar el texto
                      </Button>
                    </div>
                  </li>
                );
              })}
              {suggestions.length === 0 && (
                <li className="flex flex-col items-center gap-2 px-4 py-10 text-center text-[15px] text-gray-600">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500"><MessageCircle size={22} aria-hidden /></span>
                  Hoy no hay mensajes para mandar. Si querés escribirle a alguien, usá el cuadro «Escribir un mensaje».
                </li>
              )}
            </ul>
          </Card>

          <Card title="Escribir un mensaje">
            <div className="space-y-4 p-4">
              <Field label="¿A quién le escribís?">
                <Select className="text-[15px]" value={resId} onChange={(e) => setResId(e.target.value)}>
                  <option value="">Elegí un huésped</option>
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
              <Field label="Mensaje armado">
                <Select className="text-[15px]" value={tplId} onChange={(e) => setTplId(e.target.value)}>
                  {data.templates
                    .filter((x) => x.audience === "huesped")
                    .map((x) => (
                      <option key={x.id} value={x.id}>{x.name}</option>
                    ))}
                </Select>
              </Field>
              <Field label={`Texto del mensaje${guest?.phone ? ` (va al +${guest.phone})` : ""}`}>
                <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
              </Field>
              <div className="text-[14px] font-medium text-gray-700">Así lo va a ver el huésped:</div>
              <div className="rounded-xl bg-gray-100 p-3 sm:p-4">
                <div className="relative ml-auto max-w-[92%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] px-3.5 py-2.5 text-[15px] leading-relaxed text-[#111b21] shadow-card">
                  <div className="whitespace-pre-wrap break-words">{body || "…"}</div>
                </div>
              </div>
              <Button variant="success" className="h-12 w-full text-[15px]" disabled={!r} onClick={() => r && send(r, body)}>
                <Send size={15} /> Abrir WhatsApp con este mensaje
              </Button>
            </div>
          </Card>
        </div>
      )}

      {tab === "plantillas" && (
        <Card
          title="Mensajes armados"
          actions={
            <Button variant="primary" className="h-11 sm:h-10" onClick={() => setEditTpl({ audience: "huesped", body: "" })}>
              <Plus size={14} /> Agregar mensaje
            </Button>
          }
        >
          <ul className="divide-y divide-gray-100">
            {data.templates.map((x) => (
              <li key={x.id} className="flex flex-col gap-3 px-4 py-4 transition-colors duration-150 hover:bg-gray-50 motion-reduce:transition-none sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[16px] font-semibold">
                    {x.name} <Badge className="bg-gray-100 text-gray-600 ring-gray-200">{x.audience === "huesped" ? "Para huéspedes" : "Para el personal"}</Badge>
                  </div>
                  <div className="mt-1.5 whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-[14.5px] leading-relaxed text-gray-700">{x.body}</div>
                </div>
                <Button className="h-11 sm:h-10" onClick={() => setEditTpl(x)}>Cambiar</Button>
              </li>
            ))}
          </ul>
          <p className="border-t border-gray-100 bg-gray-50 px-4 py-3 text-[14px] leading-relaxed text-gray-600">
            Estas palabras se completan solas con los datos de cada huésped (nombre, habitación, fechas, etc.). Podés usar: {"{{nombre}} {{hotel}} {{habitacion}} {{checkin}} {{checkout}} {{noches}} {{saldo}} {{hora_checkin}} {{hora_checkout}}"} · Para mensajes al personal:{" "}
            {"{{tarea}} {{prioridad}} {{vence}}"}
          </p>
        </Card>
      )}

      {tab === "historial" && (
        <Card>
          <Table head={["Fecha", "Para quién", "Teléfono", "Mensaje", "Lo mandó"]}>
            {data.messages
              .slice()
              .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
              .map((m) => (
                <tr key={m.id} className="transition-colors duration-150 hover:bg-gray-50 motion-reduce:transition-none">
                  <td className="whitespace-nowrap px-4 py-3 text-[14px] text-gray-700">{fmtDateTime(m.sentAt)}</td>
                  <td className="px-4 py-3 text-[15px] font-semibold">
                    {m.toName} {m.taskId && <Badge className="bg-indigo-50 text-indigo-700">Tarea</Badge>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[14px] tabular-nums">+{m.phone}</td>
                  <td className="max-w-[420px] truncate px-4 py-3 text-[14px] text-gray-700" title={m.body}>{m.body}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[14px]">{staffName(m.sentBy)}</td>
                </tr>
              ))}
          </Table>
          {data.messages.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-[15px] text-gray-600">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500"><MessageCircle size={22} aria-hidden /></span>
              Todavía no mandaste ningún mensaje. Cuando mandes uno, queda anotado acá.
            </div>
          )}
        </Card>
      )}

      <Modal
        open={!!editTpl}
        onClose={() => setEditTpl(null)}
        title={editTpl?.id ? "Cambiar mensaje armado" : "Agregar mensaje armado"}
        footer={
          <>
            {editTpl?.id && (
              <Button variant="ghost" className="mr-auto text-red-600" onClick={() => { actions.deleteTemplate(editTpl as MessageTemplate); setEditTpl(null); }}>
                <Trash2 size={14} /> Borrar
              </Button>
            )}
            <Button onClick={() => setEditTpl(null)}>Cerrar sin guardar</Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!editTpl?.name || !editTpl.body) return toast("Escribí el nombre y el texto del mensaje", "error");
                await actions.saveTemplate({ ...(editTpl as MessageTemplate), id: editTpl.id ?? uid("tpl") });
                setEditTpl(null);
                toast("Listo ✔ Mensaje guardado");
              }}
            >
              Guardar
            </Button>
          </>
        }
      >
        {editTpl && (
          <div className="space-y-3">
            <Field label="Nombre (para reconocerlo, ej: Bienvenida)"><Input value={editTpl.name ?? ""} onChange={(e) => setEditTpl({ ...editTpl, name: e.target.value })} /></Field>
            <Field label="¿Para quién es?">
              <Select value={editTpl.audience} onChange={(e) => setEditTpl({ ...editTpl, audience: e.target.value as MessageTemplate["audience"] })}>
                <option value="huesped">Para huéspedes</option>
                <option value="staff">Para el personal</option>
              </Select>
            </Field>
            <Field label="Texto del mensaje"><Textarea rows={5} value={editTpl.body ?? ""} onChange={(e) => setEditTpl({ ...editTpl, body: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
