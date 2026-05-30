import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Chrono } from './Chrono';

const T0 = new Date('2026-01-01T00:00:00Z').getTime();

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Chrono', () => {
  it('renders the elapsed time as M:SS from startedAt', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 65_000); // 1 min 5 s after start
    render(<Chrono startedAt={T0} aria-label="timer" />);
    expect(screen.getByLabelText('timer')).toHaveTextContent('1:05');
  });

  it('freezes the display at pausedAt while paused, ignoring wall-clock', () => {
    vi.useFakeTimers();
    // Paused 2 min in; wall clock is now 5 min in but the display must
    // stay frozen at the pause instant.
    vi.setSystemTime(T0 + 5 * 60_000);
    render(
      <Chrono
        startedAt={T0}
        pausedAt={T0 + 2 * 60_000}
        pausedTotalMs={0}
        aria-label="timer"
      />
    );
    expect(screen.getByLabelText('timer')).toHaveTextContent('2:00');
  });

  it('subtracts accumulated paused time from the running display', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 3 * 60_000); // 3 min of wall clock
    render(<Chrono startedAt={T0} pausedTotalMs={60_000} aria-label="timer" />);
    // 3 min wall − 1 min paused = 2 min of actual play time.
    expect(screen.getByLabelText('timer')).toHaveTextContent('2:00');
  });

  it('switches to Hh format past one hour', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 3_725_000); // 1 h 02 min 05 s
    render(<Chrono startedAt={T0} aria-label="timer" />);
    expect(screen.getByLabelText('timer')).toHaveTextContent('1h02');
  });
});
