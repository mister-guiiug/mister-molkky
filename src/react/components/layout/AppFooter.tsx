import { AppFooter as SocleAppFooter } from '@mister-guiiug/dev-wpa-config/react';
import { repoUrl } from '@mister-guiiug/dev-wpa-config/apps-catalog';

/**
 * Pied de page de l'app : les deux liens viennent du socle, la mention de
 * copyright reste ici.
 *
 * CE QUE LE SOCLE APPORTE. Les liens externes sécurisés (`target="_blank"` +
 * `rel="noopener noreferrer"`), l'URL du dépôt tirée du catalogue famille
 * (`repoUrl('mister-molkky')`, vérifiée identique à celle qui était codée en
 * dur ici), l'URL sponsor par défaut, et surtout des libellés TRADUITS —
 * « Code source » et « Buy me a coffee » étaient figés en français et en
 * anglais dans le même pied de page, quelle que soit la langue choisie.
 *
 * CE QUI RESTE LOCAL, et pourquoi : le copyright, que le composant partagé ne
 * rend pas, et l'habillage (`styles.css`, sélecteurs `[data-dwc]`) — le socle
 * livre la structure, l'app garde la pastille jaune du lien sponsor.
 */
export function AppFooter() {
  return (
    <div
      className="mt-8 flex flex-col items-center gap-3 border-t pt-6 pb-2 text-xs"
      style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
    >
      <SocleAppFooter repoUrl={repoUrl('mister-molkky')} />
      <p className="m-0">Mister Mölkky © {new Date().getFullYear()}</p>
    </div>
  );
}
