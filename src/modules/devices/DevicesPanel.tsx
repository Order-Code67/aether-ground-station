import { useState } from "react";
import { useDeviceStore } from "@/stores/deviceStore";
import { StatusBadge } from "@/components/common/StatusBadge";
import { deviceToEntityStatus } from "@/types/entityStatus";
import { deviceManager } from "@/services/devices/deviceManager";
import type { DeviceCard } from "@/types";

export function DevicesPanel() {
  const devices = useDeviceStore((s) => s.devices);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = devices.find((d) => d.id === selectedId) ?? null;

  if (devices.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-ags-muted">
        Нет устройств. Подключение — вкладки COM / USB / Сеть / HID или модуль
        Видео. Без имитации Online.
      </div>
    );
  }

  const reconnect = async (d: DeviceCard) => {
    setBusy(true);
    await deviceManager.reconnectNow(d.id);
    setBusy(false);
  };

  return (
    <div className="grid h-full min-h-0 gap-2 p-3 lg:grid-cols-[1fr_20rem]">
      <div className="grid gap-2 overflow-auto sm:grid-cols-2">
        {devices.map((d) => (
          <article
            key={d.id}
            className={
              d.id === selectedId
                ? "cursor-pointer rounded border border-ags-accent bg-ags-elevated p-3 text-sm"
                : "cursor-pointer rounded border border-ags-border bg-ags-elevated p-3 text-sm"
            }
            onClick={() => setSelectedId(d.id)}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <h4 className="font-semibold text-ags-fg">{d.name}</h4>
              <StatusBadge status={deviceToEntityStatus(d.status)} />
            </div>
            <dl className="grid grid-cols-[6.5rem_1fr] gap-y-1 text-xs">
              <dt className="text-ags-dim">Тип</dt>
              <dd>{d.connectionType}</dd>
              <dt className="text-ags-dim">Адрес</dt>
              <dd className="truncate font-mono">{d.address ?? "—"}</dd>
              <dt className="text-ags-dim">Контакт</dt>
              <dd>
                {d.lastSeenAt
                  ? new Date(d.lastSeenAt).toLocaleString()
                  : "—"}
              </dd>
              {d.lastError && (
                <>
                  <dt className="text-ags-dim">Ошибка</dt>
                  <dd className="text-ags-warning">{d.lastError}</dd>
                </>
              )}
            </dl>
            <div className="mt-2 flex gap-1">
              <button
                type="button"
                disabled={busy || !deviceManager.hasReconnectHandler(d.id)}
                className="rounded border border-ags-border px-2 py-0.5 text-[11px] disabled:opacity-40"
                onClick={(e) => {
                  e.stopPropagation();
                  void reconnect(d);
                }}
              >
                Reconnect
              </button>
            </div>
          </article>
        ))}
      </div>

      <aside className="min-h-0 overflow-auto rounded border border-ags-border bg-ags-panel/80 p-3 text-xs">
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-ags-muted">
          Карточка · история
        </h3>
        {!selected ? (
          <p className="text-ags-dim">Выберите устройство</p>
        ) : (
          <>
            <p className="mb-1 font-semibold text-ags-fg">{selected.name}</p>
            <p className="mb-2 font-mono text-[10px] text-ags-dim">{selected.id}</p>
            <dl className="mb-3 grid grid-cols-[5.5rem_1fr] gap-y-1">
              <dt className="text-ags-dim">Статус</dt>
              <dd>{selected.status}</dd>
              <dt className="text-ags-dim">Возможности</dt>
              <dd>{selected.capabilities.join(", ") || "—"}</dd>
              <dt className="text-ags-dim">Ошибка</dt>
              <dd className="text-ags-warning">{selected.lastError ?? "—"}</dd>
            </dl>
            <div className="text-[10px] font-semibold uppercase text-ags-muted">
              События
            </div>
            <ul className="mt-1 max-h-64 space-y-1 overflow-auto">
              {(selected.history ?? []).length === 0 && (
                <li className="text-ags-dim">Нет записей</li>
              )}
              {(selected.history ?? []).map((h, i) => (
                <li
                  key={`${h.at}-${i}`}
                  className="rounded bg-ags-elevated/80 px-2 py-1 font-mono text-[10px]"
                >
                  <span className="text-ags-dim">
                    {new Date(h.at).toLocaleTimeString()} · {h.kind}
                  </span>
                  <div>{h.message}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
    </div>
  );
}
