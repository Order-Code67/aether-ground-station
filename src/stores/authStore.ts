import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { AuthSession, AuthUser, UserRole } from "@/types/auth";
import { ROLE_PERMISSIONS } from "@/types/auth";
import { eventBus } from "@/services/events/eventBus";
import {
  dbAudit,
  dbListUsers,
  dbUpsertJson,
  dbVerifyUserPassword,
  ensureDefaultAdmin,
} from "@/services/database";
import { isTauriRuntime } from "@/services/tauri";

/** Local desktop GS: no interactive login gate. */
const AUTO_USERNAME = "admin";
const AUTO_PASSWORD = "admin";

interface AuthState {
  session: AuthSession | null;
  ready: boolean;
  users: AuthUser[];
  idleTimeoutSecs: number;
  bootstrap: () => Promise<void>;
  /** Re-establish local admin session (used after idle expire / logout). */
  autoEnter: () => Promise<boolean>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  /** Touch backend session; returns false if expired. */
  touchSession: () => Promise<boolean>;
  can: (perm: keyof (typeof ROLE_PERMISSIONS)["Administrator"]) => boolean;
  refreshUsers: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  ready: false,
  users: [],
  idleTimeoutSecs: 45 * 60,

  autoEnter: async () => get().login(AUTO_USERNAME, AUTO_PASSWORD),

  bootstrap: async () => {
    await ensureDefaultAdmin();
    const users = await dbListUsers();
    // Clear stale backend session, then auto-enter as local admin.
    if (isTauriRuntime()) {
      await invoke("auth_clear_session").catch(() => undefined);
      await dbUpsertJson("auth_session", null);
    }
    set({ users, session: null });
    const ok = await get().login(AUTO_USERNAME, AUTO_PASSWORD);
    if (!ok && !isTauriRuntime()) {
      const user: AuthUser = users[0] ?? {
        id: "usr_admin",
        username: AUTO_USERNAME,
        role: "Administrator",
        disabled: false,
      };
      set({
        session: { user, loggedInAt: new Date().toISOString() },
        users: users.length ? users : [user],
      });
    }
    set({ ready: true });
  },

  login: async (username, password) => {
    if (isTauriRuntime()) {
      try {
        const result = await invoke<{
          id: string;
          username: string;
          role: string;
          idleTimeoutSecs?: number;
        }>("auth_login", { username, password });
        const user: AuthUser = {
          id: result.id,
          username: result.username,
          role: result.role as UserRole,
          disabled: false,
        };
        const session: AuthSession = {
          user,
          loggedInAt: new Date().toISOString(),
        };
        const users = await dbListUsers();
        await dbAudit(user.id, "auth.login", { role: user.role });
        set({
          session,
          users,
          idleTimeoutSecs: result.idleTimeoutSecs ?? 45 * 60,
        });
        eventBus.emit("info", "auth", `Вход: ${user.username} (${user.role})`);
        return true;
      } catch (e) {
        eventBus.emit(
          "warning",
          "auth",
          e instanceof Error ? e.message : "Неверный логин или пароль",
        );
        return false;
      }
    }

    // Browser preview: soft verify helper (no privilege escalation surface)
    const ok = await dbVerifyUserPassword(username, password);
    if (!ok) {
      eventBus.emit("warning", "auth", "Неверный логин или пароль");
      return false;
    }
    const users = await dbListUsers();
    const user = users.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase(),
    );
    if (!user || user.disabled) {
      eventBus.emit("warning", "auth", "Учётная запись отключена");
      return false;
    }
    const session: AuthSession = {
      user,
      loggedInAt: new Date().toISOString(),
    };
    set({ session, users });
    eventBus.emit("info", "auth", `Вход (preview): ${user.username}`);
    return true;
  },

  logout: () => {
    const session = get().session;
    void dbUpsertJson("auth_session", null);
    if (isTauriRuntime()) {
      void invoke("auth_clear_session");
    }
    if (session) {
      void dbAudit(session.user.id, "auth.logout", {});
      eventBus.emit("info", "auth", `Выход: ${session.user.username}`);
    }
    set({ session: null });
    // Desktop GS has no login gate — re-enter immediately.
    void get().autoEnter();
  },

  touchSession: async () => {
    if (!isTauriRuntime()) return true;
    if (!get().session) return false;
    try {
      const info = await invoke<{
        authenticated: boolean;
        expired: boolean;
        idleTimeoutSecs?: number;
      }>("auth_touch");
      if (info.idleTimeoutSecs != null) {
        set({ idleTimeoutSecs: info.idleTimeoutSecs });
      }
      if (!info.authenticated || info.expired) {
        eventBus.emit("warning", "auth", "Сессия обновлена (авто-вход)");
        set({ session: null });
        await get().autoEnter();
        return Boolean(get().session);
      }
      return true;
    } catch {
      set({ session: null });
      await get().autoEnter();
      return Boolean(get().session);
    }
  },

  can: (perm) => {
    const role: UserRole | undefined = get().session?.user.role;
    if (!role) return false;
    return ROLE_PERMISSIONS[role][perm];
  },

  refreshUsers: async () => {
    set({ users: await dbListUsers() });
  },
}));
