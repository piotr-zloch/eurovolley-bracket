/**
 * A prediction made before signing up, held in the browser.
 *
 * localStorage rather than the database, deliberately: an anonymous row per visitor would need
 * garbage-collecting and could be spammed, and — more importantly — the draft has to survive the
 * email-confirmation round trip, where the user leaves the site entirely and comes back minutes
 * later. A server-side anonymous session wouldn't.
 *
 * The one case it can't cover is confirming the email in a different browser from the one the
 * bracket was filled in.
 */
export type Draft = {
  tournamentId: number;
  orders: Record<number, number[]>;
  picks: Record<string, number>;
  /**
   * Set only when the visitor pressed Save while signed out, i.e. they asked for this to be
   * kept. Without it, an existing user who browsed signed out and then logged back in would
   * have their stored prediction silently overwritten by whatever they had idly dragged around.
   */
  pendingSave?: boolean;
};

const KEY = "typer-draft-v1";

export function readDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    if (!parsed || typeof parsed.tournamentId !== "number") return null;
    return parsed;
  } catch {
    return null; // private mode, disabled storage, or corrupted JSON — just behave as if empty
  }
}

export function writeDraft(draft: Draft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* storage unavailable — the user simply loses the draft on reload */
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
