import { TAG_BIT } from './dictionary';
import type { Settings } from './search';

/**
 * Zeitbudget einer Suche. Danach bricht sie ab und meldet `truncated`.
 * Steht hier, weil das UI den Fortschrittsbalken darauf bezieht — die Restzeit
 * bis zum Abbruch ist bei einer Tiefensuche die einzige ehrliche Fortschritts-
 * größe: wie viel vom Suchbaum noch kommt, weiß vorher niemand.
 */
export const MAX_MS = 5_000;

export interface WordInfo {
  word: string;
  rank: number;
}

export interface AnagramResult {
  words: string[];
  score: number;
}

/** Ein Pin ist eine Alternativen-Menge: eine Wortgruppe pinnen heißt "eines davon". */
export type Pin = string[];

export type WorkerRequest =
  | { type: 'load'; url: string }
  | { type: 'search'; id: number; input: string; settings: Settings; pins: Pin[] };

export type WorkerResponse =
  | { type: 'loaded'; words: number }
  | { type: 'candidates'; id: number; letters: string; words: WordInfo[] }
  | { type: 'results'; id: number; batch: AnagramResult[] }
  | { type: 'done'; id: number; total: number; truncated: boolean; ms: number }
  | { type: 'error'; message: string };

// Umgangssprache, Anglizismen, Slang und Vulgäres sind der Sinn des Tools und
// stehen an. Abkürzungen nicht: "utc", "bgb", "egmr" sind konsonantische
// Buchstabensenken, die jeden Rest aufsaugen, ohne dass ein lesbares Anagramm
// entsteht. Wer sie will, schaltet sie zu.
export const DEFAULT_SETTINGS: Settings = {
  minLen: 3,
  maxLen: 20,
  maxWords: 3,
  resolveUmlauts: true,
  blockedTags: TAG_BIT.A,
};
