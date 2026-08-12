/**
 * Where the moderator password lives while the console is open.
 *
 * sessionStorage, not localStorage: the value IS the admin bearer token, so it
 * should die with the tab rather than sit on the disk of whatever machine
 * happened to be used. There is no cookie and no server session — every admin
 * call carries the token, and the Worker is the only thing that can judge it.
 */

const STORAGE_KEY = "kospinow:admin-token";

export function readAdminToken(): string | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw && raw.length > 0 ? raw : null;
  } catch {
    // Private mode or storage disabled — the caller falls back to asking again.
    return null;
  }
}

export function writeAdminToken(token: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // The console still works for this render; only the reload survives fails.
  }
}

export function clearAdminToken(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was stored.
  }
}
