import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { useAuthStore } from "@/stores/authStore";
import { useEventLogStore } from "@/stores/eventLogStore";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";
import { StatusBadge } from "@/components/common/StatusBadge";
import { isTauriRuntime } from "@/services/tauri";
import { deviceManager } from "@/services/devices/deviceManager";
import { getDiskSpace, formatBytes } from "@/services/system/diskSpace";
import { getGatewayStatus } from "@/services/gateway";
import type { DeviceCard, EntityStatusId } from "@/types";
import { deviceToEntityStatus } from "@/types/entityStatus";

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
  const criticalCount = useEventLogStore(
    (s) =>
      s.events.filter((e) => e.severity === "error" || e.severity === "warning")
        .length,
  );
  const tauri = isTauriRuntime();

  const complex = complexes.find((c) => c.id === activeComplexId);
  const site = sites.find((s) => s.id === activeSiteId);
  const station = stations.find((s) => s.id === activeStationId);

  const [devices, setDevices] = useState<DeviceCard[]>([]);
  const [diskLabel, setDiskLabel] = useState("N/A");
  const [gwStatus, setGwStatus] = useState<EntityStatusId>("not_available");

  useEffect(() => deviceManager.subscribe(setDevices), []);
  useEffect(() => {
    void useStationPlannerStore.getState().refresh();
  }, []);

  useEffect(() => {
    void (async () => {
      const space = await getDiskSpace();
      setDiskLabel(space ? formatBytes(space.availableBytes) : "N/A");
      if (!tauri) {
        setGwStatus("not_available");
        return;
      }
      try {
        const st = await getGatewayStatus();
        setGwStatus(st.enabled ? "online" : "not_configured");
      } catch {
        setGwStatus("not_available");
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

  return (
    <footer className="flex h-8 shrink-0 items-center gap-2 overflow-hidden border-t border-ags-border-subtle bg-ags-surface px-3 text-[11px] text-ags-muted">
      <span className="truncate font-medium text-ags-fg">
        {complex?.name ?? "Комплекс —"}
      </span>
      <span className="text-ags-dim">·</span>
      <span className="truncate">{site?.name ?? "Площадка N/A"}</span>
      <span className="text-ags-dim">·</span>
      <span className="truncate">{station?.name ?? "Станция N/A"}</span>
      <span className="text-ags-dim">·</span>
      <span>
        Устр. {online}/{devices.length}
      </span>
      <StatusBadge status={videoStatus} />
      <StatusBadge
        label={tauri ? "SQLite" : "Preview DB"}
        tone={ready ? "ok" : "warn"}
      />
      <span title="Свободно на диске">Диск {diskLabel}</span>
      <span className={criticalCount ? "text-ags-warning" : ""}>
        События {criticalCount}
      </span>
      <StatusBadge status={gwStatus} />
      <span className="ml-auto flex items-center gap-2 text-ags-dim">
        <span>
          {appInfo?.name ?? "Aether"} v{appInfo?.version ?? "1.0.0"}
        </span>
        {session && (
          <>
            <StatusBadge label={`${session.user.username}`} tone="ok" />
            <button
              type="button"
              className="text-ags-muted hover:text-ags-fg"
              onClick={logout}
            >
              Выход
            </button>
          </>
        )}
      </span>
    </footer>
  );
}
