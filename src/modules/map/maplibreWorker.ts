/**
 * MapLibre GL JS v6 — bundlers must set the worker URL explicitly.
 * Resolve to an absolute same-origin URL so Tauri custom protocol can load it.
 */
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

function resolveWorkerUrl(url: string): string {
  if (!url) return url;
  if (
    url.startsWith("blob:") ||
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    return url;
  }
  if (typeof window !== "undefined" && window.location?.href) {
    return new URL(url, window.location.href).href;
  }
  return url;
}

setWorkerUrl(resolveWorkerUrl(workerUrl));
