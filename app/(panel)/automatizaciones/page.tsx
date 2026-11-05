"use client";
import { useMemo } from "react";
import { Bell, BedDouble, CalendarX, ClipboardList, MessageCircle, Play, Receipt, Sparkles, UserCheck, Wrench, Zap } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Badge, Button, Card, PageHeader, Select, Stat, toast } from "@/components/ui";
import { planAutomations, planSize } from "@/lib/automation";
import { fmtDateTime, today } from "@/lib/dates";
import { automationOf, CHECKOUT_SEQUENCE, cls, TASK_TYPE_ICON, TASK_TYPE_LABEL } from "@/lib/logic";
import { DEFAULT_SETTINGS } from "@/lib/seed";
import type { AutomationConfig } from "@/lib/types";

export default function AutomatizacionesPage() {
  const { data, actions, staffName } = useApp();
  const settings = data.settings[0] ?? DEFAULT_SETTINGS;
  const cfg = automationOf(settings);
  const t = today();

  const set = async (patch: Partial<AutomationConfig>) => {
    await actions.saveSettings({ ...settings, automation: { ...(settings.automation ?? {}), ...cfg, ...patch } });
  };

  const pending = useMemo(() => planSize(planAutomations(data, t)), [data, t]);
  const autoTasks = data.tasks.filter((x) => x.trigger !== "manual");
  const createdToday = autoTasks.filter((x) => x.createdAt.slice(0, 10) === t).length;
  const doneAuto = autoTasks.filter((x) => x.status === "completada" && x.completedAt);
  const onTime = doneAuto.filter((x) => x.completedAt!.slice(0, 10) <= x.dueDate).length;
  const log = data.activity.filter((a) => a.action.startsWith("Automatizaciones") || a.action === "Actualizó configuración").slice(0, 30);

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <PageHeader
        title="Automatizaciones"
        subtitle="Reglas que conectan los paneles entre sí. Corren solas en tiempo real cada vez que cambia algo en el hotel."
        actions={
          <Button
            variant="primary"
            onClick={async () => {
              const n = await actions.runAutomations(true);
              toast(n ? `Se aplicaron ${n} acciones automáticas` : "Todo al día: no había nada pendiente");
            }}
          >
            <Play size={15} /> Ejecutar ahora
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Zap} tone="indigo" label="Tareas automáticas hoy" value={createdToday} />
        <Stat icon={ClipboardList} tone="blue" label="Tareas automáticas totales" value={autoTasks.length} sub={`${autoTasks.filter((x) => x.status !== "completada").length} abiertas`} />
        <Stat icon={UserCheck} tone="green" label="Cumplidas a tiempo" value={`${doneAuto.length ? Math.round((onTime / doneAuto.length) * 100) : 100}%`} />
        <Stat icon={Sparkles} tone={pending ? "orange" : "gray"} label="Acciones pendientes" value={pending} sub={pending ? "se aplican en segundos" : "todo al día"} />
      </div>

      <Section icon={BedDouble} title="Reservas → Mantenimiento / Housekeeping">
        <Rule
          on={cfg.preSalida}
          onToggle={() => set({ preSalida: !cfg.preSalida })}
          color="bg-proxima"
          when="Una reserva pasa a 🔴 Próxima a salir"
          then="Crea “Pre-salida: revisar minibar y consumos” para Recepción."
        >
          <Select value={cfg.preSalidaDias} onChange={(e) => set({ preSalidaDias: Number(e.target.value) })} className="h-8 w-[190px]">
            <option value={0}>El mismo día de salida</option>
            <option value={1}>Desde el día anterior</option>
            <option value={2}>Dos días antes</option>
          </Select>
        </Rule>
        <Rule
          on={cfg.checkoutTasks}
          onToggle={() => set({ checkoutTasks: !cfg.checkoutTasks })}
          color="bg-gray-400"
          when="Se hace el check-out (el huésped ya salió)"
          then="La habitación pasa a “Sucia” y se crean estas tareas. Al completarlas todas vuelve a “Lista”."
        >
          <div className="flex flex-wrap gap-1.5">
            {CHECKOUT_SEQUENCE.map((tp) => {
              const on = cfg.checkoutTipos.includes(tp);
              return (
                <button
                  key={tp}
                  onClick={() => set({ checkoutTipos: on ? cfg.checkoutTipos.filter((x) => x !== tp) : [...cfg.checkoutTipos, tp] })}
                  className={cls("rounded-full px-2.5 py-1 text-xs font-medium ring-1", on ? "bg-gray-900 text-white ring-gray-900" : "bg-white text-gray-500 ring-gray-200")}
                >
                  {TASK_TYPE_ICON[tp]} {TASK_TYPE_LABEL[tp]}
                </button>
              );
            })}
          </div>
        </Rule>
        <Rule
          on={cfg.llegada}
          onToggle={() => set({ llegada: !cfg.llegada })}
          color="bg-reservada"
          when="Hay una 🔵 reserva por llegar"
          then="Crea “Preparar habitación” con los pedidos especiales y preferencias del huésped."
        >
          <Select value={cfg.llegadaDias} onChange={(e) => set({ llegadaDias: Number(e.target.value) })} className="h-8 w-[190px]">
            <option value={0}>El mismo día de llegada</option>
            <option value={1}>Desde el día anterior</option>
            <option value={2}>Dos días antes</option>
          </Select>
        </Rule>
        <Rule
          on={cfg.cerrarAlCheckin}
          onToggle={() => set({ cerrarAlCheckin: !cfg.cerrarAlCheckin })}
          color="bg-ocupada"
          when="Se hace el check-in o el check-out"
          then="Cierra solas las tareas de “Preparar llegada” y “Pre-salida” que quedaron abiertas."
        />
        <Rule
          on={cfg.repasoDiario}
          onToggle={() => set({ repasoDiario: !cfg.repasoDiario })}
          color="bg-ocupada"
          when="Hay un 🟢 huésped en casa"
          then="Crea un “Repaso diario” por habitación ocupada cada día."
        />
      </Section>

      <Section icon={Wrench} title="Equipo de mantenimiento y mucamas">
        <Rule
          on={cfg.autoAsignar}
          onToggle={() => set({ autoAsignar: !cfg.autoAsignar })}
          color="bg-emerald-500"
          when="Se crea una tarea automática"
          then="La asigna a la persona del cargo correspondiente (mucama, recepción o mantenimiento) con menos tareas abiertas. Si está apagado, quedan libres para que las tomen desde “Mi jornada”."
        />
        <Rule
          on={cfg.escalarVencidas}
          onToggle={() => set({ escalarVencidas: !cfg.escalarVencidas })}
          color="bg-red-500"
          when="Una tarea pasa su fecha de vencimiento"
          then="Sube su prioridad a URGENTE y aparece en las alertas 🔔."
        />
        <Rule
          on={cfg.reporteBloquea}
          onToggle={() => set({ reporteBloquea: !cfg.reporteBloquea })}
          color="bg-purple-500"
          when="Una mucama reporta un problema"
          then="Crea una reparación para mantenimiento y bloquea la habitación por defecto (queda rayada en el calendario)."
        />
      </Section>

      <Section icon={CalendarX} title="Recepción y reservas">
        <Rule
          on={cfg.noShowAuto}
          onToggle={() => set({ noShowAuto: !cfg.noShowAuto })}
          color="bg-amber-500"
          when="Una reserva confirmada no hizo check-in"
          then="La marca como No-show automáticamente y libera la habitación (y borra sus tareas pendientes)."
        >
          <Select value={cfg.noShowDias} onChange={(e) => set({ noShowDias: Number(e.target.value) })} className="h-8 w-[190px]">
            <option value={1}>Al día siguiente</option>
            <option value={2}>A los 2 días</option>
            <option value={3}>A los 3 días</option>
          </Select>
        </Rule>
      </Section>

      <Section icon={Bell} title="Avisos en tiempo real">
        <Rule
          on={cfg.avisosEnVivo}
          onToggle={() => set({ avisosEnVivo: !cfg.avisosEnVivo })}
          color="bg-green-500"
          when="Alguien del equipo hace algo (completa una tarea, hace check-in, cobra…)"
          then="Muestra un aviso en vivo a los demás usuarios conectados, y avisa a cada empleado cuando le asignan una tarea nueva."
        />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><Receipt size={15} /> Siempre activas</span>}>
          <ul className="space-y-2 p-4 text-sm text-gray-700">
            <li>🍽️ Cada pedido de room service se carga solo al folio del huésped (y se quita si se cancela).</li>
            <li>🧾 La numeración de facturas avanza sola.</li>
            <li>🧹 El estado de cada habitación (lista / sucia / en limpieza / mantenimiento) se calcula solo con reservas y tareas.</li>
            <li>🔁 Si una reserva cambia de habitación, sus tareas pendientes la siguen.</li>
            <li>❌ Si se cancela una reserva, se borran sus tareas automáticas pendientes.</li>
            <li>
              <MessageCircle size={13} className="mr-1 inline" />
              WhatsApp sugiere cada día a quién escribir (pre-llegada, check-out, agradecimiento).
            </li>
          </ul>
        </Card>
        <Card title="Historial de ejecuciones y cambios">
          <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto text-sm">
            {log.map((a) => (
              <li key={a.id} className="flex justify-between gap-3 px-4 py-2">
                <span>
                  {a.action} <span className="text-gray-400">· {staffName(a.by)}</span>
                </span>
                <span className="shrink-0 text-xs text-gray-500">{fmtDateTime(a.at)}</span>
              </li>
            ))}
            {!log.length && <li className="px-4 py-6 text-center text-gray-500">Sin ejecuciones registradas</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Icon size={15} /> {title}
        </span>
      }
    >
      <div className="divide-y divide-gray-100">{children}</div>
    </Card>
  );
}

function Rule({ on, onToggle, color, when, then, children }: { on: boolean; onToggle: () => void; color: string; when: string; then: string; children?: React.ReactNode }) {
  return (
    <div className={cls("flex flex-wrap items-start gap-4 px-4 py-3.5", !on && "opacity-60")}>
      <span className={cls("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", color)} />
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <div className="text-sm font-medium">Cuando: {when}</div>
          <div className="text-sm text-gray-600">Entonces: {then}</div>
        </div>
        {children && on && <div>{children}</div>}
      </div>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={on}
        className={cls("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-green-500" : "bg-gray-300")}
      >
        <span className={cls("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
      <Badge className={cls("hidden sm:inline-flex", on ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500")}>{on ? "Activa" : "Apagada"}</Badge>
    </div>
  );
}
