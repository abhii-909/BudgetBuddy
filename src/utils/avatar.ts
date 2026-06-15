/**
 * Centralized utility to extract initials for user avatars.
 *
 * Rules:
 * 1. If full_name is available, use the first letter of the full_name.
 * 2. If full_name is unavailable, use the first letter of the email.
 * 3. Fallback to "U".
 */
export function getAvatarInitial(fullName?: string, email?: string): string {
  if (fullName && fullName.trim().length > 0) {
    return fullName.trim().charAt(0).toUpperCase();
  }
  if (email && email.trim().length > 0) {
    return email.trim().charAt(0).toUpperCase();
  }
  return "U";
}
