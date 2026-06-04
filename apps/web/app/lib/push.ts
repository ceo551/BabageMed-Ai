// Web Push opt-in (P6.5). enablePush() ties the Notification permission prompt
// to a user gesture (called from the /tasks "Assign" click), subscribes the
// browser via the server's VAPID public key, and registers the subscription so
// the backend can notify when an async run finishes — even with the tab closed.
// Everything is best-effort: any failure (no SW, denied permission, push not
// configured on the server) returns false and the /tasks page keeps polling.
import { push as pushApi } from "./api";

function urlB64ToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function enablePush(): Promise<boolean> {
  try {
    if (typeof window === "undefined") return false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return false;
    // Don't re-prompt if the user already blocked notifications.
    if (Notification.permission === "denied") return false;

    const { publicKey } = await pushApi.config();
    if (!publicKey) return false; // server hasn't got a VAPID key → push disabled

    const perm = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
    if (perm !== "granted") return false;

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(publicKey),
      });
    }
    await pushApi.subscribe(sub.toJSON());
    return true;
  } catch {
    return false;
  }
}
