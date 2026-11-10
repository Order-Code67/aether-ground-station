import { useEffect, useState } from "react";
import { eventBus } from "@/services/events/eventBus";
import { StatusBadge } from "@/components/common/StatusBadge";

/**
 * HID Controllers (V2.1) — Gamepad API enumeration / monitoring.
 * Does not map sticks to vehicle actuators.
 */
export function HidView() {
  const [pads, setPads] = useState<string[]>([]);

  const refresh = () => {
    if (!navigator.getGamepads) {
      setPads([]);
      eventBus.emit("warning", "hid", "Gamepad API недоступен");
      return;
    }
    const list = [...navigator.getGamepads()]
      .filter(Boolean)
      .map((g) => `${g!.id} · axes=${g!.axes.length} buttons=${g!.buttons.length}`);
    setPads(list);
    eventBus.emit("info", "hid", `HID: ${list.length} устройств`);
  };

  useEffect(() => {
    refresh();
    window.addEventListener("gamepadconnected", refresh);
    window.addEventListener("gamepaddisconnected", refresh);
    return () => {
      window.removeEventListener("gamepadconnected", refresh);
      window.removeEventListener("gamepaddisconnected", refresh);
    };
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-6 text-sm">
      <div>
        <h1 className="text-xl font-semibold">HID Controllers</h1>
        <p className="mt-1 text-xs text-ags-muted">
          Локальный перечень геймпадов / джойстиков. Без привязки к полёту и
          актуаторам.
        </p>
      </div>
      <section className="max-w-xl space-y-2 rounded-lg border border-ags-border bg-ags-panel p-4">
        <div className="flex items-center gap-2">
          <StatusBadge label="enumerate-only" tone="ok" />
        </div>
        <button
          type="button"
          className="rounded bg-ags-accent px-3 py-1.5 text-white"
          onClick={refresh}
        >
          Обновить
        </button>
        {pads.length === 0 ? (
          <p className="text-xs text-ags-dim">Нет подключённых HID (или нет разрешения ОС).</p>
        ) : (
          <ul className="space-y-1 font-mono text-[11px]">
            {pads.map((p) => (
              <li key={p} className="rounded border border-ags-border px-2 py-1">
                {p}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
