import { eventBus } from "@/services/events/eventBus";
import { dbGetJson, dbUpsertJson } from "@/services/database";

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  permissions: string[];
  enabled: boolean;
}

const KEY = "plugins_registry";

class PluginManager {
  private plugins: PluginManifest[] = [];
  private loaded = false;

  async hydrate(): Promise<void> {
    if (this.loaded) return;
    this.plugins = await dbGetJson<PluginManifest[]>(KEY, [
      {
        id: "example-adapter-kit",
        name: "Adapter Kit (bundled)",
        version: "0.1.0",
        description: "Шаблон манифеста — без неограниченного доступа",
        permissions: ["devices.read"],
        enabled: false,
      },
    ]);
    this.loaded = true;
  }

  async list(): Promise<PluginManifest[]> {
    await this.hydrate();
    return [...this.plugins];
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    await this.hydrate();
    this.plugins = this.plugins.map((p) =>
      p.id === id ? { ...p, enabled } : p,
    );
    await dbUpsertJson(KEY, this.plugins);
    eventBus.emit(
      "info",
      "plugins",
      `${enabled ? "Включён" : "Отключён"} плагин ${id}`,
    );
  }

  isEnabled(id: string): boolean {
    return this.plugins.some((p) => p.id === id && p.enabled);
  }

  async register(manifest: PluginManifest): Promise<void> {
    await this.hydrate();
    if (this.plugins.some((p) => p.id === manifest.id)) {
      throw new Error("Плагин уже зарегистрирован");
    }
    if (
      manifest.permissions.some(
        (p) => p === "*" || p === "system.exec" || p === "shell.exec" || p === "all",
      )
    ) {
      throw new Error("Небезопасные permissions отклонены");
    }
    this.plugins.push({ ...manifest, enabled: false });
    await dbUpsertJson(KEY, this.plugins);
  }
}

export const pluginManager = new PluginManager();
