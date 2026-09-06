import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { keepValid, STORE_KEYS, versionedPersistStorage } from './persistence';
import {
  MatchTemplateSchema,
  newId,
  type MatchTemplate,
  type MissSanction,
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
    // Optional so older callers compile; the schema applies the
    // 'elimination' default if it's omitted.
    missSanction?: MissSanction;
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
            t.id === id
              ? // `updatedAt` : la fusion cloud ne peut pas départager deux
                // renommages du même modèle sur `createdAt`, qui ne bouge pas.
                { ...t, name: name.trim() || t.name, updatedAt: Date.now() }
              : t
          ),
        })),
    }),
    {
      name: STORE_KEYS.templates,
      storage: versionedPersistStorage<{ templates: MatchTemplate[] }>({
        name: STORE_KEYS.templates,
        validate: (data, reject) => {
          if (data === null || typeof data !== 'object') {
            throw new Error('mm_templates: forme inattendue');
          }
          const s = data as { templates?: unknown };
          return {
            templates: keepValid(MatchTemplateSchema, s.templates, reject),
          };
        },
      }),
      partialize: state => ({ templates: state.templates }),
    }
  )
);
