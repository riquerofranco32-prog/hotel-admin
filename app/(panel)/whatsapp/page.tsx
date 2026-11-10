"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ElementType } from "react";
import { BedDouble, CalendarPlus, Camera, Check, CheckCheck, FileText, Heart, LogIn, LogOut, MessageCircle, Phone, Plus, Send, Trash2, Video } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { CountUp, Ring } from "@/components/viz";
import { fillTemplate, waLink } from "@/components/tasks";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Table, Tabs, Textarea, toast } from "@/components/ui";
import { addDays, fmtDate, fmtDateTime, today } from "@/lib/dates";
import { cls, folio, isActive, money, nights, uid } from "@/lib/logic";
import type { DataState, MessageTemplate, Reservation } from "@/lib/types";

// Motivo de cada sugerencia: ícono y color propios.
const REASON_STYLE: Record<string, { icon: ElementType; cls: string }> = {
  tpl_prellegada: { icon: LogIn, cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  tpl_checkout: { icon: LogOut, cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  tpl_gracias: { icon: Heart, cls: "bg-rose-50 text-rose-700 ring-rose-200" },
  tpl_confirm: { icon: CalendarPlus, cls: "bg-green-50 text-green-700 ring-green-200" },
};

const STYLES = `
@media (prefers-reduced-motion: no-preference){
  @keyframes wa-bubble{from{opacity:0;transform:translateY(8px) scale(.96)}}
  .wa-bubble{animation:wa-bubble .35s cubic-bezier(.22,1,.36,1) both;transform-origin:bottom right}
}
.wa-pattern{background-color:#efe7dd;background-image:radial-gradient(rgba(0,0,0,.07) 1px,transparent 1.5px),radial-gradient(rgba(0,0,0,.05) 1px,transparent 1.5px);background-size:18px 18px,18px 18px;background-position:0 0,9px 9px}
`;

/** Maqueta de teléfono: así le llega el mensaje al huésped. */
function PhonePreview({ name, body }: { name: string; body: string }) {
  const time = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="mx-auto w-full max-w-[340px] rounded-[2rem] border-[7px] border-gray-800 bg-gray-800 shadow-card" role="img" aria-label={`Vista previa del mensaje para ${name}`}>
      <div className="overflow-hidden rounded-[1.5rem] bg-white">
        <div className="flex items-center gap-2.5 bg-[#075e54] px-3 py-2.5 text-white">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/25 text-[15px] font-bold">{name.trim().charAt(0).toUpperCase() || "?"}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold leading-tight">{name}</div>
            <div className="text-[12.5px] leading-tight text-white/85">en línea</div>
          </div>
          <Video size={18} aria-hidden className="opacity-90" />
          <Phone size={17} aria-hidden className="opacity-90" />
        </div>
        <div className="wa-pattern max-h-[320px] min-h-[200px] overflow-y-auto px-3 py-4">
          <div key={body} className="wa-bubble relative ml-auto w-fit max-w-[92%] rounded-xl rounded-tr-none bg-[#d9fdd3] px-3 pb-1.5 pt-2 text-[15px] leading-relaxed text-[#111b21] shadow-sm">
            <span aria-hidden className="absolute -right-[7px] top-0 h-0 w-0 border-l-[8px] border-t-[8px] border-l-[#d9fdd3] border-t-transparent" />
            <div className="whitespace-pre-wrap break-words">{body || "…"}</div>
            <div className="mt-0.5 flex items-center justify-end gap-1 text-[12px] text-[#667781]">
              <span suppressHydrationWarning>{time}</span>
              <CheckCheck size={16} className="text-[#53bdeb]" aria-label="Leído" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-gray-200 bg-gray-100 px-3 py-2 text-[14px] text-gray-600">
          <Camera size={16} aria-hidden /> <span className="flex-1 rounded-full bg-white px-3 py-1.5 ring-1 ring-gray-200">Mensaje</span>
        </div>
      </div>
    </div>
  );
}

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

  const pendingCount = suggestions.filter((s) => !s.done).length;

  return (
    <div className="mx-auto max-w-[1400px] p-4 lg:p-6">
      <style>{STYLES}</style>
      <div className="aurora mb-5">
        <PageHeader title={<span className="serif-accent">WhatsApp</span>} subtitle="Mandá mensajes por WhatsApp a los huéspedes. Elegís el mensaje, se abre WhatsApp con el texto ya escrito y vos solo tocás enviar. Todo queda anotado." />
        <div className="stagger grid grid-cols-1 gap-4 min-[560px]:grid-cols-3">
          <div className="hero-card flex items-center justify-between gap-3 rounded-2xl p-5">
            <div>
              <div className="flex items-center gap-2 text-[15px] font-medium opacity-90"><MessageCircle size={18} aria-hidden /> Para mandar hoy</div>
              <div className="num mt-2 text-[48px] leading-none"><CountUp value={pendingCount} /></div>
            </div>
            {pendingCount > 0 && <span className="pulse-dot h-3 w-3 rounded-full bg-white" aria-hidden />}
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
            <Ring value={suggestions.length ? ((suggestions.length - pendingCount) / suggestions.length) * 100 : 0} size={72} stroke={8} tone="green" label="Mensajes de hoy ya enviados">
              <span className="num text-[18px]">{suggestions.length - pendingCount}</span>
            </Ring>
            <div>
              <div className="label-mono text-[12.5px] text-gray-600">Ya enviados</div>
              <div className="mt-1 text-[14px] text-gray-700">de {suggestions.length} sugeridos para hoy</div>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/20"><FileText size={20} aria-hidden /></span>
            <div className="label-mono mt-3 text-[12.5px] text-gray-600">Mensajes armados</div>
            <div className="num mt-1 text-[30px] leading-none text-gray-900"><CountUp value={data.templates.length} /></div>
          </div>
        </div>
      </div>
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
            <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
              <span className="num text-[34px] leading-none text-accent"><CountUp value={pendingCount} /></span>
              <span className="text-[14px] leading-snug text-gray-700">sin mandar de {suggestions.length} sugeridos. Tocá «Mandar por WhatsApp» en cada uno.</span>
            </div>
            <ul className="stagger space-y-3 p-3 sm:p-4">
              {suggestions.map((s) => {
                const tpl = data.templates.find((x) => x.id === s.tpl)!;
                const rs = REASON_STYLE[s.tpl] ?? REASON_STYLE.tpl_confirm;
                const RIcon = rs.icon;
                return (
                  <li key={s.r.id + s.tpl} className={cls("rounded-2xl border border-l-[6px] bg-white p-3.5 shadow-card transition-colors duration-150 motion-reduce:transition-none sm:p-4", s.done ? "border-gray-200 border-l-green-500 opacity-90" : "lift border-gray-200 border-l-accent")}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[17px] font-semibold leading-snug text-gray-900">{s.r.guestName}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-gray-700">
                          <span className="inline-flex items-center gap-1 font-medium"><BedDouble size={15} aria-hidden /> Hab. {data.rooms.find((x) => x.id === s.r.roomId)?.number}</span>
                          <span className={cls("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-semibold ring-1 ring-inset", rs.cls)}><RIcon size={14} aria-hidden />{s.reason}</span>
                        </div>
                      </div>
                      {s.done && <Badge className="bg-green-50 px-2.5 py-1 text-[13.5px] text-green-700 ring-green-200"><Check size={14} aria-hidden /> Ya enviado</Badge>}
                    </div>
                    <div className="label-mono mt-2.5 text-[12.5px] text-gray-600">{tpl.name}</div>
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
                <li className="flex flex-col items-center gap-3 px-4 py-10 text-center text-[15px] text-gray-600">
                  <span aria-hidden className="relative flex h-20 w-24 items-center justify-center">
                    <span className="absolute left-0 top-1 flex h-12 w-14 items-center justify-center rounded-2xl rounded-bl-sm border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400"><MessageCircle size={22} /></span>
                    <span className="absolute bottom-1 right-0 flex h-12 w-14 items-center justify-center rounded-2xl rounded-br-sm bg-green-50 text-green-700 ring-1 ring-green-200"><Check size={22} /></span>
                  </span>
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
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Mensaje armado">
                  {data.templates
                    .filter((x) => x.audience === "huesped")
                    .map((x) => {
                      const on = x.id === tplId;
                      const first = (r ? fillTemplate(x.body, varsFor(r, data)) : x.body).split("\n").find((l) => l.trim()) ?? "";
                      return (
                        <button key={x.id} type="button" role="radio" aria-checked={on} onClick={() => setTplId(x.id)} className={cls("lift min-h-[44px] rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-accent/40 motion-reduce:transition-none", on ? "border-accent bg-accent/10 ring-1 ring-accent" : "border-gray-200 bg-white")}>
                          <span className="flex items-center justify-between gap-2 text-[15px] font-semibold text-gray-900">{x.name}{on && <Check size={16} className="shrink-0 text-accent" aria-hidden />}</span>
                          <span className="mt-1 line-clamp-2 block text-[13.5px] leading-snug text-gray-600">{first}</span>
                        </button>
                      );
                    })}
                </div>
              </Field>
              <Field label={`Texto del mensaje${guest?.phone ? ` (va al +${guest.phone})` : ""}`}>
                <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
              </Field>
              <div className="label-mono text-[12.5px] font-medium text-gray-700">Así lo va a ver el huésped:</div>
              <PhonePreview name={guest?.name ?? r?.guestName ?? "Huésped"} body={body} />
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
          <ul className="stagger divide-y divide-gray-100">
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
            <div className="flex flex-col items-center gap-3 p-10 text-center text-[15px] text-gray-600">
              <span aria-hidden className="flex h-16 w-20 items-center justify-center rounded-2xl rounded-bl-sm border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400"><MessageCircle size={26} /></span>
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
