import { StationsPanel } from "./StationsPanel";

export function StationsView() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-ags-border-subtle px-4 py-2">
        <h1 className="text-sm font-semibold">Station Planner</h1>
        <p className="text-xs text-ags-muted">
          Размещение наземных станций, мачты, антенны, азимут. Геометрия не
          гарантирует радиосвязь.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <StationsPanel />
      </div>
    </div>
  );
}

export { StationsPanel };
