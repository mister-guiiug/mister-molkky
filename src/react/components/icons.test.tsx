import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CheckIcon, HomeIcon, MenuIcon, PlayIcon, TrashIcon } from './icons';

describe('icons (lucide-react wrappers)', () => {
  it('renders an SVG with at least one drawable child for every wrapped icon', () => {
    for (const Icon of [HomeIcon, PlayIcon, MenuIcon, CheckIcon, TrashIcon]) {
      const { container, unmount } = render(<Icon />);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg!.children.length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('default size attribute is 22', () => {
    const { container } = render(<HomeIcon />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('22');
    expect(svg?.getAttribute('height')).toBe('22');
  });

  it('explicit size overrides the default', () => {
    const { container } = render(<HomeIcon size={32} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('32');
  });

  it('inherits color via stroke=currentColor', () => {
    const { container } = render(
      <div style={{ color: 'red' }}>
        <HomeIcon />
      </div>
    );
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('stroke')).toBe('currentColor');
  });
});
