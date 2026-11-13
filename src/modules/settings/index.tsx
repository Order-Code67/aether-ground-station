import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { useArchiveStore } from "@/stores/archiveStore";
import { useAuthStore } from "@/stores/authStore";
import { isTauriRuntime } from "@/services/tauri";
import {
  dbBackup,
  dbListUsers,
  dbRestore,
  dbUpsertSetting,
  dbUpsertUser,
} from "@/services/database";
import type { AuthUser } from "@/types/auth";
import { eventBus } from "@/services/events/eventBus";
import { useNavigationStore } from "@/stores/navigationStore";
import { MODULES, type ModuleId } from "@/types";

export function SettingsView() {
  const appInfo = useAppStore((s) => s.appInfo);
  const storageFolder = useArchiveStore((s) => s.storageFolder);
  const setStorageFolder = useArchiveStore((s) => s.setStorageFolder);
  const role = useAuthStore((s) => s.session?.user.role);
  const showAdvanced = useNavigationStore((s) => s.showAdvanced);
  const setShowAdvanced = useNavigationStore((s) => s.setShowAdvanced);
  const navigateToModule = useNavigationStore((s) => s.navigateToModule);
  const [backupPath, setBackupPath] = useState<string | null>(null);
  const [restorePath, setRestorePath] = useState("");
  const [restoreNote, setRestoreNote] = useState<string | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [newUser, setNewUser] = useState({
    username: "",
    role: "Operator" as AuthUser["role"],
    password: "",
  });

  const refreshUsers = () => {
    void dbListUsers().then(setUsers).catch(() => setUsers([]));
  };

  useEffect(() => {
    refreshUsers();
  }, []);

  const saveUser = async () => {
    if (!newUser.username.trim()) return;
    try {
      await dbUpsertUser({
        id: `usr_${newUser.username.trim().toLowerCase()}`,
        username: newUser.username.trim(),
        role: newUser.role,
        password: newUser.password || undefined,
        disabled: false,
      });
      setNewUser({ username: "", role: "Operator", password: "" });
      refreshUsers();
      eventBus.emit("info", "users", "Пользователь сохранён");
    } catch (e) {
      eventBus.emit(
        "error",
        "users",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  const toggleDisabled = async (u: AuthUser) => {
    try {
      await dbUpsertUser({
        id: u.id,
        username: u.username,
        role: u.role,
        disabled: !u.disabled,
      });
      refreshUsers();
    } catch (e) {
      eventBus.emit(
        "error",
        "users",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
        <p className="mt-2 max-w-xl text-sm text-ags-muted">
          Конфигурация платформы. Пароли и секреты не хранятся открытым текстом.
        </p>
      </div>

      <section className="max-w-lg space-y-3 rounded-lg border border-ags-border bg-ags-panel p-4 text-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ags-muted">
          Приложение
        </h2>
        <dl className="grid grid-cols-[10rem_1fr] gap-y-2">
          <dt className="text-ags-dim">Название</dt>
          <dd>{appInfo?.name ?? "Aether Ground Station"}</dd>
          <dt className="text-ags-dim">Версия</dt>
          <dd>{appInfo?.version ?? "0.7.0"}</dd>
          <dt className="text-ags-dim">Этап</dt>
          <dd>{appInfo?.stage ?? "—"}</dd>
          <dt className="text-ags-dim">Среда</dt>
          <dd>{isTauriRuntime() ? "Tauri desktop" : "Браузерный preview"}</dd>
        </dl>
      </section>

      <section className="max-w-lg space-y-3 rounded-lg border border-ags-border bg-ags-panel p-4 text-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ags-muted">
          Архив видео
        </h2>
        <label className="block text-xs text-ags-muted">
          Папка хранения
          <input
            className="mt-1 w-full rounded border border-ags-border bg-ags-elevated px-2 py-1.5 text-ags-fg"
            value={storageFolder}
            onChange={(e) => setStorageFolder(e.target.value)}
            placeholder="D:\\Aether\\Recordings"
          />
        </label>
      </section>

      <section className="max-w-lg space-y-3 rounded-lg border border-ags-border bg-ags-panel p-4 text-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ags-muted">
          Резервное копирование
        </h2>
        <button
          type="button"
          className="rounded bg-ags-accent px-3 py-1.5 text-white disabled:opacity-40"
          disabled={!isTauriRuntime()}
          onClick={() => {
            void dbBackup().then(async (path) => {
              setBackupPath(path);
              if (path) {
                await dbUpsertSetting("last_backup_path", path);
                await dbUpsertSetting(
                  "last_backup_at",
                  new Date().toISOString(),
                );
              }
              eventBus.emit(
                "info",
                "database",
                path ? `Резервная копия: ${path}` : "Бэкап недоступен",
              );
            });
          }}
        >
          Создать копию SQLite
        </button>
        {backupPath && (
          <p className="font-mono text-xs text-ags-muted">{backupPath}</p>
        )}
        <label className="block text-xs text-ags-muted">
          Восстановить из файла (.sqlite / .bak)
          <input
            className="mt-1 w-full rounded border border-ags-border bg-ags-elevated px-2 py-1.5 font-mono text-ags-fg"
            value={restorePath}
            onChange={(e) => setRestorePath(e.target.value)}
            placeholder={backupPath ?? "C:\\…\\ags.sqlite.bak"}
          />
        </label>
        <button
          type="button"
          className="rounded border border-ags-border px-3 py-1.5 disabled:opacity-40"
          disabled={!isTauriRuntime() || !restorePath.trim()}
          onClick={() => {
            void dbRestore(restorePath.trim())
              .then((path) => {
                setRestoreNote(path ? `Восстановлено: ${path}` : "Ошибка");
                eventBus.emit(
                  "info",
                  "database",
                  path ? `DB restore OK: ${path}` : "restore failed",
                );
              })
              .catch((e) => {
                const msg = e instanceof Error ? e.message : String(e);
                setRestoreNote(msg);
                eventBus.emit("error", "database", msg);
              });
          }}
        >
          Восстановить SQLite
        </button>
        {restoreNote && (
          <p className="font-mono text-xs text-ags-warning">{restoreNote}</p>
        )}
      </section>

      {role === "Administrator" && (
        <section className="max-w-lg space-y-3 rounded-lg border border-ags-border bg-ags-panel p-4 text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ags-muted">
            Пользователи (Administrator)
          </h2>
          <ul className="space-y-1 text-xs">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-2 rounded border border-ags-border px-2 py-1"
              >
                <span>
                  {u.username} · {u.role}
                  {u.disabled ? " · disabled" : ""}
                </span>
                <button
                  type="button"
                  className="rounded border border-ags-border px-2 py-0.5"
                  onClick={() => void toggleDisabled(u)}
                >
                  {u.disabled ? "Включить" : "Отключить"}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <input
              className="rounded border border-ags-border bg-ags-elevated px-2 py-1"
              placeholder="username"
              value={newUser.username}
              onChange={(e) =>
                setNewUser((s) => ({ ...s, username: e.target.value }))
              }
            />
            <select
              className="rounded border border-ags-border bg-ags-elevated px-2 py-1"
              value={newUser.role}
              onChange={(e) =>
                setNewUser((s) => ({
                  ...s,
                  role: e.target.value as AuthUser["role"],
                }))
              }
            >
              <option value="Administrator">Administrator</option>
              <option value="Operator">Operator</option>
              <option value="Observer">Observer</option>
            </select>
            <input
              type="password"
              className="rounded border border-ags-border bg-ags-elevated px-2 py-1"
              placeholder="password"
              value={newUser.password}
              onChange={(e) =>
                setNewUser((s) => ({ ...s, password: e.target.value }))
              }
            />
            <button
              type="button"
              className="rounded bg-ags-accent px-3 py-1 text-white"
              onClick={() => void saveUser()}
            >
              Сохранить
            </button>
          </div>
        </section>
      )}

      <section className="max-w-lg space-y-2 rounded-lg border border-ags-border bg-ags-panel p-4 text-sm text-ags-muted">
        <h2 className="text-xs font-semibold uppercase tracking-wider">
          Безопасность
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-xs">
          <li>Секреты не попадают в журналы</li>
          <li>Сканирование оборудования — только с разрешения</li>
          <li>Плагины без произвольного доступа к ОС</li>
          <li>Observer — read-only; manage users только Administrator</li>
        </ul>
      </section>

      {(role === "Administrator" || role === "Operator") && (
        <section className="max-w-lg space-y-3 rounded-lg border border-dashed border-ags-border bg-ags-panel p-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ags-muted">
              Advanced
            </h2>
            <button
              type="button"
              className="rounded border border-ags-border px-2 py-1 text-xs"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? "Скрыть" : "Показать"}
            </button>
          </div>
          <p className="text-xs text-ags-dim">
            Инженерные модули скрыты из основной навигации (GS-1).
          </p>
          {showAdvanced && (
            <div className="flex flex-wrap gap-2">
              {(
                [
                  "remote",
                  "plugins",
                  "robotics",
                  "aerial",
                  "workspace",
                ] as ModuleId[]
              ).map((id) => {
                const label = MODULES.find((m) => m.id === id)?.label ?? id;
                return (
                  <button
                    key={id}
                    type="button"
                    className="rounded border border-ags-border px-2 py-1 text-xs hover:bg-ags-elevated"
                    onClick={() => navigateToModule(id)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
