import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { AuthSession, AuthUser, UserRole } from "@/types/auth";
import { ROLE_PERMISSIONS } from "@/types/auth";
import { eventBus } from "@/services/events/eventBus";
import {
  dbAudit,
  dbGetJson,
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

async function bindBackend(session: AuthSession | null): Promise<void> {
  if (!isTauriRuntime()) return;
  if (session) {
    await invoke("auth_bind_session", {
      username: session.user.username,
      role: session.user.role,
    });
  } else {
    await invoke("auth_clear_session");
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  ready: false,
  users: [],

  bootstrap: async () => {
    await ensureDefaultAdmin();
    const users = await dbListUsers();
    const saved = await dbGetJson<AuthSession | null>("auth_session", null);
    const session = saved && !saved.user.disabled ? saved : null;
    await bindBackend(session);
    set({ users, session, ready: true });
  },

  login: async (username, password) => {
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
    await dbUpsertJson("auth_session", session);
    await bindBackend(session);
    await dbAudit(user.id, "auth.login", { role: user.role });
    set({ session, users });
    eventBus.emit("info", "auth", `Вход: ${user.username} (${user.role})`);
    return true;
  },

  logout: () => {
    const session = get().session;
    void dbUpsertJson("auth_session", null);
    void bindBackend(null);
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
