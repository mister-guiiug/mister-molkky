import './tailwind.css';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyResolvedTheme, wireSystemThemeListener } from './theme';
import { registerServiceWorker } from './register-sw';
import { App } from './react/AppRouter';
import { I18nProvider } from './i18n/I18nProvider';
import { installErrorReporter } from './error-reporter';

installErrorReporter();
applyResolvedTheme();
wireSystemThemeListener();
registerServiceWorker();

const rootElement = document.querySelector<HTMLDivElement>('#app');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </StrictMode>
  );
}
