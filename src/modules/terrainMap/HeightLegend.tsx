/** Height color legend matching TZ / concept. */
export function HeightLegend({
  placement = "left",
}: {
  /** Keep off left «Слои» / right sidebar controls. */
  placement?: "left" | "right" | "bottom-left";
}) {
  const stops = [
    { c: "#1a5c3a", l: "< 50" },
    { c: "#3d9b4a", l: "50–150" },
    { c: "#d4c03a", l: "150–250" },
    { c: "#d4782a", l: "250–300" },
    { c: "#c03030", l: "> 300" },
  ];
  const pos =
    placement === "right"
      ? "right-3 top-36"
      : placement === "bottom-left"
        ? "bottom-16 left-3"
        : "left-3 top-36";
  return (
    <div
      className={`ags-glass-panel pointer-events-none absolute z-[8] w-[6.5rem] px-2 py-1.5 text-[10px] ${pos}`}
    >
      <div className="mb-1 font-semibold uppercase tracking-wide text-ags-muted">
        Высота, м
      </div>
      <ul className="space-y-1">
        {stops.map((s) => (
          <li key={s.l} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-[2px] ring-1 ring-white/10"
              style={{ background: s.c }}
            />
            <span className="font-mono text-[9px] text-ags-fg">{s.l}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
