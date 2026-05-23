// Extract first http(s):// URL from a string. Handles 抖音/头条 share text.
const URL_RE = /https?:\/\/[^\s一-龥"'<>{}|\\^`，。、；：！？【】（）《》""'']+/i;

export function extractUrl(text: string): string | null {
  if (!text) return null;
  const m = text.match(URL_RE);
  if (!m) return null;
  // Strip trailing punctuation that often clings to URLs in share text
  return m[0].replace(/[.,;:!?)\]]+$/, '');
}

export function isPureUrl(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (!/^https?:\/\//i.test(t)) return false;
  return !/\s/.test(t);
}
