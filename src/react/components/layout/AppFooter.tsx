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
 * `issues` ET `version` (socle 4.4.0 / 4.4.1). Le dépôt avait activé
 * `version.json` au build sans jamais poser les deux props qui s'en servent :
 * l'app affichait donc un numéro de version dans l'écran Réglages — et nulle
 * part ailleurs — et n'offrait AUCUN chemin pour signaler quoi que ce soit.
 * Zéro anomalie ouverte sur le dépôt n'était pas un bulletin de santé, c'était
 * l'absence de porte.
 *
 * Le lien « Signaler un problème » ouvre `issues/new?template=bug.yml` — le
 * gabarit hérité du dépôt `.github` du compte, vérifié en 200 — avec la
 * version, le commit, l'écran courant et le navigateur DÉJÀ REMPLIS
 * (`currentIssueReportUrl`, recalculé au clic et non au rendu : la route
 * change sans que le pied de page se rende).
 *
 * `version` porte `updates: false` À DESSEIN. `AppVersion` sonderait sinon
 * `version.json` au montage de CHAQUE écran qui affiche ce pied de page pour
 * annoncer « version disponible » — or l'app est en `registerType: 'prompt'`
 * et `SocleUpdates` tient déjà ce rôle, avec le bandeau du socle et sa
 * revérification horaire. Un second sondage n'apprendrait rien de plus à
 * l'utilisateur et ferait deux requêtes là où une suffit.
 */
export function AppFooter() {
  return (
    <div
      className="mt-8 flex flex-col items-center gap-3 border-t pt-6 pb-2 text-xs"
      style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
    >
      <SocleAppFooter
        repoUrl={repoUrl('mister-molkky')}
        issues
        version={{ prefix: 'v', updates: false }}
      />
      <p className="m-0">Mister Mölkky © {new Date().getFullYear()}</p>
    </div>
  );
}
