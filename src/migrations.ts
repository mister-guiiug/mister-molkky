/**
 * Versioned data migration scaffolding. Stays minimal until we ship the
 * first breaking schema change.
 */

export interface Migration<TInput, TOutput> {
  from: number;
  to: number;
  run(input: TInput): TOutput;
}

export function runMigrations<T>(
  data: unknown,
  fromVersion: number,
  toVersion: number,
  migrations: Migration<unknown, unknown>[]
): T {
  let current: unknown = data;
  let version = fromVersion;
  while (version < toVersion) {
    const m = migrations.find(x => x.from === version);
    if (!m) throw new Error(`No migration from version ${version}`);
    current = m.run(current);
    version = m.to;
  }
  return current as T;
}
