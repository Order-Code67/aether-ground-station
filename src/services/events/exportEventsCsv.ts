import type { AppEvent } from "@/types";
import type { DiagnosticEntry } from "@/services/diagnostics/diagnosticsManager";

function csvCell(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function eventsToCsv(rows: AppEvent[]): string {
  const header = "at,severity,source,message";
  const lines = rows.map((e) =>
    [e.at, e.severity, e.source, csvCell(e.message)].join(","),
  );
  return [header, ...lines].join("\n");
}

export function diagnosticsToCsv(rows: DiagnosticEntry[]): string {
  const header = "at,severity,module,description";
  const lines = rows.map((d) =>
    [d.at, d.severity, d.module, csvCell(d.description)].join(","),
  );
  return [header, ...lines].join("\n");
}
