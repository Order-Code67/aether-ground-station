import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { useAuthStore } from "@/stores/authStore";
import { useEventLogStore } from "@/stores/eventLogStore";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";
import { StatusBadge } from "@/components/common/StatusBadge";
import { isTauriRuntime } from "@/services/tauri";
import { deviceManager } from "@/services/devices/deviceManager";
import { getDiskSpace, formatBytes } from "@/services/system/diskSpace";
import { getGatewayStatus } from "@/services/gateway";
import { listTelemetryRecords } from "@/services/inventory";
import type { DeviceCard, EntityStatusId } from "@/types";
import { deviceToEntityStatus } from "@/types/entityStatus";

function formatClock(isoOrMs: string | number | null): string {
  if (isoOrMs == null) return "N/A";
  const d =
    typeof isoOrMs === "number" ? new Date(isoOrMs) : new Date(isoOrMs);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function StatusBar() {
  const appInfo = useAppStore((s) => s.appInfo);
  const ready = useAppStore((s) => s.ready);
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);
  const complexes = useStationPlannerStore((s) => s.complexes);
  const sites = useStationPlannerStore((s) => s.sites);
  const stations = useStationPlannerStore((s) => s.stations);
  const activeComplexId = useStationPlannerStore((s) => s.activeComplexId);
  const activeSiteId = useStationPlannerStore((s) => s.activeSiteId);
  const activeStationId = useStationPlannerStore((s) => s.activeStationId);
  const events = useEventLogStore((s) => s.events);
  const criticalCount = events.filter(
    (e) => e.severity === "error" || e.severity === "warning",
  ).length;
  const tauri = isTauriRuntime();

  const complex = complexes.find((c) => c.id === activeComplexId);
  const site = sites.find((s) => s.id === activeSiteId);
  const station = stations.find((s) => s.id === activeStationId);

  const [devices, setDevices] = useState<DeviceCard[]>([]);
  const [diskLabel, setDiskLabel] = useState("N/A");
  const [gwStatus, setGwStatus] = useState<EntityStatusId>("not_available");
  const [telAt, setTelAt] = useState<string | null>(null);

  useEffect(() => deviceManager.subscribe(setDevices), []);

  useEffect(() => {
    void (async () => {
      const space = await getDiskSpace();
      setDiskLabel(space ? formatBytes(space.availableBytes) : "N/A");
      if (!tauri) {
        setGwStatus("not_available");
        setTelAt(null);
        return;
      }
      try {
        const st = await getGatewayStatus();
        setGwStatus(st.enabled ? "online" : "not_configured");
      } catch {
        setGwStatus("not_available");
      }
      try {
        const rows = await listTelemetryRecords(1);
        setTelAt(rows[0]?.at ?? null);
      } catch {
        setTelAt(null);
      }
    })();
  }, [tauri]);

  const online = devices.filter((d) => d.status === "Online").length;
  const videoDev = devices.filter((d) =>
    d.capabilities.some((c) => c === "video" || c === "walksnail"),
  );
  const videoStatus: EntityStatusId = !videoDev.length
    ? "no_device"
    : deviceToEntityStatus(
        videoDev.find((d) => d.status === "Online")?.status ??
          videoDev[0]!.status,
      );

  const telemetryStatus: EntityStatusId = telAt ? "online" : "not_available";

  const lastUpdate = useMemo(() => {
    const times: number[] = [];
    for (const e of events) {
      const t = Date.parse(e.at);
      if (!Number.isNaN(t)) times.push(t);
    }
    for (const d of devices) {
      if (d.lastSeenAt) {
        const t = Date.parse(d.lastSeenAt);
        if (!Number.isNaN(t)) times.push(t);
      }
    }
    if (telAt) {
      const t = Date.parse(telAt);
      if (!Number.isNaN(t)) times.push(t);
    }
    if (!times.length) return null;
    return Math.max(...times);
  }, [events, devices, telAt]);

  return (
    <footer className="flex h-8 shrink-0 items-center gap-2 overflow-hidden border-t border-ags-border-subtle bg-ags-surface px-3 text-[11px] text-ags-muted">
      <StatusBadge
        label={ready ? "Приложение" : "Загрузка"}
        tone={ready ? "ok" : "warn"}
      />
      <span className="truncate font-medium text-ags-fg">
        {complex?.name ?? "Комплекс —"}
      </span>
      <span className="text-ags-dim">·</span>
      <span className="truncate">{site?.name ?? "Площадка N/A"}</span>
      <span className="text-ags-dim">·</span>
      <span className="truncate">{station?.name ?? "Станция N/A"}</span>
      <span className="text-ags-dim">·</span>
      <span title="Подключённые устройства">
        Устр. {online}/{devices.length}
      </span>
      <StatusBadge status={videoStatus} />
      <StatusBadge status={telemetryStatus} />
      <span className={criticalCount ? "text-ags-warning" : ""}>
        Пред. {criticalCount}
      </span>
      <span title="Последнее обновление (события / устройства / телеметрия)">
        Обновлено {formatClock(lastUpdate)}
      </span>
      <StatusBadge
        label={tauri ? "SQLite" : "Preview"}
        tone={ready ? "ok" : "warn"}
      />
      <span title="Свободно на диске">Диск {diskLabel}</span>
      <StatusBadge status={gwStatus} />
      <span className="ml-auto flex items-center gap-2 text-ags-dim">
        <span>
          v{appInfo?.version ?? "1.0.0"}
        </span>
        {session && (
          <button
            type="button"
            className="text-ags-muted hover:text-ags-fg"
            onClick={logout}
          >
            Выход
          </button>
        )}
      </span>
    </footer>
  );
}
