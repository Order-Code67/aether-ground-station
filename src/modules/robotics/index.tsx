import { eventBus } from "@/services/events/eventBus";
import { StatusBadge } from "@/components/common/StatusBadge";

/**
 * Robotics Manager (V2.1) — local status / monitoring only.
 * Remote actuator commands are intentionally unsupported.
 */
export function RoboticsView() {
  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-6 text-sm">
      <div>
        <h1 className="text-xl font-semibold">Robotics</h1>
        <p className="mt-1 text-xs text-ags-muted">
          Мониторинг локальных робототехнических узлов. Команды приводов через
          remote / gateway запрещены.
        </p>
      </div>
      <section className="max-w-xl space-y-2 rounded-lg border border-ags-border bg-ags-panel p-4">
        <div className="flex items-center gap-2">
          <StatusBadge label="local-only" tone="ok" />
          <StatusBadge label="no remote actuators" tone="warn" />
        </div>
        <p className="text-xs text-ags-dim">
          Подключите диагностику через Telemetry / Serial. Исполнительные
          команды не экспортируются в API.
        </p>
        <button
          type="button"
          className="rounded border border-ags-border px-3 py-1.5"
          onClick={() =>
            eventBus.emit(
              "info",
              "robotics",
              "Robotics: только мониторинг (V2.1 shell)",
            )
          }
        >
          Проверить политику
        </button>
      </section>
    </div>
  );
}
