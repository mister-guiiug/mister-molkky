import { Modal } from './Modal';
import { useI18n } from '../../i18n/useI18n';

interface ConfirmDialogProps {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function ConfirmDialog({
  open,
  message,
  onConfirm,
  onCancel,
  destructive,
  confirmLabel,
  cancelLabel,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  return (
    <Modal open={open} onClose={onCancel} size="sm">
      <p className="mb-5 text-base">{message}</p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="touch-target rounded-lg border px-4 font-semibold"
          style={{ borderColor: 'var(--border)' }}
        >
          {cancelLabel ?? t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="touch-target rounded-lg px-4 font-semibold text-white"
          style={{
            background: destructive ? 'var(--danger)' : 'var(--primary)',
          }}
        >
          {confirmLabel ?? t('common.confirm')}
        </button>
      </div>
    </Modal>
  );
}
