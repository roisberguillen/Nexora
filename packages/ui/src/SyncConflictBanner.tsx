import { type ReactElement } from "react";

export interface SyncConflictSummary {
  readonly id: string;
  readonly entityLabel: string;
  readonly detail: string;
}

export interface SyncConflictBannerProps {
  readonly conflicts: readonly SyncConflictSummary[];
  readonly onReview: (conflictId: string) => void;
}

/** Keeps financial conflicts visible until the user explicitly reviews them. */
export function SyncConflictBanner({
  conflicts,
  onReview,
}: SyncConflictBannerProps): ReactElement | null {
  if (conflicts.length === 0) return null;
  return (
    <section aria-labelledby="sync-conflicts-title" className="offline-banner" role="alert">
      <strong id="sync-conflicts-title">Conflitti da risolvere</strong>
      <p>Le modifiche non sono state sovrascritte automaticamente.</p>
      <ul>
        {conflicts.map((conflict) => (
          <li key={conflict.id}>
            <span>
              {conflict.entityLabel}: {conflict.detail}
            </span>{" "}
            <button type="button" onClick={() => onReview(conflict.id)}>
              Esamina
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
