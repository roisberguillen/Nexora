import { isAndroidRuntime } from "./pcManagerDesktop";

type VisibilityDocument = Pick<
  Document,
  "visibilityState" | "addEventListener" | "removeEventListener"
>;

export function installPhoneLocalHubForegroundGuard(
  documentLike: VisibilityDocument = document,
  isAndroid: () => boolean = isAndroidRuntime,
): () => void {
  // The Android Local Hub is intentionally allowed to keep serving while the
  // WebView is hidden. The PC browser needs the phone host to remain reachable
  // while the user switches apps or copies the pairing invite.
  void documentLike;
  void isAndroid;
  return () => undefined;
}
