import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { usePlayersStore, pickNextColor } from '../../store/usePlayersStore';
import { useMatchStore } from '../../store/useMatchStore';
import { useTemplatesStore } from '../../store/useTemplatesStore';
import {
  MatchConfigSchema,
  PlayerIdSchema,
  type MatchTemplate,
  type MissSanction,
  type Player,
  type PlayerId,
  type RuleVariant,
  type TargetScore,
  type Team,
  type TeamMode,
} from '../../schemas';
import { newId } from '../../schemas';
import { ROUTES } from '../../routes';
import {
  PlusIcon,
  CheckIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ShuffleIcon,
} from './icons';

type Step = 'players' | 'rules' | 'recap';

interface MatchSetupWizardProps {
  onClose: () => void;
  initialTemplate?: MatchTemplate;
}

export function MatchSetupWizard({
  onClose,
  initialTemplate,
}: MatchSetupWizardProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const roster = usePlayersStore(s => s.players);
  const addPlayer = usePlayersStore(s => s.add);
  const startMatch = useMatchStore(s => s.startMatch);
  const addTemplate = useTemplatesStore(s => s.add);

  const [step, setStep] = useState<Step>('players');
  const [selectedIds, setSelectedIds] = useState<string[]>(
    () =>
      initialTemplate?.playerIds?.filter(id => roster.some(p => p.id === id)) ??
      []
  );
  // Players added only for this match — NOT persisted to the global
  // roster. Tracked here so orderedPlayers can resolve their ids.
  const [guests, setGuests] = useState<Player[]>([]);
  const [guestMode, setGuestMode] = useState(false);
  // Per-player handicap. Stored by player ID, applied at match start.
  // 0 or missing entry = no handicap.
  const [handicaps, setHandicaps] = useState<Record<string, number>>({});
  const [quickName, setQuickName] = useState('');
  const [targetScore, setTargetScore] = useState<TargetScore>(
    initialTemplate?.targetScore ?? 50
  );
  const [overshootPenalty, setOvershootPenalty] = useState(
    initialTemplate?.overshootPenalty ?? 25
  );
  const [maxMisses, setMaxMisses] = useState(initialTemplate?.maxMisses ?? 3);
  const [missSanction, setMissSanction] = useState<MissSanction>(
    initialTemplate?.missSanction ?? 'elimination'
  );
  const [teamMode, setTeamMode] = useState<TeamMode>(
    initialTemplate?.teamMode ?? 'solo'
  );
  const [variant, setVariant] = useState<RuleVariant>('classic');
  const [shuffle, setShuffle] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateSaved, setTemplateSaved] = useState(false);

  const orderedPlayers = useMemo<Player[]>(() => {
    const map = new Map<string, Player>(roster.map(p => [p.id, p]));
    for (const g of guests) map.set(g.id, g);
    return selectedIds
      .map(id => map.get(id))
      .filter((p): p is Player => Boolean(p));
  }, [selectedIds, roster, guests]);

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

  /**
   * Fisher–Yates shuffle of the picked players. Done on `selectedIds`
   * (not on the underlying roster) so we keep the user's selection set
   * intact and only re-order it.
   */
  const shuffleSelected = () => {
    setSelectedIds(prev => {
      if (prev.length < 2) return prev;
      const next = [...prev];
      for (let i = next.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j]!, next[i]!];
      }
      // Guarantee an actual change so the user sees the order flip even
      // on a 2-player swap that happens to land on the same arrangement.
      if (prev.length === 2 && next[0] === prev[0]) {
        return [next[1]!, next[0]!];
      }
      return next;
    });
  };

  const handleQuickAdd = () => {
    const name = quickName.trim();
    if (!name) return;
    const color = pickNextColor([...roster, ...guests]);
    if (guestMode) {
      // Build a transient player object — NOT persisted to usePlayersStore,
      // so the global roster stays clean. `createdAt: 0` is the marker we
      // use elsewhere to tell guests apart from saved players.
      const guest: Player = {
        id: PlayerIdSchema.parse(`guest-${newId()}`),
        name,
        color,
        createdAt: 0,
      };
      setGuests(prev => [...prev, guest]);
      setSelectedIds(prev => [...prev, guest.id]);
    } else {
      const p = addPlayer({ name, color });
      setSelectedIds(prev => [...prev, p.id]);
    }
    setQuickName('');
  };

  const setHandicap = (id: string, value: number) => {
    setHandicaps(prev => {
      const next = { ...prev };
      if (value === 0) {
        delete next[id];
      } else {
        next[id] = value;
      }
      return next;
    });
  };

  const canStart = selectedIds.length >= 2;

  const buildTeams = (players: Player[]): Team[] => {
    if (teamMode === 'solo') return [];
    const groupSize = teamMode === 'duo' ? 2 : 3;
    const teams: Team[] = [];
    for (let i = 0; i < players.length; i += groupSize) {
      const members = players.slice(i, i + groupSize);
      if (members.length === 0) continue;
      teams.push({
        id: newId(),
        name: members.map(m => m.name.split(/\s+/)[0]).join(' & '),
        color: members[0]!.color,
        playerIds: members.map(m => m.id as PlayerId),
      });
    }
    return teams;
  };

  const handleStart = () => {
    if (!canStart) return;
    const teams = buildTeams(orderedPlayers);
    if (teamMode !== 'solo' && teams.length < 2) {
      return;
    }
    // Only keep handicap entries for actors actually in the match — drop
    // stale entries for players the user removed before starting.
    const actorIdsForHandicap = new Set<string>(
      teamMode === 'solo' ? orderedPlayers.map(p => p.id) : teams.map(t => t.id)
    );
    const trimmedHandicaps: Record<string, number> = {};
    for (const [k, v] of Object.entries(handicaps)) {
      if (actorIdsForHandicap.has(k)) trimmedHandicaps[k] = v;
    }

    const config = MatchConfigSchema.parse({
      players: orderedPlayers,
      targetScore,
      overshootPenalty,
      maxMisses,
      missSanction,
      teamMode,
      teams,
      variant,
      shufflePlayers: shuffle,
      handicaps: trimmedHandicaps,
    });
    startMatch(config);
    onClose();
    navigate(ROUTES.match);
  };

  const STEPS: Step[] = ['players', 'rules', 'recap'];
  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="flex flex-col gap-4">
      <ol
        className="sticky top-[-1.25rem] -mx-5 -mt-5 flex gap-2 border-b px-5 py-3"
        aria-label="Étapes"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          zIndex: 1,
        }}
      >
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
              placeholder={
                guestMode ? t('setup.addGuestName') : t('setup.addPlayerName')
              }
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
                borderColor: guestMode ? 'var(--accent)' : 'var(--border)',
                color: 'var(--text)',
              }}
            />
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={!quickName.trim()}
              className="touch-target rounded-lg px-4 font-semibold text-white disabled:opacity-50"
              style={{
                background: guestMode ? 'var(--accent)' : 'var(--primary)',
              }}
              aria-label={t('setup.addPlayerHere')}
            >
              <PlusIcon size={20} />
            </button>
          </div>
          {/*
            Guest mode toggle. When on, the quick-add input creates a
            one-shot player just for this match — they never land in the
            global roster, perfect for "le copain de Paul qui passait là".
          */}
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={guestMode}
              onChange={e => setGuestMode(e.target.checked)}
              className="h-4 w-4"
            />
            <span style={{ color: 'var(--muted)' }}>
              {t('setup.guestMode')}
            </span>
          </label>

          {roster.length > 0 && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {roster.length} {t('nav.players').toLowerCase()}
              </span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(ROUTES.players);
                }}
                className="text-xs font-semibold underline"
                style={{ color: 'var(--primary)' }}
              >
                {t('players.title')} →
              </button>
            </div>
          )}

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
            <div
              className="rounded-lg border p-3"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p
                  className="m-0 text-xs font-bold uppercase"
                  style={{ color: 'var(--muted)' }}
                >
                  {t('setup.turnOrderTitle')} ({selectedIds.length})
                </p>
                <button
                  type="button"
                  onClick={shuffleSelected}
                  disabled={selectedIds.length < 2}
                  className="touch-target flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold disabled:opacity-40"
                  style={{
                    borderColor: 'var(--primary)',
                    color: 'var(--primary)',
                  }}
                  aria-label={t('setup.shuffleNow')}
                >
                  <ShuffleIcon size={14} />
                  {t('setup.shuffleNow')}
                </button>
              </div>
              <ol className="flex flex-col gap-1">
                {orderedPlayers.map((p, i) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5"
                    style={{ background: 'var(--surface-highlight)' }}
                  >
                    <span
                      className="w-5 text-right text-xs font-bold"
                      style={{ color: 'var(--muted)' }}
                    >
                      {i + 1}.
                    </span>
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: p.color }}
                      aria-hidden
                    />
                    <span className="flex-1 truncate text-sm font-semibold">
                      {p.name}
                      {p.createdAt === 0 && (
                        <span
                          className="ml-1.5 rounded-full border px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider"
                          style={{
                            borderColor: 'var(--accent)',
                            color: 'var(--accent)',
                          }}
                          title={t('setup.guestBadge')}
                        >
                          {t('setup.guestBadge')}
                        </span>
                      )}
                    </span>
                    {/*
                      Handicap pill. Tap to step through 0 / +5 / +10 / +15
                      / -5 — keeps the UI compact (no inline number input
                      that fights the soft keyboard on mobile).
                    */}
                    <button
                      type="button"
                      onClick={() => {
                        const cycle = [0, 5, 10, 15, -5];
                        const current = handicaps[p.id] ?? 0;
                        const idx = cycle.indexOf(current);
                        const next = cycle[(idx + 1) % cycle.length] ?? 0;
                        setHandicap(p.id, next);
                      }}
                      className="touch-target rounded-md border px-1.5 py-0.5 text-xs font-bold tabular-nums"
                      style={{
                        borderColor:
                          (handicaps[p.id] ?? 0) !== 0
                            ? 'var(--accent)'
                            : 'var(--border)',
                        color:
                          (handicaps[p.id] ?? 0) !== 0
                            ? 'var(--accent)'
                            : 'var(--muted)',
                      }}
                      aria-label={t('setup.handicapLabel')}
                      title={t('setup.handicapLabel')}
                    >
                      {handicaps[p.id]
                        ? `${handicaps[p.id]! > 0 ? '+' : ''}${handicaps[p.id]!}`
                        : 'H'}
                    </button>
                    <button
                      type="button"
                      onClick={() => movePlayer(p.id, -1)}
                      disabled={i === 0}
                      className="touch-target rounded p-1 disabled:opacity-30"
                      aria-label="Monter"
                    >
                      <ArrowLeftIcon
                        size={16}
                        style={{ transform: 'rotate(90deg)' }}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePlayer(p.id, 1)}
                      disabled={i === orderedPlayers.length - 1}
                      className="touch-target rounded p-1 disabled:opacity-30"
                      aria-label="Descendre"
                    >
                      <ArrowRightIcon
                        size={16}
                        style={{ transform: 'rotate(90deg)' }}
                      />
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
            <legend
              className="mb-2 text-sm font-bold uppercase"
              style={{ color: 'var(--muted)' }}
            >
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
            <span
              className="text-sm font-bold uppercase"
              style={{ color: 'var(--muted)' }}
            >
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
            <span
              className="text-sm font-bold uppercase"
              style={{ color: 'var(--muted)' }}
            >
              {t('setup.maxMisses')}
            </span>
            <input
              type="number"
              min={1}
              max={5}
              value={maxMisses}
              onChange={e =>
                setMaxMisses(
                  Math.max(1, Math.min(5, Number(e.target.value) || 3))
                )
              }
              className="touch-target rounded-lg border px-3"
              style={{
                background: 'var(--surface-input)',
                borderColor: 'var(--border)',
              }}
            />
          </label>

          <fieldset>
            <legend
              className="mb-2 text-sm font-bold uppercase"
              style={{ color: 'var(--muted)' }}
            >
              {t('setup.missSanction', { n: String(maxMisses) })}
            </legend>
            <div className="flex flex-col gap-2">
              {(
                [
                  {
                    value: 'elimination',
                    label: 'missSanctionElimination',
                    hint: 'missSanctionEliminationHint',
                  },
                  {
                    value: 'reset',
                    label: 'missSanctionReset',
                    hint: 'missSanctionResetHint',
                  },
                  {
                    value: 'none',
                    label: 'missSanctionNone',
                    hint: 'missSanctionNoneHint',
                  },
                ] as const
              ).map(opt => {
                const selected = missSanction === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMissSanction(opt.value)}
                    className="touch-target flex flex-col items-start rounded-lg border px-3 py-2 text-left"
                    style={{
                      background: selected
                        ? 'color-mix(in srgb, var(--primary) 16%, var(--surface))'
                        : 'var(--surface)',
                      borderColor: selected
                        ? 'var(--primary)'
                        : 'var(--border)',
                      color: selected ? 'var(--primary)' : 'var(--text)',
                    }}
                    aria-pressed={selected}
                  >
                    <span className="text-sm font-bold">
                      {t(`setup.${opt.label}`)}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {t(`setup.${opt.hint}`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend
              className="mb-2 text-sm font-bold uppercase"
              style={{ color: 'var(--muted)' }}
            >
              {t('setup.teamMode')}
            </legend>
            <div className="flex gap-2">
              {(['solo', 'duo', 'trio'] as TeamMode[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTeamMode(m)}
                  className="touch-target flex-1 rounded-lg border px-3 font-bold"
                  style={{
                    background:
                      teamMode === m
                        ? 'color-mix(in srgb, var(--primary) 16%, var(--surface))'
                        : 'var(--surface)',
                    borderColor:
                      teamMode === m ? 'var(--primary)' : 'var(--border)',
                    color: teamMode === m ? 'var(--primary)' : 'var(--text)',
                  }}
                >
                  {t(
                    m === 'solo'
                      ? 'setup.teamSolo'
                      : m === 'duo'
                        ? 'setup.teamDuo'
                        : 'setup.teamTrio'
                  )}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend
              className="mb-2 text-sm font-bold uppercase"
              style={{ color: 'var(--muted)' }}
            >
              {t('setup.variant')}
            </legend>
            <div className="flex gap-2">
              {(['classic', 'inverse', 'free'] as RuleVariant[]).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVariant(v)}
                  className="touch-target flex-1 rounded-lg border px-3 text-sm font-bold"
                  style={{
                    background:
                      variant === v
                        ? 'color-mix(in srgb, var(--primary) 16%, var(--surface))'
                        : 'var(--surface)',
                    borderColor:
                      variant === v ? 'var(--primary)' : 'var(--border)',
                    color: variant === v ? 'var(--primary)' : 'var(--text)',
                  }}
                >
                  {t(
                    v === 'classic'
                      ? 'setup.variantClassic'
                      : v === 'inverse'
                        ? 'setup.variantInverse'
                        : 'setup.variantFree'
                  )}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs" style={{ color: 'var(--muted)' }}>
              {t(
                variant === 'classic'
                  ? 'setup.variantClassicHint'
                  : variant === 'inverse'
                    ? 'setup.variantInverseHint'
                    : 'setup.variantFreeHint'
              )}
            </p>
          </fieldset>

          <label
            className="flex items-center gap-3 rounded-lg border p-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <input
              type="checkbox"
              checked={shuffle}
              onChange={e => setShuffle(e.target.checked)}
              className="h-5 w-5"
            />
            <span className="text-sm font-semibold">
              {t('setup.shuffleOrder')}
            </span>
          </label>
        </div>
      )}

      {step === 'recap' && (
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-bold">{t('setup.recap')}</h3>
          <dl className="grid grid-cols-2 gap-3">
            <div
              className="rounded-lg p-3"
              style={{ background: 'var(--surface-highlight)' }}
            >
              <dt
                className="text-xs font-bold uppercase"
                style={{ color: 'var(--muted)' }}
              >
                {t('nav.players')}
              </dt>
              <dd className="text-2xl font-black">{orderedPlayers.length}</dd>
            </div>
            <div
              className="rounded-lg p-3"
              style={{ background: 'var(--surface-highlight)' }}
            >
              <dt
                className="text-xs font-bold uppercase"
                style={{ color: 'var(--muted)' }}
              >
                {t('setup.targetScore')}
              </dt>
              <dd className="text-2xl font-black">{targetScore}</dd>
            </div>
            <div
              className="rounded-lg p-3"
              style={{ background: 'var(--surface-highlight)' }}
            >
              <dt
                className="text-xs font-bold uppercase"
                style={{ color: 'var(--muted)' }}
              >
                {t('setup.overshootPenalty')}
              </dt>
              <dd className="text-2xl font-black">{overshootPenalty}</dd>
            </div>
            <div
              className="rounded-lg p-3"
              style={{ background: 'var(--surface-highlight)' }}
            >
              <dt
                className="text-xs font-bold uppercase"
                style={{ color: 'var(--muted)' }}
              >
                {t('setup.maxMisses')}
              </dt>
              <dd className="text-2xl font-black">{maxMisses}</dd>
            </div>
            <div
              className="col-span-2 rounded-lg p-3"
              style={{ background: 'var(--surface-highlight)' }}
            >
              <dt
                className="text-xs font-bold uppercase"
                style={{ color: 'var(--muted)' }}
              >
                {t('setup.missSanction', { n: String(maxMisses) })}
              </dt>
              <dd className="text-base font-bold">
                {t(
                  missSanction === 'elimination'
                    ? 'setup.missSanctionElimination'
                    : missSanction === 'reset'
                      ? 'setup.missSanctionReset'
                      : 'setup.missSanctionNone'
                )}
              </dd>
            </div>
          </dl>
          <ol className="flex flex-col gap-1.5">
            {orderedPlayers.map((p, i) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-lg border px-3 py-2"
                style={{ borderColor: 'var(--border)' }}
              >
                <span
                  className="w-5 text-right text-xs font-bold"
                  style={{ color: 'var(--muted)' }}
                >
                  {i + 1}.
                </span>
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: p.color }}
                />
                <span className="font-semibold">{p.name}</span>
              </li>
            ))}
          </ol>

          <div
            className="rounded-lg border border-dashed p-3"
            style={{ borderColor: 'var(--border)' }}
          >
            {templateSaved ? (
              <p
                className="m-0 flex items-center gap-2 text-sm font-semibold"
                style={{ color: 'var(--success)' }}
              >
                <CheckIcon size={16} /> {t('setup.templateSaved')}
              </p>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  placeholder={t('setup.templateNamePlaceholder')}
                  maxLength={40}
                  className="touch-target flex-1 rounded-lg border px-3 text-sm"
                  style={{
                    background: 'var(--surface-input)',
                    borderColor: 'var(--border)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!templateName.trim()) return;
                    addTemplate({
                      name: templateName.trim(),
                      targetScore,
                      overshootPenalty,
                      maxMisses,
                      missSanction,
                      teamMode: 'solo',
                      playerIds: orderedPlayers.map(p => p.id as PlayerId),
                    });
                    setTemplateSaved(true);
                  }}
                  disabled={!templateName.trim()}
                  className="touch-target rounded-lg border px-3 text-sm font-bold disabled:opacity-50"
                  style={{
                    borderColor: 'var(--primary)',
                    color: 'var(--primary)',
                  }}
                >
                  {t('setup.saveAsTemplate')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <footer
        className="sticky bottom-[-1.25rem] -mx-5 -mb-5 flex items-center justify-between gap-2 border-t px-5 py-3"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          zIndex: 1,
        }}
      >
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
