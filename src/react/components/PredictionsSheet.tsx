import { Sheet } from '@mister-guiiug/dev-wpa-config/react/sheet';
import { useI18n } from '../../i18n/useI18n';
import { useMatchStore } from '../../store/useMatchStore';

interface PredictionsSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Mid-match prediction sheet. Each player in the lineup picks who they
 * think will win. Self-pick is allowed (someone betting on themselves
 * is the most common case). Clearing the pick removes the entry. The
 * VictoryScreen later resolves predictions and shows the correct ones.
 */
export function PredictionsSheet({ open, onClose }: PredictionsSheetProps) {
  const { t } = useI18n();
  const current = useMatchStore(s => s.current);
  const setPrediction = useMatchStore(s => s.setPrediction);
  if (!current) return null;

  const players = current.config.players;

  return (
    <Sheet open={open} onClose={onClose} title={t('match.predictionsTitle')}>
      <p className="m-0 mb-3 text-sm" style={{ color: 'var(--muted)' }}>
        {t('match.predictionsHint')}
      </p>
      <ul className="flex flex-col gap-2">
        {players.map(predictor => {
          const picked = current.predictions[predictor.id] ?? '';
          return (
            <li
              key={predictor.id}
              className="flex flex-col gap-1 rounded-lg border p-2"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: predictor.color }}
                />
                <span className="font-semibold">{predictor.name}</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {players.map(target => {
                  const isPick = picked === target.id;
                  return (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() =>
                        setPrediction(predictor.id, isPick ? '' : target.id)
                      }
                      className="touch-target rounded-full border px-3 text-xs font-bold"
                      style={{
                        borderColor: isPick ? target.color : 'var(--border)',
                        background: isPick
                          ? `color-mix(in srgb, ${target.color} 22%, var(--surface))`
                          : 'var(--surface)',
                        color: isPick ? 'var(--text)' : 'var(--muted)',
                      }}
                      aria-pressed={isPick}
                    >
                      {target.name}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
