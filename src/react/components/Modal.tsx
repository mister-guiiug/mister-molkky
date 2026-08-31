import { useEffect, useRef, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { CloseIcon } from './icons';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

// Elements that can hold keyboard focus. Used by the focus trap to find
// the first/last tabbable target inside the dialog.
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    // offsetParent is null for display:none elements — skip those so we
    // never trap focus on something the user can't see.
  ).filter(el => el.offsetParent !== null || el === document.activeElement);
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: ModalProps) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  // The element that had focus before the dialog opened — we hand focus
  // back to it on close so keyboard users land where they left off.
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Move focus into the dialog on open (first focusable, else the panel
    // itself which is tabindex=-1) so the keyboard isn't stranded behind
    // the backdrop.
    const initial = panel ? getFocusable(panel) : [];
    (initial[0] ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = getFocusable(panel);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (!panel.contains(active)) {
        // Focus escaped the dialog (e.g. after a backdrop click) — pull it
        // back in rather than letting Tab wander the page behind it.
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`mm-modal-pop flex w-full ${widths[size]} max-h-[92dvh] flex-col rounded-t-2xl sm:rounded-2xl border shadow-xl sm:max-h-[88dvh] outline-none`}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <header
            className="flex shrink-0 items-center justify-between border-b px-5 py-4"
            style={{ borderColor: 'var(--border)' }}
          >
            <h2 className="m-0 text-lg font-bold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('a11y.closeDialog')}
              className="touch-target -m-2 rounded-full p-2 transition hover:bg-black/5"
            >
              <CloseIcon />
            </button>
          </header>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
