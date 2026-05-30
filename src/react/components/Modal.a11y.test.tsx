import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { I18nProvider } from '../../i18n/I18nProvider';
import { Modal } from './Modal';

/**
 * Harness with a real trigger button so we can assert the dialog's focus
 * lifecycle: focus moves into the dialog on open and is handed back to
 * the trigger on close.
 */
function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <I18nProvider>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Réglages">
        <button type="button">inside</button>
      </Modal>
    </I18nProvider>
  );
}

afterEach(cleanup);

describe('Modal — accessibility', () => {
  it('exposes dialog semantics and the title as an accessible name', () => {
    render(
      <I18nProvider>
        <Modal open onClose={() => {}} title="Réglages">
          <p>contenu</p>
        </Modal>
      </I18nProvider>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Réglages');
  });

  it('moves focus into the dialog when it opens', () => {
    render(<Harness />);
    const trigger = screen.getByText('open');
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog');
    // Focus landed inside the dialog (first focusable, or the panel
    // itself as a fallback) rather than staying on the backdrop trigger.
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape and restores focus to the trigger', () => {
    render(<Harness />);
    const trigger = screen.getByText('open');
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).not.toBeNull();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
