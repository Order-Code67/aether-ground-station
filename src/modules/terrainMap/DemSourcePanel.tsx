import { useEffect, useState } from "react";
import { getDemMeta } from "@/services/terrain/terrainEngine";
import {
  getSavedGeoTiffPath,
  loadGeoTiffFromPath,
  pickAndLoadGeoTiff,
  switchToBundledTerrarium,
} from "@/services/terrain/geotiffDem";
import { isTauriRuntime } from "@/services/tauri";

/** Install / switch DEM source: GeoTIFF file or bundled Terrarium. */
export function DemSourcePanel() {
  const [meta, setMeta] = useState(() => getDemMeta());
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () => setMeta(getDemMeta());

  useEffect(() => {
    void getSavedGeoTiffPath().then((p) => {
      if (p) setPath(p);
    });
  }, []);

  const onPick = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await pickAndLoadGeoTiff();
      setMsg(r.message);
      if (r.path) setPath(r.path);
      refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onLoadPath = async () => {
    if (!path.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await loadGeoTiffFromPath(path.trim());
      setMsg(r.message);
      refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onTerrarium = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await switchToBundledTerrarium();
      setMsg("Активен офлайн Terrarium");
      refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded border border-ags-border/50 p-1.5 text-[11px]">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ags-muted">
        DEM / GeoTIFF
      </div>
      <p className="font-mono text-[10px] text-ags-fg">
        {meta.sourceType === "none" ? "Нет данных" : meta.name}
      </p>
      <p className="text-[9px] text-ags-dim">
        Тип: {meta.sourceType}
        {meta.path ? ` · ${meta.path}` : ""}
        {meta.resolutionM != null ? ` · ≈${meta.resolutionM} м` : ""}
      </p>
      <p className="text-[9px] text-ags-dim">
        Поддержка: Float32/Int16, Deflate/Zlib, strip/tile + geo-теги. LZW и
        прочие кодеки — Н/Д. Высоты не подменяются нулём.
      </p>

      {!isTauriRuntime() && (
        <p className="text-[9px] text-ags-warning">
          Загрузка GeoTIFF — только в desktop-сборке.
        </p>
      )}

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          disabled={busy || !isTauriRuntime()}
          className="rounded bg-ags-accent px-2 py-1 text-[10px] text-white disabled:opacity-40"
          onClick={() => void onPick()}
        >
          {busy ? "…" : "Установить GeoTIFF…"}
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded border border-ags-border px-2 py-1 text-[10px]"
          onClick={() => void onTerrarium()}
        >
          Terrarium (офлайн)
        </button>
      </div>

      <label className="block text-[9px] text-ags-muted">
        Или путь к файлу
        <div className="mt-0.5 flex gap-1">
          <input
            className="min-w-0 flex-1 rounded border border-ags-border bg-ags-elevated px-1.5 py-0.5 font-mono text-[10px]"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="D:\dem\smolensk.tif"
            disabled={!isTauriRuntime()}
          />
          <button
            type="button"
            disabled={busy || !isTauriRuntime() || !path.trim()}
            className="rounded border border-ags-border px-1.5 py-0.5 text-[10px] disabled:opacity-40"
            onClick={() => void onLoadPath()}
          >
            Загрузить
          </button>
        </div>
      </label>

      {msg && (
        <p className="break-all text-[9px] text-ags-muted" title={msg}>
          {msg}
        </p>
      )}
    </div>
  );
}
