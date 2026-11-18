import { describe, expect, it } from "vitest";
import {
  createStubLocalPanTiltAdapter,
  getPanTiltAdapter,
  nullPanTiltAdapter,
  setPanTiltAdapter,
} from "./panTiltAdapter";

describe("panTiltAdapter", () => {
  it("null adapter never invents fact angles", async () => {
    setPanTiltAdapter(nullPanTiltAdapter);
    const s = await getPanTiltAdapter().read();
    expect(s.azimuthDeg).toBeNull();
    expect(s.elevationDeg).toBeNull();
    expect(s.linkOk).toBe(false);
  });

  it("stub local adapter stays Н/Д until real stream", async () => {
    setPanTiltAdapter(
      createStubLocalPanTiltAdapter({ deviceId: "COM9", label: "PT COM9" }),
    );
    const s = await getPanTiltAdapter().read();
    expect(s.deviceId).toBe("COM9");
    expect(s.azimuthDeg).toBeNull();
    expect(s.elevationDeg).toBeNull();
    expect(s.linkOk).toBe(false);
    setPanTiltAdapter(nullPanTiltAdapter);
  });
});
