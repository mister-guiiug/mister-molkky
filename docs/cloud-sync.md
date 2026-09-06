# Synchronisation cloud (multi-appareils)

L'interrupteur **Sync cloud** de l'écran **Paramètres** réunit, sur tous les
appareils du même utilisateur, ses **joueurs**, ses **parties terminées** et ses
**modèles de partie**. Une ligne Supabase par utilisateur, un blob JSON,
deux boutons manuels — et, depuis la fusion par identifiant, **plus aucune
donnée écrasée**.

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

## Cohabitation avec les versions antérieures

Le format de la ligne **ne change pas** (`v: 1`). Les enregistrements portent un
`updatedAt` de plus, que les versions antérieures ignorent : un appareil resté
sur l'ancienne version continue de lire ce blob. **Il continue aussi de
l'écraser en entier quand il envoie** — la fusion ne protège une donnée que si
les deux appareils ont la version qui fusionne.

## Mise en service dans votre projet Supabase

1. Appliquer la migration SQL ci-dessous (une fois, dans l'éditeur SQL).
2. Activer **Anonymous sign-ins** dans **Authentication → Providers**.

### Migration SQL

```sql
-- Une ligne par utilisateur authentifié, avec le blob JSON de ses données.
create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

-- Chacun ne voit et ne modifie que sa propre ligne.
create policy "user_data_select_own"
  on public.user_data for select
  using (auth.uid() = user_id);

create policy "user_data_insert_own"
  on public.user_data for insert
  with check (auth.uid() = user_id);

create policy "user_data_update_own"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

## Comment l'utilisateur y entre

Paramètres → interrupteur **Sync cloud (multi-appareils)** → l'app appelle
`signInAnonymously()` au premier envoi. L'identité anonyme persiste dans le
navigateur via le jeton de session Supabase (`localStorage`), donc les visites
suivantes reprennent la même identité automatiquement.

Si l'utilisateur vide les données de son navigateur, l'identité anonyme est
perdue — c'est voulu, aucun parcours « supprimer mon compte » n'est nécessaire.

## Limites qui restent

- **Pas de miroir temps réel.** L'utilisateur appuie sur « Envoyer » /
  « Récupérer » quand il le décide. La synchro automatique à chaque
  enregistrement n'est volontairement pas implémentée.
- **La récupération de compte demande le jeton de session anonyme.** Le perdre
  équivaut à perdre les données côté nuage ; il n'y a pas (encore) de passage
  vers un compte e-mail / mot de passe.
- **La suppression ne se propage pas** (voir plus haut).
