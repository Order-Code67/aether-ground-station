import { useEffect, useState } from "react";
import {
  loadColormapUrl,
  loadContourUrl,
  loadHillshadeUrl,
} from "./hillshade";

type Kind = "hillshade" | "colormap" | "contour";

/** One DEM-derived overlay tile (hillshade / colormap / contours). */
export function DemOverlayTile({
  demUrl,
  left,
  top,
  size,
  kind,
  opacity = 0.5,
  exaggeration = 1.6,
  cellSizeM = 30,
  contourStep = 25,
}: {
  demUrl: string;
  left: number;
  top: number;
  size: number;
  kind: Kind;
  opacity?: number;
  exaggeration?: number;
  cellSizeM?: number;
  contourStep?: number;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load =
      kind === "hillshade"
        ? loadHillshadeUrl(demUrl, exaggeration, cellSizeM)
        : kind === "colormap"
          ? loadColormapUrl(demUrl)
          : loadContourUrl(demUrl, contourStep);
    void load.then((url) => {
      if (alive) setSrc(url);
    });
    return () => {
      alive = false;
    };
  }, [demUrl, kind, exaggeration, cellSizeM, contourStep]);

  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className="pointer-events-none absolute select-none"
      style={{
        left,
        top,
        width: size,
        height: size,
        mixBlendMode: kind === "hillshade" ? "overlay" : "normal",
        opacity,
      }}
      onError={() => setSrc(null)}
    />
  );
}
