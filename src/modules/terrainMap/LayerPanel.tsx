import { useGisStore } from "@/stores/gisStore";
import type { GisLayerFlags } from "@/services/gis/gisTypes";
import { DemSourcePanel } from "./DemSourcePanel";

const LAYER_ROWS: {
  key: keyof GisLayerFlags;
  label: string;
  source: string;
}[] = [
  { key: "satellite", label: "Спутник (офлайн)", source: "Esri Imagery · /tiles" },
  { key: "relief", label: "Рельеф (hillshade)", source: "Terrarium DEM" },
  { key: "demColormap", label: "Цветовая карта высот", source: "Terrarium" },
  { key: "contours", label: "Горизонтали (визуал.)", source: "Terrarium · шаг 25 м" },
  { key: "station", label: "Наземная станция", source: "SQLite stations" },
  { key: "drone", label: "Дрон / цель", source: "live / lookAt / DEMO" },
  { key: "radius", label: "Радиус анализа", source: "геометрия · не RF" },
  { key: "antennaSector", label: "Сектор антенны", source: "упрощённая модель" },
  { key: "los", label: "Линия радиовидимости", source: "DEM + Fresnel" },
  { key: "fresnel", label: "Зона Френеля (профиль)", source: "1-я зона" },
  { key: "route", label: "Маршрут", source: "планирование" },
  { key: "userPoints", label: "Пользовательские точки", source: "оператор" },
  { key: "obstacles", label: "Препятствия", source: "ручная отметка" },
  { key: "measurements", label: "Измерения", source: "оператор" },
];

export function LayerPanel() {
  const layers = useGisStore((s) => s.layers);
  const setLayer = useGisStore((s) => s.setLayer);
  const exag = useGisStore((s) => s.verticalExaggeration);
  const setExag = useGisStore((s) => s.setVerticalExaggeration);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-auto p-2 text-[11px]">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-ags-muted">
        Слои
      </h3>
      <ul className="space-y-1.5">
        {LAYER_ROWS.map((row) => {
          const on = Boolean(layers[row.key]);
          return (
            <li key={row.key} className="rounded border border-ags-border/50 px-1.5 py-1">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) =>
                    setLayer(row.key, e.target.checked as never)
                  }
                />
                <span className="text-ags-fg">{row.label}</span>
              </label>
              <p className="ml-5 text-[9px] text-ags-dim">{row.source}</p>
            </li>
          );
        })}
      </ul>

      <label className="block text-ags-muted">
        Прозрачность рельефа
        <input
          type="range"
          className="mt-1 w-full"
          min={0.1}
          max={1}
          step={0.05}
          value={layers.reliefOpacity}
          onChange={(e) => setLayer("reliefOpacity", Number(e.target.value))}
        />
      </label>
      <label className="block text-ags-muted">
        Прозрачность colormap
        <input
          type="range"
          className="mt-1 w-full"
          min={0.1}
          max={1}
          step={0.05}
          value={layers.colormapOpacity}
          onChange={(e) => setLayer("colormapOpacity", Number(e.target.value))}
        />
      </label>

      <DemSourcePanel />

      <label className="block text-ags-muted">
        Вертикальное преувеличение 3D (×{exag.toFixed(1)})
        <input
          type="range"
          className="mt-1 w-full"
          min={0.5}
          max={6}
          step={0.1}
          value={exag}
          onChange={(e) => setExag(Number(e.target.value))}
        />
        <span className="text-[9px] text-ags-dim">
          Визуальный масштаб, не реальная высота. 1.0 ≈ натуральный.
        </span>
      </label>
    </div>
  );
}
