import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { isTauriRuntime } from "@/services/tauri";

/**
 * 1.0.1 SEC-1: keep backend session alive on activity; expire via auth_touch.
 */
export function useAuthIdleGuard(): void {
  const session = useAuthStore((s) => s.session);
  const touchSession = useAuthStore((s) => s.touchSession);

  useEffect(() => {
    if (!session || !isTauriRuntime()) return;

    const onActivity = () => {
      void touchSession();
    };

    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "mousemove",
      "wheel",
    ];
    let last = 0;
    const throttled = () => {
      const now = Date.now();
      if (now - last < 15_000) return;
      last = now;
      onActivity();
    };
    for (const ev of events) {
      window.addEventListener(ev, throttled, { passive: true });
    }

    const interval = window.setInterval(() => {
      void touchSession();
    }, 60_000);

    return () => {
      for (const ev of events) {
        window.removeEventListener(ev, throttled);
      }
      window.clearInterval(interval);
    };
  }, [session, touchSession]);
}
