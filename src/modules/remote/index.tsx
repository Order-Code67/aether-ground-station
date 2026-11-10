import { useEffect, useState } from "react";
import {
  getRemoteGateway,
  getRemoteTestMode,
  setRemoteTestMode,
} from "@/services/remote";
import type { RemoteStationSummary, RemoteTestMode } from "@/types/remote";
import {
  getGatewayConfig,
  getGatewayStatus,
  setGatewayConfig,
  tryGatewaySync,
  enqueueGateway,
  type GatewayConfig,
  type GatewayStatus,
} from "@/services/gateway";
import { eventBus } from "@/services/events/eventBus";
import { StatusBadge } from "@/components/common/StatusBadge";

export function RemoteView() {
  const [mode, setMode] = useState<RemoteTestMode>(getRemoteTestMode());
  const [stations, setStations] = useState<RemoteStationSummary[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [synthetic, setSynthetic] = useState(false);
  const [cfg, setCfg] = useState<GatewayConfig>({
    enabled: false,
    httpBaseUrl: "",
    postgresDsn: "",
    staleAfterSec: 120,
    syncSecret: "",
  });
  const [status, setStatus] = useState<GatewayStatus | null>(null);

  useEffect(() => {
    void getGatewayConfig().then((c) =>
      setCfg({
        ...c,
        syncSecret: c.syncSecret ?? "",
      }),
    );
    void getGatewayStatus().then(setStatus);
  }, []);

  const applyMode = (next: RemoteTestMode) => {
    setRemoteTestMode(next);
    setMode(next);
    setStations(null);
    setNote(null);
    eventBus.emit("info", "remote", `Режим remote: ${next}`);
  };

  const loadStations = async () => {
    const gw = getRemoteGateway();
    if (!gw) {
      setNote("Remote отключён. Включите sandbox или integration.");
      setStations(null);
      return;
    }
    const res = await gw.registry.listStations();
    setSynthetic(res.meta.synthetic);
    setStations(res.data);
    setNote(
      res.error ??
        (res.meta.synthetic
          ? "Sandbox: список пуст — демо-станции не подставляются"
          : undefined) ??
        null,
    );
  };

  const saveGw = async () => {
    const next = await setGatewayConfig(cfg);
    setCfg(next);
    setStatus(await getGatewayStatus());
    eventBus.emit("info", "gateway", "Конфиг Central Gateway сохранён");
  };

  const syncNow = async () => {
    try {
      await enqueueGateway("heartbeat", { at: Date.now() });
      const st = await tryGatewaySync();
      setStatus(st);
      eventBus.emit("info", "gateway", st.message);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setNote(msg);
      eventBus.emit("warning", "gateway", msg);
      setStatus(await getGatewayStatus());
    }
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-ags-dim">V2 Gateway</p>
        <h1 className="mt-2 text-2xl font-semibold">Удалённое подключение</h1>
        <p className="mt-2 max-w-2xl text-sm text-ags-muted">
          Central Gateway: outbox → HTTP sync, PostgreSQL probe. Локальный SQLite —
          SSOT offline. Команды полёта / актуаторов через remote не передаются.
        </p>
      </div>

      <section className="max-w-xl space-y-3 rounded-lg border border-ags-border bg-ags-panel p-4 text-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ags-muted">
          Central Gateway
        </h2>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={cfg.enabled}
            onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
          />
          Включён
        </label>
        <input
          className="w-full rounded border border-ags-border bg-ags-elevated px-2 py-1 font-mono text-xs"
          placeholder="https://gateway.example:8443"
          value={cfg.httpBaseUrl}
          onChange={(e) => setCfg({ ...cfg, httpBaseUrl: e.target.value })}
        />
        <input
          className="w-full rounded border border-ags-border bg-ags-elevated px-2 py-1 font-mono text-xs"
          placeholder="postgresql://user@host:5432/aether"
          value={cfg.postgresDsn}
          onChange={(e) => setCfg({ ...cfg, postgresDsn: e.target.value })}
        />
        <input
          className="w-full rounded border border-ags-border bg-ags-elevated px-2 py-1 font-mono text-xs"
          placeholder="syncSecret (= GATEWAY_SYNC_SECRET)"
          type="password"
          value={cfg.syncSecret}
          onChange={(e) => setCfg({ ...cfg, syncSecret: e.target.value })}
        />
        <p className="text-[11px] text-ags-dim">
          Preview: sync требует X-Ags-Sync-Token. Сервер: GATEWAY_SYNC_SECRET.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded bg-ags-accent px-3 py-1.5 text-white"
            onClick={() => void saveGw()}
          >
            Сохранить
          </button>
          <button
            type="button"
            className="rounded border border-ags-border px-3 py-1.5"
            onClick={() => void syncNow()}
          >
            Sync outbox
          </button>
          <button
            type="button"
            className="rounded border border-ags-border px-3 py-1.5"
            onClick={() => void getGatewayStatus().then(setStatus)}
          >
            Статус
          </button>
        </div>
        {status && (
          <div className="space-y-1 text-xs text-ags-muted">
            <p>{status.message}</p>
            <p>
              outbox: {status.pendingOutbox}
              {status.stale ? " · STALE" : ""}
              {status.httpReachable === false ? " · HTTP down" : ""}
              {status.postgresReachable === false ? " · PG down" : ""}
            </p>
            {status.stale && <StatusBadge label="stale data" tone="warn" />}
          </div>
        )}
      </section>

      <section className="max-w-xl space-y-3 rounded-lg border border-ags-border bg-ags-panel p-4 text-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ags-muted">
          Тестовый режим API
        </h2>
        <div className="flex flex-wrap gap-2">
          {(["disabled", "sandbox", "integration"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => applyMode(m)}
              className={
                mode === m
                  ? "rounded bg-ags-accent px-3 py-1 text-white"
                  : "rounded border border-ags-border px-3 py-1 text-ags-muted"
              }
            >
              {m}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="rounded border border-ags-border px-3 py-1.5"
          onClick={() => void loadStations()}
        >
          Запросить список станций (API)
        </button>
        {note && <p className="text-xs text-ags-warning">{note}</p>}
        {stations && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-ags-muted">Станции: {stations.length}</span>
              {synthetic && <StatusBadge label="synthetic" tone="warn" />}
            </div>
            {stations.length === 0 ? (
              <p className="text-ags-dim">Пусто — без фиктивных объектов.</p>
            ) : (
              <ul className="space-y-1">
                {stations.map((s) => (
                  <li key={s.id} className="rounded border border-ags-border px-2 py-1">
                    {s.name} · {s.connectionState}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
