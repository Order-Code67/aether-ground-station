import { useMemo, useState } from "react";
import type { LinkProfileResult } from "@/services/terrain/linkProfile";
import { radioVisibilityLabel } from "@/services/terrain/fresnel";

export function ElevationProfileChart({
  profile,
  stationLabel = "НСУ",
  droneLabel = "Дрон",
  onHoverDistanceM,
}: {
  profile: LinkProfileResult | null;
  stationLabel?: string;
  droneLabel?: string;
  onHoverDistanceM?: (m: number | null) => void;
}) {
  const [hoverX, setHoverX] = useState<number | null>(null);
  const w = 640;
  const h = 140;
  const pad = { l: 44, r: 12, t: 12, b: 28 };

  const geom = useMemo(() => {
    if (!profile?.points.length) return null;
    const pts = profile.points;
    const known = pts
      .map((p) => p.terrainM)
      .filter((v): v is number => v != null);
    const los = pts
      .map((p) => p.losAmslM)
      .filter((v): v is number => v != null);
    const all = [...known, ...los];
    if (!all.length) return null;
    const minY = Math.min(...all) - 20;
    const maxY = Math.max(...all) + 40;
    const maxX = profile.distanceM || 1;
    const sx = (d: number) =>
      pad.l + (d / maxX) * (w - pad.l - pad.r);
    const sy = (elev: number) =>
      pad.t + (1 - (elev - minY) / (maxY - minY || 1)) * (h - pad.t - pad.b);

    const terrainPath = pts
      .filter((p) => p.terrainM != null)
      .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.distanceM)},${sy(p.terrainM!)}`)
      .join(" ");

    const terrainFill =
      terrainPath +
      ` L${sx(maxX)},${sy(minY)} L${sx(0)},${sy(minY)} Z`;

    let fresnelPath = "";
    const withLos = pts.filter((p) => p.losAmslM != null && p.fresnelRadiusM != null);
    if (withLos.length > 1) {
      const upper = withLos
        .map(
          (p, i) =>
            `${i === 0 ? "M" : "L"}${sx(p.distanceM)},${sy(p.losAmslM! + p.fresnelRadiusM!)}`,
        )
        .join(" ");
      const lower = [...withLos]
        .reverse()
        .map(
          (p) =>
            `L${sx(p.distanceM)},${sy(p.losAmslM! - p.fresnelRadiusM!)}`,
        )
        .join(" ");
      fresnelPath = `${upper} ${lower} Z`;
    }

    const losLine = withLos
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${sx(p.distanceM)},${sy(p.losAmslM!)}`,
      )
      .join(" ");

    return {
      minY,
      maxY,
      maxX,
      sx,
      sy,
      terrainFill,
      fresnelPath,
      losLine,
      stationY: pts[0]?.losAmslM ?? pts[0]?.terrainM,
      droneY: pts[pts.length - 1]?.losAmslM ?? pts[pts.length - 1]?.terrainM,
    };
  }, [profile]);

  if (!profile || !geom) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-ags-muted">
        Профиль высот: нет данных DEM / нет цели
      </div>
    );
  }

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = (x - pad.l) / (w - pad.l - pad.r);
    const d = Math.max(0, Math.min(1, t)) * geom.maxX;
    setHoverX(d);
    onHoverDistanceM?.(d);
  };

  return (
    <div className="flex h-full min-h-0 flex-col px-2 py-1">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[10px] text-ags-muted">
        <span className="font-semibold uppercase tracking-wide">
          Профиль высот
        </span>
        <span>
          {radioVisibilityLabel(profile.status)} ·{" "}
          {(profile.distanceM / 1000).toFixed(2)} км
          {profile.maxObstacleM != null
            ? ` · препятствие ≈ ${profile.maxObstacleM.toFixed(0)} м`
            : ""}
        </span>
        <span className="text-ags-dim">{profile.disclaimer}</span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-full min-h-[7rem] w-full"
        onMouseMove={onMove}
        onMouseLeave={() => {
          setHoverX(null);
          onHoverDistanceM?.(null);
        }}
      >
        {geom.fresnelPath && (
          <path d={geom.fresnelPath} fill="rgba(61,139,253,0.18)" />
        )}
        {geom.terrainFill && (
          <path
            d={geom.terrainFill}
            fill="url(#terrainGrad)"
            opacity={0.85}
          />
        )}
        <defs>
          <linearGradient id="terrainGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d4782a" />
            <stop offset="55%" stopColor="#3d9b4a" />
            <stop offset="100%" stopColor="#1a5c3a" />
          </linearGradient>
        </defs>
        {geom.losLine && (
          <path
            d={geom.losLine}
            fill="none"
            stroke="#9ec5ff"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
        )}
        {profile.maxObstacleAtM != null && profile.maxObstacleM != null && (
          <g>
            <circle
              cx={geom.sx(profile.maxObstacleAtM)}
              cy={geom.sy(profile.maxObstacleM)}
              r={5}
              fill="#e85d5d"
            />
            <text
              x={geom.sx(profile.maxObstacleAtM) + 8}
              y={geom.sy(profile.maxObstacleM) - 6}
              fill="#e85d5d"
              fontSize={9}
            >
              ! {profile.maxObstacleM.toFixed(0)} м
            </text>
          </g>
        )}
        {geom.stationY != null && (
          <text
            x={pad.l}
            y={geom.sy(geom.stationY) - 6}
            fill="#9ec5ff"
            fontSize={9}
          >
            {geom.stationY.toFixed(0)} м ({stationLabel})
          </text>
        )}
        {geom.droneY != null && (
          <text
            x={w - pad.r - 90}
            y={geom.sy(geom.droneY) - 6}
            fill="#f0c14a"
            fontSize={9}
          >
            {geom.droneY.toFixed(0)} м ({droneLabel})
          </text>
        )}
        {hoverX != null && (
          <line
            x1={geom.sx(hoverX)}
            x2={geom.sx(hoverX)}
            y1={pad.t}
            y2={h - pad.b}
            stroke="#ffffff55"
            strokeWidth={1}
          />
        )}
        <text x={pad.l} y={h - 6} fill="#8899aa" fontSize={9}>
          0 км
        </text>
        <text x={w / 2 - 20} y={h - 6} fill="#8899aa" fontSize={9}>
          {(geom.maxX / 2000).toFixed(1)} км
        </text>
        <text x={w - pad.r - 40} y={h - 6} fill="#8899aa" fontSize={9}>
          {(geom.maxX / 1000).toFixed(2)} км
        </text>
      </svg>
    </div>
  );
}
