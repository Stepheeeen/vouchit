/**
 * Field projections for User.
 *
 * The Prisma `User` model carries `password` (bcrypt hash), `otp` and
 * `otpExpiresAt`. Including the relation raw (`include: { user: true }`) returns
 * all of them, so any endpoint hydrating participants or creators leaks
 * credentials. Always select explicitly.
 */

/**
 * Safe to serialise to ANY caller, authenticated or not. No email, no role, no
 * secrets — this is what wager listings and public profiles may expose.
 */
export const PUBLIC_USER_SELECT = {
  id: true,
  displayName: true,
  avatarUrl: true,
  web3Address: true,
} as const;

/**
 * Adds email and role for admin-only surfaces (the disputes dashboard). Still
 * excludes the password hash and OTP — those have no legitimate reader.
 */
export const ADMIN_USER_SELECT = {
  ...PUBLIC_USER_SELECT,
  email: true,
  role: true,
  emailVerified: true,
  createdAt: true,
} as const;

/** Strip secrets from a full User row that has already been fetched. */
export function stripUserSecrets<T extends Record<string, any>>(user: T) {
  const { password, otp, otpExpiresAt, ...safe } = user;
  return safe;
}
