import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { CameraIcon, CloseIcon } from './icons';

/**
 * "Photo de la situation" — lets the user snap the current pin layout
 * with their camera so disputes about which pins fell can be settled
 * from the image. Stored as a transient ObjectURL in component state;
 * not persisted across matches to keep scope tight + avoid blob-store
 * growth.
 *
 * Implementation uses `<input type="file" accept="image/*" capture>`
 * because it gives us the native camera UI on every mobile browser
 * without permission-prompt gymnastics, and it gracefully falls back
 * to a file picker on desktop.
 */
export function SituationPhoto() {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Revoke the previous ObjectURL when the photo changes / on unmount —
  // browsers don't garbage-collect them automatically.
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    // Reset the input so picking the SAME file twice still fires onChange.
    e.target.value = '';
  };

  const clear = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    setExpanded(false);
  };

  if (!photoUrl) {
    return (
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePick}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="touch-target flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          aria-label={t('match.photoTake')}
        >
          <CameraIcon size={16} />
          {t('match.photo')}
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePick}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="h-10 w-10 overflow-hidden rounded-lg border"
          style={{ borderColor: 'var(--accent)' }}
          aria-label={t('match.photoOpen')}
        >
          <img
            src={photoUrl}
            alt={t('match.photoAlt')}
            className="h-full w-full object-cover"
          />
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="touch-target rounded-md border p-1.5 text-xs font-bold"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          aria-label={t('match.photoReplace')}
        >
          <CameraIcon size={14} />
        </button>
        <button
          type="button"
          onClick={clear}
          className="touch-target rounded-md border p-1.5 text-xs font-bold"
          style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
          aria-label={t('match.photoClear')}
        >
          <CloseIcon size={14} />
        </button>
      </div>

      {expanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('match.photoTitle')}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setExpanded(false)}
        >
          <img
            src={photoUrl}
            alt={t('match.photoAlt')}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="touch-target absolute top-3 right-3 rounded-full bg-black/60 p-2 text-white"
            aria-label={t('common.close')}
          >
            <CloseIcon size={24} />
          </button>
        </div>
      )}
    </>
  );
}
