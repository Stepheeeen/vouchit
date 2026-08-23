/**
 * Runs before any test module is imported, so env-dependent module setup sees a
 * consistent configuration regardless of the developer's local .env.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'vouchit-test-secret';
// No mail during tests; the OTP is read straight from the database instead.
delete process.env.RESEND_API_KEY;
