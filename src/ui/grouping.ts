import type { WordInfo } from '../core/protocol';

export interface WordGroup {
  stem: string;
  words: WordInfo[];
}

const MIN_STEM = 4;
const MAX_SUFFIX = 3;

/**
 * Fasst Flexionsformen zusammen: jung / junge / junger / jungen.
 *
 * Heuristik über gemeinsame Präfixe, keine echte Lemmatisierung — dafür bräuchte
 * es die Wiktionary-Daten aus Milestone 2. Trifft die häufigen deutschen
 * Endungen (-e, -er, -en, -es, -em) zuverlässig und liegt bei zusammengesetzten
 * Wörtern gelegentlich daneben.
 */
export function groupWords(words: readonly WordInfo[]): WordGroup[] {
  const sorted = [...words].sort((a, b) => a.word.localeCompare(b.word, 'de'));
  const groups: WordGroup[] = [];

  for (const info of sorted) {
    const current = groups[groups.length - 1];
    const fits =
      current &&
      current.stem.length >= MIN_STEM &&
      info.word.startsWith(current.stem) &&
      info.word.length - current.stem.length <= MAX_SUFFIX;

    if (fits) current.words.push(info);
    else groups.push({ stem: info.word, words: [info] });
  }

  // Lange und seltene Wörter zuerst — das sind die, aus denen gute Anagramme werden.
  return groups.sort((a, b) => {
    const aBest = Math.max(...a.words.map((w) => w.word.length));
    const bBest = Math.max(...b.words.map((w) => w.word.length));
    return bBest - aBest || a.words[0].rank - b.words[0].rank;
  });
}
