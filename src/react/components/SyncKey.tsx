import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@mister-guiiug/dev-pwa-config/react/confirm-dialog';
import { qrToDataUrl } from '@mister-guiiug/dev-pwa-config/qr';
import { useActionGuard } from '@mister-guiiug/dev-pwa-config/react/use-action-guard';
import { useQrScanner } from '@mister-guiiug/dev-pwa-config/react/use-qr-scanner';
import { useI18n } from '../../i18n';
import { formatSyncKey, syncKeyLink } from '../../cloudSync';
import { useSyncStore } from '../../store/useSyncStore';
import { Modal } from './Modal';
import { Skeleton } from './Skeleton';
import { CameraIcon } from './icons';

/*
 * LA CLÉ DE SYNCHRO, À L'ÉCRAN.
 *
 * Tous les appareils qu'on réunit partagent UNE clé : le premier la crée, les
 * autres la scannent (ou la saisissent). Elle ouvre le blob du cloud à qui la
 * détient — d'où une clé masquée par défaut, montrée en entier seulement à la
 * demande, avec l'avertissement sous les yeux.
 *
 * Créer, reprendre ou oublier une clé est LOCAL : aucun garde réseau. Seul
 * l'effacement du cloud parle à Supabase.
 */

/** `ABCD-…-WXYZ` : de quoi reconnaître sa clé, pas de quoi la recopier. */
function maskSyncKey(key: string): string {
  return `${key.slice(0, 4)}-…-${key.slice(-4)}`;
}

const buttonClass =
  'touch-target flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-3 text-sm font-bold disabled:opacity-50 aria-disabled:opacity-50';

/** Pas encore de clé : en créer une, ou reprendre celle d'un autre appareil. */
export function SyncKeySetup() {
  const { t } = useI18n();
  const createKey = useSyncStore(s => s.createKey);
  const adoptKey = useSyncStore(s => s.adoptKey);
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);
  // Au premier QR décodé, la caméra s'arrête (défaut du socle) : une clé
  // reconnue remplace ce panneau, une autre image laisse le message.
  const {
    videoRef,
    scanning,
    error: scanError,
    start,
    stop,
  } = useQrScanner({
    onScan: data => setInvalid(!adoptKey(data)),
  });

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-xs" style={{ color: 'var(--muted)' }}>
        {t('settings.cloudKeyIntro')}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={createKey}
          className={buttonClass}
          style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
        >
          {t('settings.cloudKeyCreate')}
        </button>
        {!scanning && (
          <button
            type="button"
            onClick={() => {
              setInvalid(false);
              start();
            }}
            className={buttonClass}
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            <CameraIcon size={18} />
            {t('settings.cloudKeyScan')}
          </button>
        )}
      </div>
      {scanning && (
        <div className="flex flex-col gap-2">
          <video
            ref={videoRef}
            className="aspect-square w-full rounded-2xl bg-black object-cover"
            playsInline
            muted
          />
          <button
            type="button"
            onClick={stop}
            className="touch-target rounded-lg border px-3 py-2 text-sm font-semibold"
            style={{ borderColor: 'var(--border)' }}
          >
            {t('live.joinCancelScan')}
          </button>
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={e => {
          e.preventDefault();
          setInvalid(!adoptKey(draft));
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={e => {
            setDraft(e.target.value);
            setInvalid(false);
          }}
          aria-label={t('settings.cloudKeyInputLabel')}
          aria-invalid={invalid}
          placeholder="XXXX-XXXX-XXXX-…"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="touch-target min-w-0 flex-1 rounded-lg border-2 px-3 font-mono text-sm"
          style={{
            background: 'var(--surface-input)',
            borderColor: invalid ? 'var(--danger)' : 'var(--border)',
            color: 'var(--text)',
          }}
        />
        <button
          type="submit"
          disabled={draft.trim() === ''}
          className="touch-target rounded-lg px-3 text-sm font-bold text-white disabled:opacity-50"
          style={{ background: 'var(--primary)' }}
        >
          {t('settings.cloudKeyUse')}
        </button>
      </form>
      {(invalid || scanError) && (
        <p
          role="alert"
          className="m-0 text-xs"
          style={{ color: 'var(--danger)' }}
        >
          {invalid ? t('settings.cloudKeyInvalid') : scanError?.message}
        </p>
      )}
    </div>
  );
}

/** La clé de cet appareil, masquée — et, à la demande, en entier et en QR. */
export function SyncKeyBadge() {
  const { t } = useI18n();
  const key = useSyncStore(s => s.key);
  const [open, setOpen] = useState(false);
  // Le QR est rangé AVEC le lien qu'il encode : après un changement de clé,
  // l'ancien ne s'affiche pas le temps que le nouveau se calcule.
  const [qr, setQr] = useState<{ link: string; url: string } | null>(null);
  const link = key ? syncKeyLink(key) : null;
  const qrDataUrl = qr && qr.link === link ? qr.url : null;

  useEffect(() => {
    if (!open || !link) return;
    let cancelled = false;
    // Même rendu que le QR du direct (`LiveShareSheet`) : la peer `uqr` n'est
    // chargée qu'à l'ouverture.
    void qrToDataUrl(link, {
      margin: 1,
      width: 240,
      color: { dark: '#1b1d18', light: '#ffffff' },
    })
      .then(url => {
        if (!cancelled) setQr({ link, url });
      })
      .catch(() => {
        /* la clé en clair, sous le QR, reste recopiable */
      });
    return () => {
      cancelled = true;
    };
  }, [open, link]);

  if (!key) return null;

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-sm">
          <span style={{ color: 'var(--muted)' }}>
            {t('settings.cloudKeyLabel')}
          </span>{' '}
          <code className="font-mono font-bold">{maskSyncKey(key)}</code>
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="touch-target rounded-lg border px-3 text-sm font-semibold"
          style={{ borderColor: 'var(--border)' }}
        >
          {t('settings.cloudKeyShow')}
        </button>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('settings.cloudKeyShowTitle')}
        size="md"
      >
        <div className="flex flex-col items-center gap-4">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={t('settings.cloudKeyQrAlt')}
              className="h-56 w-56 rounded-lg border"
              style={{ borderColor: 'var(--border)' }}
            />
          ) : (
            <Skeleton width={224} height={224} rounded="lg" />
          )}
          <p className="m-0 text-center font-mono text-base font-black tracking-wider break-all">
            {formatSyncKey(key)}
          </p>
          <p
            className="m-0 text-center text-xs"
            style={{ color: 'var(--muted)' }}
          >
            {t('settings.cloudKeyShowHint')}
          </p>
          <p
            role="note"
            className="m-0 text-center text-xs font-semibold"
            style={{ color: 'var(--danger)' }}
          >
            {t('settings.cloudKeyWarning')}
          </p>
        </div>
      </Modal>
    </>
  );
}

/** Oublier la clé ici, ou effacer le blob du cloud — chacun sa confirmation. */
export function SyncKeyDangerZone() {
  const { t } = useI18n();
  const key = useSyncStore(s => s.key);
  const status = useSyncStore(s => s.status);
  const forgetKey = useSyncStore(s => s.forgetKey);
  const deleteCloud = useSyncStore(s => s.deleteCloud);
  const [confirming, setConfirming] = useState<'forget' | 'delete' | null>(
    null
  );
  // Effacer parle à Supabase ; oublier, non.
  const guard = useActionGuard({ online: true });

  if (!key) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirming('forget')}
          className="touch-target flex-1 rounded-lg border px-3 text-sm font-semibold"
          style={{ borderColor: 'var(--border)' }}
        >
          {t('settings.cloudKeyForget')}
        </button>
        <button
          type="button"
          {...guard.disabledProps}
          onClick={guard.wrap(() => setConfirming('delete'))}
          disabled={status === 'syncing'}
          className="touch-target flex-1 rounded-lg border px-3 text-sm font-semibold disabled:opacity-50 aria-disabled:opacity-50"
          style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
        >
          {t('settings.cloudDelete')}
        </button>
      </div>
      <ConfirmDialog
        open={confirming === 'forget'}
        title={t('settings.cloudKeyForgetConfirm')}
        message={t('settings.cloudKeyForgetHint')}
        confirmLabel={t('settings.cloudKeyForget')}
        onConfirm={() => {
          setConfirming(null);
          forgetKey();
        }}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming === 'delete'}
        title={t('settings.cloudDeleteConfirm')}
        message={t('settings.cloudDeleteHint')}
        confirmLabel={t('settings.cloudDelete')}
        destructive
        onConfirm={() => {
          setConfirming(null);
          void deleteCloud();
        }}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
