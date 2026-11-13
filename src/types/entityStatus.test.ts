import { describe, expect, it } from "vitest";
import {
  deviceToEntityStatus,
  entityStatus,
  videoToEntityStatus,
} from "./entityStatus";

describe("entityStatus", () => {
  it("maps device statuses", () => {
    expect(deviceToEntityStatus("Online")).toBe("online");
    expect(deviceToEntityStatus("Reconnecting")).toBe("reconnecting");
    expect(deviceToEntityStatus("Unknown")).toBe("not_available");
  });

  it("maps video signal states", () => {
    expect(videoToEntityStatus("streaming")).toBe("online");
    expect(videoToEntityStatus("no-device")).toBe("no_device");
    expect(videoToEntityStatus("no-signal")).toBe("no_signal");
    expect(videoToEntityStatus("error")).toBe("error");
  });

  it("exposes RU labels", () => {
    expect(entityStatus("not_available").labelRu).toBe("Недоступно");
    expect(entityStatus("online").tone).toBe("ok");
  });
});
