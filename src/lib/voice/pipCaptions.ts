/**
 * Read recent Pip caption text for adventure planning context.
 * Captions are session-scoped text only — never audio.
 */

const CAPTION_HISTORY_KEY = "wondoodle-pip-captions";

type StoredCaption = { id: string; role: string; text: string };

export function getRecentPipConversationContext(maxChars = 700): string | null {
  try {
    const raw = sessionStorage.getItem(CAPTION_HISTORY_KEY);
    if (!raw) return null;
    const lines = JSON.parse(raw) as StoredCaption[];
    if (!Array.isArray(lines) || !lines.length) return null;
    const text = lines
      .slice(-10)
      .map((l) => `${l.role === "user" ? "Student" : "Pip"}: ${l.text}`)
      .join("\n")
      .trim();
    if (!text) return null;
    return text.length > maxChars ? text.slice(-maxChars) : text;
  } catch {
    return null;
  }
}
