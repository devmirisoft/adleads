import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The Zoom API is retired: staff paste links per batch. Fails if a Zoom module comes back.
const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((f) => {
    const path = join(dir, f.name);
    if (f.isDirectory()) return f.name === 'generated' ? [] : sources(path);
    return /\.(ts|tsx)$/.test(f.name) ? [path] : [];
  });

describe('no Zoom API', () => {
  it('src/lib/zoom is gone', () => {
    expect(existsSync('src/lib/zoom')).toBe(false);
  });

  it('nothing imports a Zoom module, or talks to the Zoom API', () => {
    const offenders = sources('src').filter((f) =>
      /from ['"][^'"]*zoom[^'"]*['"]|api\.zoom\.us|zoom\.us\/oauth/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('no ZOOM_* keys left in the env schema or the example', () => {
    expect(readFileSync('src/lib/config.ts', 'utf8')).not.toMatch(/ZOOM_/);
    expect(readFileSync('.env.example', 'utf8')).not.toMatch(/ZOOM_/);
  });
});
