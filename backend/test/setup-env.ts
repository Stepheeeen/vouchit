/**
 * Runs before any test module is imported, so env-dependent module setup sees a
 * consistent configuration regardless of the developer's local .env.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'vouchit-test-secret';
// No mail during tests; the OTP is read straight from the database instead.
delete process.env.RESEND_API_KEY;
// Pin mongod. mongodb-memory-server otherwise fetches its newest build, and
// current ones are compiled for macOS 14+ — on an older OS they abort at
// dynamic-link time with a missing libc++ symbol, which surfaces only as
// SIGABRT. Override if your platform needs a different build.
process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION ?? '6.0.14';
