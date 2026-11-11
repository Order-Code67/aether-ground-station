import { useState, type FormEvent } from "react";
import { useAuthStore } from "@/stores/authStore";

export function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const ok = await login(username, password);
    setBusy(false);
    if (!ok) setError("Неверный логин или пароль");
  };

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-ags-bg p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_50%_-10%,rgba(61,139,253,0.18),transparent_60%)]" />
      <form
        onSubmit={(e) => void submit(e)}
        className="ags-panel relative w-full max-w-sm space-y-4 p-7"
      >
        <div className="flex items-center gap-3">
          <div className="ags-brand-mark h-12 w-12 overflow-hidden rounded-xl ring-1 ring-ags-accent/35">
            <img
              src="/aether-logo.jpg"
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Aether Ground Station
            </h1>
            <p className="text-xs text-ags-muted">Локальный вход · offline ready</p>
          </div>
        </div>
        <label className="block text-xs text-ags-muted">
          Пользователь
          <input
            className="mt-1 w-full rounded-lg border border-ags-border bg-ags-elevated px-3 py-2 text-sm text-ags-fg outline-none focus:border-ags-accent/50"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="block text-xs text-ags-muted">
          Пароль
          <input
            type="password"
            className="mt-1 w-full rounded-lg border border-ags-border bg-ags-elevated px-3 py-2 text-sm text-ags-fg outline-none focus:border-ags-accent/50"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <p className="text-xs text-ags-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-ags-accent py-2.5 text-sm font-medium text-white shadow-[0_8px_24px_rgba(61,139,253,0.25)] transition hover:bg-ags-accent-muted disabled:opacity-50"
        >
          {busy ? "Вход…" : "Войти"}
        </button>
      </form>
    </div>
  );
}
