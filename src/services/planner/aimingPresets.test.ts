import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, unknown>();

vi.mock("@/services/database", () => ({
  dbGetJson: async <T>(key: string, fallback: T) =>
    (store.has(key) ? (store.get(key) as T) : fallback),
  dbUpsertJson: async (key: string, value: unknown) => {
    store.set(key, value);
  },
}));

import {
  deleteAimingPreset,
  listAimingPresets,
  upsertAimingPreset,
  type AimingPreset,
} from "./aimingPresets";

describe("aimingPresets", () => {
  beforeEach(() => store.clear());

  const sample = (): AimingPreset => ({
    id: "p1",
    name: "Смоленск восток",
    stationId: "st1",
    latitude: 54.78,
    longitude: 32.05,
    azimuthDeg: 90,
    elevationDeg: 5,
    rangeKm: 40,
    videoPatchDeg: 60,
    controlPatchDeg: 90,
    mastHeightM: 15,
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  it("upserts and lists presets", async () => {
    await upsertAimingPreset(sample());
    const list = await listAimingPresets();
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe("Смоленск восток");
  });

  it("deletes by id", async () => {
    await upsertAimingPreset(sample());
    await deleteAimingPreset("p1");
    expect(await listAimingPresets()).toEqual([]);
  });
});
