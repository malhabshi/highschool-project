// Generates a unique id. Uses crypto.randomUUID() when available, but that
// only works in secure contexts (HTTPS / localhost). Falls back gracefully so
// the app also works over plain HTTP (e.g. opening it via a LAN IP on a phone).
export function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}
