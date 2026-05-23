import { useState } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { useMatchStore } from '../../store/useMatchStore';
import { ALL_PIN_NUMBERS } from '../../molkky/pins-layout';
import { Modal } from './Modal';
import { CheckIcon, StarIcon } from './icons';

interface ThrowsLogProps {
  open: boolean;
  onClose: () => void;
}

export function ThrowsLog({ open, onClose }: ThrowsLogProps) {
  const { t } = useI18n();
  const current = useMatchStore(s => s.current);
  const editThrow = useMatchStore(s => s.editThrow);
  const toggleHighlight = useMatchStore(s => s.toggleHighlight);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPins, setEditPins] = useState<Set<number>>(new Set());

  const throws = current?.throws ?? [];
  const highlightedSet = new Set(current?.highlightedThrowIds ?? []);
  const playersById = new Map(
    (current?.config.players ?? []).map(p => [p.id, p])
  );

  const startEdit = (throwId: string, fallenPins: number[]) => {
    setEditingId(throwId);
    setEditPins(new Set(fallenPins));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditPins(new Set());
  };

  const saveEdit = () => {
    if (!editingId) return;
    const sorted = Array.from(editPins).sort((a, b) => a - b);
    editThrow(editingId, sorted);
    cancelEdit();
  };

  const togglePin = (pin: number) =>
    setEditPins(prev => {
      const next = new Set(prev);
      if (next.has(pin)) next.delete(pin);
      else next.add(pin);
      return next;
    });

  return (
    <Modal open={open} onClose={onClose} title={t('match.throwsLog')} size="md">
      {throws.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>{t('match.throwsLogEmpty')}</p>
      ) : (
        <ol className="flex max-h-[55vh] flex-col gap-1.5 overflow-y-auto">
          {throws.map((tr, idx) => {
            const p = playersById.get(tr.playerId);
            const isEditing = editingId === tr.id;
            const pinsLabel =
              tr.fallenPins.length === 0
                ? t('match.miss')
                : tr.fallenPins.join(' · ');
            return (
              <li
                key={tr.id}
                className="rounded-lg border px-3 py-2"
                style={{
                  borderColor: isEditing ? 'var(--primary)' : 'var(--border)',
                  background: isEditing
                    ? 'color-mix(in srgb, var(--primary) 8%, var(--surface))'
                    : 'var(--surface)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-8 text-right text-xs font-bold tabular-nums"
                    style={{ color: 'var(--muted)' }}
                  >
                    #{idx + 1}
                  </span>
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: p?.color ?? '#999' }}
                  />
                  <span className="flex-1 truncate text-sm font-semibold">
                    {p?.name ?? '?'}
                  </span>
                  <span
                    className="text-sm tabular-nums"
                    style={{ color: 'var(--muted)' }}
                  >
                    {pinsLabel}
                  </span>
                  <span className="w-10 text-right text-base font-black tabular-nums">
                    +{tr.computedScore}
                  </span>
                  {!isEditing && (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleHighlight(tr.id)}
                        className="touch-target rounded px-1"
                        aria-label={t('match.markHighlight')}
                        aria-pressed={highlightedSet.has(tr.id)}
                        style={{
                          color: highlightedSet.has(tr.id)
                            ? 'var(--accent)'
                            : 'var(--muted)',
                        }}
                      >
                        <StarIcon
                          size={16}
                          fill={
                            highlightedSet.has(tr.id) ? 'currentColor' : 'none'
                          }
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(tr.id, [...tr.fallenPins])}
                        className="touch-target rounded px-2 text-xs font-bold"
                        style={{ color: 'var(--primary)' }}
                      >
                        {t('common.edit')}
                      </button>
                    </>
                  )}
                </div>
                {isEditing && (
                  <div className="mt-2 flex flex-col gap-2">
                    <p
                      className="m-0 text-xs"
                      style={{ color: 'var(--muted)' }}
                    >
                      {t('match.editThrowHint')}
                    </p>
                    <div className="grid grid-cols-6 gap-1">
                      {ALL_PIN_NUMBERS.map(pin => {
                        const selected = editPins.has(pin);
                        return (
                          <button
                            key={pin}
                            type="button"
                            onClick={() => togglePin(pin)}
                            className="touch-target rounded-md border text-sm font-bold tabular-nums"
                            style={{
                              background: selected
                                ? 'color-mix(in srgb, var(--primary) 22%, var(--surface))'
                                : 'var(--surface)',
                              borderColor: selected
                                ? 'var(--primary)'
                                : 'var(--border)',
                              color: selected
                                ? 'var(--primary)'
                                : 'var(--text)',
                            }}
                          >
                            {pin}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="touch-target rounded-lg border px-3 text-sm font-semibold"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={saveEdit}
                        className="touch-target flex items-center gap-1 rounded-lg px-3 text-sm font-bold text-white"
                        style={{ background: 'var(--primary)' }}
                      >
                        <CheckIcon size={16} /> {t('common.save')}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Modal>
  );
}
