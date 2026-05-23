import { beforeEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from './useSettingsStore';

beforeEach(() => {
  useSettingsStore.getState().reset();
});

describe('useSettingsStore', () => {
  it('exposes the schema defaults', () => {
    const s = useSettingsStore.getState();
    expect(s.locale).toBe('fr');
    expect(s.sounds).toBe(true);
    expect(s.vibrations).toBe(true);
    expect(s.wakeLock).toBe(true);
    expect(s.outdoor).toBe(false);
    expect(s.colorblind).toBe(false);
    expect(s.hasSeenWelcome).toBe(false);
    expect(s.hasSeenMatchOnboarding).toBe(false);
  });

  it('setLocale switches the language', () => {
    useSettingsStore.getState().setLocale('en');
    expect(useSettingsStore.getState().locale).toBe('en');
  });

  it('toggles the sounds, vibrations, wake-lock, outdoor and colourblind flags', () => {
    const s = useSettingsStore.getState();
    s.toggleSounds();
    s.toggleVibrations();
    s.toggleWakeLock();
    s.toggleOutdoor();
    s.toggleColorblind();
    const after = useSettingsStore.getState();
    expect(after.sounds).toBe(false);
    expect(after.vibrations).toBe(false);
    expect(after.wakeLock).toBe(false);
    expect(after.outdoor).toBe(true);
    expect(after.colorblind).toBe(true);
  });

  it('marks the welcome tutorial and match onboarding as seen', () => {
    useSettingsStore.getState().markWelcomeSeen();
    useSettingsStore.getState().markMatchOnboardingSeen();
    const s = useSettingsStore.getState();
    expect(s.hasSeenWelcome).toBe(true);
    expect(s.hasSeenMatchOnboarding).toBe(true);
  });

  it('reset() restores the defaults', () => {
    const s = useSettingsStore.getState();
    s.setLocale('en');
    s.toggleSounds();
    s.markWelcomeSeen();
    s.reset();
    const after = useSettingsStore.getState();
    expect(after.locale).toBe('fr');
    expect(after.sounds).toBe(true);
    expect(after.hasSeenWelcome).toBe(false);
  });
});
