/**
 * Versioned data migration scaffolding. Stays minimal until we ship the
 * first breaking schema change.
 */

export interface Migration<TInput, TOutput> {
  from: number;
  to: number;
  run(input: TInput): TOutput;
}
