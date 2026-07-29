export type BrowserNotificationStatus = "denied" | "granted" | "unsupported";

/** Requests permission only from an explicit user action; notification contents remain local. */
export async function enableBrowserNotifications(
  notificationApi:
    | Pick<typeof Notification, "permission" | "requestPermission">
    | undefined = typeof Notification === "undefined" ? undefined : Notification,
): Promise<BrowserNotificationStatus> {
  if (notificationApi === undefined) return "unsupported";
  if (notificationApi.permission === "granted") return "granted";
  if (notificationApi.permission === "denied") return "denied";
  const permission = await notificationApi.requestPermission();
  return permission === "granted" ? "granted" : "denied";
}
