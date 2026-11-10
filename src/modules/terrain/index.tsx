import { TerrainPanel } from "./TerrainPanel";

export function TerrainView() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-ags-border-subtle px-4 py-2">
        <h1 className="text-sm font-semibold">Terrain Engine</h1>
        <p className="text-xs text-ags-muted">
          DEM / профиль рельефа. Отсутствующие данные — N/A.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <TerrainPanel />
      </div>
    </div>
  );
}

export { TerrainPanel };
