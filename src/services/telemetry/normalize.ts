import type { DiagnosticsMessage } from "@/types";
import { parseDiagnosticsMessage } from "@/types";

/** UI-facing telemetry — never carries vendor wire format. */
export interface NormalizedTelemetry {
  deviceId: string;
  deviceLabel: string;
  firmware?: string;
  online: boolean;
  voltageV: number | null;
  temperatureC: number | null;
  latitude: number | null;
  longitude: number | null;
  altitudeM: number | null;
  rawStatus: string;
  receivedAt: string;
  warnings: string[];
  adapterId?: string;
}

export interface TelemetrySample {
  at: string;
  voltageV: number | null;
  temperatureC: number | null;
}

export type TelemetryAdapterId =
  | "esp32-json"
  | "generic-json"
  | "px4-json"
  | "ardupilot-json";

export interface TelemetryAdapter {
  id: TelemetryAdapterId;
  label: string;
  parse(line: string): NormalizedTelemetry | null;
}

function baseWarnings(msg: {
  voltageV: number | null;
  temperatureC: number | null;
  rawStatus: string;
}): string[] {
  const warnings: string[] = [];
  if (msg.voltageV === null) warnings.push("Нет данных напряжения");
  if (msg.temperatureC === null) warnings.push("Нет данных температуры");
  if (msg.rawStatus !== "online" && msg.rawStatus !== "OK") {
    warnings.push(`Статус: ${msg.rawStatus}`);
  }
  return warnings;
}

function fromDiagnostics(msg: DiagnosticsMessage): NormalizedTelemetry {
  return {
    deviceId: msg.device,
    deviceLabel: msg.device,
    firmware: msg.version,
    online: msg.status === "online",
    voltageV: msg.voltage,
    temperatureC: msg.temperature,
    latitude: null,
    longitude: null,
    altitudeM: null,
    rawStatus: msg.status,
    receivedAt: new Date().toISOString(),
    warnings: baseWarnings({
      voltageV: msg.voltage,
      temperatureC: msg.temperature,
      rawStatus: msg.status,
    }),
    adapterId: "esp32-json",
  };
}

export const esp32JsonAdapter: TelemetryAdapter = {
  id: "esp32-json",
  label: "ESP32 / Arduino JSON",
  parse(line: string) {
    const msg = parseDiagnosticsMessage(line);
    return msg ? fromDiagnostics(msg) : null;
  },
};

export const genericJsonAdapter: TelemetryAdapter = {
  id: "generic-json",
  label: "Generic JSON",
  parse(line: string) {
    try {
      const o = JSON.parse(line) as Record<string, unknown>;
      const device = String(o.device ?? o.id ?? "unknown");
      const status = String(o.status ?? "unknown");
      const voltage =
        typeof o.voltage === "number"
          ? o.voltage
          : typeof o.voltageV === "number"
            ? o.voltageV
            : null;
      const temperature =
        typeof o.temperature === "number"
          ? o.temperature
          : typeof o.temperatureC === "number"
            ? o.temperatureC
            : null;
      return {
        ...fromDiagnostics({
          device,
          version: String(o.version ?? o.firmware ?? ""),
          status,
          voltage,
          temperature,
        }),
        adapterId: "generic-json",
        latitude: num(o.lat ?? o.latitude),
        longitude: num(o.lon ?? o.lng ?? o.longitude),
        altitudeM: num(o.alt ?? o.altitudeM ?? o.altitude),
      };
    } catch {
      return null;
    }
  },
};

/** PX4 JSON bridge / uORB mirror — missing fields stay null. */
export const px4JsonAdapter: TelemetryAdapter = {
  id: "px4-json",
  label: "PX4 JSON",
  parse(line: string) {
    try {
      const o = JSON.parse(line) as Record<string, unknown>;
      if (!(o.px4 === true || o.source === "px4" || o.mavlink === "px4")) {
        // Accept vehicle_status / battery_status shaped frames
        if (!("battery_status" in o || "vehicle_global_position" in o || "px4" in o)) {
          return null;
        }
      }
      const bat = (o.battery_status as Record<string, unknown> | undefined) ?? o;
      const pos =
        (o.vehicle_global_position as Record<string, unknown> | undefined) ?? o;
      const status = String(o.nav_state ?? o.status ?? "unknown");
      const voltageV = num(bat.voltage_v ?? bat.voltageV ?? o.voltage);
      const temperatureC = num(bat.temperature ?? o.temperature);
      const latitude = num(pos.lat ?? pos.latitude);
      const longitude = num(pos.lon ?? pos.longitude);
      const altitudeM = num(pos.alt ?? pos.altitude);
      return {
        deviceId: String(o.sys_id ?? o.device ?? "px4"),
        deviceLabel: String(o.name ?? o.device ?? "PX4"),
        firmware: String(o.version ?? o.fw ?? "") || undefined,
        online: status !== "disconnected" && status !== "offline",
        voltageV,
        temperatureC,
        latitude,
        longitude,
        altitudeM,
        rawStatus: status,
        receivedAt: new Date().toISOString(),
        warnings: baseWarnings({ voltageV, temperatureC, rawStatus: status }),
        adapterId: "px4-json",
      };
    } catch {
      return null;
    }
  },
};

/** ArduPilot JSON / MAVLink JSON bridge. */
export const ardupilotJsonAdapter: TelemetryAdapter = {
  id: "ardupilot-json",
  label: "ArduPilot JSON",
  parse(line: string) {
    try {
      const o = JSON.parse(line) as Record<string, unknown>;
      const isAp =
        o.ardupilot === true ||
        o.source === "ardupilot" ||
        o.autopilot === "ardupilot" ||
        typeof o.mavpackettype === "string";
      if (!isAp && !("VFR_HUD" in o || "GLOBAL_POSITION_INT" in o || "SYS_STATUS" in o)) {
        return null;
      }
      const sys = (o.SYS_STATUS as Record<string, unknown> | undefined) ?? o;
      const gpos =
        (o.GLOBAL_POSITION_INT as Record<string, unknown> | undefined) ?? o;
      const hud = (o.VFR_HUD as Record<string, unknown> | undefined) ?? o;
      const voltageV = num(
        sys.voltage_battery != null
          ? Number(sys.voltage_battery) / 1000
          : o.voltageV ?? o.voltage,
      );
      const temperatureC = num(o.temperatureC ?? o.temperature);
      let latitude = num(gpos.lat ?? gpos.latitude);
      let longitude = num(gpos.lon ?? gpos.longitude);
      // GLOBAL_POSITION_INT uses degE7
      if (latitude != null && Math.abs(latitude) > 180) latitude = latitude / 1e7;
      if (longitude != null && Math.abs(longitude) > 180) longitude = longitude / 1e7;
      const altitudeM = num(
        gpos.alt != null ? Number(gpos.alt) / 1000 : hud.alt ?? o.altitudeM,
      );
      const status = String(o.mode ?? o.status ?? o.mavpackettype ?? "unknown");
      return {
        deviceId: String(o.sysid ?? o.device ?? "ardupilot"),
        deviceLabel: String(o.name ?? "ArduPilot"),
        firmware: String(o.version ?? "") || undefined,
        online: status !== "offline",
        voltageV,
        temperatureC,
        latitude,
        longitude,
        altitudeM,
        rawStatus: status,
        receivedAt: new Date().toISOString(),
        warnings: baseWarnings({ voltageV, temperatureC, rawStatus: status }),
        adapterId: "ardupilot-json",
      };
    } catch {
      return null;
    }
  },
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const ADAPTERS: TelemetryAdapter[] = [
  esp32JsonAdapter,
  px4JsonAdapter,
  ardupilotJsonAdapter,
  genericJsonAdapter,
];

export function normalizeTelemetryLine(
  line: string,
  preferred: TelemetryAdapterId = "esp32-json",
): NormalizedTelemetry | null {
  const first = ADAPTERS.find((a) => a.id === preferred) ?? esp32JsonAdapter;
  const primary = first.parse(line);
  if (primary) return primary;
  for (const a of ADAPTERS) {
    if (a.id === preferred) continue;
    const r = a.parse(line);
    if (r) return r;
  }
  return null;
}

export function listTelemetryAdapters(): TelemetryAdapter[] {
  return [...ADAPTERS];
}

export function exportTelemetryCsv(samples: TelemetrySample[]): string {
  const header = "at,voltage_v,temperature_c";
  const rows = samples.map(
    (s) =>
      `${s.at},${s.voltageV ?? ""},${s.temperatureC ?? ""}`,
  );
  return [header, ...rows].join("\n");
}
