import { describe, expect, it } from "vitest";
import {
  assertSafePermissions,
  registerPluginTelemetryAdapter,
} from "./adapterSdk";
import { pluginManager } from "./pluginManager";

describe("adapter SDK", () => {
  it("rejects wildcard and exec permissions", () => {
    expect(() => assertSafePermissions(["*"])).toThrow(/Небезопасные/);
    expect(() => assertSafePermissions(["system.exec"])).toThrow(/Небезопасные/);
    expect(() => assertSafePermissions(["telemetry.parse"])).not.toThrow();
  });

  it("does not register a parser when the plugin is off", () => {
    expect(() =>
      registerPluginTelemetryAdapter(
        {
          id: "missing-plugin",
          name: "x",
          version: "0",
          permissions: ["telemetry.parse"],
          enabled: false,
        },
        {
          id: "custom-json",
          label: "custom",
          parse: () => null,
        },
      ),
    ).toThrow(/выключен/);
  });

  it("bundled example plugin stays disabled by default", async () => {
    const list = await pluginManager.list();
    const ex = list.find((p) => p.id === "example-adapter-kit");
    expect(ex?.enabled).toBe(false);
  });
});
