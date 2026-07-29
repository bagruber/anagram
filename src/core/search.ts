// Multi-Wort-Anagramm-Suche.
//
// Grundidee: Eingabe wird zu einem Buchstaben-Multiset. Gesucht sind alle
// Kombinationen von Wörterbuch-Wörtern, deren Multisets sich exakt zur Eingabe
// summieren. Die Suche ist eine Tiefensuche, die pro Schritt ein Wort abzieht.
//
// Drei Dinge machen das schnell genug für den Browser:
//   1. Kandidatenfilter vorab — nur Wörter, die Teilmenge der Eingabe sind.
//      Von 50.000 Wörtern bleiben typisch ein paar Tausend übrig.
//   2. Bitmasken — ein Wort mit einem Buchstaben außerhalb der Restmenge wird
//      mit einer einzigen Integer-Operation verworfen.
//   3. Index-Ordnung — ein Wort darf nur an Position >= dem Vorgänger gewählt
//      werden. Verhindert, dass dieselbe Menge in jeder Reihenfolge auftaucht.

import type { Dictionary } from './dictionary';
import { A, countsOf, maskOf, normalize } from './letters';

const HAS_UMLAUT = /[äöüß]/;

export interface Settings {
  minLen: number;
  maxLen: number;
  maxWords: number;
  resolveUmlauts: boolean;
  /** Bitmaske der Register, die ausgeschlossen sind. 0 = alles erlaubt. */
  blockedTags: number;
}

export interface Candidates {
  n: number;
  words: string[];
  /** Frequenzrang aus dem Wörterbuch (0 = häufigstes Wort). */
  ranks: Int32Array;
  lens: Uint8Array;
  masks: Int32Array;
  /** Sparse Multisets: Wort i belegt entries[offsets[i] .. offsets[i+1]). */
  offsets: Int32Array;
  entryLetter: Uint8Array;
  entryCount: Uint8Array;
  /** lenStart[L] = kleinster Index, dessen Wortlänge <= L ist. */
  lenStart: Int32Array;
  /** suffixMask[i] = alle Buchstaben, die ab Index i überhaupt noch vorkommen. */
  suffixMask: Int32Array;
  /** Buchstaben-Signatur → Kandidaten mit exakt dieser Signatur. */
  bySignature: Map<string, number[]>;
}

/** Multiset als String, damit es als Map-Schlüssel taugt. */
function signature(counts: Uint8Array): string {
  return String.fromCharCode(...counts);
}

/**
 * Reduziert das Wörterbuch auf Wörter, die vollständig in `target` passen,
 * und sortiert sie nach Länge absteigend.
 *
 * Die Sortierung ist nicht kosmetisch: sie erlaubt, beim Rekursionsschritt
 * direkt zum ersten Wort zu springen, das noch in die Restlänge passt, und sie
 * sorgt dafür, dass zuerst gefundene Lösungen aus wenigen langen Wörtern
 * bestehen — also die interessanten.
 */
export function buildCandidates(
  dict: Dictionary,
  target: Uint8Array,
  settings: Settings,
): Candidates {
  const targetMask = maskOf(target);
  let targetTotal = 0;
  for (let i = 0; i < A; i++) targetTotal += target[i];

  const picked: { word: string; len: number; rank: number; counts: Uint8Array; mask: number }[] = [];

  for (let rank = 0; rank < dict.words.length; rank++) {
    // Ein Wort fliegt raus, sobald eines seiner Register abgewählt ist.
    // Wörter ohne Tags sind Standardsprache und bleiben immer.
    if ((dict.tags[rank] & settings.blockedTags) !== 0) continue;

    const word = dict.words[rank];
    // Die Längengrenzen meinen das geschriebene Wort — "Bär" ist für den
    // Nutzer drei Buchstaben lang, auch wenn intern "baer" daraus wird.
    if (word.length < settings.minLen || word.length > settings.maxLen) continue;

    // Das Wörterbuch muss dieselbe Normalisierung durchlaufen wie die Eingabe,
    // sonst kann "bär" in "baer" nie gefunden werden.
    const folded =
      settings.resolveUmlauts && HAS_UMLAUT.test(word) ? normalize(word, true) : word;
    if (folded.length > targetTotal) continue;

    const counts = countsOf(folded);
    const mask = maskOf(counts);
    if ((mask & ~targetMask) !== 0) continue;

    let fits = true;
    for (let i = 0; i < A; i++) {
      if (counts[i] > target[i]) {
        fits = false;
        break;
      }
    }
    if (fits) picked.push({ word, len: folded.length, rank, counts, mask });
  }

  picked.sort((a, b) => b.len - a.len || a.rank - b.rank);

  const n = picked.length;
  const words = new Array<string>(n);
  const ranks = new Int32Array(n);
  const lens = new Uint8Array(n);
  const masks = new Int32Array(n);
  const offsets = new Int32Array(n + 1);

  const entryLetter: number[] = [];
  const entryCount: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = picked[i];
    words[i] = p.word;
    ranks[i] = p.rank;
    lens[i] = p.len;
    masks[i] = p.mask;
    offsets[i] = entryLetter.length;
    for (let l = 0; l < A; l++) {
      if (p.counts[l] > 0) {
        entryLetter.push(l);
        entryCount.push(p.counts[l]);
      }
    }
  }
  offsets[n] = entryLetter.length;

  const lenStart = new Int32Array(targetTotal + 1);
  for (let L = 0; L <= targetTotal; L++) {
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (lens[mid] > L) lo = mid + 1;
      else hi = mid;
    }
    lenStart[L] = lo;
  }

  const suffixMask = new Int32Array(n + 1);
  for (let i = n - 1; i >= 0; i--) suffixMask[i] = suffixMask[i + 1] | masks[i];

  // Für den letzten erlaubten Zug: dort muss der Rest exakt einem Wort
  // entsprechen. Statt alle Kandidaten durchzuprobieren, wird nachgeschlagen.
  const bySignature = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const key = signature(picked[i].counts);
    const bucket = bySignature.get(key);
    if (bucket) bucket.push(i);
    else bySignature.set(key, [i]);
  }

  return {
    n,
    words,
    ranks,
    lens,
    masks,
    offsets,
    entryLetter: Uint8Array.from(entryLetter),
    entryCount: Uint8Array.from(entryCount),
    lenStart,
    suffixMask,
    bySignature,
  };
}

/**
 * Liefert jede Lösung als Liste von Kandidaten-Indizes.
 *
 * Generator statt Array, damit der Worker Treffer streamen und die Suche
 * jederzeit abbrechen kann — bei langen Eingaben ist die Ergebnismenge
 * praktisch unbegrenzt.
 */
export function* enumerate(
  c: Candidates,
  target: Uint8Array,
  maxWords: number,
  minLen: number,
  shouldStop?: () => boolean,
): Generator<number[]> {
  const rem = Uint8Array.from(target);
  let total = 0;
  for (let i = 0; i < A; i++) total += rem[i];

  const stack: number[] = [];
  const maxLen = c.n > 0 ? c.lens[0] : 0;

  // Der Abbruch muss unabhängig davon greifen, ob gerade Treffer entstehen:
  // eine Suche kann minutenlang laufen und dabei nichts liefern, und dann
  // bekäme der Aufrufer nie die Kontrolle zurück.
  let ticks = 0;
  let stopped = false;

  function* step(start: number, remaining: number): Generator<number[]> {
    if (stopped) return;
    if (remaining === 0) {
      yield stack.slice();
      return;
    }
    if (stack.length >= maxWords) return;
    // Ein Rest kleiner als das kürzeste erlaubte Wort ist nicht mehr aufzulösen.
    if (remaining < minLen) return;
    // Selbst mit lauter Maximalwörtern reicht das verbleibende Wortbudget nicht.
    if (remaining > (maxWords - stack.length) * maxLen) return;

    // Beim letzten erlaubten Wort muss der Rest exakt ein Kandidat sein.
    // Nachschlagen statt scannen — das ist der Unterschied zwischen Sekunden
    // und Minuten, weil diese Ebene die mit Abstand meisten Knoten hat.
    if (stack.length === maxWords - 1) {
      for (const i of c.bySignature.get(signature(rem)) ?? []) {
        if (i < start) continue;
        stack.push(i);
        yield stack.slice();
        stack.pop();
      }
      return;
    }

    const remMask = maskOf(rem);
    let i = Math.max(start, c.lenStart[remaining]);
    // Ein Buchstabe, den kein Wort ab hier mehr enthält, macht den Zweig tot.
    if ((remMask & ~c.suffixMask[i]) !== 0) return;

    for (; i < c.n; i++) {
      if ((++ticks & 0xfff) === 0 && shouldStop?.()) {
        stopped = true;
        return;
      }
      if ((c.masks[i] & ~remMask) !== 0) continue;

      const from = c.offsets[i];
      const to = c.offsets[i + 1];
      let fits = true;
      for (let p = from; p < to; p++) {
        if (c.entryCount[p] > rem[c.entryLetter[p]]) {
          fits = false;
          break;
        }
      }
      if (!fits) continue;

      for (let p = from; p < to; p++) rem[c.entryLetter[p]] -= c.entryCount[p];
      stack.push(i);
      // Wieder ab i, nicht i+1: Wiederholungen sind erlaubt ("die die"),
      // Permutationen derselben Menge nicht.
      yield* step(i, remaining - c.lens[i]);
      stack.pop();
      for (let p = from; p < to; p++) rem[c.entryLetter[p]] += c.entryCount[p];
      if (stopped) return;
    }
  }

  yield* step(0, total);
}

// Jenseits dieses Rangs sagt Seltenheit nichts mehr über Witz aus — dort
// stehen Fachbegriffe und Kürzel. Ohne Deckel gewinnen drei obskure
// Dreibuchstabler gegen ein gutes langes Wort.
const RARITY_CAP = 20_000;

/**
 * Höher ist besser.
 *
 * Die Summe der quadrierten Wortlängen erledigt die Hauptarbeit von allein:
 * Bei konstanter Gesamtlänge wird sie maximal, wenn die Buchstaben auf wenige
 * lange Wörter fallen. Zwei lange Wörter schlagen also automatisch sechs kurze.
 * Der Rang-Term gibt seltenen Wörtern einen milden Bonus — "Zwergpudel" ist
 * lustiger als "und".
 */
export function scoreOf(words: readonly string[], ranks: readonly number[]): number {
  let score = 0;
  for (const w of words) score += w.length * w.length;
  for (const r of ranks) score += 0.8 * Math.log10(Math.min(r, RARITY_CAP) + 10);
  return score;
}

/** Zieht die Buchstaben eines Wortes ab; `null`, wenn sie nicht vorhanden sind. */
export function subtract(
  target: Uint8Array,
  word: string,
  resolveUmlauts: boolean,
): Uint8Array | null {
  const rest = Uint8Array.from(target);
  const counts = countsOf(normalize(word, resolveUmlauts));
  for (let i = 0; i < A; i++) {
    if (counts[i] > rest[i]) return null;
    rest[i] -= counts[i];
  }
  return rest;
}
