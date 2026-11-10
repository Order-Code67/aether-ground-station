import { describe, expect, it } from "vitest";
import { videoSignalLabel, type VideoSignalState } from "./video";

describe("P1-6 video signal labels", () => {
  it("maps connecting/streaming for operator UI", () => {
    expect(videoSignalLabel("connecting")).toBe("Connecting");
    expect(videoSignalLabel("streaming")).toBe("Streaming");
    expect(videoSignalLabel("ok")).toBe("Streaming");
    expect(videoSignalLabel("no-signal")).toBe("No signal");
  });

  it("covers all declared states", () => {
    const states: VideoSignalState[] = [
      "unknown",
      "connecting",
      "streaming",
      "no-device",
      "no-signal",
      "ok",
      "degraded",
      "lost",
      "recording",
      "error",
    ];
    for (const s of states) {
      expect(videoSignalLabel(s).length).toBeGreaterThan(0);
    }
  });
});
