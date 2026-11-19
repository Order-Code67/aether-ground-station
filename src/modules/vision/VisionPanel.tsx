import { useCallback, useEffect, useState } from "react";

export type VisionMode = "idle" | "avoid" | "detect" | "follow" | "land";

type VisionMeta = {
  ts?: number;
  mode?: VisionMode;
  armed_assist?: boolean;
  dry_run?: boolean;
  gs2_min_mm?: number | null;
  boxes?: Array<{
    cls: string;
    x: number;
    y: number;
    w: number;
    h: number;
    score: number;
  }>;
  track_id?: number | null;
  marker?: { id: number; x: number; y: number; area?: number } | null;
  msp?: {
    enabled?: boolean;
    roll?: number;
    pitch?: number;
    yaw?: number;
    throttle?: number;
    mock?: boolean;
  };
};

const MODES: VisionMode[] = ["idle", "avoid", "detect", "follow", "land"];

/**
 * Overlay panel for aether-vision companion (/meta + /mjpeg).
 * Assist commands stay onboard; GCS is monitor + mode switch.
 */
export function VisionPanel() {
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:8787");
  const [meta, setMeta] = useState<VisionMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/meta`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as VisionMeta;
      setMeta(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [baseUrl]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 500);
    return () => window.clearInterval(id);
  }, [refresh]);

  const postJson = async (path: string, body: unknown) => {
    setBusy(true);
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const mjpeg = `${baseUrl.replace(/\/$/, "")}/mjpeg`;
  const boxes = meta?.boxes ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4" data-testid="vision-panel">
      <div>
        <h1 className="text-sm font-semibold">Vision (aether-vision)</h1>
        <p className="text-xs text-ags-muted">
          Мониторинг companion: detect / follow / land / avoid. Управление assist
          — на борту (MSP), здесь только режим и оверлей.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-xs">
          Base URL companion
          <input
            className="rounded border border-ags-border bg-ags-elevated px-2 py-1.5 text-sm"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://192.168.x.x:8787"
          />
        </label>
        <button
          type="button"
          className="rounded border border-ags-border px-3 py-1.5 text-xs"
          onClick={() => void refresh()}
          disabled={busy}
        >
          Обновить
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            disabled={busy}
            className={
              meta?.mode === m
                ? "rounded bg-ags-accent px-2 py-1 text-xs text-white"
                : "rounded border border-ags-border px-2 py-1 text-xs"
            }
            onClick={() => void postJson("/mode", { mode: m })}
          >
            {m}
          </button>
        ))}
        <button
          type="button"
          disabled={busy}
          className="rounded border border-ags-border px-2 py-1 text-xs"
          onClick={() => void postJson("/assist", { on: true })}
        >
          Assist ON
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded border border-ags-border px-2 py-1 text-xs"
          onClick={() => void postJson("/assist", { on: false })}
        >
          Assist OFF
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
          <div className="mt-1 text-ags-muted">
            Запустите companion: <code>python main.py</code> в{" "}
            <code>D:\AETHER_LIDAR\aether-vision</code>
          </div>
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
        <div className="relative min-h-[220px] overflow-hidden rounded border border-ags-border bg-black">
          <img
            src={mjpeg}
            alt="aether-vision mjpeg"
            className="h-full w-full object-contain"
            onError={() =>
              setError((prev) => prev ?? "MJPEG недоступен (нет /mjpeg)")
            }
          />
          {/* Normalized boxes overlay relative to image box */}
          <div className="pointer-events-none absolute inset-0">
            {boxes.map((b, i) => (
              <div
                key={i}
                className="absolute border border-emerald-400/90"
                style={{
                  left: `${(b.x - b.w / 2) * 100}%`,
                  top: `${(b.y - b.h / 2) * 100}%`,
                  width: `${b.w * 100}%`,
                  height: `${b.h * 100}%`,
                }}
              >
                <span className="bg-emerald-500/80 px-1 text-[10px] text-white">
                  {b.cls} {b.score.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2 overflow-auto rounded border border-ags-border bg-ags-elevated p-3 text-xs">
          <Row k="mode" v={meta?.mode ?? "—"} />
          <Row k="dry_run" v={String(meta?.dry_run ?? "—")} />
          <Row k="armed_assist" v={String(meta?.armed_assist ?? false)} />
          <Row
            k="gs2_min_mm"
            v={meta?.gs2_min_mm != null ? String(meta.gs2_min_mm) : "—"}
          />
          <Row k="boxes" v={String(boxes.length)} />
          <Row k="track_id" v={String(meta?.track_id ?? "—")} />
          <Row
            k="marker"
            v={
              meta?.marker
                ? `id=${meta.marker.id} x=${meta.marker.x.toFixed(2)} y=${meta.marker.y.toFixed(2)}`
                : "—"
            }
          />
          <Row k="msp.enabled" v={String(meta?.msp?.enabled ?? false)} />
          <Row
            k="msp R/P/Y/T"
            v={
              meta?.msp
                ? `${meta.msp.roll}/${meta.msp.pitch}/${meta.msp.yaw}/${meta.msp.throttle}`
                : "—"
            }
          />
          <pre className="mt-2 max-h-48 overflow-auto rounded bg-black/40 p-2 text-[10px] text-ags-muted">
            {JSON.stringify(meta, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-ags-border-subtle py-1">
      <span className="text-ags-muted">{k}</span>
      <span className="font-mono">{v}</span>
    </div>
  );
}
