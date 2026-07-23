// Single source of truth for username rules, shared by the web account panel
// and the native profile form. Usernames are stored lowercase.

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export const RESERVED_USERNAMES = new Set([
  'admin', 'support', 'help', 'singjam', 'sing', 'jam', 'connect', 'api', 'www', 'mail',
]);

// Lowercase and drop any characters that are not allowed in a username.
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

// True when the normalized form matches the format rules and is not reserved.
export function isValidUsername(raw: string): boolean {
  const normalized = normalizeUsername(raw);
  return USERNAME_REGEX.test(normalized) && !RESERVED_USERNAMES.has(normalized);
}

// Suggest a username from an email's local part, or "" if it can't produce a valid one.
export function suggestUsername(email: string): string {
  const prefix = email.split("@")[0] ?? "";
  const clean = normalizeUsername(prefix).slice(0, USERNAME_MAX_LENGTH);
  return isValidUsername(clean) ? clean : "";
}
