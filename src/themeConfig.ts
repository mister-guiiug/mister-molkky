/**
 * Ce qu'il reste du thème local après l'adoption du socle.
 *
 * L'état, la persistance, l'écoute de `prefers-color-scheme`, l'écriture de
 * `data-theme` et la resynchronisation de `<meta name="theme-color">` sont
 * désormais assurées par `ThemeProvider` / `useTheme`
 * (`@mister-guiiug/dev-wpa-config`). `src/theme.ts` faisait tout cela à la
 * main — plus un jeu d'abonnés que personne n'écoutait.
 *
 * Ne subsistent que les deux valeurs que le socle ne peut pas deviner.
 */

/**
 * L'ANCIENNE CLÉ DE STOCKAGE.
 *
 * Le socle stocke sous `dwc_theme` ; Mister Mölkky stockait sous `mm_theme`.
 * Sans reprise, chaque utilisateur déjà installé perd son choix au premier
 * chargement — une seule fois, sans erreur ni trace, et il le vit comme « l'app
 * a oublié mon thème sombre ». `legacyKeys` relit l'ancienne clé puis réécrit
 * sous la neuve.
 *
 * La même liste est passée DEUX fois : au script anti-FOUC (option `themeBoot`
 * de `pwaSeoPlugin`, dans `vite.config.ts`, qui s'exécute côté Node et ne peut
 * pas importer ce module) et à `ThemeProvider`. Deux valeurs divergentes = le
 * script pose un thème que React repeint aussitôt.
 */
export const THEME_LEGACY_KEYS: string[] = ['mm_theme'];

/**
 * La couleur de la barre du navigateur, par schéma. Reprise à l'identique de
 * l'ancien `applyTheme`, qui réécrivait `content` sur la balise à la main.
 */
export const THEME_COLOR = { light: '#4a7c2a', dark: '#11140f' };
