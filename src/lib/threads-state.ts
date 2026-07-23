import { createHmac } from "crypto";

function sig(uid: string) {
  return createHmac("sha256", process.env.THREADS_APP_SECRET!).update(uid).digest("hex").slice(0, 32);
}

export function signState(uid: string) {
  return `${uid}.${sig(uid)}`;
}

export function verifyState(state: string | null): string | null {
  if (!state) return null;
  const dot = state.lastIndexOf(".");
  if (dot === -1) return null;
  const uid = state.slice(0, dot);
  if (!uid || state.slice(dot + 1) !== sig(uid)) return null;
  return uid;
}
