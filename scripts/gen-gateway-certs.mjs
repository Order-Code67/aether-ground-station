/**
 * Cross-platform self-signed cert (selfsigned async API).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "selfsigned";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "..", "services", "gateway-server", "certs");
fs.mkdirSync(out, { recursive: true });

const pems = await generate([{ name: "commonName", value: "localhost" }], {
  days: 825,
  keySize: 2048,
  algorithm: "sha256",
});

const key = pems.private || pems.privateKey;
const cert = pems.cert || pems.certificate;
if (!key || !cert) {
  console.error("unexpected shape", pems);
  process.exit(1);
}
fs.writeFileSync(path.join(out, "server.key"), key);
fs.writeFileSync(path.join(out, "server.crt"), cert);
console.log("Wrote", path.join(out, "server.crt"));
console.log("Wrote", path.join(out, "server.key"));
