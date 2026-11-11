import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/services/tauri";
import type { AuthUser } from "@/types/auth";

export const DATABASE_READY = true;

const memoryKv = new Map<string, string>();

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(cmd, args);
}

export async function dbInit(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return call<string>("db_init");
}

export async function dbAppendEvent(event: {
  id: string;
  at: string;
  severity: string;
  source: string;
  message: string;
}): Promise<void> {
  if (!isTauriRuntime()) return;
  await call("db_append_event", event);
}

export async function dbListEvents(limit = 200): Promise<
  Array<{
    id: string;
    at: string;
    severity: string;
    source: string;
    message: string;
  }>
> {
  if (!isTauriRuntime()) return [];
  return call("db_list_events", { limit });
}

export async function dbBackup(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return call<string>("db_backup");
}

export async function dbRestore(path: string): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return call<string>("db_restore", { path });
}

export async function dbUpsertSetting(key: string, value: string): Promise<void> {
  if (!isTauriRuntime()) {
    memoryKv.set(`setting:${key}`, value);
    return;
  }
  await call("db_upsert_setting", { key, value });
}

export async function dbGetSetting(key: string): Promise<string | null> {
  if (!isTauriRuntime()) {
    return memoryKv.get(`setting:${key}`) ?? null;
  }
  return call<string | null>("db_get_setting", { key });
}

export async function dbUpsertJson(key: string, value: unknown): Promise<void> {
  const raw = JSON.stringify(value);
  if (!isTauriRuntime()) {
    memoryKv.set(`json:${key}`, raw);
    return;
  }
  await call("db_upsert_json", { key, value: raw });
}

export async function dbGetJson<T>(key: string, fallback: T): Promise<T> {
  if (!isTauriRuntime()) {
    const raw = memoryKv.get(`json:${key}`);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  const raw = await call<string | null>("db_get_json", { key });
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function ensureDefaultAdmin(): Promise<void> {
  if (!isTauriRuntime()) {
    // browser preview seed
    if (!(await dbListUsers()).length) {
      /* no-op: verify uses Tauri; preview allows empty */
    }
    return;
  }
  await dbInit();
}

export async function dbListUsers(): Promise<AuthUser[]> {
  if (!isTauriRuntime()) {
    return [
      {
        id: "usr_admin",
        username: "admin",
        role: "Administrator",
        disabled: false,
      },
    ];
  }
  const rows = await call<
    Array<{ id: string; username: string; role: string; disabled: boolean }>
  >("db_list_users");
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    role: r.role as AuthUser["role"],
    disabled: r.disabled,
  }));
}

export async function dbVerifyUserPassword(
  username: string,
  password: string,
): Promise<boolean> {
  if (!isTauriRuntime()) {
    return username === "admin" && password === "admin";
  }
  return call<boolean>("db_verify_user_password", { username, password });
}

export async function dbUpsertUser(input: {
  id: string;
  username: string;
  role: AuthUser["role"];
  password?: string;
  disabled: boolean;
}): Promise<AuthUser> {
  if (!isTauriRuntime()) {
    return {
      id: input.id,
      username: input.username,
      role: input.role,
      disabled: input.disabled,
    };
  }
  const row = await call<{
    id: string;
    username: string;
    role: string;
    disabled: boolean;
  }>("db_upsert_user", {
    id: input.id,
    username: input.username,
    role: input.role,
    password: input.password ?? null,
    disabled: input.disabled,
  });
  return {
    id: row.id,
    username: row.username,
    role: row.role as AuthUser["role"],
    disabled: row.disabled,
  };
}

export async function dbUpsertRecording(rec: {
  id: string;
  sourceId: string;
  filename: string;
  startTime: string;
  endTime?: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  if (!isTauriRuntime()) return;
  await call("db_upsert_recording", {
    id: rec.id,
    sourceId: rec.sourceId,
    filename: rec.filename,
    startTime: rec.startTime,
    endTime: rec.endTime ?? null,
    metadata: JSON.stringify(rec.metadata),
  });
}

export async function dbListRecordings(): Promise<
  Array<{
    id: string;
    sourceId?: string;
    filename: string;
    startTime: string;
    endTime?: string;
    metadata?: string;
  }>
> {
  if (!isTauriRuntime()) return [];
  return call("db_list_recordings");
}

export async function dbAudit(
  userId: string | null,
  event: string,
  details?: Record<string, unknown>,
): Promise<void> {
  if (!isTauriRuntime()) return;
  await call("db_audit", {
    id: `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    userId,
    timestamp: new Date().toISOString(),
    event,
    details: details ? JSON.stringify(details) : null,
  });
}
