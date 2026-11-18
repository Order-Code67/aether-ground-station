import { useMemo, useState } from "react";
import type { LinkProfileResult } from "@/services/terrain/linkProfile";
import { radioVisibilityLabel } from "@/services/terrain/fresnel";

export function ElevationProfileChart({
  profile,
  stationLabel = "НСУ",
  droneLabel = "Цель",
  stationAmsl,
  targetAmsl,
  onHoverDistanceM,
}: {
  profile: LinkProfileResult | null;
  stationLabel?: string;
  droneLabel?: string;
  stationAmsl?: number | null;
  targetAmsl?: number | null;
  onHoverDistanceM?: (m: number | null) => void;
}) {
  const [hoverX, setHoverX] = useState<number | null>(null);
  const w = 720;
  const h = 168;
  const pad = { l: 48, r: 16, t: 18, b: 30 };

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
    const minY = Math.min(...all) - 25;
    const maxY = Math.max(...all) + 35;
    const maxX = profile.distanceM || 1;
    const sx = (d: number) => pad.l + (d / maxX) * (w - pad.l - pad.r);
    const sy = (elev: number) =>
      pad.t + (1 - (elev - minY) / (maxY - minY || 1)) * (h - pad.t - pad.b);

    const terrainPts = pts.filter((p) => p.terrainM != null);
    const terrainPath = terrainPts
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${sx(p.distanceM).toFixed(1)},${sy(p.terrainM!).toFixed(1)}`,
      )
      .join(" ");

    const terrainFill =
      terrainPath +
      ` L${sx(maxX).toFixed(1)},${sy(minY).toFixed(1)} L${sx(0).toFixed(1)},${sy(minY).toFixed(1)} Z`;

    let fresnelPath = "";
    const withLos = pts.filter(
      (p) => p.losAmslM != null && p.fresnelRadiusM != null,
    );
    if (withLos.length > 1) {
      const upper = withLos
        .map(
          (p, i) =>
            `${i === 0 ? "M" : "L"}${sx(p.distanceM).toFixed(1)},${sy(p.losAmslM! + p.fresnelRadiusM!).toFixed(1)}`,
        )
        .join(" ");
      const lower = [...withLos]
        .reverse()
        .map(
          (p) =>
            `L${sx(p.distanceM).toFixed(1)},${sy(p.losAmslM! - p.fresnelRadiusM!).toFixed(1)}`,
        )
        .join(" ");
      fresnelPath = `${upper} ${lower} Z`;
    }

    const losLine = withLos
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${sx(p.distanceM).toFixed(1)},${sy(p.losAmslM!).toFixed(1)}`,
      )
      .join(" ");

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
      const elev = minY + t * (maxY - minY);
      return { elev, y: sy(elev) };
    });

    const xTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      d: t * maxX,
      x: sx(t * maxX),
      label: `${((t * maxX) / 1000).toFixed(t === 0 || t === 1 ? 2 : 1)}`,
    }));

    const stElev =
      stationAmsl ?? pts[0]?.losAmslM ?? pts[0]?.terrainM ?? null;
    const tgElev =
      targetAmsl ??
      pts[pts.length - 1]?.losAmslM ??
      pts[pts.length - 1]?.terrainM ??
      null;

    return {
      minY,
      maxY,
      maxX,
      sx,
      sy,
      terrainFill,
      fresnelPath,
      losLine,
      yTicks,
      xTicks,
      stationY: stElev,
      droneY: tgElev,
    };
  }, [profile, stationAmsl, targetAmsl]);

  if (!profile || !geom) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
        <div className="text-xs font-medium text-ags-muted">Профиль высот</div>
        <p className="max-w-sm text-[11px] text-ags-dim">
          Поставьте НСУ и цель B на карте — появится разрез рельефа, линия
          видимости и зона Френеля по направлению станции.
        </p>
      </div>
    );
  }

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = w / rect.width;
    const x = (e.clientX - rect.left) * scaleX;
    const t = (x - pad.l) / (w - pad.l - pad.r);
    const d = Math.max(0, Math.min(1, t)) * geom.maxX;
    setHoverX(d);
    onHoverDistanceM?.(d);
  };

  const hoverPt =
    hoverX != null
      ? profile.points.reduce((best, p) =>
          Math.abs(p.distanceM - hoverX) < Math.abs(best.distanceM - hoverX)
            ? p
            : best,
        )
      : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-1 px-3 py-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold tracking-wide text-ags-fg">
            Профиль высот
          </span>
          <span
            className={
              profile.status === "clear"
                ? "rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300"
                : profile.status === "blocked"
                  ? "rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300"
                  : profile.status === "fresnel_partial"
                    ? "rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200"
                    : "rounded-full bg-ags-elevated px-2 py-0.5 text-[10px] text-ags-muted"
            }
          >
            {radioVisibilityLabel(profile.status)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-ags-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-sm bg-gradient-to-r from-[#d4782a] to-[#1a5c3a]" />
            Рельеф
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-px w-4 border-t border-dashed border-[#9ec5ff]" />
            Линия видимости
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-sm bg-[#3d8bfd]/30" />
            1-я зона Френеля
          </span>
          <span className="font-mono text-ags-fg">
            {(profile.distanceM / 1000).toFixed(2)} км
            {profile.deltaHeightM != null
              ? ` · Δh ${profile.deltaHeightM >= 0 ? "+" : ""}${profile.deltaHeightM.toFixed(0)} м`
              : ""}
            {profile.elevationDeg != null
              ? ` · EL ${profile.elevationDeg.toFixed(1)}°`
              : ""}
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-full min-h-[8rem] w-full"
        onMouseMove={onMove}
        onMouseLeave={() => {
          setHoverX(null);
          onHoverDistanceM?.(null);
        }}
      >
        <defs>
          <linearGradient id="agsTerrainGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e08a3a" />
            <stop offset="45%" stopColor="#4aab58" />
            <stop offset="100%" stopColor="#163f2c" />
          </linearGradient>
          <linearGradient id="agsFresnelGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(61,139,253,0.28)" />
            <stop offset="100%" stopColor="rgba(61,139,253,0.08)" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {geom.yTicks.map((t, i) => (
          <g key={`yg-${i}`}>
            <line
              x1={pad.l}
              x2={w - pad.r}
              y1={t.y}
              y2={t.y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
            <text
              x={pad.l - 6}
              y={t.y + 3}
              textAnchor="end"
              fill="#6b7c90"
              fontSize={9}
              fontFamily="ui-monospace, monospace"
            >
              {t.elev.toFixed(0)}
            </text>
          </g>
        ))}
        {geom.xTicks.map((t, i) => (
          <line
            key={`xg-${i}`}
            x1={t.x}
            x2={t.x}
            y1={pad.t}
            y2={h - pad.b}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={1}
          />
        ))}

        {geom.fresnelPath && (
          <path d={geom.fresnelPath} fill="url(#agsFresnelGrad)" />
        )}
        {geom.terrainFill && (
          <path d={geom.terrainFill} fill="url(#agsTerrainGrad)" opacity={0.92} />
        )}
        {geom.losLine && (
          <path
            d={geom.losLine}
            fill="none"
            stroke="#9ec5ff"
            strokeWidth={1.75}
            strokeDasharray="6 5"
            strokeLinecap="round"
          />
        )}

        {profile.maxObstacleAtM != null && profile.maxObstacleM != null && (
          <g>
            <polygon
              points={`${geom.sx(profile.maxObstacleAtM)},${geom.sy(profile.maxObstacleM) - 9} ${geom.sx(profile.maxObstacleAtM) - 7},${geom.sy(profile.maxObstacleM) + 4} ${geom.sx(profile.maxObstacleAtM) + 7},${geom.sy(profile.maxObstacleM) + 4}`}
              fill="#e85d5d"
            />
            <text
              x={geom.sx(profile.maxObstacleAtM) + 10}
              y={geom.sy(profile.maxObstacleM) - 4}
              fill="#ff8a8a"
              fontSize={10}
              fontWeight={600}
            >
              Препятствие ≈ {profile.maxObstacleM.toFixed(0)} м
            </text>
          </g>
        )}

        {geom.stationY != null && (
          <g>
            <circle
              cx={geom.sx(0)}
              cy={geom.sy(geom.stationY)}
              r={5}
              fill="#3d8bfd"
              stroke="#fff"
              strokeWidth={1.5}
            />
            <text
              x={geom.sx(0) + 8}
              y={geom.sy(geom.stationY) - 8}
              fill="#c5dcff"
              fontSize={10}
              fontWeight={600}
            >
              {stationLabel} {geom.stationY.toFixed(0)} м
            </text>
          </g>
        )}
        {geom.droneY != null && (
          <g>
            <circle
              cx={geom.sx(geom.maxX)}
              cy={geom.sy(geom.droneY)}
              r={5}
              fill="#f0c14a"
              stroke="#fff"
              strokeWidth={1.5}
            />
            <text
              x={geom.sx(geom.maxX) - 8}
              y={geom.sy(geom.droneY) - 8}
              textAnchor="end"
              fill="#ffe6a0"
              fontSize={10}
              fontWeight={600}
            >
              {droneLabel} {geom.droneY.toFixed(0)} м
            </text>
          </g>
        )}

        {hoverX != null && (
          <g>
            <line
              x1={geom.sx(hoverX)}
              x2={geom.sx(hoverX)}
              y1={pad.t}
              y2={h - pad.b}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={1}
            />
            {hoverPt?.terrainM != null && (
              <text
                x={geom.sx(hoverX) + 6}
                y={pad.t + 12}
                fill="#eef3fa"
                fontSize={10}
                fontFamily="ui-monospace, monospace"
              >
                {(hoverX / 1000).toFixed(2)} км · рельеф{" "}
                {hoverPt.terrainM.toFixed(0)} м
              </text>
            )}
          </g>
        )}

        {geom.xTicks.map((t, i) => (
          <text
            key={`xl-${i}`}
            x={t.x}
            y={h - 8}
            textAnchor={i === 0 ? "start" : i === geom.xTicks.length - 1 ? "end" : "middle"}
            fill="#7a8a9c"
            fontSize={9}
            fontFamily="ui-monospace, monospace"
          >
            {t.label} км
          </text>
        ))}
        <text
          x={12}
          y={pad.t + 4}
          fill="#5a687a"
          fontSize={8}
          transform={`rotate(-90 12 ${h / 2})`}
        >
          м AMSL
        </text>
      </svg>
      <p className="truncate text-[9px] text-ags-dim">{profile.disclaimer}</p>
    </div>
  );
}
