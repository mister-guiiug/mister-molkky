import { useState } from 'react';
import { Sheet } from '@mister-guiiug/dev-pwa-config/react/sheet';
import { ConfirmDialog } from '@mister-guiiug/dev-pwa-config/react/confirm-dialog';
import { useI18n } from '../../i18n';
import { useMatchStore, useScores } from '../../store/useMatchStore';
import { ForfeitIcon } from './icons';

interface ForfeitPlayerSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Mid-match "Faire abandonner un joueur" sheet. Lists every actor (player
 * in solo, team in team mode) that is still in the running, and lets the
 * user drop them out individually. We confirm with a small ConfirmDialog
 * to avoid accidental forfeits — the action is irreversible from the UI.
 *
 * If the forfeit leaves exactly one active actor, the store auto-finishes
 * the match (the parent MatchView's victory-screen effect picks it up).
 */
export function ForfeitPlayerSheet({ open, onClose }: ForfeitPlayerSheetProps) {
  const { t } = useI18n();
  const current = useMatchStore(s => s.current);
  const forfeitActor = useMatchStore(s => s.forfeitActor);
  const scores = useScores();
  const [pending, setPending] = useState<{ id: string; name: string } | null>(
    null
  );

  if (!current) return null;

  const teams = current.config.teams ?? [];
  const isTeamMode = teams.length > 0;
  const forfeited = new Set(current.forfeitedActorIds);

  // Build the list of actors that can still forfeit: those that haven't
  // already forfeited or won. Eliminated-by-misses actors are filtered
  // out too since forfeiting them would be a no-op visually.
  type Row = { id: string; name: string; color: string; canForfeit: boolean };
  const rows: Row[] = isTeamMode
    ? teams.map(team => {
        const s = scores.get(team.id);
        const dropped =
          forfeited.has(team.id) ||
          (s?.eliminated ?? false) ||
          (s?.hasWon ?? false);
        return {
          id: team.id,
          name: team.name,
          color: team.color,
          canForfeit: !dropped,
        };
      })
    : current.config.players.map(p => {
        const s = scores.get(p.id);
        const dropped =
          forfeited.has(p.id) ||
          (s?.eliminated ?? false) ||
          (s?.hasWon ?? false);
        return {
          id: p.id,
          name: p.name,
          color: p.color,
          canForfeit: !dropped,
        };
      });

  const activeCount = rows.filter(r => r.canForfeit).length;

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={t('match.forfeitPlayerTitle')}
      >
        <p className="m-0 mb-3 text-sm" style={{ color: 'var(--muted)' }}>
          {t('match.forfeitPlayerHint')}
        </p>

        {activeCount === 0 ? (
          <p
            className="rounded-lg border border-dashed p-4 text-center text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            {t('match.forfeitNoActive')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map(r => {
              const dropped = !r.canForfeit;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    disabled={dropped}
                    onClick={() => setPending({ id: r.id, name: r.name })}
                    className="touch-target flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left disabled:opacity-50"
                    style={{
                      borderColor: dropped ? 'var(--border)' : 'var(--danger)',
                      color: dropped ? 'var(--muted)' : 'var(--text)',
                      background: 'var(--surface)',
                    }}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ background: r.color }}
                      aria-hidden
                    />
                    <span className="flex-1 truncate font-semibold">
                      {r.name}
                    </span>
                    {dropped ? (
                      <span
                        className="rounded-full border px-2 py-0.5 text-[0.65rem] font-bold uppercase"
                        style={{
                          borderColor: 'var(--border)',
                          color: 'var(--muted)',
                        }}
                      >
                        {forfeited.has(r.id)
                          ? t('match.forfeitedBadge')
                          : t('match.eliminated')}
                      </span>
                    ) : (
                      <span
                        className="flex items-center gap-1 text-xs font-bold"
                        style={{ color: 'var(--danger)' }}
                      >
                        <ForfeitIcon size={16} />
                        {t('match.forfeit')}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>

      <ConfirmDialog
        open={pending !== null}
        title={pending ? t('match.forfeitConfirm', { name: pending.name }) : ''}
        destructive
        // « Confirmer », pas le « Supprimer » par défaut du destructif : on
        // fait abandonner un joueur, on ne supprime rien.
        confirmLabel={t('common.confirm')}
        onConfirm={() => {
          if (pending) forfeitActor(pending.id);
          setPending(null);
          // Close the parent sheet too — if only one actor remained,
          // the store has auto-finished the match and the victory
          // screen takes over; otherwise the user is back in-match.
          onClose();
        }}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
