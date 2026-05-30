import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '../supabase';
import type { CurrentMatchState, MatchConfig, Throw } from '../schemas';

export interface LiveMatchRow {
  id: string;
  code: string;
  config: MatchConfig;
  throws: Throw[];
  winner_id: string | null;
  started_at: string;
  updated_at: string;
  finished_at: string | null;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

/**
 * Generate a 6-char shareable code from a Crockford-style base32 alphabet
 * (no I/O/0/1 to avoid ambiguity on phone keypads). With 30^6 ≈ 7.3·10⁸
 * combinations, collisions are rare enough that the unique-constraint
 * retry loop in createLiveMatch rarely fires more than once.
 */
function makeCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < CODE_LENGTH; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return out;
}

export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, '')
    .replace(/[IO01]/g, c => ({ I: '1', O: '0', '0': 'O', '1': 'I' })[c] ?? c)
    .slice(0, CODE_LENGTH);
}

export class LiveBackendUnavailableError extends Error {
  constructor() {
    super(
      'Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing)'
    );
    this.name = 'LiveBackendUnavailableError';
  }
}

async function requireClient() {
  const client = await getSupabase();
  if (!client) throw new LiveBackendUnavailableError();
  return client;
}

export async function createLiveMatch(
  state: CurrentMatchState
): Promise<{ id: string; code: string }> {
  const client = await requireClient();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = makeCode();
    const { data, error } = await client
      .from('live_matches')
      .insert({
        code,
        config: state.config,
        throws: state.throws,
      })
      .select('id, code')
      .single();
    if (!error && data) {
      return { id: data.id, code: data.code };
    }
    if (error?.code !== '23505') throw error;
  }
  throw new Error('Could not generate a unique code after 5 attempts');
}

export async function joinLiveMatch(rawCode: string): Promise<LiveMatchRow> {
  const client = await requireClient();
  const code = normalizeCode(rawCode);
  if (code.length !== CODE_LENGTH) {
    throw new Error('Invalid code');
  }
  const { data, error } = await client
    .from('live_matches')
    .select('*')
    .eq('code', code)
    .single<LiveMatchRow>();
  if (error || !data) throw new Error('Match not found');
  return data;
}

export async function pushLiveState(
  matchId: string,
  patch: Partial<
    Pick<LiveMatchRow, 'throws' | 'winner_id' | 'finished_at' | 'config'>
  >
): Promise<void> {
  const client = await requireClient();
  const { error } = await client
    .from('live_matches')
    .update(patch)
    .eq('id', matchId);
  if (error) throw error;
}

export interface LiveSubscription {
  channel: RealtimeChannel;
  unsubscribe: () => void;
}

export async function subscribeLiveMatch(
  matchId: string,
  onChange: (row: LiveMatchRow) => void,
  onError?: (err: Error) => void
): Promise<LiveSubscription> {
  const client = await requireClient();
  const channel = client
    .channel(`live_match:${matchId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_matches',
        filter: `id=eq.${matchId}`,
      },
      payload => {
        onChange(payload.new as LiveMatchRow);
      }
    )
    .subscribe(status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError?.(new Error(`Realtime channel status: ${status}`));
      }
    });

  return {
    channel,
    unsubscribe: () => {
      void client.removeChannel(channel);
    },
  };
}
