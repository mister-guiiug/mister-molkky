import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import { PageContainer } from '../components/layout/PageContainer';
import { PinsBoard } from '../components/PinsBoard';
import { ROUTES } from '../../routes';
import { ALL_PIN_NUMBERS } from '../../molkky/pins-layout';
import {
  ArrowLeftIcon,
  CheckIcon,
  RefreshIcon,
  TargetIcon,
} from '../components/icons';

interface Attempt {
  readonly target: number;
  readonly hit: boolean;
}

/**
 * Solo practice mode — no win condition, no eliminations. The user picks
 * a target pin, then taps the pins they actually knocked down (PinsBoard
 * reuse). We record a hit when the target is in the fallen set and
 * compute per-target accuracy. Purely transient: nothing is persisted
 * outside this view's lifetime, so the global stats / history stay
 * focused on real matches.
 */
export function PracticeView() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [target, setTarget] = useState<number>(1);
  const [fallen, setFallen] = useState<Set<number>>(new Set());
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  const togglePin = (pin: number) =>
    setFallen(prev => {
      const next = new Set(prev);
      if (next.has(pin)) next.delete(pin);
      else next.add(pin);
      return next;
    });

  const validate = () => {
    const hit = fallen.has(target);
    setAttempts(prev => [...prev, { target, hit }]);
    setFallen(new Set());
  };

  const recordMiss = () => {
    setAttempts(prev => [...prev, { target, hit: false }]);
    setFallen(new Set());
  };

  const reset = () => {
    setAttempts([]);
    setFallen(new Set());
  };

  // Per-target stats derived from the attempts list. Pure derivation in
  // a useMemo so it never causes extra renders when nothing meaningful
  // changed.
  const perTarget = useMemo(() => {
    const map = new Map<number, { hits: number; total: number }>();
    for (const a of attempts) {
      const cell = map.get(a.target) ?? { hits: 0, total: 0 };
      cell.total += 1;
      if (a.hit) cell.hits += 1;
      map.set(a.target, cell);
    }
    return map;
  }, [attempts]);

  const totalHits = attempts.filter(a => a.hit).length;

  return (
    <PageContainer>
      <header className="mb-4 flex items-center gap-2 pt-4">
        <button
          type="button"
          onClick={() => navigate(ROUTES.home)}
          className="touch-target rounded-full p-2"
          style={{ color: 'var(--muted)' }}
          aria-label={t('common.back')}
        >
          <ArrowLeftIcon />
        </button>
        <h1 className="m-0 text-2xl font-black">{t('practice.title')}</h1>
      </header>

      <p className="mb-4 text-sm" style={{ color: 'var(--muted)' }}>
        {t('practice.hint')}
      </p>

      <section className="mb-4">
        <h2
          className="mb-2 text-xs font-bold uppercase"
          style={{ color: 'var(--muted)' }}
        >
          {t('practice.targetLabel')}
        </h2>
        <div className="grid grid-cols-6 gap-2">
          {ALL_PIN_NUMBERS.map(pin => {
            const stats = perTarget.get(pin);
            const acc =
              stats && stats.total > 0
                ? Math.round((stats.hits / stats.total) * 100)
                : null;
            const selected = pin === target;
            return (
              <button
                key={pin}
                type="button"
                onClick={() => setTarget(pin)}
                className="touch-target flex aspect-square flex-col items-center justify-center rounded-lg border-2"
                style={{
                  borderColor: selected ? 'var(--accent)' : 'var(--border)',
                  background: selected
                    ? 'color-mix(in srgb, var(--accent) 18%, var(--surface))'
                    : 'var(--surface)',
                  color: selected ? 'var(--accent)' : 'var(--text)',
                }}
                aria-pressed={selected}
              >
                <span className="text-lg font-black tabular-nums">{pin}</span>
                <span
                  className="text-[0.6rem] tabular-nums"
                  style={{ color: 'var(--muted)' }}
                >
                  {acc !== null ? `${acc}%` : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div
        className="mb-3 flex items-center justify-between rounded-lg border-l-4 px-3 py-2 text-sm font-bold"
        style={{
          borderColor: 'var(--accent)',
          background: 'color-mix(in srgb, var(--accent) 8%, var(--surface))',
        }}
      >
        <span className="flex items-center gap-2">
          <TargetIcon size={18} style={{ color: 'var(--accent)' }} />
          {t('practice.aimFor', { n: target })}
        </span>
        <span
          className="text-xs tabular-nums"
          style={{ color: 'var(--muted)' }}
        >
          {attempts.length > 0
            ? `${totalHits} / ${attempts.length}`
            : t('practice.noAttempts')}
        </span>
      </div>

      <PinsBoard fallen={fallen} onToggle={togglePin} />

      <section className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={validate}
          disabled={fallen.size === 0}
          className="touch-target flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white shadow-lg disabled:opacity-50"
          style={{ background: 'var(--primary)' }}
        >
          <CheckIcon /> {t('practice.recordAttempt')}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={recordMiss}
            className="touch-target flex-1 rounded-xl border-2 py-3 font-bold"
            style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
          >
            {t('match.miss')}
          </button>
          <button
            type="button"
            onClick={reset}
            className="touch-target flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 font-bold"
            style={{ borderColor: 'var(--border)' }}
          >
            <RefreshIcon size={18} /> {t('practice.reset')}
          </button>
        </div>
      </section>

      {attempts.length > 0 && (
        <section
          className="mt-4 rounded-2xl border p-3"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface)',
          }}
        >
          <h3
            className="mb-2 text-xs font-bold uppercase"
            style={{ color: 'var(--muted)' }}
          >
            {t('practice.recentAttempts')}
          </h3>
          <ol className="flex flex-wrap gap-1">
            {attempts.slice(-30).map((a, i) => (
              <li
                key={i}
                className="flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold tabular-nums"
                style={{
                  borderColor: a.hit ? 'var(--success)' : 'var(--muted)',
                  color: a.hit ? 'var(--success)' : 'var(--muted)',
                }}
              >
                {a.hit ? '✓' : '✗'}
                {a.target}
              </li>
            ))}
          </ol>
        </section>
      )}
    </PageContainer>
  );
}
