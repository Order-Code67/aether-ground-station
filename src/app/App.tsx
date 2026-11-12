import { useEffect } from "react";
import { AppShell } from "@/components/layout";
import { ModuleErrorBoundary } from "@/components/common/ModuleErrorBoundary";
import { useAppBootstrap } from "@/hooks/useAppBootstrap";
import { useSqliteSync } from "@/hooks/useSqliteSync";
import { useAuthIdleGuard } from "@/hooks/useAuthIdleGuard";
import { eventBus } from "@/services/events/eventBus";
import { dbAppendEvent, dbInit, dbGetJson } from "@/services/database";
import { deviceManager } from "@/services/devices/deviceManager";
import { useEventLogStore } from "@/stores/eventLogStore";
import { useAuthStore } from "@/stores/authStore";
import type { DeviceCard } from "@/types";

export default function App() {
  useAppBootstrap();
  useSqliteSync();
  useAuthIdleGuard();
  const append = useEventLogStore((s) => s.append);
  const ready = useAuthStore((s) => s.ready);
  const session = useAuthStore((s) => s.session);
  const bootstrapAuth = useAuthStore((s) => s.bootstrap);
  const autoEnter = useAuthStore((s) => s.autoEnter);

  useEffect(() => {
    return eventBus.subscribe((event) => {
      append(event);
      void dbAppendEvent({
        id: event.id,
        at: event.at,
        severity: event.severity,
        source: event.source,
        message: event.message,
      });
    });
  }, [append]);

  useEffect(() => {
    void (async () => {
      const path = await dbInit();
      const snapshot = await dbGetJson<DeviceCard[]>("devices_snapshot", []);
      if (snapshot.length) deviceManager.hydrate(snapshot);
      await bootstrapAuth();
      eventBus.emit(
        "info",
        "app",
        path
          ? `Ядро готово · SQLite: ${path}`
          : "Ядро готово (браузерный preview)",
      );
    })();
  }, [bootstrapAuth]);

  // Safety net: never stick on a login wall for local desktop GS.
  useEffect(() => {
    if (ready && !session) {
      void autoEnter();
    }
  }, [ready, session, autoEnter]);

  if (!ready || !session) {
    return (
      <div className="flex h-full items-center justify-center bg-ags-bg text-ags-muted">
        Загрузка…
      </div>
    );
  }

  return (
    <ModuleErrorBoundary name="Оболочка">
      <AppShell />
    </ModuleErrorBoundary>
  );
}
