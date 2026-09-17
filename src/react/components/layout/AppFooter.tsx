import { AppFooter as SocleAppFooter } from '@mister-guiiug/dev-pwa-config/react';
import { repoUrl } from '@mister-guiiug/dev-pwa-config/apps-catalog';

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
 *
 * `issues` (socle 4.4.0). Le dépôt n'offrait AUCUN chemin pour signaler quoi
 * que ce soit : zéro anomalie ouverte n'était pas un bulletin de santé,
 * c'était l'absence de porte.
 *
 * Le lien « Signaler un problème » ouvre `issues/new?template=bug.yml` — le
 * gabarit hérité du dépôt `.github` du compte, vérifié en 200 — avec la
 * version, le commit, l'écran courant et le navigateur DÉJÀ REMPLIS
 * (`currentIssueReportUrl`, recalculé au clic et non au rendu : la route
 * change sans que le pied de page se rende).
 *
 * PAS DE PROP `version`. Elle affichait un numéro lié vers
 * `…/releases/tag/vX.Y.Z` — or aucune app du parc ne crée de tag git, et le
 * lien répondait 404. C'est le rapport de bug ci-dessus qui porte le numéro,
 * et `SocleUpdates` qui annonce qu'une version attend, avec le bandeau du
 * socle et sa revérification horaire.
 */
export function AppFooter() {
  return (
    <div
      className="mt-8 flex flex-col items-center gap-3 border-t pt-6 pb-2 text-xs"
      style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
    >
      {/* PAS DE PROP `version` : le numéro portait un lien vers
          `…/releases/tag/vX.Y.Z`, et aucune app du parc ne crée de tag git —
          404 garanti. Le numéro part toujours dans le rapport de bug ouvert
          par `issues`. */}
      <SocleAppFooter repoUrl={repoUrl('mister-molkky')} issues />
      <p className="m-0">Mister Mölkky © {new Date().getFullYear()}</p>
    </div>
  );
}
