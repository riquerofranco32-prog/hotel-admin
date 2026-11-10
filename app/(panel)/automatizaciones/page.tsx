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
import { Button, Card, PageHeader, Select, Stat, toast } from "@/components/ui";
import { planAutomations, planSize } from "@/lib/automation";
import { fmtDateTime, today } from "@/lib/dates";
import {
  automationOf,
  CHECKOUT_SEQUENCE,
  cls,
  TASK_TYPE_LABEL,
} from "@/lib/logic";
import { DEFAULT_SETTINGS } from "@/lib/seed";
import type { AutomationConfig } from "@/lib/types";
import { TaskIcon } from "@/components/TaskIcon";

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

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <PageHeader
        title="Automatizaciones"
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
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5 text-[15px] leading-relaxed text-blue-900">
        <Info size={20} className="mt-0.5 shrink-0" aria-hidden />
        <p>
          <b>Cómo usarlo:</b> cada tarjeta es una tarea automática. Tocá el
          interruptor para dejarla <b>Prendida</b> (el sistema la hace solo) o{" "}
          <b>Apagada</b> (no hace nada). Los cambios se guardan al instante.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Zap}
          tone="indigo"
          label="Tareas hechas por el sistema hoy"
          value={createdToday}
        />
        <Stat
          icon={ClipboardList}
          tone="blue"
          label="Tareas del sistema en total"
          value={autoTasks.length}
          sub={`${autoTasks.filter((x) => x.status !== "completada").length} sin terminar`}
        />
        <Stat
          icon={UserCheck}
          tone="green"
          label="Terminadas a tiempo"
          value={`${doneAuto.length ? Math.round((onTime / doneAuto.length) * 100) : 100}%`}
        />
        <Stat
          icon={Sparkles}
          tone={pending ? "orange" : "gray"}
          label="Cosas por hacer ahora"
          value={pending}
          sub={
            pending
              ? "el sistema las hace en unos segundos"
              : "no hay nada pendiente"
          }
        />
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
            className="min-h-[44px] w-full max-w-[300px] sm:min-h-0"
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
                    "min-h-[44px] rounded-full px-3.5 py-1.5 text-[14px] font-medium ring-1 transition duration-150 motion-reduce:transition-none sm:min-h-[36px]",
                    on
                      ? "bg-gray-900 text-white ring-gray-900"
                      : "bg-white text-gray-700 ring-gray-300 hover:bg-gray-50",
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
            className="min-h-[44px] w-full max-w-[300px] sm:min-h-0"
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
            className="min-h-[44px] w-full max-w-[300px] sm:min-h-0"
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
            className="min-h-[44px] w-full max-w-[300px] sm:min-h-0"
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
          title={
            <span className="flex items-center gap-2">
              <Receipt
                size={18}
                className="shrink-0 text-gray-600"
                aria-hidden
              />{" "}
              Esto pasa siempre (no se puede apagar)
            </span>
          }
        >
          <ul className="divide-y divide-gray-100 text-[15px] leading-relaxed text-gray-700">
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
          title={
            <span className="flex items-center gap-2">
              <History
                size={18}
                className="shrink-0 text-gray-600"
                aria-hidden
              />{" "}
              Lo último que hizo el sistema y los cambios
            </span>
          }
        >
          <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto text-[15px]">
            {log.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
              >
                <span className="min-w-0 break-words">
                  {a.action}{" "}
                  <span className="text-gray-600">· {staffName(a.by)}</span>
                </span>
                <span className="shrink-0 text-[14px] tabular-nums text-gray-600">
                  {fmtDateTime(a.at)}
                </span>
              </li>
            ))}
            {!log.length && (
              <li className="flex flex-col items-center gap-3 px-4 py-10 text-center text-[15px] text-gray-600">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <History size={22} aria-hidden />
                </span>
                <span className="max-w-xs">
                  Todavía no hay nada para mostrar. Cuando el sistema haga algo
                  solo, lo vas a ver acá.
                </span>
              </li>
            )}
          </ul>
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
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
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
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Icon size={17} aria-hidden />
          </span>
          {title}
        </span>
      }
    >
      <div className="divide-y divide-gray-100">{children}</div>
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
    <div className="relative px-4 py-4 sm:px-5">
      <span
        aria-hidden
        className={cls(
          "absolute inset-y-3 left-0 w-1 rounded-r-full transition-opacity duration-200 motion-reduce:transition-none",
          color,
          !on && "opacity-30",
        )}
      />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <div
          className={cls(
            "grid flex-1 gap-2 transition-opacity duration-200 motion-reduce:transition-none lg:grid-cols-[1fr_auto_1fr] lg:items-stretch",
            !on && "opacity-60",
          )}
        >
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <div className="mb-1.5 flex items-center gap-2 text-[13.5px] font-semibold uppercase tracking-wide text-gray-600">
              <Icon size={16} aria-hidden /> Cuando pasa esto
            </div>
            <div className="text-[15px] font-medium leading-snug text-gray-900">
              {when}
            </div>
          </div>
          <div
            className="flex items-center justify-center text-gray-500"
            aria-hidden
          >
            <ArrowDown size={20} className="lg:hidden" />
            <ArrowRight size={20} className="hidden lg:block" />
          </div>
          <div className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
            <div className="mb-1.5 flex items-center gap-2 text-[13.5px] font-semibold uppercase tracking-wide text-accent">
              <Zap size={16} aria-hidden /> El sistema hace esto
            </div>
            <div className="text-[15px] leading-snug text-gray-800">{then}</div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 lg:w-[120px] lg:flex-col lg:justify-center">
          <span
            className={cls(
              "text-[15px] font-semibold",
              on ? "text-green-700" : "text-gray-600",
            )}
          >
            {on ? "Prendido" : "Apagado"}
          </span>
          <button
            onClick={onToggle}
            role="switch"
            aria-checked={on}
            aria-label={
              on ? "Prendido. Tocá para apagar" : "Apagado. Tocá para prender"
            }
            className={cls(
              "relative h-8 w-14 shrink-0 rounded-full outline-none transition-colors duration-200 focus-visible:ring-[3px] focus-visible:ring-accent/40 motion-reduce:transition-none",
              on ? "bg-green-600" : "bg-gray-400",
            )}
          >
            <span
              className={cls(
                "absolute left-1 top-1 h-6 w-6 rounded-full bg-[#fff] shadow transition-transform duration-200 motion-reduce:transition-none",
                on ? "translate-x-6" : "translate-x-0",
              )}
            />
          </button>
        </div>
      </div>
      {children && on && (
        <div className="mt-3 border-t border-gray-100 pt-3">{children}</div>
      )}
    </div>
  );
}
