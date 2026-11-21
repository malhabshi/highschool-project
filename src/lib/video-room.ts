import { uid } from "@/lib/uid";

// Room codes look like "k3f9-a2xq-7m1c": easy to read out, hard to guess.
export const ROOM_CODE = /^[a-z0-9-]{4,40}$/;

export function newRoomCode(): string {
  const raw = uid().replace(/-/g, "").slice(0, 12);
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}
