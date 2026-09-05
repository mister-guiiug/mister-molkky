import { useEffect, type ReactNode } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { AppUpdates } from '@mister-guiiug/dev-pwa-config/react/app-updates';
import { unregisterServiceWorkers } from '@mister-guiiug/dev-pwa-config/sw-update';

/**
 * Enregistrement du service worker et bandeau « Mise à jour disponible ».
 *
 * REMPLACE `src/register-sw.ts`, dont l'en-tête a servi de source au module
 * `sw-update` du socle : c'est molkky qui a documenté noir sur blanc que
 * `updateSW(true)` de vite-plugin-pwa ne fait RIEN quand aucun worker
 * n'attend — « leaving the user staring at a button that does nothing ». Le
 * socle a repris ce constat et l'a corrigé : l'absence de worker en attente
 * bascule sur la purge au lieu de retourner en silence.
 *
 * DEUX CHOSES QUE LE BANDEAU MAISON NE SAVAIT PAS FAIRE :
 *
 * 1. **Il parlait français à tout le monde.** Il était construit en DOM brut
 *    avant React (`document.createElement`), donc hors de tout contexte i18n,
 *    avec « Une nouvelle version est disponible. » codé en dur. Rendu ici sous
 *    `SocleLabels`, il suit la langue de l'app — le socle livre `fr` et `en`,
 *    exactement les deux locales de Mölkky.
 * 2. **Il n'offrait aucune sortie.** Un seul bouton, « Mettre à jour » : qui ne
 *    voulait pas recharger tout de suite n'avait qu'à vivre avec. Le bandeau du
 *    socle rend toujours un second bouton (« Plus tard »).
 *
 * `checkEvery` EST UN AJOUT, et il compte ici : l'app est en
 * `registerType: 'prompt'` (vite.config.ts), donc le bandeau EST son seul
 * mécanisme de mise à jour. Sans revérification périodique, une PWA installée
 * laissée ouverte plusieurs jours ne découvrait une nouvelle version qu'au
 * prochain démarrage à froid — le bandeau n'apparaissait alors jamais.
 *
 * LA GARDE DE DÉVELOPPEMENT RESTE ICI, pas dans le paquet : `sw-update` est
 * aussi consommé par `node --test`, il ne peut pas lire `import.meta.env`.
 * Sans elle, un worker resté d'une session précédente sert du cache périmé
 * pendant qu'on code, et se bat contre le HMR.
 */
export function SocleUpdates({ children }: { children: ReactNode }) {
  const dev = import.meta.env.DEV;

  useEffect(() => {
    if (!dev) return;
    // Le compte rendu est ignoré volontairement : l'absence de service worker
    // vaut zéro, pas un incident (la fonction ne rejette jamais).
    void unregisterServiceWorkers();
  }, [dev]);

  return (
    <AppUpdates registerSW={dev ? undefined : registerSW} checkEvery="1h">
      {children}
    </AppUpdates>
  );
}
