import { useEffect } from "react";
import { getAppInfo } from "@/services/tauri";
import { useAppStore } from "@/stores/appStore";
import { registerBundledTerrariumDem } from "@/services/terrain/terrainEngine";
import { eventBus } from "@/services/events/eventBus";

export function useAppBootstrap(): void {
  const setAppInfo = useAppStore((s) => s.setAppInfo);
  const setReady = useAppStore((s) => s.setReady);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const info = await getAppInfo();
      if (cancelled) return;
      setAppInfo(info);
      setReady(true);
      const demOk = await registerBundledTerrariumDem();
      if (!cancelled && demOk) {
        eventBus.emit(
          "info",
          "terrain",
          "DEM офлайн: Terrarium · Смоленск / Центральная Россия",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setAppInfo, setReady]);
}
