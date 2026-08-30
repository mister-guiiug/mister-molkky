import type { ReactNode } from 'react';
import { LabelsProvider } from '@mister-guiiug/dev-wpa-config/react';
import { useI18n } from '../../i18n/useI18n';

/**
 * Les libellés des composants du socle suivent la langue de l'app.
 *
 * Sans ce pont, ils restent au français par défaut : un utilisateur anglophone
 * lisait « Code source » et « M'offrir un café » dans le pied de page. Le pied
 * de page maison ne faisait pas mieux — ses deux libellés étaient codés en dur.
 */
export function SocleLabels({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  return <LabelsProvider locale={locale}>{children}</LabelsProvider>;
}
