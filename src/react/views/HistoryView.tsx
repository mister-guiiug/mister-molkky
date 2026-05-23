import { useCallback, useMemo, useState } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { useMatchStore } from '../../store/useMatchStore';
import { PageContainer } from '../components/layout/PageContainer';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PullIndicator } from '../components/PullIndicator';
import { TrashIcon, TrophyIcon } from '../components/icons';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import type { FinishedMatch } from '../../schemas';

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
  const [selected, setSelected] = useState<FinishedMatch | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<FinishedMatch | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const onPullRefresh = useCallback(async () => {
    // Local data is already current — bump a nonce so the user sees the
    // indicator complete and we get a redraw for free.
    await new Promise(r => setTimeout(r, 250));
    setRefreshNonce(n => n + 1);
  }, []);
  const pull = usePullToRefresh({ onRefresh: onPullRefresh });
  void refreshNonce;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return history;
    return history.filter(m =>
      m.config.players.some(p => p.name.toLowerCase().includes(q))
    );
  }, [history, search]);

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
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('history.searchPlaceholder')}
            className="touch-target mb-3 w-full rounded-lg border px-3"
            style={{
              background: 'var(--surface-input)',
              borderColor: 'var(--border)',
            }}
          />
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
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>
                        {formatDate(m.finishedAt, locale)} ·{' '}
                        {m.config.players.length} {t('nav.players').toLowerCase()} ·{' '}
                        {m.throws.length} {t('history.throwsLabel').toLowerCase()}
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
        <Modal open onClose={() => setSelected(null)} title={t('history.title')}>
          <div className="flex flex-col gap-3">
            <p className="m-0 text-sm" style={{ color: 'var(--muted)' }}>
              {formatDate(selected.finishedAt, locale)} ·{' '}
              {t('history.durationLabel')}:{' '}
              {formatDuration(selected.finishedAt - selected.startedAt)}
            </p>
            <ol className="flex flex-col gap-1.5">
              {selected.ranking.map(r => {
                const p = selected.config.players.find(x => x.id === r.playerId);
                return (
                  <li
                    key={r.playerId}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2"
                    style={{
                      borderColor:
                        r.rank === 1 ? 'var(--accent)' : 'var(--border)',
                    }}
                  >
                    <span className="w-5 text-right text-xs font-bold" style={{ color: 'var(--muted)' }}>
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
                    <span className="font-black tabular-nums">{r.finalScore}</span>
                  </li>
                );
              })}
            </ol>
            <div className="flex justify-end gap-2">
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
    </PageContainer>
  );
}
