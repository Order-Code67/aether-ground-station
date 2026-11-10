import { Suspense, lazy, type ComponentType } from "react";
import { MODULES, type ModuleId } from "@/types";
import { useNavigationStore } from "@/stores/navigationStore";
import { ModuleErrorBoundary } from "@/components/common/ModuleErrorBoundary";

const WorkspaceView = lazy(() =>
  import("@/modules/workspace").then((m) => ({ default: m.WorkspaceView })),
);
const VideoView = lazy(() =>
  import("@/modules/video").then((m) => ({ default: m.VideoView })),
);
const WalksnailView = lazy(() =>
  import("@/modules/walksnail").then((m) => ({ default: m.WalksnailView })),
);
const MapView = lazy(() =>
  import("@/modules/map").then((m) => ({ default: m.MapView })),
);
const StationsView = lazy(() =>
  import("@/modules/stations").then((m) => ({ default: m.StationsView })),
);
const TerrainView = lazy(() =>
  import("@/modules/terrain").then((m) => ({ default: m.TerrainView })),
);
const PanTiltView = lazy(() =>
  import("@/modules/pantilt").then((m) => ({ default: m.PanTiltView })),
);
const DevicesView = lazy(() =>
  import("@/modules/devices").then((m) => ({ default: m.DevicesView })),
);
const NetworkView = lazy(() =>
  import("@/modules/network").then((m) => ({ default: m.NetworkView })),
);
const UsbView = lazy(() =>
  import("@/modules/usb").then((m) => ({ default: m.UsbView })),
);
const SerialView = lazy(() =>
  import("@/modules/serial").then((m) => ({ default: m.SerialView })),
);
const TelemetryView = lazy(() =>
  import("@/modules/telemetry").then((m) => ({ default: m.TelemetryView })),
);
const ArchiveView = lazy(() =>
  import("@/modules/archive").then((m) => ({ default: m.ArchiveView })),
);
const InventoryView = lazy(() =>
  import("@/modules/inventory").then((m) => ({ default: m.InventoryView })),
);
const ReportsView = lazy(() =>
  import("@/modules/reports").then((m) => ({ default: m.ReportsView })),
);
const PluginsView = lazy(() =>
  import("@/modules/plugins").then((m) => ({ default: m.PluginsView })),
);
const ProfilesView = lazy(() =>
  import("@/modules/profiles").then((m) => ({ default: m.ProfilesView })),
);
const RemoteView = lazy(() =>
  import("@/modules/remote").then((m) => ({ default: m.RemoteView })),
);
const SettingsView = lazy(() =>
  import("@/modules/settings").then((m) => ({ default: m.SettingsView })),
);

const VIEWS: Record<ModuleId, ComponentType> = {
  workspace: WorkspaceView,
  video: VideoView,
  walksnail: WalksnailView,
  map: MapView,
  stations: StationsView,
  terrain: TerrainView,
  pantilt: PanTiltView,
  devices: DevicesView,
  network: NetworkView,
  usb: UsbView,
  serial: SerialView,
  telemetry: TelemetryView,
  archive: ArchiveView,
  inventory: InventoryView,
  reports: ReportsView,
  plugins: PluginsView,
  profiles: ProfilesView,
  remote: RemoteView,
  settings: SettingsView,
};

export function WorkArea() {
  const activeModule = useNavigationStore((s) => s.activeModule);
  const View = VIEWS[activeModule];
  const def = MODULES.find((m) => m.id === activeModule);

  if (!View || !def) {
    return (
      <main className="flex-1 bg-ags-bg p-6 text-ags-muted">
        Неизвестный модуль
      </main>
    );
  }

  return (
    <main className="min-w-0 flex-1 overflow-auto bg-ags-bg">
      <ModuleErrorBoundary name={def.label}>
        <Suspense
          fallback={
            <div className="p-6 text-sm text-ags-muted">Загрузка модуля…</div>
          }
        >
          <View />
        </Suspense>
      </ModuleErrorBoundary>
    </main>
  );
}
