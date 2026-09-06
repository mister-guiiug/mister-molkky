/**
 * FUSION PAR IDENTIFIANT — ce qui remplace le remplacement du blob.
 *
 * LE DÉFAUT QU'ON RETIRE. Jusqu'ici, `cloudSync` posait un `upsert` du blob
 * ENTIER : le dernier appareil à envoyer écrasait tout ce qu'un autre avait
 * écrit. Une partie notée sur le téléphone du jardin et une autre sur celui de
 * la maison, et l'une des deux disparaissait — sans erreur, sans message, et
 * sans qu'on puisse dire laquelle avant de regarder. `docs/cloud-sync.md`
 * l'annonçait en toutes lettres (« last-write-wins ») ; l'annoncer n'est pas
 * l'excuser sur une app dont le multi-appareils est l'argument.
 *
 * LA RÈGLE, EN UNE PHRASE. Union par identifiant ; à identifiant égal, le plus
 * récent gagne ; à égalité parfaite, le local est gardé — pour que fusionner
 * deux fois de suite ne réécrive rien.
 *
 * CE QUI PORTE LA RÉCENCE :
 *  - `FinishedMatch` → `finishedAt`. Une partie terminée ne change plus : deux
 *    exemplaires du même identifiant sont le même objet, la date tranche les
 *    cas tordus (import d'une sauvegarde, réécriture).
 *  - `Player` et `MatchTemplate` → `updatedAt ?? createdAt`. Ceux-là SE
 *    MODIFIENT (un joueur se renomme, change de couleur, gagne un avatar ; un
 *    modèle se renomme), et `createdAt` ne bouge pas : sans une seconde date,
 *    deux versions du même joueur sont indiscernables. `updatedAt` est donc
 *    ajouté au schéma, OPTIONNEL — un enregistrement d'avant n'en a pas, et
 *    `?? createdAt` le date exactement. C'est ce qui permet de s'en passer de
 *    migration : il n'y a rien à rétro-remplir.
 *
 * CE QUE ÇA N'APPORTE PAS, ET IL FAUT LE SAVOIR : **la suppression ne se
 * propage pas**. Une union ne peut pas distinguer « supprimé ici » de « pas
 * encore reçu là-bas » ; effacer une partie sur un appareil puis synchroniser
 * la fait revenir depuis l'autre. Le remède serait des pierres tombales
 * (`deletedAt` conservé et diffusé), c'est-à-dire un modèle de données
 * différent — et VALEUR.md écarte explicitement le CRDT complet. Entre une
 * suppression qui revient et une partie qui disparaît, le choix n'est pas
 * douteux : le second est une perte, le premier une gêne.
 *
 * CE FICHIER EST PUR. Ni réseau, ni magasin, ni React — c'est ce qui le rend
 * éprouvable au scénario près.
 */
import {
  FinishedMatchSchema,
  MatchTemplateSchema,
  PlayerSchema,
  type FinishedMatch,
  type MatchTemplate,
  type Player,
} from '../schemas';

/** Plafonds de l'app, repris tels quels pour que la fusion ne les franchisse pas. */
const MAX_HISTORY = 200;
const MAX_TEMPLATES = 50;

/** Les trois collections qui se fusionnent. Ni la partie en cours, ni les réglages. */
export interface SyncSnapshot {
  players: Player[];
  history: FinishedMatch[];
  templates: MatchTemplate[];
}

export interface MergeStats {
  /** Enregistrements que l'autre appareil avait et pas celui-ci. */
  added: number;
  /** Mêmes identifiants, exemplaire distant plus récent : remplacés. */
  updated: number;
  /** Enregistrements écartés faute de place sous le plafond de l'app. */
  dropped: number;
}

export interface MergeReport {
  players: MergeStats;
  history: MergeStats;
  templates: MergeStats;
}

export const EMPTY_SNAPSHOT: SyncSnapshot = {
  players: [],
  history: [],
  templates: [],
};

/** Un rapport où rien n'a bougé — l'état de départ des compteurs. */
function zeroStats(): MergeStats {
  return { added: 0, updated: 0, dropped: 0 };
}

/** La date qui fait foi pour un joueur ou un modèle de partie. */
export function recencyOf(record: {
  createdAt: number;
  updatedAt?: number;
}): number {
  return record.updatedAt ?? record.createdAt;
}

/**
 * Union de deux listes par identifiant.
 *
 * L'ORDRE DE SORTIE SUIT L'ORDRE LOCAL, les nouveaux venus à la fin : c'est le
 * tri de la collection (fait par l'appelant) qui décide de l'affichage, et
 * garder l'ordre local ici évite de faire sauter les lignes sous les yeux de
 * l'utilisateur quand rien n'a changé.
 */
export function mergeById<T>(
  mine: readonly T[],
  theirs: readonly T[],
  idOf: (record: T) => string,
  recency: (record: T) => number
): { merged: T[]; stats: MergeStats } {
  const stats = zeroStats();
  const byId = new Map<string, T>();
  for (const record of mine) byId.set(idOf(record), record);

  for (const record of theirs) {
    const id = idOf(record);
    const local = byId.get(id);
    if (!local) {
      byId.set(id, record);
      stats.added += 1;
      continue;
    }
    // À égalité PARFAITE on garde le local : fusionner deux fois de suite ne
    // doit rien réécrire, sinon chaque synchro produirait une écriture.
    if (recency(record) > recency(local)) {
      byId.set(id, record);
      stats.updated += 1;
    }
  }

  return { merged: Array.from(byId.values()), stats };
}

/**
 * Ce que l'autre appareil a envoyé, passé au schéma AVANT d'entrer dans
 * l'état. Le nuage n'est pas une source de confiance : la ligne appartient à
 * l'utilisateur (RLS), mais elle a pu être écrite par une version de l'app
 * plus ancienne, plus récente, ou par une main. Un enregistrement refusé est
 * ignoré — le local, lui, n'est jamais touché par ce chemin.
 */
export function readRemoteSnapshot(payload: unknown): SyncSnapshot {
  const p = (payload ?? {}) as {
    players?: unknown;
    history?: unknown;
    templates?: unknown;
  };
  const keep = <T>(
    schema: { safeParse: (x: unknown) => { success: boolean; data?: unknown } },
    value: unknown
  ): T[] => {
    if (!Array.isArray(value)) return [];
    const out: T[] = [];
    for (const item of value) {
      const parsed = schema.safeParse(item);
      if (parsed.success) out.push(parsed.data as T);
    }
    return out;
  };
  return {
    players: keep<Player>(PlayerSchema, p.players),
    history: keep<FinishedMatch>(FinishedMatchSchema, p.history),
    templates: keep<MatchTemplate>(MatchTemplateSchema, p.templates),
  };
}

/** Applique le plafond de l'app en gardant les plus récents. */
function capNewest<T>(records: T[], limit: number, stats: MergeStats): T[] {
  if (records.length <= limit) return records;
  stats.dropped = records.length - limit;
  return records.slice(0, limit);
}

/**
 * La fusion des trois collections, avec son rapport.
 *
 * Le TRI est celui de chaque écran : l'historique et les modèles du plus
 * récent au plus ancien (comme `finishMatch` et `add`), le roster du plus
 * ancien au plus récent (comme l'ajout d'un joueur, qui empile).
 */
export function mergeSnapshots(
  mine: SyncSnapshot,
  theirs: SyncSnapshot
): { merged: SyncSnapshot; report: MergeReport } {
  const players = mergeById(mine.players, theirs.players, p => p.id, recencyOf);
  const history = mergeById(
    mine.history,
    theirs.history,
    m => m.id,
    m => m.finishedAt
  );
  const templates = mergeById(
    mine.templates,
    theirs.templates,
    t => t.id,
    recencyOf
  );

  const sortedHistory = history.merged
    .slice()
    .sort((a, b) => b.finishedAt - a.finishedAt);
  const sortedTemplates = templates.merged
    .slice()
    .sort((a, b) => recencyOf(b) - recencyOf(a));
  const sortedPlayers = players.merged
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt);

  return {
    merged: {
      players: sortedPlayers,
      history: capNewest(sortedHistory, MAX_HISTORY, history.stats),
      templates: capNewest(sortedTemplates, MAX_TEMPLATES, templates.stats),
    },
    report: {
      players: players.stats,
      history: history.stats,
      templates: templates.stats,
    },
  };
}

/** `true` si la fusion a réellement apporté quelque chose. */
export function mergeChangedSomething(report: MergeReport): boolean {
  return [report.players, report.history, report.templates].some(
    s => s.added > 0 || s.updated > 0
  );
}
