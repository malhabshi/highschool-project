// Build a tel: link from a stored phone number.
// Local 8-digit numbers get the Kuwait country code so they dial correctly.
export function telHref(phone: string) {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length === 8) return `tel:+965${d}`;
  if (d.startsWith("965")) return `tel:+${d}`;
  return `tel:${d}`;
}
