import { describe, expect, it } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { PinsBoard } from './PinsBoard';
import { I18nProvider } from '../../i18n';

function renderBoard(props?: Partial<React.ComponentProps<typeof PinsBoard>>) {
  return render(
    <I18nProvider>
      <PinsBoard fallen={new Set()} onToggle={() => undefined} {...props} />
    </I18nProvider>
  );
}

describe('PinsBoard', () => {
  it('renders all 12 pin buttons', () => {
    const { container } = renderBoard();
    const buttons = container.querySelectorAll('button[aria-pressed]');
    expect(buttons).toHaveLength(12);
  });

  it('each pin button carries its number label', () => {
    const { container } = renderBoard();
    const numbers = Array.from(
      container.querySelectorAll('button[aria-pressed]')
    )
      .map(b => b.textContent?.trim())
      .sort((a, b) => Number(a) - Number(b));
    expect(numbers).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
    ]);
  });

  it('container holds the right aspect-ratio', () => {
    const { container } = renderBoard();
    const board = container.querySelector('[data-testid="pins-board"]');
    expect(board).not.toBeNull();
    expect((board as HTMLElement).style.aspectRatio).toBe('300 / 320');
  });

  it('every pin sits at a percentage position', () => {
    const { container } = renderBoard();
    const buttons = container.querySelectorAll('button[aria-pressed]');
    for (const btn of Array.from(buttons)) {
      const style = (btn as HTMLElement).style;
      expect(style.left.endsWith('%')).toBe(true);
      expect(style.top.endsWith('%')).toBe(true);
      expect(style.width.endsWith('%')).toBe(true);
    }
  });

  it('toggles a pin via click', () => {
    const calls: number[] = [];
    const { container } = renderBoard({
      onToggle: (pin: number) => calls.push(pin),
    });
    const pin7 = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')
    ).find(b => b.textContent?.trim() === '7');
    expect(pin7).toBeDefined();
    fireEvent.click(pin7!);
    expect(calls).toEqual([7]);
  });

  it('fires onToggle exactly once per pointer+click sequence (regression: double-toggle bug)', () => {
    // The previous version called onToggle from both onPointerUp AND
    // onClick, which left the pin in its original state after every tap.
    const calls: number[] = [];
    const { container } = renderBoard({
      onToggle: (pin: number) => calls.push(pin),
    });
    const pin7 = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')
    ).find(b => b.textContent?.trim() === '7')!;
    fireEvent.pointerDown(pin7);
    fireEvent.pointerUp(pin7);
    fireEvent.click(pin7);
    expect(calls).toEqual([7]);
  });

  it('aria-pressed reflects the fallen set', () => {
    const { container } = renderBoard({ fallen: new Set([3, 7]) });
    const pressed = Array.from(
      container.querySelectorAll('button[aria-pressed="true"]')
    ).map(b => b.textContent?.trim());
    expect(pressed.sort()).toEqual(['3', '7']);
  });
});
