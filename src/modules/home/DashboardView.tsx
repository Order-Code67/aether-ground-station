import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useEventLogStore } from "@/stores/eventLogStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";
import { deviceManager } from "@/services/devices/deviceManager";
import { dbInit, dbGetSetting } from "@/services/database";
import { getDiskSpace, formatBytes } from "@/services/system/diskSpace";
import { isTauriRuntime } from "@/services/tauri";
import { invoke } from "@tauri-apps/api/core";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  deviceToEntityStatus,
  entityStatus,
  type DeviceCard,
  type EntityStatusId,
} from "@/types";
import { getGatewayStatus } from "@/services/gateway";
import { listTelemetryRecords } from "@/services/inventory";

function Widget({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="ags-panel p-4 text-sm">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ags-dim">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function DashboardView() {
  const role = useAuthStore((s) => s.session?.user.role) ?? "Observer";
  const events = useEventLogStore((s) => s.events);
  const navigateToModule = useNavigationStore((s) => s.navigateToModule);
  const setSection = useNavigationStore((s) => s.setSection);

  const complexes = useStationPlannerStore((s) => s.complexes);
  const sites = useStationPlannerStore((s) => s.sites);
  const stations = useStationPlannerStore((s) => s.stations);
  const activeComplexId = useStationPlannerStore((s) => s.activeComplexId);
  const activeSiteId = useStationPlannerStore((s) => s.activeSiteId);
  const refresh = useStationPlannerStore((s) => s.refresh);

  const [devices, setDevices] = useState<DeviceCard[]>([]);
  const [schemaVersion, setSchemaVersion] = useState<number | null>(null);
  const [dbPath, setDbPath] = useState<string | null>(null);
  const [disk, setDisk] = useState<{ available: string; path: string } | null>(
    null,
  );
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [gatewayOn, setGatewayOn] = useState<boolean | null>(null);
  const [telLast, setTelLast] = useState<string | null>(null);

  const complex = complexes.find((c) => c.id === activeComplexId);
  const site = sites.find((s) => s.id === activeSiteId);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return deviceManager.subscribe(setDevices);
  }, []);

  useEffect(() => {
    void (async () => {
      if (!isTauriRuntime()) {
        setSchemaVersion(null);
        setDbPath(null);
        setDisk(null);
        setLastBackup(null);
        setGatewayOn(null);
        setTelLast(null);
        return;
      }
      try {
        const path = await dbInit();
        setDbPath(path);
        const ver = await invoke<number>("db_schema_version");
        setSchemaVersion(ver);
      } catch {
        setDbPath(null);
        setSchemaVersion(null);
      }
      const space = await getDiskSpace();
      setDisk(
        space
          ? {
              available: formatBytes(space.availableBytes),
              path: space.path,
            }
          : null,
      );
      try {
        setLastBackup(await dbGetSetting("last_backup_path"));
      } catch {
        setLastBackup(null);
      }
      try {
        const st = await getGatewayStatus();
        setGatewayOn(Boolean(st?.enabled));
      } catch {
        setGatewayOn(null);
      }
      try {
        const rows = await listTelemetryRecords(1);
        setTelLast(rows[0]?.at ?? null);
      } catch {
        setTelLast(null);
      }
    })();
  }, []);

  const byStatus = useMemo(() => {
    const counts = {
      Online: 0,
      Offline: 0,
      Lost: 0,
      Error: 0,
      other: 0,
    };
    for (const d of devices) {
      if (d.status in counts) {
        counts[d.status as keyof typeof counts]++;
      } else {
        counts.other++;
      }
    }
    return counts;
  }, [devices]);

  const videoDevices = devices.filter((d) =>
    d.capabilities.some((c) => c === "video" || c === "walksnail"),
  );
  const critical = events
    .filter((e) => e.severity === "error" || e.severity === "warning")
    .slice(0, 5);

  const deviceSummaryStatus: EntityStatusId = useMemo(() => {
    if (!devices.length) return "no_device";
    if (devices.some((d) => d.status === "Error")) return "error";
    if (devices.some((d) => d.status === "Online")) return "online";
    if (devices.some((d) => d.status === "Connecting")) return "connecting";
    return "offline";
  }, [devices]);

  const showOps = role === "Operator" || role === "Administrator";
  const showEng = role === "Administrator" || role === "Operator";
  const showAdmin = role === "Administrator";

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto bg-gradient-to-b from-ags-bg to-ags-surface/40 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ags-fg">
          Главная
        </h1>
        <p className="mt-1 text-sm text-ags-muted">
          Сводка активного комплекса. Нет данных — Н/Д, без имитации Live.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded bg-ags-accent px-3 py-1.5 text-sm text-white"
          onClick={() => setSection("planning")}
        >
          Открыть карту
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-3 py-1.5 text-sm"
          onClick={() => navigateToModule("stations")}
        >
          Добавить станцию
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-3 py-1.5 text-sm"
          onClick={() => setSection("video")}
        >
          Открыть видео
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-3 py-1.5 text-sm"
          onClick={() => setSection("equipment")}
        >
          Открыть оборудование
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-3 py-1.5 text-sm"
          onClick={() => setSection("events")}
        >
          Посмотреть события
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-3 py-1.5 text-sm"
          onClick={() => setSection("complexes")}
        >
          Выбрать комплекс
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Widget title="Сводка комплекса">
          <dl className="grid grid-cols-[7rem_1fr] gap-y-1.5 text-xs">
            <dt className="text-ags-dim">Комплекс</dt>
            <dd className="font-medium">{complex?.name ?? "Не выбран"}</dd>
            <dt className="text-ags-dim">Площадка</dt>
            <dd>{site?.name ?? "Н/Д"}</dd>
            <dt className="text-ags-dim">Площадок</dt>
            <dd className="font-mono">
              {activeComplexId == null ? "Н/Д" : sites.length}
            </dd>
            <dt className="text-ags-dim">Станций</dt>
            <dd className="font-mono">{stations.length}</dd>
            <dt className="text-ags-dim">Всего комплексов</dt>
            <dd className="font-mono">{complexes.length}</dd>
          </dl>
        </Widget>

        {(showOps || showEng) && (
          <Widget title="Станции">
            <p className="font-mono text-lg">{stations.length}</p>
            <p className="text-xs text-ags-dim">
              в фильтре активного комплекса / площадки
            </p>
            <p className="mt-2 text-xs text-ags-muted">
              Последняя активность:{" "}
              {stations[0]?.updatedAt
                ? new Date(stations[0].updatedAt).toLocaleString("ru-RU")
                : "Н/Д"}
            </p>
          </Widget>
        )}

        <Widget title="Оборудование">
          <div className="mb-2 flex items-center gap-2">
            <StatusBadge status={deviceSummaryStatus} />
          </div>
          <ul className="space-y-0.5 font-mono text-xs text-ags-muted">
            <li>Подключено: {byStatus.Online}</li>
            <li>Отключено: {byStatus.Offline}</li>
            <li>Потеряно: {byStatus.Lost}</li>
            <li>Ошибка: {byStatus.Error}</li>
          </ul>
          {!devices.length && (
            <p className="mt-2 text-xs text-ags-dim">
              {entityStatus("no_device").labelRu}
            </p>
          )}
        </Widget>

        {showOps && (
          <Widget title="Видео">
            {videoDevices.length === 0 ? (
              <>
                <StatusBadge status="no_device" />
                <p className="mt-2 text-xs text-ags-dim">Нет источников в реестре</p>
              </>
            ) : (
              <ul className="space-y-1 text-xs">
                {videoDevices.slice(0, 5).map((d) => (
                  <li key={d.id} className="flex justify-between gap-2">
                    <span className="truncate">{d.name}</span>
                    <StatusBadge status={deviceToEntityStatus(d.status)} />
                  </li>
                ))}
              </ul>
            )}
          </Widget>
        )}

        {showEng && (
          <Widget title="Телеметрия">
            <StatusBadge status={telLast ? "online" : "not_available"} />
            <p className="mt-2 text-xs text-ags-dim">
              Последнее обновление:{" "}
              {telLast
                ? new Date(telLast).toLocaleString("ru-RU")
                : "Н/Д (нет записей)"}
            </p>
          </Widget>
        )}

        <Widget title="Последние события">
          {critical.length === 0 ? (
            <p className="text-xs text-ags-dim">Нет критических в сессии</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {critical.map((e) => (
                <li key={e.id} className="truncate">
                  <span className="text-ags-warning">{e.severity}</span> ·{" "}
                  {e.message}
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget title="Локальная система">
          <dl className="grid grid-cols-[6.5rem_1fr] gap-y-1 text-xs">
            <dt className="text-ags-dim">Среда</dt>
            <dd>{isTauriRuntime() ? "Tauri" : "Браузер"}</dd>
            <dt className="text-ags-dim">Schema</dt>
            <dd className="font-mono">
              {schemaVersion == null ? "Н/Д" : `v${schemaVersion}`}
            </dd>
            <dt className="text-ags-dim">База</dt>
            <dd className="truncate font-mono" title={dbPath ?? undefined}>
              {dbPath ?? "Н/Д"}
            </dd>
            <dt className="text-ags-dim">Диск</dt>
            <dd className="font-mono">{disk?.available ?? "Н/Д"}</dd>
            <dt className="text-ags-dim">Бэкап</dt>
            <dd className="truncate font-mono text-[10px]">
              {lastBackup ?? "Не выполнялась / Н/Д"}
            </dd>
          </dl>
        </Widget>

        {showAdmin && (
          <Widget title="Gateway">
            <StatusBadge
              status={
                gatewayOn == null
                  ? "not_available"
                  : gatewayOn
                    ? "online"
                    : "not_configured"
              }
            />
            <p className="mt-2 text-xs text-ags-dim">
              Preview (не outbox UI)
            </p>
          </Widget>
        )}
      </div>
    </div>
  );
}
