/** Terrarium RGB → simple hillshade (Lambert) for 2D relief overlay. */

export function decodeTerrarium(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

export interface RgbaBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/**
 * Convert a Terrarium DEM tile RGBA buffer into a grayscale hillshade buffer.
 */
export function terrariumImageDataToHillshade(
  src: RgbaBuffer,
  exaggeration = 1.6,
): RgbaBuffer {
  const { width: w, height: h, data } = src;
  const elev = new Float32Array(w * h);
  for (let i = 0, p = 0; i < elev.length; i++, p += 4) {
    elev[i] = decodeTerrarium(data[p]!, data[p + 1]!, data[p + 2]!);
  }

  const od = new Uint8ClampedArray(w * h * 4);
  const out: RgbaBuffer = { width: w, height: h, data: od };
  const az = (315 * Math.PI) / 180;
  const alt = (45 * Math.PI) / 180;
  const zFactor = exaggeration;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(w - 1, x + 1);
      const y0 = Math.max(0, y - 1);
      const y1 = Math.min(h - 1, y + 1);
      const dzdx =
        ((elev[y * w + x1]! + elev[y1 * w + x1]! + elev[y0 * w + x1]!) -
          (elev[y * w + x0]! + elev[y1 * w + x0]! + elev[y0 * w + x0]!)) /
        8;
      const dzdy =
        ((elev[y1 * w + x]! + elev[y1 * w + x1]! + elev[y1 * w + x0]!) -
          (elev[y0 * w + x]! + elev[y0 * w + x1]! + elev[y0 * w + x0]!)) /
        8;
      const slope = Math.atan(zFactor * Math.hypot(dzdx, dzdy));
      const aspect =
        dzdx === 0 && dzdy === 0
          ? 0
          : Math.atan2(dzdy, -dzdx);
      let shade =
        Math.sin(alt) * Math.cos(slope) +
        Math.cos(alt) * Math.sin(slope) * Math.cos(az - aspect);
      shade = Math.max(0, Math.min(1, shade));
      const v = Math.round(shade * 255);
      const o = i * 4;
      od[o] = v;
      od[o + 1] = v;
      od[o + 2] = v;
      od[o + 3] = Math.round(200 * (0.35 + 0.65 * (1 - shade)));
    }
  }
  return out;
}

const cache = new Map<string, Promise<string | null>>();

/** Load terrarium PNG and return object-URL of hillshade PNG. */
export function loadHillshadeUrl(
  demUrl: string,
  exaggeration = 1.6,
): Promise<string | null> {
  const key = `${demUrl}|${exaggeration}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetch(demUrl);
        if (!res.ok) return null;
        const blob = await res.blob();
        const bmp = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(bmp, 0, 0);
        const src = ctx.getImageData(0, 0, bmp.width, bmp.height);
        bmp.close();
        const shaded = terrariumImageDataToHillshade(src, exaggeration);
        const img = ctx.createImageData(shaded.width, shaded.height);
        img.data.set(shaded.data);
        ctx.putImageData(img, 0, 0);
        return await new Promise<string | null>((resolve) => {
          canvas.toBlob((b) => {
            if (!b) {
              resolve(null);
              return;
            }
            resolve(URL.createObjectURL(b));
          }, "image/png");
        });
      } catch {
        return null;
      }
    })();
    cache.set(key, pending);
  }
  return pending;
}
