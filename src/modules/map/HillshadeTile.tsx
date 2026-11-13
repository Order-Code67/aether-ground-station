import { useEffect, useState } from "react";
import { loadHillshadeUrl } from "./hillshade";

/** One DEM tile rendered as translucent hillshade over satellite basemap. */
export function HillshadeTile({
  demUrl,
  left,
  top,
  size,
}: {
  demUrl: string;
  left: number;
  top: number;
  size: number;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void loadHillshadeUrl(demUrl).then((url) => {
      if (alive) setSrc(url);
    });
    return () => {
      alive = false;
    };
  }, [demUrl]);

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
        mixBlendMode: "multiply",
        opacity: 0.55,
      }}
      onError={() => setSrc(null)}
    />
  );
}
