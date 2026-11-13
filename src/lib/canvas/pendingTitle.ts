const PENDING_TITLE_KEY = "wondoodle-pending-title";

export const TITLE_SUGGESTIONS = [
  "Fraction Adventure",
  "Pizza Pieces",
  "Chocolate Bar Fractions",
  "Equal Parts Quest",
  "My Math Doodle",
  "Pip’s Challenge",
] as const;

export function sanitizeDocumentTitle(raw: string): string {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.slice(0, 48);
}

export function setPendingDocumentTitle(title: string) {
  if (typeof window === "undefined") return;
  const next = sanitizeDocumentTitle(title);
  if (!next) return;
  try {
    sessionStorage.setItem(PENDING_TITLE_KEY, next);
  } catch {
    // ignore
  }
}

export function peekPendingDocumentTitle(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = sessionStorage.getItem(PENDING_TITLE_KEY);
    return value ? sanitizeDocumentTitle(value) || null : null;
  } catch {
    return null;
  }
}

export function clearPendingDocumentTitle() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PENDING_TITLE_KEY);
  } catch {
    // ignore
  }
}

/** @deprecated Prefer peek + clear after a successful apply. */
export function consumePendingDocumentTitle(): string | null {
  const value = peekPendingDocumentTitle();
  if (value) clearPendingDocumentTitle();
  return value;
}

export function isDefaultUntitledTitle(title: string): boolean {
  const t = title.trim().toLowerCase();
  return !t || t === "untitled notes" || t === "untitled";
}
