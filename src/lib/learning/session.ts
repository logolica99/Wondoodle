const SESSION_KEY = "wondoodle-learning-session";

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Stable learning session for the current browser tab. */
export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = createId();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return createId();
  }
}
