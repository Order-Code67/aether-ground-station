/** Height color legend matching TZ / concept. */
export function HeightLegend() {
  const stops = [
    { c: "#1a5c3a", l: "< 50" },
    { c: "#3d9b4a", l: "50–150" },
    { c: "#d4c03a", l: "150–250" },
    { c: "#d4782a", l: "250–300" },
    { c: "#c03030", l: "> 300" },
  ];
  return (
    <div className="ags-glass-panel pointer-events-none absolute left-3 top-[3.75rem] z-[2] w-[6.75rem] px-2 py-2 text-[10px] opacity-90">
      <div className="mb-1.5 font-semibold uppercase tracking-wide text-ags-muted">
        Высота, м
      </div>
      <ul className="space-y-1.5">
        {stops.map((s) => (
          <li key={s.l} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[3px] shadow-sm ring-1 ring-white/10"
              style={{ background: s.c }}
            />
            <span className="font-mono text-ags-fg">{s.l}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
