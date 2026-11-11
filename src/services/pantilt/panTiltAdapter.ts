/**
 * Local pan-tilt device adapter contract.
 * Safety: NO remote actuator / servo command paths in this module.
 * Fact angles are null until a real adapter reports them.
 */

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
  active = adapter;
}

/**
 * Placeholder for future local COM/USB adapter registration.
 * Does not send motion commands — read-only monitoring surface.
 */
export function createStubLocalPanTiltAdapter(opts: {
  deviceId: string;
  label?: string;
}): PanTiltAdapter {
  return {
    id: `local:${opts.deviceId}`,
    label: opts.label ?? `Local ${opts.deviceId}`,
    async read() {
      // No fake angles — until a real transport fills a buffer, report Н/Д.
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
