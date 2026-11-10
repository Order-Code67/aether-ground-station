import { PanTiltPanel } from "./PanTiltPanel";

export function PanTiltView() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-ags-border-subtle px-4 py-2">
        <h1 className="text-sm font-semibold">Pan-Tilt Status</h1>
      </div>
      <div className="min-h-0 flex-1">
        <PanTiltPanel />
      </div>
    </div>
  );
}

export { PanTiltPanel };
