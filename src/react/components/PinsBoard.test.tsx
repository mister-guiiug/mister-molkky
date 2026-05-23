import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { PinsBoard } from './PinsBoard';
import { I18nProvider } from '../../i18n/I18nProvider';

function renderBoard(props?: Partial<React.ComponentProps<typeof PinsBoard>>) {
  return render(
    <I18nProvider>
      <PinsBoard fallen={new Set()} onToggle={() => undefined} {...props} />
    </I18nProvider>
  );
}

describe('PinsBoard', () => {
  it('renders all 12 pins', () => {
    const { container } = renderBoard();
    const pinGroups = container.querySelectorAll('svg > g[role="button"]');
    expect(pinGroups).toHaveLength(12);
  });

  it('each pin has the number label visible', () => {
    const { container } = renderBoard();
    const numbers = Array.from(
      container.querySelectorAll('svg > g[role="button"] text')
    )
      .map(t => t.textContent)
      .sort((a, b) => Number(a) - Number(b));
    expect(numbers).toEqual([
      '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
    ]);
  });

  it('SVG has explicit width 100% and aspect-preserving preserveAspectRatio', () => {
    const { container } = renderBoard();
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 360 320');
    expect(svg?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
  });

  it('renders a fallen pin with the pin-down gradient fill', () => {
    const { container } = renderBoard({ fallen: new Set([7]) });
    const groups = container.querySelectorAll('svg > g[role="button"]');
    const pin7 = Array.from(groups).find(
      g => g.querySelector('text')?.textContent === '7'
    );
    expect(pin7).toBeDefined();
    const fill = pin7?.querySelectorAll('circle')[1]?.getAttribute('fill');
    expect(fill).toBe('url(#pin-down)');
  });
});
