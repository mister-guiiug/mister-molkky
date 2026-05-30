import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { usePlayersStore, pickNextColor } from '../../store/usePlayersStore';
import type { Player, PlayerId } from '../../schemas';
import { PageContainer } from '../components/layout/PageContainer';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PlusIcon, TrashIcon } from '../components/icons';

export function PlayersView() {
  const { t } = useI18n();
  const players = usePlayersStore(s => s.players);
  const add = usePlayersStore(s => s.add);
  const update = usePlayersStore(s => s.update);
  const remove = usePlayersStore(s => s.remove);
  const setAvatar = usePlayersStore(s => s.setAvatar);
  const clearAvatar = usePlayersStore(s => s.clearAvatar);
  const getAvatarUrl = usePlayersStore(s => s.getAvatarUrl);

  const [editing, setEditing] = useState<Player | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Player | null>(null);
  const [avatars, setAvatars] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    Promise.all(
      players
        .filter(p => p.avatarBlobKey)
        .map(async p => {
          const url = await getAvatarUrl(p.id);
          if (url) urls.push(url);
          return [p.id, url] as const;
        })
    ).then(entries => {
      if (cancelled) return;
      setAvatars(
        Object.fromEntries(
          entries.filter((e): e is readonly [PlayerId, string] => Boolean(e[1]))
        )
      );
    });
    return () => {
      cancelled = true;
      urls.forEach(u => URL.revokeObjectURL(u));
    };
  }, [players, getAvatarUrl]);

  return (
    <PageContainer>
      <header className="mb-4 flex items-center justify-between gap-3 pt-4">
        <h1 className="m-0 text-2xl font-black">{t('players.title')}</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="touch-target flex items-center gap-1 rounded-full px-4 text-sm font-bold text-white"
          style={{ background: 'var(--primary)' }}
        >
          <PlusIcon size={18} /> {t('common.add')}
        </button>
      </header>

      {players.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed p-8 text-center"
          style={{ borderColor: 'var(--border)' }}
        >
          <p className="m-0 mb-1 font-bold">{t('players.empty')}</p>
          <p className="m-0 text-sm" style={{ color: 'var(--muted)' }}>
            {t('players.emptyHint')}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {players.map(p => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-2xl border p-3"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--surface)',
              }}
            >
              <span
                className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full text-lg font-black text-white"
                style={{ background: p.color }}
              >
                {avatars[p.id] ? (
                  <img
                    src={avatars[p.id]}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  p.name.slice(0, 2).toUpperCase()
                )}
              </span>
              <button
                type="button"
                onClick={() => setEditing(p)}
                className="flex-1 text-left font-bold"
              >
                {p.name}
              </button>
              <button
                type="button"
                onClick={() => setConfirmRemove(p)}
                aria-label={t('common.delete')}
                className="touch-target rounded-full p-2"
                style={{ color: 'var(--danger)' }}
              >
                <TrashIcon size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {(editing || creating) && (
        <PlayerEditor
          player={editing}
          existingPlayers={players}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={({ name, color }) => {
            if (editing) update(editing.id, { name, color });
            else add({ name, color });
          }}
          onAvatarPick={async file => {
            if (!editing) return;
            await setAvatar(editing.id, file);
          }}
          onAvatarClear={async () => {
            if (!editing) return;
            await clearAvatar(editing.id);
          }}
        />
      )}

      {confirmRemove && (
        <ConfirmDialog
          open
          message={t('players.removeConfirm', { name: confirmRemove.name })}
          destructive
          onConfirm={() => {
            remove(confirmRemove.id);
            setConfirmRemove(null);
          }}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </PageContainer>
  );
}

interface PlayerEditorProps {
  player: Player | null;
  existingPlayers: Player[];
  onClose: () => void;
  onSave: (data: { name: string; color: string }) => void;
  onAvatarPick: (file: Blob) => Promise<void>;
  onAvatarClear: () => Promise<void>;
}

function PlayerEditor({
  player,
  existingPlayers,
  onClose,
  onSave,
  onAvatarPick,
  onAvatarClear,
}: PlayerEditorProps) {
  const { t } = useI18n();
  const [name, setName] = useState(player?.name ?? '');
  const [color, setColor] = useState(
    player?.color ?? pickNextColor(existingPlayers)
  );

  const save = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), color });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={player ? t('common.edit') : t('players.addPlayer')}
      size="sm"
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span
            className="text-sm font-bold uppercase"
            style={{ color: 'var(--muted)' }}
          >
            {t('players.name')}
          </span>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={30}
            autoFocus
            className="touch-target rounded-lg border px-3"
            style={{
              background: 'var(--surface-input)',
              borderColor: 'var(--border)',
            }}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span
            className="text-sm font-bold uppercase"
            style={{ color: 'var(--muted)' }}
          >
            {t('players.color')}
          </span>
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="h-12 w-full cursor-pointer rounded-lg border"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface-input)',
            }}
          />
        </label>
        {player && (
          <div className="flex flex-col gap-2">
            <span
              className="text-sm font-bold uppercase"
              style={{ color: 'var(--muted)' }}
            >
              {t('players.avatar')}
            </span>
            <div className="flex gap-2">
              <label
                className="touch-target flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-semibold"
                style={{ borderColor: 'var(--border)' }}
              >
                {t('players.pickAvatar')}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async e => {
                    const f = e.target.files?.[0];
                    if (f) await onAvatarPick(f);
                  }}
                />
              </label>
              {player.avatarBlobKey && (
                <button
                  type="button"
                  onClick={onAvatarClear}
                  className="touch-target rounded-lg border px-3 text-sm font-semibold"
                  style={{
                    borderColor: 'var(--danger)',
                    color: 'var(--danger)',
                  }}
                >
                  {t('players.clearAvatar')}
                </button>
              )}
            </div>
          </div>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="touch-target rounded-lg border px-4 font-semibold"
            style={{ borderColor: 'var(--border)' }}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!name.trim()}
            className="touch-target rounded-lg px-5 font-bold text-white disabled:opacity-50"
            style={{ background: 'var(--primary)' }}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
