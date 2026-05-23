import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import { usePlayersStore, pickNextColor } from '../../store/usePlayersStore';
import { useMatchStore } from '../../store/useMatchStore';
import {
  MatchConfigSchema,
  type Player,
  type TargetScore,
} from '../../schemas';
import { ROUTES } from '../../routes';
import { PlusIcon, CheckIcon, ArrowLeftIcon, ArrowRightIcon } from './icons';

type Step = 'players' | 'rules' | 'recap';

export function MatchSetupWizard({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const roster = usePlayersStore(s => s.players);
  const addPlayer = usePlayersStore(s => s.add);
  const startMatch = useMatchStore(s => s.startMatch);

  const [step, setStep] = useState<Step>('players');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [quickName, setQuickName] = useState('');
  const [targetScore, setTargetScore] = useState<TargetScore>(50);
  const [overshootPenalty, setOvershootPenalty] = useState(25);
  const [maxMisses, setMaxMisses] = useState(3);
  const [shuffle, setShuffle] = useState(false);

  const orderedPlayers = useMemo<Player[]>(() => {
    const map = new Map(roster.map(p => [p.id, p]));
    return selectedIds
      .map(id => map.get(id as Player['id']))
      .filter((p): p is Player => Boolean(p));
  }, [selectedIds, roster]);

  const togglePlayer = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const movePlayer = (id: string, direction: -1 | 1) => {
    setSelectedIds(prev => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx]!, next[idx]!];
      return next;
    });
  };

  const handleQuickAdd = () => {
    const name = quickName.trim();
    if (!name) return;
    const color = pickNextColor(roster);
    const p = addPlayer({ name, color });
    setSelectedIds(prev => [...prev, p.id]);
    setQuickName('');
  };

  const canStart = selectedIds.length >= 2;

  const handleStart = () => {
    if (!canStart) return;
    const config = MatchConfigSchema.parse({
      players: orderedPlayers,
      targetScore,
      overshootPenalty,
      maxMisses,
      teamMode: 'solo',
      shufflePlayers: shuffle,
    });
    startMatch(config);
    onClose();
    navigate(ROUTES.match);
  };

  const STEPS: Step[] = ['players', 'rules', 'recap'];
  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex gap-2" aria-label="Étapes">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className="flex-1 rounded-full px-2 py-1 text-center text-xs font-bold uppercase"
            style={{
              background:
                i <= stepIndex
                  ? 'color-mix(in srgb, var(--primary) 18%, var(--surface))'
                  : 'var(--surface-highlight)',
              color: i <= stepIndex ? 'var(--primary)' : 'var(--muted)',
            }}
          >
            {t(`setup.step${(i + 1) as 1 | 2 | 3}`)}
          </li>
        ))}
      </ol>

      {step === 'players' && (
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-bold">{t('setup.pickPlayers')}</h3>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {t('setup.pickPlayersHint')}
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={quickName}
              onChange={e => setQuickName(e.target.value)}
              placeholder={t('setup.addPlayerName')}
              maxLength={30}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleQuickAdd();
                }
              }}
              className="touch-target flex-1 rounded-lg border px-3 text-base"
              style={{
                background: 'var(--surface-input)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            />
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={!quickName.trim()}
              className="touch-target rounded-lg px-4 font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
              aria-label={t('setup.addPlayerHere')}
            >
              <PlusIcon size={20} />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {roster.length === 0 && (
              <p
                className="w-full rounded-lg border border-dashed p-4 text-center text-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
              >
                {t('players.empty')}
              </p>
            )}
            {roster.map(p => {
              const selected = selectedIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlayer(p.id)}
                  className="touch-target flex items-center gap-2 rounded-full border px-3 text-sm font-semibold transition"
                  style={{
                    background: selected
                      ? `color-mix(in srgb, ${p.color} 22%, var(--surface))`
                      : 'var(--surface)',
                    borderColor: selected ? p.color : 'var(--border)',
                    color: 'var(--text)',
                  }}
                  aria-pressed={selected}
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: p.color }}
                    aria-hidden
                  />
                  {p.name}
                  {selected && <CheckIcon size={16} />}
                </button>
              );
            })}
          </div>

          {selectedIds.length > 0 && (
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <p className="mb-2 text-xs font-bold uppercase" style={{ color: 'var(--muted)' }}>
                Ordre de passage ({selectedIds.length})
              </p>
              <ol className="flex flex-col gap-1">
                {orderedPlayers.map((p, i) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5"
                    style={{ background: 'var(--surface-highlight)' }}
                  >
                    <span className="w-5 text-right text-xs font-bold" style={{ color: 'var(--muted)' }}>
                      {i + 1}.
                    </span>
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: p.color }}
                      aria-hidden
                    />
                    <span className="flex-1 truncate text-sm font-semibold">{p.name}</span>
                    <button
                      type="button"
                      onClick={() => movePlayer(p.id, -1)}
                      disabled={i === 0}
                      className="touch-target rounded p-1 disabled:opacity-30"
                      aria-label="Monter"
                    >
                      <ArrowLeftIcon size={16} style={{ transform: 'rotate(90deg)' }} />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePlayer(p.id, 1)}
                      disabled={i === orderedPlayers.length - 1}
                      className="touch-target rounded p-1 disabled:opacity-30"
                      aria-label="Descendre"
                    >
                      <ArrowRightIcon size={16} style={{ transform: 'rotate(90deg)' }} />
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {!canStart && selectedIds.length > 0 && (
            <p className="text-xs" style={{ color: 'var(--danger)' }}>
              {t('setup.needMinPlayers')}
            </p>
          )}
        </div>
      )}

      {step === 'rules' && (
        <div className="flex flex-col gap-4">
          <fieldset>
            <legend className="mb-2 text-sm font-bold uppercase" style={{ color: 'var(--muted)' }}>
              {t('setup.targetScore')}
            </legend>
            <div className="flex gap-2">
              {[25, 50, 100].map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTargetScore(v as TargetScore)}
                  className="touch-target flex-1 rounded-lg border px-3 font-bold"
                  style={{
                    background:
                      targetScore === v
                        ? 'color-mix(in srgb, var(--primary) 16%, var(--surface))'
                        : 'var(--surface)',
                    borderColor:
                      targetScore === v ? 'var(--primary)' : 'var(--border)',
                    color: targetScore === v ? 'var(--primary)' : 'var(--text)',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold uppercase" style={{ color: 'var(--muted)' }}>
              {t('setup.overshootPenalty')}
            </span>
            <input
              type="number"
              min={0}
              max={50}
              value={overshootPenalty}
              onChange={e =>
                setOvershootPenalty(
                  Math.max(0, Math.min(50, Number(e.target.value) || 0))
                )
              }
              className="touch-target rounded-lg border px-3"
              style={{
                background: 'var(--surface-input)',
                borderColor: 'var(--border)',
              }}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold uppercase" style={{ color: 'var(--muted)' }}>
              {t('setup.maxMisses')}
            </span>
            <input
              type="number"
              min={1}
              max={5}
              value={maxMisses}
              onChange={e =>
                setMaxMisses(Math.max(1, Math.min(5, Number(e.target.value) || 3)))
              }
              className="touch-target rounded-lg border px-3"
              style={{
                background: 'var(--surface-input)',
                borderColor: 'var(--border)',
              }}
            />
          </label>

          <label className="flex items-center gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <input
              type="checkbox"
              checked={shuffle}
              onChange={e => setShuffle(e.target.checked)}
              className="h-5 w-5"
            />
            <span className="text-sm font-semibold">{t('setup.shuffleOrder')}</span>
          </label>
        </div>
      )}

      {step === 'recap' && (
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-bold">{t('setup.recap')}</h3>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-3" style={{ background: 'var(--surface-highlight)' }}>
              <dt className="text-xs font-bold uppercase" style={{ color: 'var(--muted)' }}>
                {t('nav.players')}
              </dt>
              <dd className="text-2xl font-black">{orderedPlayers.length}</dd>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'var(--surface-highlight)' }}>
              <dt className="text-xs font-bold uppercase" style={{ color: 'var(--muted)' }}>
                {t('setup.targetScore')}
              </dt>
              <dd className="text-2xl font-black">{targetScore}</dd>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'var(--surface-highlight)' }}>
              <dt className="text-xs font-bold uppercase" style={{ color: 'var(--muted)' }}>
                {t('setup.overshootPenalty')}
              </dt>
              <dd className="text-2xl font-black">{overshootPenalty}</dd>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'var(--surface-highlight)' }}>
              <dt className="text-xs font-bold uppercase" style={{ color: 'var(--muted)' }}>
                {t('setup.maxMisses')}
              </dt>
              <dd className="text-2xl font-black">{maxMisses}</dd>
            </div>
          </dl>
          <ol className="flex flex-col gap-1.5">
            {orderedPlayers.map((p, i) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-lg border px-3 py-2"
                style={{ borderColor: 'var(--border)' }}
              >
                <span className="w-5 text-right text-xs font-bold" style={{ color: 'var(--muted)' }}>
                  {i + 1}.
                </span>
                <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                <span className="font-semibold">{p.name}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <footer className="flex items-center justify-between gap-2 pt-2">
        <button
          type="button"
          onClick={() => {
            if (stepIndex === 0) onClose();
            else setStep(STEPS[stepIndex - 1]!);
          }}
          className="touch-target rounded-lg border px-4 font-semibold"
          style={{ borderColor: 'var(--border)' }}
        >
          {stepIndex === 0 ? t('common.cancel') : t('common.back')}
        </button>
        {step !== 'recap' ? (
          <button
            type="button"
            onClick={() => setStep(STEPS[stepIndex + 1]!)}
            disabled={step === 'players' && !canStart}
            className="touch-target rounded-lg px-5 font-bold text-white disabled:opacity-50"
            style={{ background: 'var(--primary)' }}
          >
            {t('common.next')}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart}
            className="touch-target rounded-lg px-5 font-bold text-white disabled:opacity-50"
            style={{ background: 'var(--primary)' }}
          >
            {t('setup.startMatch')}
          </button>
        )}
      </footer>
    </div>
  );
}
