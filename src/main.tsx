import './tokens.css';
import './tailwind.css';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Coffee, X } from 'lucide-react';
import {
  ErrorBoundary,
  IconsProvider,
  ThemeProvider,
} from '@mister-guiiug/dev-pwa-config/react';
import { lucideIconSet } from '@mister-guiiug/dev-pwa-config/react/icons-lucide';
import {
  installErrorReporter,
  initSentry,
  recordError,
} from '@mister-guiiug/dev-pwa-config/react/observability';
import { App } from './react/AppRouter';
import { I18nProvider } from './i18n';
import { LocaleSync } from './i18n/LocaleSync';
import { SocleUpdates } from './react/components/SocleUpdates';
import { THEME_COLOR, THEME_LEGACY_KEYS } from './themeConfig';

installErrorReporter();
void initSentry({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
});

/**
 * Mister Mölkky dessine avec lucide-react. Sans ce branchement, le café du
 * pied de page serait le SVG maison du socle, à côté d'une trentaine d'icônes
 * lucide. `repo` garde le repli du paquet : lucide 1.x n'a plus d'icône de
 * marque GitHub.
 */
const icons = lucideIconSet({ close: X, sponsor: Coffee });

const rootElement = document.querySelector<HTMLDivElement>('#app');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <ErrorBoundary
        onError={error => {
          recordError(error, { source: 'error-boundary' });
        }}
      >
        {/* Avant React, le thème est posé par le script anti-FOUC injecté au
            build (pwaSeoPlugin themeBoot) ; ThemeProvider prend ensuite le
            relais : état partagé, écoute du thème système, persistance et
            <meta name="theme-color"> alignée sur le schéma affiché — les trois
            choses que src/theme.ts faisait à la main. Pas d'appId : aucune
            palette --dwc-* n'est peinte, le contrat est déjà câblé sur les
            jetons de tokens.css. */}
        <ThemeProvider legacyKeys={THEME_LEGACY_KEYS} themeColor={THEME_COLOR}>
          {/* `I18nProvider` vient de `createI18n` : il pose LUI-MÊME le
              `LabelsProvider` du socle avec la locale courante — c'est ce qui
              fait parler anglais aux anglophones les libellés du paquet
              (« Fermer », « Code source »…), et ce que src/react/components/
              SocleLabels.tsx câblait à la main. */}
          <I18nProvider>
            {/* La langue est aussi une donnée synchronisée : voir LocaleSync. */}
            <LocaleSync>
              <IconsProvider icons={icons}>
                <SocleUpdates>
                  <App />
                </SocleUpdates>
              </IconsProvider>
            </LocaleSync>
          </I18nProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}
