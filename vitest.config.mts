import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  // App code reads env via @/lib/config, so give tests the .env values — but point the
  // database at TEST_DATABASE_URL. Without it, DB tests are skipped (never touch the dev DB).
  const env = loadEnv(mode, process.cwd(), '');
  const testDb = process.env.TEST_DATABASE_URL ?? env.TEST_DATABASE_URL;
  return {
    resolve: {
      tsconfigPaths: true,
      // Tests run server code outside React Server Components; the marker package would throw.
      alias: {
        'server-only': fileURLToPath(
          new URL('./node_modules/server-only/empty.js', import.meta.url),
        ),
      },
    },
    test: {
      include: ['tests/**/*.test.ts'],
      env: { ...env, ...(testDb && { DATABASE_URL: testDb, TEST_DATABASE_URL: testDb }) },
      globalSetup: './tests/globalSetup.ts',
      fileParallelism: false, // DB tests share one database
      // next-auth imports "next/server" without an extension; let Vite resolve it instead of Node.
      server: { deps: { inline: ['next-auth'] } },
      testTimeout: 20_000,
    },
  };
});
