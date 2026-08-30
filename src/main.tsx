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
} from '@mister-guiiug/dev-wpa-config/react';
import { lucideIconSet } from '@mister-guiiug/dev-wpa-config/react/icons-lucide';
import {
  installErrorReporter,
  initSentry,
  recordError,
} from '@mister-guiiug/dev-wpa-config/react/observability';
import { registerServiceWorker } from './register-sw';
import { App } from './react/AppRouter';
import { I18nProvider } from './i18n/I18nProvider';
import { SocleLabels } from './react/components/SocleLabels';
import { THEME_COLOR, THEME_LEGACY_KEYS } from './themeConfig';

installErrorReporter();
void initSentry({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
});
registerServiceWorker();

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
          <I18nProvider>
            <SocleLabels>
              <IconsProvider icons={icons}>
                <App />
              </IconsProvider>
            </SocleLabels>
          </I18nProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}
