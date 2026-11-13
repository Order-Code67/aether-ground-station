import { useState, type CSSProperties } from "react";

/** XYZ tile image — hides itself on 404 / decode error (no broken-icon boxes). */
export function SafeTile({
  url,
  left,
  top,
  width,
  height,
  className,
  style,
  zIndex = 0,
}: {
  url: string;
  left: number;
  top: number;
  width: number;
  height: number;
  className?: string;
  style?: CSSProperties;
  zIndex?: number;
}) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      className={className ?? "pointer-events-none absolute select-none"}
      style={{ left, top, width, height, zIndex, ...style }}
      onError={() => setOk(false)}
    />
  );
}
