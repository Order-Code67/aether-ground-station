/**
 * Local pan-tilt device adapter contract.
 * Safety: NO remote actuator / servo command paths in this module.
 * Fact angles are null until a real adapter reports them.
 */

import { listen } from "@tauri-apps/api/event";
import { isTauriRuntime } from "@/services/tauri";
import { parsePanTiltAngles } from "./parsePanTiltAngles";

export interface PanTiltSample {
  azimuthDeg: number | null;
  elevationDeg: number | null;
  linkOk: boolean;
  deviceId: string | null;
  updatedAt: string | null;
  message: string;
}

export interface PanTiltAdapter {
  id: string;
  label: string;
  /** Poll fact angles — never invents values. */
  read(): Promise<PanTiltSample>;
  /** Optional cleanup for event subscriptions. */
  dispose?: () => void;
}

/** Default: no hardware — always Н/Д. */
export const nullPanTiltAdapter: PanTiltAdapter = {
  id: "none",
  label: "Нет адаптера",
  async read() {
    return {
      azimuthDeg: null,
      elevationDeg: null,
      linkOk: false,
      deviceId: null,
      updatedAt: null,
      message: "Адаптер поворотного механизма не подключён",
    };
  },
};

let active: PanTiltAdapter = nullPanTiltAdapter;

export function getPanTiltAdapter(): PanTiltAdapter {
  return active;
}

export function setPanTiltAdapter(adapter: PanTiltAdapter): void {
  active.dispose?.();
  active = adapter;
}

/**
 * Placeholder registration without a live stream — stays Н/Д.
 */
export function createStubLocalPanTiltAdapter(opts: {
  deviceId: string;
  label?: string;
}): PanTiltAdapter {
  return {
    id: `local:${opts.deviceId}`,
    label: opts.label ?? `Local ${opts.deviceId}`,
    async read() {
      return {
        azimuthDeg: null,
        elevationDeg: null,
        linkOk: false,
        deviceId: opts.deviceId,
        updatedAt: null,
        message:
          "Локальный адаптер зарегистрирован, но поток углов ещё не поступает (Н/Д)",
      };
    },
  };
}

/**
 * Read-only COM/USB angle stream via existing `serial-data` events.
 * Does not open the port itself and never writes — open COM in Serial / Aiming UI.
 */
export function createSerialPanTiltAdapter(opts: {
  deviceId: string;
  label?: string;
}): PanTiltAdapter {
  let last: PanTiltSample = {
    azimuthDeg: null,
    elevationDeg: null,
    linkOk: false,
    deviceId: opts.deviceId,
    updatedAt: null,
    message: isTauriRuntime()
      ? "Ожидание строк AZ/EL на serial-data…"
      : "COM доступен только в desktop",
  };
  let unlisten: (() => void) | undefined;
  let buffer = "";

  if (isTauriRuntime()) {
    void listen<{ data: string }>("serial-data", (ev) => {
      buffer += ev.payload.data;
      const parts = buffer.split(/\r?\n/);
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        const parsed = parsePanTiltAngles(line);
        if (!parsed) continue;
        last = {
          azimuthDeg: parsed.azimuthDeg,
          elevationDeg: parsed.elevationDeg,
          linkOk: true,
          deviceId: opts.deviceId,
          updatedAt: new Date().toISOString(),
          message: `Углы с ${opts.deviceId}`,
        };
      }
      // Also try whole chunk if no newlines yet
      const inline = parsePanTiltAngles(ev.payload.data);
      if (inline) {
        last = {
          azimuthDeg: inline.azimuthDeg,
          elevationDeg: inline.elevationDeg,
          linkOk: true,
          deviceId: opts.deviceId,
          updatedAt: new Date().toISOString(),
          message: `Углы с ${opts.deviceId}`,
        };
      }
    }).then((fn) => {
      unlisten = fn;
    });
  }

  return {
    id: `serial:${opts.deviceId}`,
    label: opts.label ?? `COM ${opts.deviceId}`,
    async read() {
      return { ...last };
    },
    dispose: () => {
      unlisten?.();
      unlisten = undefined;
    },
  };
}
