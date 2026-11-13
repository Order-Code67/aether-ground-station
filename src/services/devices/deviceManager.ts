import type {
  DeviceCard,
  DeviceConnectionEvent,
  DeviceStatus,
} from "@/types";
import { eventBus } from "@/services/events/eventBus";
import { dbGetJson, dbUpsertJson } from "@/services/database";

type Listener = (devices: DeviceCard[]) => void;

const HISTORY_CAP = 40;

/**
 * Unified Device Manager — single registry for COM/USB/Network/Capture cards.
 * Modules report status here; UI never invents devices.
 */
class DeviceManager {
  private devices = new Map<string, DeviceCard>();
  private listeners = new Set<Listener>();
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private reconnectHandlers = new Map<string, () => Promise<void>>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.list());
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const list = this.list();
    for (const l of this.listeners) l(list);
    void dbUpsertJson("devices_snapshot", list);
  }

  list(): DeviceCard[] {
    return [...this.devices.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  get(id: string): DeviceCard | undefined {
    return this.devices.get(id);
  }

  hasReconnectHandler(id: string): boolean {
    return this.reconnectHandlers.has(id);
  }

  private pushHistory(
    card: DeviceCard,
    kind: DeviceConnectionEvent["kind"],
    message: string,
  ): DeviceConnectionEvent[] {
    const ev: DeviceConnectionEvent = {
      at: new Date().toISOString(),
      kind,
      message,
    };
    return [ev, ...(card.history ?? [])].slice(0, HISTORY_CAP);
  }

  upsert(device: DeviceCard): void {
    const prev = this.devices.get(device.id);
    const merged: DeviceCard = {
      ...prev,
      ...device,
      lastSeenAt: device.lastSeenAt ?? new Date().toISOString(),
      history: device.history ?? prev?.history,
      lastError:
        device.lastError !== undefined ? device.lastError : prev?.lastError,
    };
    if (!prev || prev.status !== merged.status) {
      const kind: DeviceConnectionEvent["kind"] =
        merged.status === "Online"
          ? "online"
          : merged.status === "Reconnecting"
            ? "reconnect"
            : merged.status === "Error"
              ? "error"
              : merged.status === "Lost"
                ? "lost"
                : "info";
      merged.history = this.pushHistory(
        merged,
        kind,
        `Статус → ${merged.status}`,
      );
    }
    this.devices.set(device.id, merged);
    this.emit();
  }

  setStatus(id: string, status: DeviceStatus, error?: string): void {
    const cur = this.devices.get(id);
    if (!cur) return;
    const next: DeviceCard = {
      ...cur,
      status,
      lastSeenAt: new Date().toISOString(),
      capabilities: cur.capabilities,
      lastError: error ?? (status === "Online" ? null : cur.lastError),
    };
    const kind: DeviceConnectionEvent["kind"] =
      status === "Online"
        ? "online"
        : status === "Reconnecting"
          ? "reconnect"
          : status === "Error"
            ? "error"
            : status === "Lost"
              ? "lost"
              : status === "Offline"
                ? "offline"
                : "info";
    next.history = this.pushHistory(
      next,
      kind,
      error ? `${status}: ${error}` : `Статус → ${status}`,
    );
    if (error) {
      eventBus.emit("warning", "device-manager", `${cur.name}: ${error}`);
    }
    if (status === "Lost" || status === "Offline" || status === "Error") {
      this.scheduleReconnect(id);
    }
    if (status === "Online") {
      this.clearReconnect(id);
    }
    this.devices.set(id, next);
    this.emit();
  }

  remove(id: string): void {
    this.clearReconnect(id);
    this.reconnectHandlers.delete(id);
    this.devices.delete(id);
    this.emit();
  }

  registerReconnectHandler(id: string, handler: () => Promise<void>): void {
    this.reconnectHandlers.set(id, handler);
  }

  /** Manual reconnect from hub UI. */
  async reconnectNow(id: string): Promise<boolean> {
    const handler = this.reconnectHandlers.get(id);
    if (!handler) {
      eventBus.emit(
        "warning",
        "device-manager",
        `Нет обработчика reconnect для ${id}`,
      );
      return false;
    }
    this.clearReconnect(id);
    this.setStatus(id, "Reconnecting");
    try {
      await handler();
      this.setStatus(id, "Online");
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.setStatus(id, "Lost", msg);
      return false;
    }
  }

  private clearReconnect(id: string): void {
    const t = this.reconnectTimers.get(id);
    if (t) clearTimeout(t);
    this.reconnectTimers.delete(id);
  }

  private scheduleReconnect(id: string): void {
    if (this.reconnectTimers.has(id)) return;
    const handler = this.reconnectHandlers.get(id);
    if (!handler) return;
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(id);
      const card = this.devices.get(id);
      if (!card) return;
      if (card.status === "Online") return;
      this.setStatus(id, "Reconnecting");
      void handler()
        .then(() => this.setStatus(id, "Online"))
        .catch((e) => {
          const msg = e instanceof Error ? e.message : String(e);
          this.setStatus(id, "Lost", msg);
        });
    }, 3000);
    this.reconnectTimers.set(id, timer);
    eventBus.emit("info", "device-manager", `Повторное подключение: ${id}`);
  }

  /**
   * After app restart: restore cards but mark live Online sessions Offline.
   * Reconnect handlers are session-only — open Serial/Video panel to re-bind.
   */
  hydrate(snapshot: DeviceCard[]): void {
    this.devices.clear();
    const now = new Date().toISOString();
    for (const d of snapshot) {
      const wasLive = d.status === "Online" || d.status === "Reconnecting";
      const card: DeviceCard = {
        ...d,
        status: wasLive ? "Offline" : d.status,
        lastSeenAt: now,
      };
      if (wasLive) {
        card.history = this.pushHistory(
          card,
          "offline",
          "После перезапуска — Offline (откройте COM/Video для reconnect)",
        );
      }
      this.devices.set(d.id, card);
    }
    this.emit();
    if (snapshot.some((d) => d.status === "Online" || d.status === "Reconnecting")) {
      eventBus.emit(
        "info",
        "device-manager",
        "После перезапуска откройте Serial/Video для повторного подключения",
      );
    }
  }

  /** Persist last open intent (COM path/baud, RTSP URL) for panel restore. */
  saveIntent(kind: string, intent: Record<string, unknown>): void {
    void (async () => {
      const cur = await dbGetJson<Record<string, Record<string, unknown>>>(
        "device_intents",
        {},
      );
      cur[kind] = { ...intent, savedAt: new Date().toISOString() };
      await dbUpsertJson("device_intents", cur);
    })();
  }

  async loadIntent(
    kind: string,
  ): Promise<Record<string, unknown> | null> {
    const cur = await dbGetJson<Record<string, Record<string, unknown>>>(
      "device_intents",
      {},
    );
    return cur[kind] ?? null;
  }

  async listIntents(): Promise<Record<string, Record<string, unknown>>> {
    return dbGetJson("device_intents", {});
  }
}

export const deviceManager = new DeviceManager();
