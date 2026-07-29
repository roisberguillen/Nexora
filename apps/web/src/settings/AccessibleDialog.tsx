import { type PropsWithChildren, useLayoutEffect, useRef } from "react";

function focusableElements(container: HTMLElement): readonly HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ];
}

/**
 * Shared modal primitive for destructive settings actions. It traps keyboard focus,
 * closes on Escape and restores the invoking control when it is unmounted.
 */
export function AccessibleDialog({
  children,
  labelledBy,
  onClose,
}: PropsWithChildren<{
  readonly labelledBy: string;
  readonly onClose: () => void;
}>) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    focusableElements(dialogRef.current ?? document.createElement("div"))[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || dialogRef.current === null) return;
      const controls = focusableElements(dialogRef.current);
      if (controls.length === 0) return;
      const currentIndex = controls.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && currentIndex <= 0) {
        event.preventDefault();
        controls.at(-1)?.focus();
      } else if (!event.shiftKey && currentIndex === controls.length - 1) {
        event.preventDefault();
        controls[0]?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, []);

  return (
    <div
      aria-labelledby={labelledBy}
      aria-modal="true"
      className="account-feedback"
      ref={dialogRef}
      role="dialog"
    >
      {children}
    </div>
  );
}
