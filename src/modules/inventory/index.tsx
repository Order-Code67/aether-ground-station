import { useCallback, useEffect, useState } from "react";
import {
  listEquipment,
  listMaintenance,
  upsertEquipment,
  upsertMaintenance,
  type EquipmentItem,
  type MaintenanceItem,
} from "@/services/inventory";
import { useAuthStore } from "@/stores/authStore";

function nid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}`;
}

export function InventoryView() {
  const can = useAuthStore((s) => s.can("manageDevices"));
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [maint, setMaint] = useState<MaintenanceItem[]>([]);
  const [name, setName] = useState("");

  const refresh = useCallback(async () => {
    setItems(await listEquipment());
    setMaint(await listMaintenance());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-6 text-sm">
      <div>
        <h1 className="text-xl font-semibold">Equipment Inventory</h1>
        <p className="text-xs text-ags-muted">
          Инвентаризация и обслуживание. Observer — только просмотр.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          className="rounded border border-ags-border bg-ags-elevated px-2 py-1"
          placeholder="Название оборудования"
          value={name}
          disabled={!can}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="button"
          disabled={!can || !name.trim()}
          className="rounded bg-ags-accent px-3 py-1 text-white disabled:opacity-40"
          onClick={() =>
            void (async () => {
              await upsertEquipment({
                id: nid("eq"),
                name: name.trim(),
                status: "in-service",
                payload: "{}",
                updatedAt: new Date().toISOString(),
              });
              setName("");
              await refresh();
            })()
          }
        >
          Добавить
        </button>
      </div>
      <ul className="space-y-2">
        {items.map((i) => (
          <li
            key={i.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-ags-border bg-ags-panel px-3 py-2"
          >
            <div>
              <div className="font-medium">{i.name}</div>
              <div className="text-xs text-ags-dim">
                {i.manufacturer ?? "—"} · {i.model ?? "—"} · S/N{" "}
                {i.serialNumber ?? "—"}
              </div>
            </div>
            <button
              type="button"
              disabled={!can}
              className="rounded border border-ags-border px-2 py-1 text-xs disabled:opacity-40"
              onClick={() =>
                void (async () => {
                  await upsertMaintenance({
                    id: nid("mnt"),
                    equipmentId: i.id,
                    dueAt: new Date(Date.now() + 86400000 * 30).toISOString(),
                    status: "planned",
                    notes: "Плановое ТО",
                    payload: "{}",
                    updatedAt: new Date().toISOString(),
                  });
                  await refresh();
                })()
              }
            >
              + ТО
            </button>
          </li>
        ))}
      </ul>
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase text-ags-muted">
          Maintenance
        </h2>
        <ul className="space-y-1 text-xs">
          {maint.map((m) => (
            <li key={m.id} className="rounded border border-ags-border px-2 py-1">
              {m.status ?? "—"} · due {m.dueAt ?? "N/A"} · {m.notes ?? ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
