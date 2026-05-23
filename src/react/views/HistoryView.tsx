import { useCallback, useMemo, useState } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { useMatchStore } from '../../store/useMatchStore';
import { PageContainer } from '../components/layout/PageContainer';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PullIndicator } from '../components/PullIndicator';
import { PlayIcon, TrashIcon, TrophyIcon } from '../components/icons';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { MatchReplay } from '../components/MatchReplay';
import type { FinishedMatch, RuleVariant } from '../../schemas';

type VariantFilter = 'all' | RuleVariant;
type SizeFilter = 'all' | '2' | '3-4' | '5+';
type DurationFilter = 'all' | 'short' | 'medium' | 'long';

function formatDate(ts: number, locale: string): string {
  return new Date(ts).toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

export function HistoryView() {
  const { t, locale } = useI18n();
  const history = useMatchStore(s => s.history);
  const remove = useMatchStore(s => s.removeFromHistory);
  const clear = useMatchStore(s => s.clearHistory);
  const [search, setSearch] = useState('');
  const [variant, setVariant] = useState<VariantFilter>('all');
  const [size, setSize] = useState<SizeFilter>('all');
  const [duration, setDuration] = useState<DurationFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<FinishedMatch | null>(null);
  const [replayMatch, setReplayMatch] = useState<FinishedMatch | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<FinishedMatch | null>(
    null
  );
  const [refreshNonce, setRefreshNonce] = useState(0);
  const onPullRefresh = useCallback(async () => {
    // Local data is already current — bump a nonce so the user sees the
    // indicator complete and we get a redraw for free.
    await new Promise(r => setTimeout(r, 250));
    setRefreshNonce(n => n + 1);
  }, []);
  const pull = usePullToRefresh({ onRefresh: onPullRefresh });
  void refreshNonce;

  /**
   * Apply name search + advanced filters. Pure derivation from the
   * persisted history list, recomputed only when one of the filters
   * actually changes.
   */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter(m => {
      if (q && !m.config.players.some(p => p.name.toLowerCase().includes(q))) {
        return false;
      }
      if (variant !== 'all' && (m.config.variant ?? 'classic') !== variant) {
        return false;
      }
      if (size !== 'all') {
        const n = m.config.players.length;
        if (size === '2' && n !== 2) return false;
        if (size === '3-4' && (n < 3 || n > 4)) return false;
        if (size === '5+' && n < 5) return false;
      }
      if (duration !== 'all') {
        const minutes = (m.finishedAt - m.startedAt) / 60000;
        if (duration === 'short' && minutes >= 10) return false;
        if (duration === 'medium' && (minutes < 10 || minutes > 25))
          return false;
        if (duration === 'long' && minutes <= 25) return false;
      }
      return true;
    });
  }, [history, search, variant, size, duration]);

  const activeFilterCount =
    (variant !== 'all' ? 1 : 0) +
    (size !== 'all' ? 1 : 0) +
    (duration !== 'all' ? 1 : 0);
  const resetFilters = () => {
    setVariant('all');
    setSize('all');
    setDuration('all');
  };

  return (
    <PageContainer>
      <PullIndicator
        pulling={pull.pulling}
        progress={pull.progress}
        refreshing={pull.refreshing}
        label={t('common.loading')}
      />
      <header className="mb-4 flex items-center justify-between gap-3 pt-4">
        <h1 className="m-0 text-2xl font-black">{t('history.title')}</h1>
        {history.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="touch-target rounded-full border px-3 text-xs font-bold"
            style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
          >
            {t('history.deleteAll')}
          </button>
        )}
      </header>

      {history.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed p-8 text-center"
          style={{ borderColor: 'var(--border)' }}
        >
          <p className="m-0" style={{ color: 'var(--muted)' }}>
            {t('history.empty')}
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('history.searchPlaceholder')}
              className="touch-target flex-1 rounded-lg border px-3"
              style={{
                background: 'var(--surface-input)',
                borderColor: 'var(--border)',
              }}
            />
            <button
              type="button"
              onClick={() => setFiltersOpen(o => !o)}
              className="touch-target rounded-lg border px-3 text-xs font-bold"
              style={{
                borderColor:
                  activeFilterCount > 0 ? 'var(--primary)' : 'var(--border)',
                color: activeFilterCount > 0 ? 'var(--primary)' : 'var(--text)',
              }}
              aria-expanded={filtersOpen}
            >
              {t('history.filters')}
              {activeFilterCount > 0 && ` · ${activeFilterCount}`}
            </button>
          </div>

          {filtersOpen && (
            <div
              className="mb-3 flex flex-col gap-3 rounded-2xl border p-3"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--surface)',
              }}
            >
              <FilterRow
                label={t('history.filterVariant')}
                value={variant}
                options={[
                  { v: 'all', l: t('history.filterAll') },
                  { v: 'classic', l: t('setup.variantClassic') },
                  { v: 'inverse', l: t('setup.variantInverse') },
                  { v: 'free', l: t('setup.variantFree') },
                ]}
                onChange={v => setVariant(v as VariantFilter)}
              />
              <FilterRow
                label={t('history.filterSize')}
                value={size}
                options={[
                  { v: 'all', l: t('history.filterAll') },
                  { v: '2', l: '2' },
                  { v: '3-4', l: '3–4' },
                  { v: '5+', l: '5+' },
                ]}
                onChange={v => setSize(v as SizeFilter)}
              />
              <FilterRow
                label={t('history.filterDuration')}
                value={duration}
                options={[
                  { v: 'all', l: t('history.filterAll') },
                  { v: 'short', l: t('history.filterDurationShort') },
                  { v: 'medium', l: t('history.filterDurationMedium') },
                  { v: 'long', l: t('history.filterDurationLong') },
                ]}
                onChange={v => setDuration(v as DurationFilter)}
              />
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="touch-target self-end rounded-md text-xs font-bold underline"
                  style={{ color: 'var(--muted)' }}
                >
                  {t('history.filterReset')}
                </button>
              )}
            </div>
          )}
          <ul className="flex flex-col gap-2">
            {filtered.map(m => {
              const winner = m.config.players.find(p => p.id === m.winnerId);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(m)}
                    className="flex w-full items-center gap-3 rounded-2xl border p-3 text-left"
                    style={{
                      borderColor: 'var(--border)',
                      background: 'var(--surface)',
                    }}
                  >
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                      style={{ background: winner?.color ?? 'var(--primary)' }}
                    >
                      <TrophyIcon size={20} />
                    </span>
                    <span className="flex-1">
                      <span className="block font-bold">
                        {winner?.name ?? '—'} {t('history.won')}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: 'var(--muted)' }}
                      >
                        {formatDate(m.finishedAt, locale)} ·{' '}
                        {m.config.players.length}{' '}
                        {t('nav.players').toLowerCase()} · {m.throws.length}{' '}
                        {t('history.throwsLabel').toLowerCase()} ·{' '}
                        {formatDuration(m.finishedAt - m.startedAt)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {selected && (
        <Modal
          open
          onClose={() => setSelected(null)}
          title={t('history.title')}
        >
          <div className="flex flex-col gap-3">
            <p className="m-0 text-sm" style={{ color: 'var(--muted)' }}>
              {formatDate(selected.finishedAt, locale)} ·{' '}
              {t('history.durationLabel')}:{' '}
              {formatDuration(selected.finishedAt - selected.startedAt)}
            </p>
            <ol className="flex flex-col gap-1.5">
              {selected.ranking.map(r => {
                const p = selected.config.players.find(
                  x => x.id === r.playerId
                );
                return (
                  <li
                    key={r.playerId}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2"
                    style={{
                      borderColor:
                        r.rank === 1 ? 'var(--accent)' : 'var(--border)',
                    }}
                  >
                    <span
                      className="w-5 text-right text-xs font-bold"
                      style={{ color: 'var(--muted)' }}
                    >
                      {r.rank}
                    </span>
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: p?.color ?? '#999' }}
                    />
                    <span className="flex-1 font-semibold">
                      {r.eliminated && '✗ '}
                      {p?.name ?? '—'}
                    </span>
                    <span className="font-black tabular-nums">
                      {r.finalScore}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setReplayMatch(selected);
                  setSelected(null);
                }}
                className="touch-target flex items-center gap-2 rounded-lg border px-4 text-sm font-semibold"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
              >
                <PlayIcon size={16} /> {t('history.replay')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmRemove(selected)}
                className="touch-target rounded-lg border px-4 text-sm font-semibold"
                style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
              >
                <TrashIcon size={16} /> {t('common.delete')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={confirmClear}
        message={t('history.deleteAllConfirm')}
        destructive
        onConfirm={() => {
          clear();
          setConfirmClear(false);
        }}
        onCancel={() => setConfirmClear(false)}
      />
      <ConfirmDialog
        open={Boolean(confirmRemove)}
        message={t('history.deleteOne')}
        destructive
        onConfirm={() => {
          if (confirmRemove) remove(confirmRemove.id);
          setConfirmRemove(null);
          setSelected(null);
        }}
        onCancel={() => setConfirmRemove(null)}
      />

      {replayMatch && (
        <MatchReplay
          match={replayMatch}
          open
          onClose={() => setReplayMatch(null)}
        />
      )}
    </PageContainer>
  );
}

/**
 * Single horizontal row of small segmented-control buttons for a filter
 * category. Rendered inside the collapsible advanced-filters panel.
 */
function FilterRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ v: string; l: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-[0.65rem] font-bold uppercase"
        style={{ color: 'var(--muted)' }}
      >
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => {
          const active = opt.v === value;
          return (
            <button
              key={opt.v}
              type="button"
              onClick={() => onChange(opt.v)}
              className="touch-target rounded-full border px-3 text-xs font-bold"
              style={{
                background: active
                  ? 'color-mix(in srgb, var(--primary) 18%, var(--surface))'
                  : 'var(--surface)',
                borderColor: active ? 'var(--primary)' : 'var(--border)',
                color: active ? 'var(--primary)' : 'var(--text)',
              }}
              aria-pressed={active}
            >
              {opt.l}
            </button>
          );
        })}
      </div>
    </div>
  );
}
