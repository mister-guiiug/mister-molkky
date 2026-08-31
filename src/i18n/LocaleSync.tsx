import { useEffect, type ReactNode } from 'react';
import { useI18n } from './index';
import { useSettingsStore } from '../store/useSettingsStore';

/**
 * Tient la langue affichée et la langue SYNCHRONISÉE d'accord.
 *
 * POURQUOI CE PONT EXISTE. Chez Mölkky, la langue n'est pas qu'un réglage
 * d'affichage : c'est un champ de `mm_settings`, et `cloudSync` la pousse et la
 * tire avec les joueurs, l'historique et les modèles. Deux chemins la changent
 * donc, et un seul passe par l'utilisateur :
 *
 *  - l'écran Réglages appelle `setLocale` du socle (choix explicite) ;
 *  - `pullNow()` écrit `useSettingsStore.setState({ locale })` depuis le nuage,
 *    hors de tout composant.
 *
 * Sans ce pont, le second chemin deviendrait muet : le socle tient sa propre
 * locale dans un `useState`, que rien n'irait relire. Tirer une sauvegarde
 * faite en anglais laisserait l'écran en français, et le prochain `push`
 * renverrait la valeur périmée.
 *
 * PAS DE VA-ET-VIENT. Chaque sens ne s'exécute que sur une DIFFÉRENCE réelle,
 * et l'abonnement impératif (`subscribe`) ne se déclenche que sur un
 * changement du magasin — jamais au montage. Au montage les deux valeurs sont
 * déjà égales : `adoptStoredLocale()` a recopié le champ du blob sous
 * `mm_locale` avant que le provider ne le lise.
 */
export function LocaleSync({ children }: { children: ReactNode }) {
  const { locale, setLocale } = useI18n();

  // Nuage (ou `reset()`) → écran.
  useEffect(
    () =>
      useSettingsStore.subscribe(s => {
        if (s.locale !== locale) setLocale(s.locale);
      }),
    [locale, setLocale]
  );

  // Choix de l'utilisateur → charge utile synchronisée.
  useEffect(() => {
    const settings = useSettingsStore.getState();
    if (settings.locale !== locale) settings.setLocale(locale);
  }, [locale]);

  return children;
}
