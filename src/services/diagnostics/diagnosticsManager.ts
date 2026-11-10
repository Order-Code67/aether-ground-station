import { eventBus } from "@/services/events/eventBus";
import { dbUpsertJson, dbGetJson } from "@/services/database";

export type DiagnosticSeverity = "debug" | "info" | "warning" | "error" | "critical";

export interface DiagnosticEntry {
  id: string;
  at: string;
  module: string;
  component?: string;
  code?: string;
  severity: DiagnosticSeverity;
  description: string;
  context?: Record<string, unknown>;
  remediation?: string;
}

const KEY = "diagnostics_buffer";
const MAX = 200;

class DiagnosticsManager {
  private buffer: DiagnosticEntry[] = [];
  private loaded = false;

  async hydrate(): Promise<void> {
    if (this.loaded) return;
    this.buffer = await dbGetJson<DiagnosticEntry[]>(KEY, []);
    this.loaded = true;
  }

  list(): DiagnosticEntry[] {
    return [...this.buffer];
  }

  async report(entry: Omit<DiagnosticEntry, "id" | "at"> & { id?: string; at?: string }): Promise<DiagnosticEntry> {
    await this.hydrate();
    const full: DiagnosticEntry = {
      id: entry.id ?? `diag_${Date.now().toString(36)}`,
      at: entry.at ?? new Date().toISOString(),
      module: entry.module,
      component: entry.component,
      code: entry.code,
      severity: entry.severity,
      description: entry.description,
      context: entry.context,
      remediation: entry.remediation,
    };
    this.buffer = [full, ...this.buffer].slice(0, MAX);
    await dbUpsertJson(KEY, this.buffer);
    eventBus.emit(
      full.severity === "critical" || full.severity === "error" ? "error" : "warning",
      "diagnostics",
      `${full.module}: ${full.description}`,
      { code: full.code, remediation: full.remediation },
    );
    return full;
  }

  exportJson(): string {
    return JSON.stringify(this.buffer, null, 2);
  }
}

export const diagnosticsManager = new DiagnosticsManager();
