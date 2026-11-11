/**
 * MapLibre GL JS v6 — bundlers must set the worker URL explicitly,
 * otherwise the map stays blank with "Worker failed to load".
 */
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

setWorkerUrl(workerUrl);
