/** Terrarium RGB → hillshade / colormap / contours for 2D overlays. */

import {
  colormapRgba,
  contoursRgba,
  hillshadeRgba,
} from "./demPaint";

export function decodeTerrarium(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

export interface RgbaBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

function terrariumToElev(src: RgbaBuffer): Float32Array {
  const { width: w, height: h, data } = src;
  const elev = new Float32Array(w * h);
  for (let i = 0, p = 0; i < elev.length; i++, p += 4) {
    const e = decodeTerrarium(data[p]!, data[p + 1]!, data[p + 2]!);
    elev[i] = !Number.isFinite(e) || e < -500 ? Number.NaN : e;
  }
  return elev;
}

/**
 * Convert a Terrarium DEM tile RGBA buffer into a grayscale hillshade buffer.
 * `cellSizeM` is ground resolution of one pixel (Horn slope); default ~SRTM.
 */
export function terrariumImageDataToHillshade(
  src: RgbaBuffer,
  exaggeration = 1.6,
  cellSizeM = 30,
): RgbaBuffer {
  const elev = terrariumToElev(src);
  return {
    width: src.width,
    height: src.height,
    data: hillshadeRgba(elev, src.width, src.height, {
      exaggeration,
      cellSizeM,
    }),
  };
}

const cache = new Map<string, Promise<string | null>>();

async function terrariumToObjectUrl(
  demUrl: string,
  cacheKey: string,
  paint: (src: RgbaBuffer, ctx: CanvasRenderingContext2D) => void,
): Promise<string | null> {
  let pending = cache.get(cacheKey);
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
        paint(src, ctx);
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
    cache.set(cacheKey, pending);
  }
  return pending;
}

/** Load terrarium PNG and return object-URL of hillshade PNG. */
export function loadHillshadeUrl(
  demUrl: string,
  exaggeration = 1.6,
  cellSizeM = 30,
): Promise<string | null> {
  return terrariumToObjectUrl(
    demUrl,
    `${demUrl}|hs|${exaggeration}|${cellSizeM.toFixed(1)}`,
    (src, ctx) => {
      const shaded = terrariumImageDataToHillshade(src, exaggeration, cellSizeM);
      const img = ctx.createImageData(shaded.width, shaded.height);
      img.data.set(shaded.data);
      ctx.putImageData(img, 0, 0);
    },
  );
}

export function terrariumImageDataToColormap(src: RgbaBuffer): RgbaBuffer {
  const elev = terrariumToElev(src);
  return {
    width: src.width,
    height: src.height,
    data: colormapRgba(elev, src.width, src.height),
  };
}

export function loadColormapUrl(demUrl: string): Promise<string | null> {
  return terrariumToObjectUrl(demUrl, `${demUrl}|cm`, (src, ctx) => {
    const cm = terrariumImageDataToColormap(src);
    const img = ctx.createImageData(cm.width, cm.height);
    img.data.set(cm.data);
    ctx.putImageData(img, 0, 0);
  });
}

export function terrariumImageDataToContours(
  src: RgbaBuffer,
  stepM = 25,
): RgbaBuffer {
  const elev = terrariumToElev(src);
  return {
    width: src.width,
    height: src.height,
    data: contoursRgba(elev, src.width, src.height, stepM),
  };
}

export function loadContourUrl(
  demUrl: string,
  stepM = 25,
): Promise<string | null> {
  return terrariumToObjectUrl(demUrl, `${demUrl}|ct|${stepM}`, (src, ctx) => {
    const ct = terrariumImageDataToContours(src, stepM);
    const img = ctx.createImageData(ct.width, ct.height);
    img.data.set(ct.data);
    ctx.putImageData(img, 0, 0);
  });
}
