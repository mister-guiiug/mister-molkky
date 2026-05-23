import { describe, expect, it } from 'vitest';
import { messages, type Messages } from './messages';

function collectKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj === 'string') return [prefix];
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    collectKeys(v, prefix ? `${prefix}.${k}` : k)
  );
}

describe('messages', () => {
  it('FR and EN expose the same key set', () => {
    const fr = collectKeys(messages.fr).sort();
    const en = collectKeys(messages.en).sort();
    expect(en).toEqual(fr);
  });

  it('every leaf is a non-empty string', () => {
    for (const locale of ['fr', 'en'] as const) {
      for (const key of collectKeys(messages[locale])) {
        const value = key.split('.').reduce<unknown>(
          (acc, p) => (acc as Record<string, unknown>)[p],
          messages[locale] as unknown as Messages
        );
        expect(typeof value).toBe('string');
        expect((value as string).length).toBeGreaterThan(0);
      }
    }
  });

  it('exposes the documentTitle table', () => {
    expect(messages.fr.documentTitle.home).toBeTruthy();
    expect(messages.en.documentTitle.match).toBeTruthy();
  });
});
