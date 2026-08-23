/**
 * Boots a throwaway single-node MongoDB replica set for integration tests.
 *
 * mongodb-memory-server's managed instance aborts (SIGABRT) on this platform,
 * but the same mongod binary runs fine when launched directly — so we launch it
 * ourselves and initiate the replica set over the driver. Prisma needs a replica
 * set because it uses transactions.
 *
 * Set MONGO_TEST_URI to point the suite at an existing server instead.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { MongoClient } from 'mongodb';

const REPL_SET = 'vouchittest';

/** Locate a mongod binary: PATH, or the cache mongodb-memory-server downloaded. */
function findMongod(): string {
  const cacheDir = join(homedir(), '.cache', 'mongodb-binaries');
  if (existsSync(cacheDir)) {
    const binary = readdirSync(cacheDir).find((f) => f.startsWith('mongod'));
    if (binary) return join(cacheDir, binary);
  }
  return 'mongod';
}

export interface MongoHarness {
  uri: string;
  stop: () => Promise<void>;
}

export async function startMongo(port = 27077): Promise<MongoHarness> {
  if (process.env.MONGO_TEST_URI) {
    return { uri: process.env.MONGO_TEST_URI, stop: async () => {} };
  }

  const dbPath = mkdtempSync(join(tmpdir(), 'vouchit-mongo-'));
  const proc: ChildProcess = spawn(
    findMongod(),
    ['--dbpath', dbPath, '--port', String(port), '--replSet', REPL_SET, '--bind_ip', '127.0.0.1'],
    { stdio: 'ignore' },
  );

  const directUri = `mongodb://127.0.0.1:${port}/?directConnection=true`;

  // Wait for the server to accept connections, then initiate the replica set.
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (Date.now() > deadline) {
      proc.kill('SIGKILL');
      throw new Error('mongod did not become ready within 30s');
    }
    try {
      const client = new MongoClient(directUri, { serverSelectionTimeoutMS: 500 });
      await client.connect();
      try {
        await client
          .db('admin')
          .command({ replSetInitiate: { _id: REPL_SET, members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
      } catch (err: any) {
        // "already initialized" is fine; anything else is not.
        if (!/already initialized/i.test(err?.message ?? '')) throw err;
      }

      // Wait for the node to actually become primary before handing back a URI.
      for (;;) {
        const status: any = await client.db('admin').command({ hello: 1 });
        if (status.isWritablePrimary) break;
        if (Date.now() > deadline) throw new Error('replica set never elected a primary');
        await new Promise((r) => setTimeout(r, 250));
      }
      await client.close();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return {
    uri: `mongodb://127.0.0.1:${port}/vouchit_test?replicaSet=${REPL_SET}&directConnection=false`,
    stop: async () => {
      proc.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 500));
      try {
        rmSync(dbPath, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    },
  };
}
