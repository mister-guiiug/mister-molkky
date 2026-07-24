import './tokens.css';
import './tailwind.css';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '@mister-guiiug/dev-wpa-config/react';
import {
  installErrorReporter,
  recordError,
} from '@mister-guiiug/dev-wpa-config/react/observability';
import { applyResolvedTheme, wireSystemThemeListener } from './theme';
import { registerServiceWorker } from './register-sw';
import { App } from './react/AppRouter';
import { I18nProvider } from './i18n/I18nProvider';

installErrorReporter();
applyResolvedTheme();
wireSystemThemeListener();
registerServiceWorker();

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
        <I18nProvider>
          <App />
        </I18nProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}
