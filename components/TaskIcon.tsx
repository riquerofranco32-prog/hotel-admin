import { cls, TASK_TYPE_LUCIDE } from "@/lib/logic";
import type { TaskType } from "@/lib/types";

/** Ícono de un tipo de tarea (limpieza, sábanas, arreglo…). Hereda el color del texto. */
export function TaskIcon({ type, size = 17, className }: { type: TaskType; size?: number; className?: string }) {
  const Icon = TASK_TYPE_LUCIDE[type];
  return <Icon size={size} className={cls("mr-1 inline-block shrink-0 align-[-3px]", className)} aria-hidden />;
}
