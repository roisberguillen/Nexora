import { isAndroidRuntime, stopPhoneLocalHub } from "./pcManagerDesktop";

type VisibilityDocument = Pick<
  Document,
  "visibilityState" | "addEventListener" | "removeEventListener"
>;

export function installPhoneLocalHubForegroundGuard(
  documentLike: VisibilityDocument = document,
  isAndroid: () => boolean = isAndroidRuntime,
  stopHost: () => Promise<void> = stopPhoneLocalHub,
): () => void {
  if (!isAndroid()) return () => undefined;

  const onVisibilityChange = () => {
    if (documentLike.visibilityState !== "hidden") return;
    void stopHost().catch(() => undefined);
  };
  documentLike.addEventListener("visibilitychange", onVisibilityChange);
  return () => documentLike.removeEventListener("visibilitychange", onVisibilityChange);
}
