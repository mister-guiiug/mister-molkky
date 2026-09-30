import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { LabelsProvider } from '@mister-guiiug/dev-pwa-config/react/labels';
import { I18nProvider, LOCALE_STORAGE_KEY } from '../../i18n';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useSyncStore } from '../../store/useSyncStore';
import { SettingsView } from './SettingsView';

/**
 * LA CLÉ DE SYNCHRO, VUE DE L'ÉCRAN RÉGLAGES.
 *
 * Ce qui se joue ici ne parle jamais au réseau : créer une clé, la reprendre
 * d'un autre appareil, la montrer, l'oublier. Les échanges eux-mêmes sont
 * éprouvés dans `useSyncStore.test.ts`, la base dans
 * `supabase/tests/user_data.test.sql`.
 */

// Supabase « configuré » : sinon la section Sync cloud n'est pas rendue.
vi.mock('../../supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: async () => null,
}));

const CLE = 'AAAABBBBCCCCDDDDEEEEFFFFGGGG';

function renderSettings(ui: ReactElement = <SettingsView />) {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <LabelsProvider locale="fr">{ui}</LabelsProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.setItem(LOCALE_STORAGE_KEY, 'fr');
  useSettingsStore.getState().reset();
  useSyncStore.setState({
    enabled: true,
    key: null,
    status: 'idle',
    lastSyncAt: null,
    error: null,
    lastOutcome: null,
  });
});

afterEach(() => {
  cleanup();
  useSyncStore.setState({ enabled: false, key: null });
});

describe('Réglages — la clé de synchro', () => {
  it('sans clé : la créer ou la scanner, et rien à envoyer encore', () => {
    renderSettings();

    expect(
      screen.getByRole('button', { name: 'Créer une clé' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Scanner une clé/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Envoyer vers le cloud' })
    ).toBeNull();
    // La durée de conservation est dite AVANT la première clé : c'est à ce
    // moment qu'on décide d'envoyer ses données.
    expect(
      screen.getByText(/efface une synchro restée un an sans envoi/)
    ).toBeInTheDocument();
  });

  it('créer une clé la montre masquée, et ouvre l’envoi', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Créer une clé' }));

    const key = useSyncStore.getState().key ?? '';
    expect(key).toHaveLength(28);
    expect(
      screen.getByText(`${key.slice(0, 4)}-…-${key.slice(-4)}`)
    ).toBeInTheDocument();
    // La clé entière n'est PAS à l'écran tant qu'on ne la demande pas.
    expect(screen.queryByText(key)).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Envoyer vers le cloud' })
    ).toBeInTheDocument();
  });

  it('refuse une clé incomplète, et le dit', () => {
    renderSettings();
    fireEvent.change(screen.getByRole('textbox', { name: 'Clé de synchro' }), {
      target: { value: 'AAAA-BBBB' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Utiliser' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ce n’est pas une clé de synchro complète (28 caractères).'
    );
    expect(useSyncStore.getState().key).toBeNull();
  });

  it('reprend la clé d’un autre appareil, saisie telle qu’elle s’affiche', () => {
    renderSettings();
    fireEvent.change(screen.getByRole('textbox', { name: 'Clé de synchro' }), {
      target: { value: 'aaaa-bbbb-cccc-dddd-eeee-ffff-gggg' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Utiliser' }));

    expect(useSyncStore.getState().key).toBe(CLE);
    expect(screen.getByText('AAAA-…-GGGG')).toBeInTheDocument();
  });

  it('montre la clé entière sur demande, avec l’avertissement', () => {
    useSyncStore.setState({ key: CLE });
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Montrer la clé' }));

    const dialog = screen.getByRole('dialog', { name: 'Ta clé de synchro' });
    expect(
      within(dialog).getByText('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GGGG')
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Qui a cette clé peut lire et remplacer/)
    ).toBeInTheDocument();
  });

  it('oublier la clé demande confirmation, puis ramène au choix de départ', () => {
    useSyncStore.setState({ key: CLE });
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Oublier la clé ici' }));

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Oublier la clé sur cet appareil ?');
    expect(useSyncStore.getState().key).toBe(CLE);

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Oublier la clé ici' })
    );

    expect(useSyncStore.getState().key).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Créer une clé' })
    ).toBeInTheDocument();
  });
});
