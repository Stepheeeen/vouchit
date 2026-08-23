/**
 * Resolves the JWT signing secret.
 *
 * Both the signing module and the verifying strategy previously defaulted to a
 * literal `'fallback_secret_key'` committed in this repository. Because
 * JWT_SECRET is set by hand in the Render dashboard (`sync: false`), forgetting
 * it would not fail the boot — the app would run on a publicly known secret and
 * anyone could forge a token for any user, including an admin.
 *
 * In production a missing secret is now fatal. Outside production a stable
 * development default is used so local runs and tests work without setup.
 */
const DEV_SECRET = 'vouchit-development-secret-not-for-production';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'JWT_SECRET is not set. Refusing to start with a default signing key — ' +
          'anyone could forge authentication tokens.',
      );
    }
    return DEV_SECRET;
  }

  return secret;
}
