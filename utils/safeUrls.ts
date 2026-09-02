export function instagramUrl(value?: string) {
  const raw = value?.trim();
  if (!raw) return null;

  const handle = raw.replace(/^@/, "");
  const candidate = /^https?:\/\//i.test(handle)
    ? handle
    : `https://instagram.com/${handle}`;

  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:") return null;
    if (hostname !== "instagram.com" && !hostname.endsWith(".instagram.com")) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
