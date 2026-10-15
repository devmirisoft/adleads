import { execSync } from 'node:child_process';
import type { TestProject } from 'vitest/node';

/** Bring the test database's schema up to date once per run (no-op without TEST_DATABASE_URL). */
export default function setup(project: TestProject) {
  const url = project.config.env.TEST_DATABASE_URL;
  if (!url) {
    console.warn('TEST_DATABASE_URL not set — database tests are skipped.');
    return;
  }
  if (!/test/i.test(new URL(url).pathname)) {
    throw new Error('TEST_DATABASE_URL must point at a database whose name contains "test".');
  }
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
