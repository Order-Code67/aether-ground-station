/**
 * P0-3: fail closed if bundled FFmpeg is missing before release build.
 * Skip with AGS_SKIP_FFMPEG_CHECK=1 (dev only).
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bin = join(root, "src-tauri", "resources", "bin");
const ffmpeg = join(bin, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
const ffprobe = join(bin, process.platform === "win32" ? "ffprobe.exe" : "ffprobe");

if (process.env.AGS_SKIP_FFMPEG_CHECK === "1") {
  console.warn("WARN: AGS_SKIP_FFMPEG_CHECK=1 — FFmpeg bundle check skipped");
  process.exit(0);
}

const okF = existsSync(ffmpeg);
const okP = existsSync(ffprobe);
if (!okF || !okP) {
  console.error("FAIL: bundled FFmpeg missing.");
  console.error(`  expected: ${ffmpeg}`);
  console.error(`  expected: ${ffprobe}`);
  console.error("Run: npm run ffmpeg:fetch");
  process.exit(1);
}
console.log("ok: bundled FFmpeg present");
