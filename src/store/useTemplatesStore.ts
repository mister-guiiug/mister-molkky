import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeLocalStorage } from '../storage';
import {
  MatchTemplateSchema,
  newId,
  type MatchTemplate,
  type PlayerId,
  type TargetScore,
  type TeamMode,
} from '../schemas';

interface TemplatesState {
  templates: MatchTemplate[];
  add: (data: {
    name: string;
    targetScore: TargetScore;
    overshootPenalty: number;
    maxMisses: number;
    teamMode: TeamMode;
    playerIds: PlayerId[];
  }) => MatchTemplate;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
}

export const useTemplatesStore = create<TemplatesState>()(
  persist(
    set => ({
      templates: [],
      add: data => {
        const tpl = MatchTemplateSchema.parse({
          ...data,
          name: data.name.trim() || 'Template',
          id: newId(),
          createdAt: Date.now(),
        });
        set(state => ({ templates: [tpl, ...state.templates].slice(0, 50) }));
        return tpl;
      },
      remove: id =>
        set(state => ({ templates: state.templates.filter(t => t.id !== id) })),
      rename: (id, name) =>
        set(state => ({
          templates: state.templates.map(t =>
            t.id === id ? { ...t, name: name.trim() || t.name } : t
          ),
        })),
    }),
    {
      name: 'mm_templates',
      storage: createJSONStorage(() => safeLocalStorage()),
      version: 1,
    }
  )
);
