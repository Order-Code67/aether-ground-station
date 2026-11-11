import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useProfileStore } from "@/stores/profileStore";
import { useEventLogStore } from "@/stores/eventLogStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { deviceManager } from "@/services/devices/deviceManager";
import { listStations } from "@/services/stations";
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

function Widget({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-ags-border bg-ags-panel p-4 text-sm">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ags-dim">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function DashboardView() {
  const role = useAuthStore((s) => s.session?.user.role) ?? "Observer";
  const profiles = useProfileStore((s) => s.profiles);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const events = useEventLogStore((s) => s.events);
  const navigateToModule = useNavigationStore((s) => s.navigateToModule);
  const setSection = useNavigationStore((s) => s.setSection);

  const [devices, setDevices] = useState<DeviceCard[]>([]);
  const [stationCount, setStationCount] = useState<number | null>(null);
  const [schemaVersion, setSchemaVersion] = useState<number | null>(null);
  const [dbPath, setDbPath] = useState<string | null>(null);
  const [disk, setDisk] = useState<{ available: string; path: string } | null>(
    null,
  );
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [gatewayOn, setGatewayOn] = useState<boolean | null>(null);

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  useEffect(() => {
    return deviceManager.subscribe(setDevices);
  }, []);

  useEffect(() => {
    void listStations()
      .then((s) => setStationCount(s.length))
      .catch(() => setStationCount(null));
  }, []);

  useEffect(() => {
    void (async () => {
      if (!isTauriRuntime()) {
        setSchemaVersion(null);
        setDbPath(null);
        setDisk(null);
        setLastBackup(null);
        setGatewayOn(null);
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
        const bak = await dbGetSetting("last_backup_path");
        setLastBackup(bak);
      } catch {
        setLastBackup(null);
      }
      try {
        const st = await getGatewayStatus();
        setGatewayOn(Boolean(st?.enabled));
      } catch {
        setGatewayOn(null);
      }
    })();
  }, []);

  const onlineDevices = devices.filter((d) => d.status === "Online").length;
  const videoDevices = devices.filter((d) =>
    d.capabilities.some((c) => c === "video" || c === "walksnail"),
  );
  const critical = events.filter(
    (e) => e.severity === "error" || e.severity === "warning",
  ).slice(0, 5);

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
    <div className="flex h-full flex-col gap-4 overflow-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Главная</h1>
        <p className="mt-1 text-sm text-ags-muted">
          Сводка активного комплекса. Нет данных — N/A, без имитации Live.
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
          Открыть события
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-3 py-1.5 text-sm"
          onClick={() => navigateToModule("profiles")}
        >
          Выбрать комплекс
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-3 py-1.5 text-sm"
          onClick={() => navigateToModule("stations")}
        >
          Станции
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Widget title="Активный комплекс (профиль)">
          <p className="text-base font-medium">
            {activeProfile?.name ?? "Не выбран"}
          </p>
          <p className="mt-1 text-xs text-ags-dim">
            До GS-2 используется профиль как временный ярлык комплекса
          </p>
        </Widget>

        {(showOps || showEng) && (
          <Widget title="Станции">
            <p className="font-mono text-lg">
              {stationCount == null ? "N/A" : stationCount}
            </p>
            <p className="text-xs text-ags-dim">зарегистрировано в SQLite</p>
          </Widget>
        )}

        <Widget title="Оборудование">
          <div className="flex items-center gap-2">
            <StatusBadge status={deviceSummaryStatus} />
            <span className="font-mono">
              {onlineDevices}/{devices.length || 0} online
            </span>
          </div>
          {!devices.length && (
            <p className="mt-2 text-xs text-ags-dim">
              {entityStatus("no_device").labelRu}
            </p>
          )}
        </Widget>

        {showOps && (
          <Widget title="Видеоисточники">
            {videoDevices.length === 0 ? (
              <StatusBadge status="no_device" />
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
            <StatusBadge status="not_available" />
            <p className="mt-2 text-xs text-ags-dim">
              Сводка источника — после подключения адаптера (не DEMO)
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

        <Widget title="Локальная база">
          <dl className="grid grid-cols-[6rem_1fr] gap-y-1 text-xs">
            <dt className="text-ags-dim">Среда</dt>
            <dd>{isTauriRuntime() ? "Tauri" : "Браузер"}</dd>
            <dt className="text-ags-dim">Schema</dt>
            <dd className="font-mono">
              {schemaVersion == null ? "N/A" : `v${schemaVersion}`}
            </dd>
            <dt className="text-ags-dim">Путь</dt>
            <dd className="truncate font-mono" title={dbPath ?? undefined}>
              {dbPath ?? "N/A"}
            </dd>
          </dl>
        </Widget>

        <Widget title="Диск">
          <p className="font-mono text-lg">{disk?.available ?? "N/A"}</p>
          <p className="truncate text-xs text-ags-dim" title={disk?.path}>
            {disk?.path ?? "Недоступно вне desktop"}
          </p>
        </Widget>

        {showAdmin && (
          <Widget title="Резервная копия">
            <p className="truncate font-mono text-xs">
              {lastBackup ?? "Не выполнялась / N/A"}
            </p>
          </Widget>
        )}

        {showAdmin && (
          <Widget title="Система / Gateway">
            <div className="flex flex-wrap gap-2">
              <StatusBadge
                status={
                  gatewayOn == null
                    ? "not_available"
                    : gatewayOn
                      ? "online"
                      : "not_configured"
                }
              />
              <span className="text-xs text-ags-dim">
                Preview Gateway (не outbox)
              </span>
            </div>
          </Widget>
        )}
      </div>
    </div>
  );
}
