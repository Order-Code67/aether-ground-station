import { useGisStore, type GisTool } from "@/stores/gisStore";
import { useTerrainMapStore } from "@/stores/terrainMapStore";
import { useStationPlannerStore } from "@/stores/stationPlannerStore";

const TOOLS: { id: GisTool; label: string }[] = [
  { id: "measureDistance", label: "Расстояние" },
  { id: "measureArea", label: "Площадь" },
  { id: "measureAzimuth", label: "Азимут" },
  { id: "measureDeltaH", label: "Δ высоты" },
  { id: "routeEdit", label: "Точки маршрута" },
  { id: "obstaclePlace", label: "Препятствие" },
  { id: "profilePickA", label: "Профиль A" },
  { id: "profilePickB", label: "Профиль B" },
];

export function ToolsPanel() {
  const tool = useGisStore((s) => s.tool);
  const setTool = useGisStore((s) => s.setTool);
  const measures = useGisStore((s) => s.measures);
  const removeMeasure = useGisStore((s) => s.removeMeasure);
  const routes = useGisStore((s) => s.routes);
  const createRoute = useGisStore((s) => s.createRoute);
  const deleteRoute = useGisStore((s) => s.deleteRoute);
  const activeRouteId = useGisStore((s) => s.activeRouteId);
  const setActiveRouteId = useGisStore((s) => s.setActiveRouteId);
  const routeLengthM = useGisStore((s) => s.routeLengthM);
  const obstacles = useGisStore((s) => s.obstacles);
  const removeObstacle = useGisStore((s) => s.removeObstacle);
  const offline = useGisStore((s) => s.offlineRegions);
  const demoMode = useTerrainMapStore((s) => s.demoMode);
  const setDemoMode = useTerrainMapStore((s) => s.setDemoMode);
  const profileA = useGisStore((s) => s.profileOverrideA);
  const profileB = useGisStore((s) => s.profileOverrideB);
  const setPA = useGisStore((s) => s.setProfileOverrideA);
  const setPB = useGisStore((s) => s.setProfileOverrideB);

  const fmt = (m: (typeof measures)[0]) => {
    if (m.kind === "distance") {
      return m.value >= 1000
        ? `${(m.value / 1000).toFixed(2)} км`
        : `${m.value.toFixed(0)} м`;
    }
    if (m.kind === "area") {
      return m.value >= 10_000
        ? `${(m.value / 10_000).toFixed(2)} га`
        : `${m.value.toFixed(0)} м²`;
    }
    if (m.kind === "azimuth") return `${m.value.toFixed(1)}°`;
    return `${m.value >= 0 ? "+" : ""}${m.value.toFixed(1)} м`;
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-auto p-2 text-[11px]">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-ags-muted">
        Инструменты
      </h3>
      <div className="flex flex-wrap gap-1">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={
              tool === t.id
                ? "rounded bg-ags-accent px-1.5 py-0.5 text-[10px] text-white"
                : "rounded border border-ags-border px-1.5 py-0.5 text-[10px]"
            }
            onClick={() => {
              const next = tool === t.id ? "none" : t.id;
              setTool(next);
              if (next !== "none") {
                const p = useStationPlannerStore.getState();
                if (p.pickStationPos) p.setPickStationPos(false);
                if (p.pickLookAt) p.setPickLookAt(false);
                if (p.pickMarker) p.setPickMarker(false);
              }
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-[9px] text-ags-dim">
        Выберите инструмент → клики по карте. Маршрут — только планирование, на
        дрон не отправляется.
      </p>

      <div className="rounded border border-ags-border/50 p-1.5">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-semibold text-ags-muted">Режим</span>
          <button
            type="button"
            className={
              demoMode
                ? "rounded bg-amber-600 px-2 py-0.5 text-[10px] text-white"
                : "rounded border border-ags-border px-2 py-0.5 text-[10px]"
            }
            onClick={() => setDemoMode(!demoMode)}
          >
            {demoMode ? "DEMO вкл" : "LIVE / рабочий"}
          </button>
        </div>
        <p className="text-[9px] text-ags-dim">
          DEMO не шлёт команды на ESP. LIVE не подменяет данные демо-дроном.
        </p>
      </div>

      <div className="rounded border border-ags-border/50 p-1.5">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-semibold text-ags-muted">Маршруты</span>
          <button
            type="button"
            className="rounded border border-ags-border px-1.5 py-0.5 text-[10px]"
            onClick={() => createRoute()}
          >
            + новый
          </button>
        </div>
        {routes.length === 0 && (
          <p className="text-[9px] text-ags-dim">Нет маршрутов</p>
        )}
        <ul className="space-y-1">
          {routes.map((r) => (
            <li
              key={r.id}
              className={
                r.id === activeRouteId
                  ? "rounded bg-ags-elevated px-1 py-0.5"
                  : "rounded px-1 py-0.5"
              }
            >
              <button
                type="button"
                className="w-full text-left font-mono text-[10px]"
                onClick={() => {
                  setActiveRouteId(r.id);
                  setTool("routeEdit");
                }}
              >
                {r.name} · {(routeLengthM(r.id) / 1000).toFixed(2)} км ·{" "}
                {r.points.length} т.
              </button>
              <button
                type="button"
                className="text-[9px] text-ags-warning"
                onClick={() => deleteRoute(r.id)}
              >
                удалить
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded border border-ags-border/50 p-1.5">
        <span className="font-semibold text-ags-muted">Профиль A–B</span>
        <p className="font-mono text-[9px] text-ags-dim">
          A:{" "}
          {profileA
            ? `${profileA.lat.toFixed(4)}, ${profileA.lng.toFixed(4)}`
            : "НСУ / не задана"}
        </p>
        <p className="font-mono text-[9px] text-ags-dim">
          B:{" "}
          {profileB
            ? `${profileB.lat.toFixed(4)}, ${profileB.lng.toFixed(4)}`
            : "цель / не задана"}
        </p>
        <button
          type="button"
          className="mt-1 text-[9px] text-ags-dim underline"
          onClick={() => {
            setPA(null);
            setPB(null);
          }}
        >
          Сбросить на НСУ→цель
        </button>
      </div>

      <div className="rounded border border-ags-border/50 p-1.5">
        <span className="font-semibold text-ags-muted">Измерения</span>
        <ul className="mt-1 max-h-28 space-y-0.5 overflow-auto">
          {measures.map((m) => (
            <li
              key={m.id}
              className="flex justify-between gap-1 font-mono text-[10px]"
            >
              <span>
                {m.label}: {fmt(m)}
              </span>
              <button type="button" onClick={() => removeMeasure(m.id)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded border border-ags-border/50 p-1.5">
        <span className="font-semibold text-ags-muted">Препятствия</span>
        <ul className="mt-1 max-h-24 space-y-0.5 overflow-auto">
          {obstacles.map((o) => (
            <li
              key={o.id}
              className="flex justify-between gap-1 text-[10px]"
            >
              <span>
                {o.name}
                {o.heightM != null ? ` · ${o.heightM} м` : " · h Н/Д"}
              </span>
              <button type="button" onClick={() => removeObstacle(o.id)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded border border-ags-border/50 p-1.5">
        <span className="font-semibold text-ags-muted">Офлайн-регионы</span>
        <ul className="mt-1 space-y-1">
          {offline.map((r) => (
            <li key={r.id} className="text-[10px]">
              <div className="font-medium text-ags-fg">{r.name}</div>
              <div className="text-[9px] text-ags-dim">
                z{r.minZoom}–{r.maxZoom} · {r.status} · {r.note}
              </div>
              <div className="text-[9px] text-ags-dim">
                Массовая закачка с внешних провайдеров — только через локальные
                скрипты (`npm run tiles:fetch` / `dem:fetch`), с соблюдением
                лицензий.
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
