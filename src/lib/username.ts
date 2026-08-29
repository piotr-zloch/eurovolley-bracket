// Mirrors the profiles_username_format CHECK constraint in
// supabase/migrations/00000000000009_require_username.sql — keep the two in sync.
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
export const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _.-]*$/;

export const USERNAME_HINT =
  "3–24 characters: letters, numbers, spaces, . _ or -. Must not be an email address.";

/** Returns an error message, or null when the username is acceptable. */
export function validateUsername(raw: string | null | undefined): string | null {
  const name = (raw ?? "").trim();

  if (!name) return "Please choose a username.";
  if (name.length < USERNAME_MIN) return `Username must be at least ${USERNAME_MIN} characters.`;
  if (name.length > USERNAME_MAX) return `Username must be at most ${USERNAME_MAX} characters.`;
  // Explicit: usernames are shown publicly on leaderboards, so an email must never become one.
  if (name.includes("@")) return "Username cannot contain '@' or be an email address.";
  if (!USERNAME_PATTERN.test(name)) {
    return "Username can only use letters, numbers, spaces, dots, underscores and hyphens.";
  }
  return null;
}

export function normalizeUsername(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}
