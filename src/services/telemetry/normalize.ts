import type { DiagnosticsMessage } from "@/types";
import {
  honestLatLng,
  honestNumber,
  parseDiagnosticsMessage,
} from "@/types";

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
  latitude?: number | null;
  longitude?: number | null;
  altitudeM?: number | null;
  adapterId?: string | null;
}

export type TelemetryAdapterId = string;

export interface TelemetryAdapter {
  id: TelemetryAdapterId;
  label: string;
  parse(line: string): NormalizedTelemetry | null;
}

function baseWarnings(msg: {
  voltageV: number | null;
  temperatureC: number | null;
  latitude?: number | null;
  longitude?: number | null;
  altitudeM?: number | null;
  rawStatus: string;
}): string[] {
  const warnings: string[] = [];
  if (msg.voltageV === null) warnings.push("Нет данных напряжения");
  if (msg.temperatureC === null) warnings.push("Нет данных температуры");
  if (msg.latitude == null || msg.longitude == null) {
    warnings.push("Нет данных GPS");
  }
  if (msg.altitudeM == null) warnings.push("Нет данных высоты");
  if (msg.rawStatus !== "online" && msg.rawStatus !== "OK") {
    warnings.push(`Статус: ${msg.rawStatus}`);
  }
  return warnings;
}

function fromDiagnostics(msg: DiagnosticsMessage): NormalizedTelemetry {
  const pos = honestLatLng(msg.latitude, msg.longitude);
  const voltageV = msg.voltage;
  const temperatureC = msg.temperature;
  const altitudeM = msg.altitudeM ?? null;
  return {
    deviceId: msg.device,
    deviceLabel: msg.device,
    firmware: msg.version,
    online: msg.status === "online",
    voltageV,
    temperatureC,
    latitude: pos?.lat ?? null,
    longitude: pos?.lng ?? null,
    altitudeM,
    rawStatus: msg.status,
    receivedAt: new Date().toISOString(),
    warnings: baseWarnings({
      voltageV,
      temperatureC,
      latitude: pos?.lat ?? null,
      longitude: pos?.lng ?? null,
      altitudeM,
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
      const voltage = honestNumber(o.voltage ?? o.voltageV);
      const temperature = honestNumber(o.temperature ?? o.temperatureC);
      const pos = honestLatLng(
        o.lat ?? o.latitude,
        o.lon ?? o.lng ?? o.longitude,
      );
      const altitudeM = honestNumber(o.alt ?? o.altitudeM ?? o.altitude);
      return {
        ...fromDiagnostics({
          device,
          version: String(o.version ?? o.firmware ?? ""),
          status,
          voltage,
          temperature,
          latitude: pos?.lat ?? null,
          longitude: pos?.lng ?? null,
          altitudeM,
        }),
        adapterId: "generic-json",
        latitude: pos?.lat ?? null,
        longitude: pos?.lng ?? null,
        altitudeM,
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
      const voltageV = honestNumber(bat.voltage_v ?? bat.voltageV ?? o.voltage);
      const temperatureC = honestNumber(bat.temperature ?? o.temperature);
      const fix = honestLatLng(pos.lat ?? pos.latitude, pos.lon ?? pos.longitude);
      const latitude = fix?.lat ?? null;
      const longitude = fix?.lng ?? null;
      const altitudeM = honestNumber(pos.alt ?? pos.altitude);
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
        warnings: baseWarnings({
          voltageV,
          temperatureC,
          latitude,
          longitude,
          altitudeM,
          rawStatus: status,
        }),
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
      const voltageV = honestNumber(
        sys.voltage_battery != null
          ? Number(sys.voltage_battery) / 1000
          : o.voltageV ?? o.voltage,
      );
      const temperatureC = honestNumber(o.temperatureC ?? o.temperature);
      let latRaw = honestNumber(gpos.lat ?? gpos.latitude);
      let lonRaw = honestNumber(gpos.lon ?? gpos.longitude);
      // GLOBAL_POSITION_INT uses degE7
      if (latRaw != null && Math.abs(latRaw) > 180) latRaw = latRaw / 1e7;
      if (lonRaw != null && Math.abs(lonRaw) > 180) lonRaw = lonRaw / 1e7;
      const fix = honestLatLng(latRaw, lonRaw);
      const latitude = fix?.lat ?? null;
      const longitude = fix?.lng ?? null;
      const altitudeM = honestNumber(
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
        warnings: baseWarnings({
          voltageV,
          temperatureC,
          latitude,
          longitude,
          altitudeM,
          rawStatus: status,
        }),
        adapterId: "ardupilot-json",
      };
    } catch {
      return null;
    }
  },
};

const ADAPTERS: TelemetryAdapter[] = [
  esp32JsonAdapter,
  px4JsonAdapter,
  ardupilotJsonAdapter,
  genericJsonAdapter,
];

/** Extra adapters from the plugin SDK — never used as a fake sensor source. */
export function registerTelemetryAdapter(adapter: TelemetryAdapter): void {
  if (ADAPTERS.some((a) => a.id === adapter.id)) {
    throw new Error(`Адаптер телеметрии уже есть: ${adapter.id}`);
  }
  ADAPTERS.push(adapter);
}

export function unregisterTelemetryAdapter(id: string): void {
  const i = ADAPTERS.findIndex((a) => a.id === id);
  if (i >= 0 && i > 3) ADAPTERS.splice(i, 1);
}

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

function csvCell(v: number | string | null | undefined): string {
  if (v == null || v === "") return "";
  return String(v);
}

export function exportTelemetryCsv(samples: TelemetrySample[]): string {
  const header =
    "at,voltage_v,temperature_c,latitude,longitude,altitude_m,adapter";
  const rows = samples.map(
    (s) =>
      `${s.at},${csvCell(s.voltageV)},${csvCell(s.temperatureC)},${csvCell(s.latitude)},${csvCell(s.longitude)},${csvCell(s.altitudeM)},${csvCell(s.adapterId)}`,
  );
  return [header, ...rows].join("\n");
}

export function exportTelemetryJson(samples: TelemetrySample[]): string {
  return JSON.stringify(samples, null, 2);
}
