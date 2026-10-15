import { readdirSync } from 'node:fs';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const modules = readdirSync(new URL('./src/modules', import.meta.url), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

// Module internals are private: import `@/modules/<name>` (its index.ts), never its subfolders.
// `self` is the module the linted file lives in — it may reach into its own internals.
const internals = (self) => ({
  regex: `^@/modules/${self ? `(?!${self}/)` : ''}[^/]+/(services|components|hooks|utils)/`,
  message: "Import other modules through their index.ts (e.g. '@/modules/payments').",
});
const kitPrimitives = {
  group: ['@/modules/core/components/ui', '@/modules/core/components/ui/*'],
  message: "Use the re-exports from '@/modules/core/components'.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/modules/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [internals(), kitPrimitives] }] },
  },
  ...modules.map((m) => ({
    files: [`src/modules/${m}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: m === 'core' ? [internals(m)] : [internals(m), kitPrimitives] },
      ],
    },
  })),
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'src/generated/**']),
]);

export default eslintConfig;
