"use client";

// End-to-end encryption for private room messages. Each participant makes a
// key pair when they join and shares only the public half. A sender derives a
// shared key with each recipient (ECDH) and seals the message with AES-GCM,
// so other people on the shared channel can't read it.

export type SealedBox = { iv: string; data: string };

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// crypto.subtle only exists on https (or localhost).
export function e2eAvailable(): boolean {
  return typeof crypto !== "undefined" && !!crypto.subtle;
}

export async function createKeyPair(): Promise<{ keys: CryptoKeyPair; publicKey: string }> {
  const keys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, [
    "deriveKey",
  ]);
  const raw = await crypto.subtle.exportKey("raw", keys.publicKey);
  return { keys, publicKey: toBase64(raw) };
}

// Shared AES key between our private key and someone's public key (cached).
export function sharedKeys(privateKey: CryptoKey) {
  const cache = new Map<string, Promise<CryptoKey>>();
  return (theirPublicKey: string): Promise<CryptoKey> => {
    let key = cache.get(theirPublicKey);
    if (!key) {
      key = crypto.subtle
        .importKey("raw", fromBase64(theirPublicKey), { name: "ECDH", namedCurve: "P-256" }, false, [])
        .then((pub) =>
          crypto.subtle.deriveKey(
            { name: "ECDH", public: pub },
            privateKey,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
          )
        );
      cache.set(theirPublicKey, key);
    }
    return key;
  };
}

export async function seal(key: CryptoKey, text: string): Promise<SealedBox> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(text)
  );
  return { iv: toBase64(iv), data: toBase64(data) };
}

export async function open(key: CryptoKey, box: SealedBox): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(box.iv) },
    key,
    fromBase64(box.data)
  );
  return new TextDecoder().decode(plain);
}
