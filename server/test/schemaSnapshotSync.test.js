// Guards against exactly the drift this test exists because of: server/test/
// schema.sql is a hand-maintained snapshot (structure + pgmigrations
// bookkeeping) used to bootstrap an empty database (see the comment at the
// top of scripts/migrate.js) and to provision every CI test database. Nothing
// regenerates it automatically from a real migration replay, so its DDL and
// its own pgmigrations bookkeeping rows can drift out of sync with each other
// with no error -- which is exactly what happened: 20260910000000 and
// 20260910010000 landed with their DDL folded into schema.sql by hand, but
// their pgmigrations rows were never added. Harmless that time only because
// both migrations happen to be idempotent SQL (ADD COLUMN IF NOT EXISTS, an
// UPDATE ... WHERE) -- a bootstrap from the snapshot silently re-ran them
// on top of DDL that already reflected their effect. A non-idempotent
// migration in the same situation (a bare ADD COLUMN without IF NOT EXISTS,
// for one) would instead fail outright the first time anyone bootstrapped
// from the snapshot -- a class of bug this test is the mechanism to catch
// before that happens, not after.
//
// No DB connection: this only reads and parses two things on disk.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');
const SCHEMA_SNAPSHOT_FILE = path.resolve(__dirname, './schema.sql');

function migrationNamesOnDisk() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => f.slice(0, -'.sql'.length))
    .sort();
}

function bookkeptMigrationNames() {
  const sql = fs.readFileSync(SCHEMA_SNAPSHOT_FILE, 'utf8');
  // INSERT INTO public.pgmigrations (id, name, run_on) VALUES (101, '20260910000000_add_terms_accepted_to_creators', '...');
  const pattern = /INSERT INTO public\.pgmigrations \(id, name, run_on\) VALUES \(\s*\d+\s*,\s*'([^']+)'/g;
  const names = [];
  let match;
  while ((match = pattern.exec(sql)) !== null) {
    names.push(match[1]);
  }
  return names.sort();
}

describe('server/test/schema.sql — pgmigrations bookkeeping stays in sync with migrations/', () => {
  test('every migration file on disk has a matching pgmigrations row in the snapshot', () => {
    const onDisk = new Set(migrationNamesOnDisk());
    const bookkept = new Set(bookkeptMigrationNames());

    const missing = [...onDisk].filter((name) => !bookkept.has(name));

    assert.deepEqual(
      missing,
      [],
      `server/test/schema.sql's pgmigrations bookkeeping is missing a row for: ${missing.join(', ')}. ` +
      `A fresh bootstrap from this snapshot will silently re-run ${missing.length === 1 ? 'this migration' : 'these migrations'} ` +
      `on top of DDL that may already reflect it/them -- harmless only if it/they happen to be idempotent SQL. ` +
      `Add the missing INSERT INTO public.pgmigrations row(s) (see the block just above the pgmigrations_id_seq setval near the end of the file).`
    );
  });

  test('every pgmigrations row in the snapshot corresponds to a real migration file (no stale/renamed entries)', () => {
    const onDisk = new Set(migrationNamesOnDisk());
    const bookkept = bookkeptMigrationNames();

    const stale = bookkept.filter((name) => !onDisk.has(name));

    assert.deepEqual(
      stale,
      [],
      `server/test/schema.sql's pgmigrations bookkeeping references migration(s) with no matching file in migrations/: ${stale.join(', ')}. ` +
      `Likely a renamed or deleted migration file left a stale bookkeeping row behind.`
    );
  });

  test('the snapshot has no duplicate pgmigrations ids or names (a broken bootstrap otherwise fails on a pgmigrations_pkey collision)', () => {
    const sql = fs.readFileSync(SCHEMA_SNAPSHOT_FILE, 'utf8');
    const pattern = /INSERT INTO public\.pgmigrations \(id, name, run_on\) VALUES \(\s*(\d+)\s*,\s*'([^']+)'/g;
    const ids = [];
    const names = [];
    let match;
    while ((match = pattern.exec(sql)) !== null) {
      ids.push(match[1]);
      names.push(match[2]);
    }

    const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);
    const duplicateNames = names.filter((name, i) => names.indexOf(name) !== i);

    assert.deepEqual([...new Set(duplicateIds)], [], `Duplicate pgmigrations id(s) in the snapshot: ${duplicateIds.join(', ')}`);
    assert.deepEqual([...new Set(duplicateNames)], [], `Duplicate pgmigrations name(s) in the snapshot: ${duplicateNames.join(', ')}`);
  });
});
