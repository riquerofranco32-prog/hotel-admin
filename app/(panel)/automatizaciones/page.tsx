"use client";
import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  BedDouble,
  Bell,
  BellRing,
  CalendarCheck,
  CalendarX,
  ClipboardCheck,
  ClipboardList,
  Hammer,
  History,
  Info,
  LogIn,
  LogOut,
  MessageCircle,
  Play,
  Receipt,
  Repeat,
  Settings,
  Shirt,
  Sparkles,
  UserCheck,
  UserX,
  Users,
  UtensilsCrossed,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Button, Card, Empty, PageHeader, Select, toast } from "@/components/ui";
import { CountUp, Ring } from "@/components/viz";
import { planAutomations, planSize } from "@/lib/automation";
import { fmtDateTime, fmtTimeAgo, today } from "@/lib/dates";
import {
  automationOf,
  CHECKOUT_SEQUENCE,
  cls,
  TASK_TYPE_LABEL,
} from "@/lib/logic";
import { DEFAULT_SETTINGS } from "@/lib/seed";
import type { AutomationConfig } from "@/lib/types";
import { TaskIcon } from "@/components/TaskIcon";

const STYLES = `
@media (prefers-reduced-motion: no-preference){
  @keyframes au-x{0%{left:0;opacity:0}15%{opacity:1}85%{opacity:1}100%{left:calc(100% - 8px);opacity:0}}
  @keyframes au-y{0%{top:0;opacity:0}15%{opacity:1}85%{opacity:1}100%{top:calc(100% - 8px);opacity:0}}
  .au-dot-x{animation:au-x 1.8s linear infinite}
  .au-dot-y{animation:au-y 1.8s linear infinite}
}
@media (prefers-reduced-motion: reduce){.au-dot-x,.au-dot-y{display:none}}
`;

export default function AutomatizacionesPage() {
  const { data, actions, staffName } = useApp();
  const settings = data.settings[0] ?? DEFAULT_SETTINGS;
  const cfg = automationOf(settings);
  const t = today();

  const set = async (patch: Partial<AutomationConfig>) => {
    await actions.saveSettings({
      ...settings,
      automation: { ...(settings.automation ?? {}), ...cfg, ...patch },
    });
  };

  const pending = useMemo(() => planSize(planAutomations(data, t)), [data, t]);
  const autoTasks = data.tasks.filter((x) => x.trigger !== "manual");
  const createdToday = autoTasks.filter(
    (x) => x.createdAt.slice(0, 10) === t,
  ).length;
  const doneAuto = autoTasks.filter(
    (x) => x.status === "completada" && x.completedAt,
  );
  const onTime = doneAuto.filter(
    (x) => x.completedAt!.slice(0, 10) <= x.dueDate,
  ).length;
  const log = data.activity
    .filter(
      (a) =>
        a.action.startsWith("Automatizaciones") ||
        a.action === "Actualizó configuración",
    )
    .slice(0, 30);

  const onTimePct = doneAuto.length ? Math.round((onTime / doneAuto.length) * 100) : 100;
  const activeRules = [cfg.preSalida, cfg.checkoutTasks, cfg.llegada, cfg.cerrarAlCheckin, cfg.sabanasAuto, cfg.repasoDiario, cfg.autoAsignar, cfg.escalarVencidas, cfg.reporteBloquea, cfg.noShowAuto, cfg.avisosEnVivo];
  const rulesOn = activeRules.filter(Boolean).length;
  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
      <style>{STYLES}</style>
      <div className="aurora">
      <PageHeader
        title={<span className="serif-accent">Automatizaciones</span>}
        subtitle="Tareas que el sistema hace solo, sin que nadie se las pida. Cada tarjeta dice: cuando pasa algo, el sistema hace otra cosa."
        actions={
          <Button
            variant="primary"
            className="min-h-[44px] w-full px-5 sm:min-h-0 sm:w-auto"
            onClick={async () => {
              const n = await actions.runAutomations(true);
              toast(
                n
                  ? `Listo ✔ El sistema hizo ${n} tareas automáticas`
                  : "Listo ✔ No había nada pendiente",
              );
            }}
          >
            <Play size={16} /> Revisar y hacer pendientes ahora
          </Button>
        }
      />
      <div className="flex items-start gap-3 rounded-xl border border-accent/25 bg-accent/[0.06] px-4 py-3.5 text-[15px] leading-relaxed text-gray-800">
        <Info size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <p>
          <b className="label-mono text-[12.5px] text-accent">Cómo usarlo:</b> cada tarjeta es una tarea automática. Tocá el
          interruptor para dejarla <b>Prendida</b> (el sistema la hace solo) o{" "}
          <b>Apagada</b> (no hace nada). Los cambios se guardan al instante.
        </p>
      </div>
      <div className="stagger mt-4 grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 lg:grid-cols-4">
        <div className="hero-card flex items-center justify-between gap-3 rounded-2xl p-5">
          <div>
            <div className="flex items-center gap-2 text-[15px] font-medium opacity-90">
              <Zap size={18} aria-hidden /> Tareas hechas por el sistema hoy
            </div>
            <div className="num mt-2 text-[48px] tabular-nums leading-none">
              <CountUp value={createdToday} />
            </div>
          </div>
          <span className="pulse-dot h-3 w-3 shrink-0 rounded-full bg-white" aria-hidden />
        </div>
        <div className="rounded-2xl border border-gray-200/80 bg-panel p-5 shadow-card">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/20">
            <ClipboardList size={20} aria-hidden />
          </span>
          <div className="label-mono mt-3 text-[12.5px] text-gray-600">Tareas del sistema en total</div>
          <div className="num mt-1.5 text-[30px] tabular-nums leading-none text-fg">
            <CountUp value={autoTasks.length} />
          </div>
          <div className="mt-2 text-[14px] text-gray-600">{autoTasks.filter((x) => x.status !== "completada").length} sin terminar</div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-gray-200/80 bg-panel p-5 shadow-card">
          <Ring value={onTimePct} size={76} stroke={8} tone="green" label={`${onTimePct}% terminadas a tiempo`}>
            <span className="num text-[20px] tabular-nums text-fg">{onTimePct}%</span>
          </Ring>
          <div className="min-w-0">
            <div className="label-mono flex items-center gap-1.5 text-[12.5px] text-gray-600"><UserCheck size={14} className="shrink-0" aria-hidden /> Terminadas a tiempo</div>
            <div className="mt-1 text-[14px] text-gray-600">de las tareas del sistema</div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200/80 bg-panel p-5 shadow-card">
          <span className={cls("flex h-10 w-10 items-center justify-center rounded-xl ring-1", pending ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-gray-100 text-gray-600 ring-gray-200")}>
            <Sparkles size={20} aria-hidden />
          </span>
          <div className="label-mono mt-3 text-[12.5px] text-gray-600">Cosas por hacer ahora</div>
          <div className="num mt-1.5 text-[30px] tabular-nums leading-none text-fg">
            <CountUp value={pending} />
          </div>
          <div className="mt-2 text-[14px] text-gray-600">
            {pending ? "el sistema las hace en unos segundos" : "no hay nada pendiente"}
          </div>
          <div className="mt-3 border-t border-gray-200/70 pt-3 text-[13.5px] text-gray-600"><b className="font-semibold tabular-nums text-fg">{rulesOn}</b> automáticas prendidas</div>
          <div className="mt-2 flex gap-1" role="img" aria-label={`${rulesOn} de ${activeRules.length} automáticas prendidas`}>
            {activeRules.map((on, i) => (
              <span key={i} aria-hidden className={cls("h-1.5 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none", on ? "bg-green-600" : "bg-gray-300")} />
            ))}
          </div>
        </div>
      </div>
      </div>

      <Section icon={BedDouble} title="Reservas, limpieza y arreglos">
        <Rule
          on={cfg.preSalida}
          onToggle={() => set({ preSalida: !cfg.preSalida })}
          color="bg-proxima"
          icon={LogOut}
          when="Una reserva está por terminar (el huésped se va hoy o mañana)"
          then="Le crea a Recepción la tarea “Antes de la salida: revisar el minibar y los consumos”."
        >
          <Select
            value={cfg.preSalidaDias}
            onChange={(e) => set({ preSalidaDias: Number(e.target.value) })}
            className="min-h-[44px] w-full sm:min-h-0 sm:w-[280px]"
          >
            <option value={0}>El mismo día de la salida</option>
            <option value={1}>Desde el día anterior</option>
            <option value={2}>Desde dos días antes</option>
          </Select>
        </Rule>
        <Rule
          on={cfg.checkoutTasks}
          onToggle={() => set({ checkoutTasks: !cfg.checkoutTasks })}
          color="bg-gray-400"
          icon={ClipboardCheck}
          when="Se da la salida (el huésped ya se fue)"
          then="La habitación pasa a “Sucia” y se crean las tareas que elijas abajo. Cuando se terminan todas, la habitación vuelve a “Lista”."
        >
          <div className="flex flex-wrap gap-2">
            {CHECKOUT_SEQUENCE.map((tp) => {
              const on = cfg.checkoutTipos.includes(tp);
              return (
                <button
                  key={tp}
                  onClick={() =>
                    set({
                      checkoutTipos: on
                        ? cfg.checkoutTipos.filter((x) => x !== tp)
                        : [...cfg.checkoutTipos, tp],
                    })
                  }
                  aria-pressed={on}
                  className={cls(
                    "inline-flex min-h-[44px] items-center rounded-full px-3.5 py-1.5 text-[14px] font-medium ring-1 ring-inset transition duration-150 motion-reduce:transition-none sm:min-h-[36px]",
                    on
                      ? "bg-accent/10 font-semibold text-fg ring-accent/60 hover:bg-accent/15"
                      : "bg-panel text-gray-600 ring-gray-300 hover:bg-gray-100 hover:text-fg hover:ring-gray-400",
                  )}
                >
                  <TaskIcon type={tp} /> {TASK_TYPE_LABEL[tp]}
                </button>
              );
            })}
          </div>
        </Rule>
        <Rule
          on={cfg.llegada}
          onToggle={() => set({ llegada: !cfg.llegada })}
          color="bg-reservada"
          icon={LogIn}
          when="Hay una reserva que está por llegar"
          then="Crea la tarea “Preparar la habitación”, con los pedidos especiales del huésped."
        >
          <Select
            value={cfg.llegadaDias}
            onChange={(e) => set({ llegadaDias: Number(e.target.value) })}
            className="min-h-[44px] w-full sm:min-h-0 sm:w-[280px]"
          >
            <option value={0}>El mismo día de la llegada</option>
            <option value={1}>Desde el día anterior</option>
            <option value={2}>Desde dos días antes</option>
          </Select>
        </Rule>
        <Rule
          on={cfg.cerrarAlCheckin}
          onToggle={() => set({ cerrarAlCheckin: !cfg.cerrarAlCheckin })}
          color="bg-ocupada"
          icon={CalendarCheck}
          when="Se da la entrada o la salida de un huésped"
          then="Da por terminadas las tareas de “Preparar llegada” y “Antes de la salida” que habían quedado sin hacer."
        />
        <Rule
          on={cfg.sabanasAuto}
          onToggle={() => set({ sabanasAuto: !cfg.sabanasAuto })}
          color="bg-teal-600"
          icon={Shirt}
          when="Una habitación ocupada lleva varios días con las mismas sábanas"
          then="Crea la tarea “Cambiar las sábanas” para una mucama y marca la habitación en la sección Mucamas. Cuando la mucama toca “Ya las cambié”, se empieza a contar de nuevo."
        >
          <Select
            value={cfg.sabanasCadaDias}
            onChange={(e) => set({ sabanasCadaDias: Number(e.target.value) })}
            className="min-h-[44px] w-full sm:min-h-0 sm:w-[280px]"
          >
            {[2, 3, 4, 5, 7].map((n) => (
              <option key={n} value={n}>
                Cada {n} días
              </option>
            ))}
          </Select>
        </Rule>
        <Rule
          on={cfg.repasoDiario}
          onToggle={() => set({ repasoDiario: !cfg.repasoDiario })}
          color="bg-ocupada"
          icon={BedDouble}
          when="Hay un huésped alojado en el hotel"
          then="Cada día crea la tarea “Repaso del día” por cada habitación ocupada."
        />
      </Section>

      <Section icon={Wrench} title="Equipo de limpieza y arreglos">
        <Rule
          on={cfg.autoAsignar}
          onToggle={() => set({ autoAsignar: !cfg.autoAsignar })}
          color="bg-emerald-500"
          icon={Users}
          when="Se crea una tarea automática"
          then="Se la da a la persona del cargo que corresponda (mucama, recepción o mantenimiento) que tenga menos tareas sin terminar. Si lo apagás, las tareas quedan libres para que cada uno las tome desde “Mi trabajo de hoy”."
        />
        <Rule
          on={cfg.escalarVencidas}
          onToggle={() => set({ escalarVencidas: !cfg.escalarVencidas })}
          color="bg-red-500"
          icon={AlertTriangle}
          when="Una tarea no se terminó a tiempo"
          then="La pasa a URGENTE y la muestra en los avisos (la campanita de arriba)."
        />
        <Rule
          on={cfg.reporteBloquea}
          onToggle={() => set({ reporteBloquea: !cfg.reporteBloquea })}
          color="bg-purple-500"
          icon={Hammer}
          when="Una mucama avisa que hay un problema"
          then="Le crea un arreglo al equipo de mantenimiento y bloquea la habitación (se ve rayada en el calendario)."
        />
      </Section>

      <Section icon={CalendarX} title="Recepción y reservas">
        <Rule
          on={cfg.noShowAuto}
          onToggle={() => set({ noShowAuto: !cfg.noShowAuto })}
          color="bg-amber-500"
          icon={UserX}
          when="Una reserva está confirmada pero el huésped no llegó"
          then="La marca como “No se presentó”, deja libre la habitación y borra las tareas que tenía pendientes."
        >
          <Select
            value={cfg.noShowDias}
            onChange={(e) => set({ noShowDias: Number(e.target.value) })}
            className="min-h-[44px] w-full sm:min-h-0 sm:w-[280px]"
          >
            <option value={1}>Al día siguiente</option>
            <option value={2}>A los 2 días</option>
            <option value={3}>A los 3 días</option>
          </Select>
        </Rule>
      </Section>

      <Section icon={Bell} title="Avisos en el momento">
        <Rule
          on={cfg.avisosEnVivo}
          onToggle={() => set({ avisosEnVivo: !cfg.avisosEnVivo })}
          color="bg-green-500"
          icon={BellRing}
          when="Alguien del equipo hace algo (termina una tarea, da una entrada, cobra…)"
          then="Muestra un aviso a los demás que están usando el panel, y le avisa a cada empleado cuando le dan una tarea nueva."
        />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          className="overflow-hidden"
          icon={Receipt}
          title="Esto pasa siempre (no se puede apagar)"
        >
          <ul className="divide-y divide-gray-200/60 text-[15px] leading-relaxed text-gray-700">
            <Always icon={UtensilsCrossed}>
              Cada pedido de comida a la habitación se suma solo a la cuenta del
              huésped (y se saca si se cancela el pedido).
            </Always>
            <Always icon={Receipt}>El número de las facturas sube solo.</Always>
            <Always icon={Sparkles}>
              El estado de cada habitación (lista, sucia, en limpieza o en
              arreglo) se actualiza solo según las reservas y las tareas.
            </Always>
            <Always icon={Repeat}>
              Si una reserva pasa a otra habitación, sus tareas pendientes se
              van con ella.
            </Always>
            <Always icon={XCircle}>
              Si se cancela una reserva, se borran las tareas del sistema que
              tenía pendientes.
            </Always>
            <Always icon={MessageCircle}>
              WhatsApp te sugiere cada día a quién escribirle (antes de llegar,
              después de la salida, para agradecer).
            </Always>
          </ul>
        </Card>
        <Card
          className="overflow-hidden"
          icon={History}
          title="Lo último que hizo el sistema y los cambios"
        >
          {!log.length && (
            <Empty icon={History}>
              <span className="max-w-xs">
                Todavía no hay nada para mostrar. Cuando el sistema haga algo
                solo, lo vas a ver acá.
              </span>
            </Empty>
          )}
          {log.length > 0 && (
          <ul className="relative max-h-[26rem] overflow-y-auto px-4 py-2 text-[15px] sm:px-5">
            {log.map((a) => {
              const isCfg = a.action === "Actualizó configuración";
              const LIcon = isCfg ? Settings : Zap;
              return (
                <li key={a.id} className="relative flex items-start gap-3 py-2.5 before:absolute before:bottom-0 before:left-4 before:top-0 before:w-px before:bg-gray-200 first:before:top-4 last:before:bottom-auto last:before:h-4">
                  <span className={cls("relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-panel", isCfg ? "bg-gray-100 text-gray-600" : "bg-[rgb(var(--panel-2))] text-accent shadow-[inset_0_0_0_1px_rgb(var(--accent)/0.3)]")}>
                    <LIcon size={15} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 break-words pt-0.5 leading-snug text-fg">
                    {a.action} <span className="text-gray-600">· {staffName(a.by)}</span>
                    <span className="mt-1 block text-[13px] tabular-nums text-gray-500" title={fmtDateTime(a.at)}>
                      {fmtTimeAgo(a.at)} · {fmtDateTime(a.at)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Always({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3 sm:px-5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-panel-2 text-gray-600">
        <Icon size={17} aria-hidden />
      </span>
      <span className="min-w-0 pt-1">{children}</span>
    </li>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      className="overflow-hidden"
      icon={Icon}
      title={title}
    >
      <div className="stagger divide-y divide-gray-200/70">{children}</div>
    </Card>
  );
}

function Rule({
  on,
  onToggle,
  color,
  icon: Icon,
  when,
  then,
  children,
}: {
  on: boolean;
  onToggle: () => void;
  color: string;
  icon: React.ElementType;
  when: string;
  then: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative px-4 py-4 sm:px-5 sm:py-5">
      <span
        aria-hidden
        className={cls(
          "absolute inset-y-4 left-0 w-1 rounded-r-full transition-opacity duration-200 motion-reduce:transition-none",
          color,
          !on && "opacity-25",
        )}
      />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-5">
        <div
          className={cls(
            "grid min-w-0 flex-1 transition duration-300 motion-reduce:transition-none lg:grid-cols-[1fr_auto_1fr] lg:items-stretch",
            !on && "opacity-60 grayscale",
          )}
        >
          <div className="rounded-xl border border-gray-200 bg-panel-2/70 px-4 py-3.5">
            <div className="label-mono mb-2 flex items-center gap-2 text-[12px] font-medium text-gray-600">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-panel text-gray-700 ring-1 ring-inset ring-gray-200"><Icon size={15} aria-hidden /></span> Cuando pasa esto
            </div>
            <div className="text-[15px] font-medium leading-snug text-fg">
              {when}
            </div>
          </div>
          <div className="flex items-center justify-center py-1 lg:px-2 lg:py-0" aria-hidden>
            <div className="relative h-7 w-0.5 rounded-full bg-gray-300 lg:hidden">
              {on && <span className="au-dot-y absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-accent" />}
              <ArrowDown size={16} className={cls("absolute -bottom-2.5 left-1/2 -translate-x-1/2", on ? "text-accent" : "text-gray-400")} />
            </div>
            <div className="relative hidden h-0.5 w-12 rounded-full bg-gray-300 lg:block">
              {on && <span className="au-dot-x absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-accent" />}
              <ArrowRight size={16} className={cls("absolute -right-2 top-1/2 -translate-y-1/2", on ? "text-accent" : "text-gray-400")} />
            </div>
          </div>
          <div className="rounded-xl border border-accent/25 bg-accent/[0.06] px-4 py-3.5">
            <div className="label-mono mb-2 flex items-center gap-2 text-[12px] font-medium text-accent">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/15"><Zap size={15} aria-hidden /></span> El sistema hace esto
            </div>
            <div className="text-[15px] leading-snug text-gray-800">{then}</div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 lg:w-[124px] lg:shrink-0 lg:flex-col lg:justify-center lg:border-l lg:border-gray-200/70 lg:pl-5">
          <span
            className={cls(
              "inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-[13px] font-semibold leading-5 ring-1 ring-inset",
              on
                ? "bg-green-50 text-green-700 ring-green-200"
                : "bg-gray-100 text-gray-600 ring-gray-200",
            )}
          >
            <span
              aria-hidden
              className={cls(
                "h-1.5 w-1.5 rounded-full",
                on ? "bg-green-600" : "bg-gray-400",
              )}
            />
            {on ? "Prendido" : "Apagado"}
          </span>
          <button
            onClick={onToggle}
            role="switch"
            aria-checked={on}
            aria-label={
              on ? "Prendido. Tocá para apagar" : "Apagado. Tocá para prender"
            }
            className="group flex h-11 w-[68px] shrink-0 items-center justify-center rounded-full outline-none"
          >
            <span
              className={cls(
                "relative block h-8 w-14 rounded-full shadow-[inset_0_1px_3px_rgba(0,0,0,0.25)] transition-colors duration-200 group-focus-visible:ring-[3px] group-focus-visible:ring-accent/50 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-panel motion-reduce:transition-none",
                on
                  ? "bg-green-600 group-hover:bg-green-700"
                  : "bg-gray-400 group-hover:bg-gray-500",
              )}
            >
              <span
                className={cls(
                  "absolute left-1 top-1 h-6 w-6 rounded-full bg-[#fff] shadow-[0_1px_3px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] motion-reduce:transition-none",
                  on ? "translate-x-6" : "translate-x-0",
                )}
              />
            </span>
          </button>
        </div>
      </div>
      {children && on && (
        <div className="mt-3 rounded-xl border border-dashed border-gray-300 bg-panel-2/40 px-3 py-3 lg:mr-[144px]">
          {children}
        </div>
      )}
    </div>
  );
}
