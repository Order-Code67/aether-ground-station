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

interface AuthState {
  session: AuthSession | null;
  ready: boolean;
  users: AuthUser[];
  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  can: (perm: keyof (typeof ROLE_PERMISSIONS)["Administrator"]) => boolean;
  refreshUsers: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  ready: false,
  users: [],

  bootstrap: async () => {
    await ensureDefaultAdmin();
    const users = await dbListUsers();
    // P0-1: do not restore a write-capable backend session without password.
    // Clear any stale UI session blob and require login.
    if (isTauriRuntime()) {
      await invoke("auth_clear_session").catch(() => undefined);
      await dbUpsertJson("auth_session", null);
      set({ users, session: null, ready: true });
      return;
    }
    set({ users, session: null, ready: true });
  },

  login: async (username, password) => {
    if (isTauriRuntime()) {
      try {
        const result = await invoke<{
          id: string;
          username: string;
          role: string;
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
        set({ session, users });
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
