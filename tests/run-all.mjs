import { spawnSync } from 'node:child_process';
import { basename, join } from 'node:path';
import { unlinkSync } from 'node:fs';

const tests = [
  'tests/backend.test.ts',
  'tests/backend-analytics.test.ts',
  'tests/backend-image.test.ts',
  'tests/backend-xlsx.test.ts',
  'tests/seed-persistence.test.ts',
  'tests/ui-model.test.mjs',
  'tests/idle-session.test.ts',
  'tests/ui.test.cjs',
];
const npm = process.platform === 'win32' ? 'npx.cmd' : 'npx';

for (const test of tests) {
  const db = join('/tmp', `pel-test-${process.pid}-${basename(test).replaceAll('.', '-')}.db`);
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    try { unlinkSync(db + suffix); } catch { /* fresh test database */ }
  }
  const env = { ...process.env, DATABASE_URL: `file:${db}` };
  const migrate = spawnSync(npm, ['prisma', 'migrate', 'deploy'], { env, stdio: 'inherit' });
  if (migrate.status !== 0) process.exit(migrate.status ?? 1);
  const seed = spawnSync(npm, ['tsx', 'prisma/seed.ts'], { env, stdio: 'inherit' });
  if (seed.status !== 0) process.exit(seed.status ?? 1);
  const result = spawnSync(npm, ['tsx', '--test', test], { env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
