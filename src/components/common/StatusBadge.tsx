import { cn } from "@/utils/cn";
import {
  entityStatus,
  type EntityStatusId,
} from "@/types/entityStatus";

interface StatusBadgeProps {
  label?: string;
  tone?: "neutral" | "ok" | "warn" | "danger";
  /** When set, label/tone derived from unified entity status (RU). */
  status?: EntityStatusId;
}

export function StatusBadge({ label, tone = "neutral", status }: StatusBadgeProps) {
  const view = status ? entityStatus(status) : null;
  const text = view?.labelRu ?? label ?? "—";
  const t = view?.tone ?? tone;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        t === "neutral" && "border-ags-border text-ags-muted",
        t === "ok" && "border-ags-success/40 text-ags-success",
        t === "warn" && "border-ags-warning/40 text-ags-warning",
        t === "danger" && "border-ags-danger/40 text-ags-danger",
      )}
    >
      {text}
    </span>
  );
}
