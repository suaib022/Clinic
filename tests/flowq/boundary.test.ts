// flowq must stay app-free: no imports from the app, Next, Supabase, React or Node built-ins.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../packages/flowq/src');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });

describe('flowq boundary', () => {
  it('has source files', () => expect(files(ROOT).length).toBeGreaterThan(0));
  it('imports nothing from the app or platform', () => {
    const bad = files(ROOT).flatMap((f) =>
      readFileSync(f, 'utf8').split('\n')
        .filter((l) => /from ['"](@\/|next|@supabase|react|node:)/.test(l))
        .map((l) => `${path.relative(ROOT, f)}: ${l.trim()}`));
    expect(bad).toEqual([]);
  });
});
