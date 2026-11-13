/**
 * Say which database a script is about to act on — out loud, before it acts.
 *
 * Three maintenance scripts read DATABASE_URL and print only the database
 * NAME. That is not enough to tell two deployments apart: a local .env and a
 * deployed service can both point at a database called "vouchit" on entirely
 * different clusters. Running a backfill or an admin grant against the wrong
 * one succeeds, prints "Done", and changes nothing the live app can see —
 * which is exactly what happened here, twice.
 *
 * The host is printed alongside the name. Credentials never are: the
 * username and password are stripped before anything is logged.
 */
/**
 * Load an alternative env file named with --db-env=<path>.
 *
 * NOT --env-file: Node owns that flag natively from v20 and consumes it even
 * when it appears after the script name, so the script would never see it and
 * a missing file would fail with Node's own error instead of ours.
 *
 * Pasting a production connection string onto the command line works, but it
 * is a bad habit: the credential lands in shell history, and a `$` or a
 * backtick in the password is mangled by the shell before the script ever
 * sees it. Keeping it in a gitignored file instead means the command is the
 * same every time and the secret is typed once.
 *
 * Only the `--db-env=<path>` form is accepted. The space-separated form
 * would leave a bare path in argv, which grant-admin.js would read as an
 * email address.
 */
function loadEnvFileArg(argv = process.argv) {
  const arg = argv.find((a) => a.startsWith('--db-env='));
  if (!arg) return null;
  const path = arg.slice('--db-env='.length).trim();
  if (!path) {
    console.error('--db-env= was given with no path.');
    process.exit(1);
  }
  const result = require('dotenv').config({ path, override: true, quiet: true });
  if (result.error) {
    console.error(`Could not read ${path}: ${result.error.message}`);
    process.exit(1);
  }
  return path;
}

function describeDatabaseUrl(uri) {
  if (!uri) return null;
  const host = (uri.match(/@([^/?]+)/) || [])[1] || null;
  const name = (uri.match(/\/([^/?]+)\?/) || [])[1] || null;
  return { host, name };
}

/**
 * Print the target and return the database name, or exit with an explanation.
 * `label` names the script so the line reads as its own.
 */
function requireDatabaseTarget() {
  const envFile = loadEnvFileArg();

  const uri = process.env.DATABASE_URL;
  if (!uri) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  // The commonest mistake is pasting the documented command verbatim, so say
  // what went wrong rather than just that it did.
  if (uri.includes('<') || uri.includes('>')) {
    console.error(
      'DATABASE_URL still contains a placeholder — it looks like the example\n' +
        'was run literally. Replace it with the real connection string, or put\n' +
        'it in a file and pass --db-env=<path>.',
    );
    process.exit(1);
  }
  const target = describeDatabaseUrl(uri);
  if (!target?.name) {
    console.error(
      'Could not read a database name out of DATABASE_URL.\n' +
        'Expected something like mongodb+srv://user:pass@host/<dbname>?opts',
    );
    process.exit(1);
  }

  if (envFile) console.log(`Env file: ${envFile}`);
  console.log(`Server:   ${target.host ?? 'unknown'}`);
  console.log(`Database: ${target.name}`);
  // Said every run, not only when something looks wrong: the failure mode is
  // a script that works perfectly against the wrong data.
  console.log('          (check this is the deployment you meant)');
  return target.name;
}

module.exports = { describeDatabaseUrl, requireDatabaseTarget, loadEnvFileArg };
