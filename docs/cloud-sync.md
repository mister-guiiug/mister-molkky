# Synchronisation cloud (multi-appareils)

L'interrupteur **Sync cloud** de l'écran **Paramètres** réunit, sur tous les
appareils du même utilisateur, ses **joueurs**, ses **parties terminées** et ses
**modèles de partie**. Une **clé de synchro** partagée par QR, une ligne
Supabase par clé, un blob JSON, deux boutons manuels — et, depuis la fusion par
identifiant et l'écriture conditionnelle, **plus aucune donnée écrasée**.

> **Avant le 30/09/2026, cette fonction n'a jamais marché.** Elle reposait sur
> la connexion anonyme de Supabase et une table `user_data` indexée par
> `auth.uid()`. Relevé du 29/09 : la table n'existait pas sur le projet, et la
> connexion anonyme y était coupée. Les rétablir n'aurait rien réuni : une
> identité anonyme vit dans **un** navigateur, chaque appareil aurait eu la
> sienne — et le client ne gardait même pas sa session
> (`persistSession: false`), si bien que chaque lancement en créait une neuve.
> D'où la clé : c'est elle, et non un compte, qui désigne les données.

## La règle, en une phrase

**Union par identifiant ; à identifiant égal, le plus récent gagne ; à égalité
parfaite, l'exemplaire local est conservé.**

Elle vit dans `src/sync/merge.ts`, une fonction pure, éprouvée scénario par
scénario dans `src/sync/merge.test.ts` et de bout en bout dans
`src/store/useSyncStore.test.ts`.

### Ce que « le plus récent » veut dire

| Enregistrement  | Date qui fait foi        | Pourquoi                                                                   |
| --------------- | ------------------------ | -------------------------------------------------------------------------- |
| `FinishedMatch` | `finishedAt`             | une partie terminée ne change plus ; deux exemplaires sont le même objet   |
| `Player`        | `updatedAt ?? createdAt` | un joueur se renomme, change de couleur, gagne un avatar — `createdAt` non |
| `MatchTemplate` | `updatedAt ?? createdAt` | un modèle se renomme                                                       |

`updatedAt` est **optionnel** dans le schéma : un enregistrement écrit avant son
introduction n'en a pas, et `?? createdAt` le date exactement — il n'a jamais
été modifié. C'est ce qui permet de l'ajouter **sans migration**.

## Ce que font les deux boutons

| Bouton        | Lit le nuage | Fusionne | Écrit le nuage | Réglages                     |
| ------------- | ------------ | -------- | -------------- | ---------------------------- |
| **Envoyer**   | oui          | oui      | oui            | ceux de cet appareil montent |
| **Récupérer** | oui          | oui      | non            | ceux du nuage descendent     |

**« Envoyer » commence par lire.** Le geste s'appelle toujours envoyer, mais il
ne remplace plus : la ligne est tirée, l'union calculée, puis écrite des deux
côtés. Si la **lecture** échoue, **rien n'est écrit** — envoyer à l'aveugle
après un échec de lecture, ce serait exactement l'écrasement qu'on vient de
retirer.

**Et l'écriture est conditionnelle.** L'envoi porte la **version** lue juste
avant la fusion ; si un autre appareil a écrit entre-temps, la base refuse
(`40001`) sans rien écrire, et l'app recommence : lecture, fusion, envoi. Sans
ce contrôle, deux téléphones qui envoient au même moment perdaient l'union de
l'un des deux. Après trois refus de suite, l'app renonce et affiche l'erreur
plutôt que d'écraser.

## Ce qui ne se fusionne pas, et pourquoi

- **La partie EN COURS** (`CurrentMatchState`) reste sur son appareil, et n'est
  pas dans la charge utile. Deux appareils qui notent des lancers dans la même
  partie produisent deux suites dont aucune règle ne sait faire une seule ;
  l'envoyer réintroduirait l'écrasement sur la donnée la plus vivante de l'app.
  **L'écran le dit** après chaque synchro, au lieu de le taire.
- **Les réglages** (sons, vibrations, langue, plein écran…) sont des
  préférences d'appareil, pas des enregistrements. Ils suivent le **sens du
  geste** — dernier écrivain gagnant — et l'écran Paramètres l'affiche sous les
  deux boutons.
- **Les avatars et les photos de situation** vivent dans IndexedDB et ne
  quittent pas l'appareil : le blob JSON ne porte que la clé
  (`avatarBlobKey`). Un joueur synchronisé sur un second appareil y arrive donc
  sans sa photo.

## Ce que ça n'apporte pas : la suppression ne se propage pas

Une union ne peut pas distinguer « supprimé ici » de « pas encore reçu
là-bas ». **Effacer une partie sur un appareil puis synchroniser la fait
revenir depuis l'autre.**

Le remède serait des pierres tombales (`deletedAt` conservé et diffusé),
c'est-à-dire un modèle de données différent. C'est assumé : entre une
suppression qui revient et une partie qui disparaît, le second est une perte,
le premier une gêne.

Et la gêne est bornée du bon côté : sur l'écran **Historique**, supprimer une
partie ne demande plus de confirmation — la suppression a lieu, et une
notification propose de la **défaire pendant huit secondes**
(`src/react/views/HistoryView.tsx`, éprouvé dans
`HistoryView.undo.test.tsx`). « Tout effacer », lui, garde sa question _et_
gagne l'annulation : le geste emporte jusqu'à deux cents parties.

## Plafonds

La fusion respecte les plafonds de l'app : **200 parties** et **50 modèles**,
les plus récents gardés. Au-delà, le compte d'enregistrements écartés remonte
dans le rapport de fusion.

## Le format du blob

Le format de la ligne est `v: 1`. Les enregistrements peuvent porter un
`updatedAt`, que la fusion lit (voir plus haut). Les versions de l'app d'avant
la clé n'ont jamais pu envoyer quoi que ce soit : aucun blob ancien n'existe,
et aucune n'écrit dans celui-ci.

## Comment l'utilisateur y entre

Paramètres → interrupteur **Sync cloud (multi-appareils)**, puis :

1. **Sur le premier appareil, « Créer une clé ».** Elle est tirée sur place :
   28 caractères de l'alphabet de Crockford (140 bits), par le module
   `/pairing` du socle. Rien ne part tant qu'on n'envoie pas.
2. **« Montrer la clé »** l'affiche en entier et en QR (`molkky:sync?key=…`),
   avec l'avertissement : qui a la clé lit et remplace les données. Masquée le
   reste du temps (`ABCD-…-WXYZ`).
3. **Sur chaque autre appareil, « Scanner une clé »**, ou la saisir : groupée
   par quatre ou non, en minuscules, avec les confusions I/L → 1 et O → 0 —
   mais ni URL, ni phrase, qui retomberaient par hasard sur une clé
   prévisible.
4. Puis **« Envoyer »** sur chacun : la fusion fait le reste.

La clé est gardée dans le navigateur de l'appareil (`mm_sync`, avec
l'interrupteur et la date du dernier échange).

Deux gestes pour en sortir, chacun avec sa confirmation :

- **« Oublier la clé ici »** : l'appareil ne synchronise plus ; le blob reste
  dans le cloud, pour les autres appareils.
- **« Effacer du cloud »** : le blob est effacé, puis la clé oubliée ici. Les
  données de chaque appareil restent. Un autre appareil qui a encore la clé
  recréera le blob à son prochain envoi : l'écran le dit.

## Mise en service dans votre projet Supabase

Appliquer les migrations de [`supabase/migrations/`](../supabase/migrations),
dont `0004_user_data_par_cle.sql` — voir
[`supabase/README.md`](../supabase/README.md). **Aucun réglage du tableau de
bord** : ni connexion anonyme, ni fournisseur d'identité.

Ce que la base garantit, éprouvé par pgTAP en CI
([`supabase/tests/user_data.test.sql`](../supabase/tests/user_data.test.sql)) :

- ni `anon` ni `authenticated` n'ont d'accès direct à `user_data` ; trois
  fonctions `security definer` (`sync_pull`, `sync_push`, `sync_delete`) sont
  la seule porte, et chacune exige une clé bien formée ;
- une clé ne lit, n'écrit et n'efface que **son** blob ; la base n'en garde que
  le haché (SHA-256) ;
- un envoi fondé sur une version périmée est refusé sans rien écraser ;
- un blob sans envoi ni récupération depuis un an est introuvable, puis effacé
  au premier échange suivant, de n'importe quelle clé ; une clé qui revient
  repart d'un blob neuf, sans conflit.

## Limites qui restent

- **Pas de miroir temps réel.** L'utilisateur appuie sur « Envoyer » /
  « Récupérer » quand il le décide. La synchro automatique à chaque
  enregistrement n'est volontairement pas implémentée.
- **La clé est le seul verrou.** Qui la détient lit et remplace les données
  synchronisées, noms des joueurs compris. Elle ne quitte l'appareil que par le
  QR ou la copie qu'on choisit d'afficher.
- **Perdre la clé partout, c'est perdre l'accès au blob** — et donc aussi le
  moyen de l'effacer. Il n'y a pas de récupération : aucun compte ne la
  double. Le blob s'efface alors de lui-même, un an après le dernier échange.
- **Un an sans envoi ni récupération, et le cloud efface le blob** (choix du
  30/09/2026). Rien n'est perdu : le cloud n'est qu'un relais, chaque appareil
  garde ses propres données, et le prochain « Envoyer » recrée le blob.
  L'écran le dit sous l'interrupteur, avant même la première clé.
- **La suppression d'une partie ne se propage pas** (voir plus haut).
