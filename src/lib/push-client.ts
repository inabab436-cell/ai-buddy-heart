/**
 * Browser-side Firebase Cloud Messaging registration.
 * Must be called from a click handler in a top-level page (not an iframe).
 */
const appId = import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID"] as
  | string
  | undefined;
const vapidKey = import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY"] as
  | string
  | undefined;

const firebaseConfig = {
  apiKey: import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY"] as
    | string
    | undefined,
  projectId: import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID"] as
    | string
    | undefined,
  appId,
  messagingSenderId: appId?.split(":")[1] ?? "",
};

export type PushResult =
  | { status: "registered"; token: string }
  | { status: "not-configured" | "unsupported" | "open-in-new-tab" | "denied" };

export async function enablePush(): Promise<PushResult> {
  if (
    !firebaseConfig.apiKey ||
    !firebaseConfig.projectId ||
    !appId ||
    !vapidKey ||
    !firebaseConfig.messagingSenderId
  ) {
    return { status: "not-configured" };
  }

  const { initializeApp } = await import("firebase/app");
  const { getMessaging, getToken, isSupported, onMessage } = await import("firebase/messaging");

  if (!("Notification" in window) || !(await isSupported())) {
    return { status: "unsupported" };
  }
  if (window.top !== window.self) {
    return { status: "open-in-new-tab" };
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (permission !== "granted") return { status: "denied" };

  const query = new URLSearchParams(
    Object.entries(firebaseConfig).filter(([, v]) => typeof v === "string" && v) as [
      string,
      string,
    ][],
  ).toString();
  const serviceWorkerRegistration = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${query}`,
  );
  const messaging = getMessaging(initializeApp(firebaseConfig as Record<string, string>));
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration });
  if (!token) return { status: "denied" };

  // Foreground messages: the service worker only shows background ones.
  onMessage(messaging, (payload) => {
    const n = payload.notification;
    if (!n) return;
    try {
      serviceWorkerRegistration.showNotification(n.title ?? "cupai", {
        body: n.body,
        icon: "/favicon.png",
        data: payload.data,
      });
    } catch {
      /* ignore */
    }
  });

  return { status: "registered", token };
}

export function pushPermissionState(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}
