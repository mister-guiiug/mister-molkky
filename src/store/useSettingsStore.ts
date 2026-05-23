import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeLocalStorage } from '../storage';
import { SettingsSchema, type Locale, type Settings } from '../schemas';

interface SettingsState extends Settings {
  setLocale: (l: Locale) => void;
  toggleSounds: () => void;
  toggleVibrations: () => void;
  toggleWakeLock: () => void;
  markWelcomeSeen: () => void;
  reset: () => void;
}

const DEFAULTS: Settings = SettingsSchema.parse({});

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      ...DEFAULTS,
      setLocale: l => set({ locale: l }),
      toggleSounds: () => set(s => ({ sounds: !s.sounds })),
      toggleVibrations: () => set(s => ({ vibrations: !s.vibrations })),
      toggleWakeLock: () => set(s => ({ wakeLock: !s.wakeLock })),
      markWelcomeSeen: () => set({ hasSeenWelcome: true }),
      reset: () => set({ ...DEFAULTS }),
    }),
    {
      name: 'mm_settings',
      storage: createJSONStorage(() => safeLocalStorage()),
      version: 1,
    }
  )
);
