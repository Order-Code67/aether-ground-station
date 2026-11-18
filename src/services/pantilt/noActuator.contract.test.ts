import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "src/services/pantilt");

/**
 * Safety contract: pan-tilt service layer must not send motion / write commands.
 * Local angle read + parse only. serialWrite / actuator verbs stay outside this module.
 */
describe("pan-tilt no remote actuator contract", () => {
  const files = readdirSync(root).filter((f) => f.endsWith(".ts"));

  it("pantilt sources never call serialWrite or motion command helpers", () => {
    // Match call sites / imports — not safety comments that say "NO … actuator".
    const banned =
      /\bserialWrite\b|\bserial_write\b|\bservo_write\b|\bgoto_position\b|\bmove_to\b|\bauth_bind_session\b/;
    for (const f of files) {
      if (f.endsWith(".test.ts")) continue;
      const src = readFileSync(join(root, f), "utf8");
      expect(src, f).not.toMatch(banned);
    }
  });

  it("adapter surface exposes read-only contract", () => {
    const src = readFileSync(join(root, "panTiltAdapter.ts"), "utf8");
    expect(src).toMatch(/read\(\):\s*Promise<PanTiltSample>/);
    expect(src).toMatch(/NO remote actuator/i);
    expect(src).not.toMatch(/\bwrite\s*\(/);
  });
});
