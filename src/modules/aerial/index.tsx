import { eventBus } from "@/services/events/eventBus";
import { StatusBadge } from "@/components/common/StatusBadge";

/**
 * Aerial / UAV observer (V2.1) — telemetry display only, no pilot channel.
 */
export function AerialView() {
  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-6 text-sm">
      <div>
        <h1 className="text-xl font-semibold">Aerial</h1>
        <p className="mt-1 text-xs text-ags-muted">
          Наблюдение телеметрии БВС (PX4 / ArduPilot adapters). Канал
          пилотирования не предоставляется.
        </p>
      </div>
      <section className="max-w-xl space-y-2 rounded-lg border border-ags-border bg-ags-panel p-4">
        <div className="flex items-center gap-2">
          <StatusBadge label="observer" tone="ok" />
          <StatusBadge label="no pilot" tone="warn" />
        </div>
        <ul className="list-disc pl-5 text-xs text-ags-dim">
          <li>Источник: Telemetry Engine JSON adapters</li>
          <li>Позиция / батарея — N/A при отсутствии полей</li>
          <li>MAVLink command uplink — не реализован намеренно</li>
        </ul>
        <button
          type="button"
          className="rounded border border-ags-border px-3 py-1.5"
          onClick={() =>
            eventBus.emit("info", "aerial", "Aerial: pilot channel blocked")
          }
        >
          Подтвердить блокировку пилота
        </button>
      </section>
    </div>
  );
}
