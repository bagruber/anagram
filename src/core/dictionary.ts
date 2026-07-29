// Register-Tags und das Wörterbuchformat.
//
// dict.txt hat eine Zeile pro Wort, entweder "wort" oder "wort<TAB>TAGS",
// absteigend nach Häufigkeit. Ein Wort ohne Tags gilt als Standardsprache und
// ist immer erlaubt.

export const TAG_CODES = ['A', 'E', 'U', 'J', 'V'] as const;
export type TagCode = (typeof TAG_CODES)[number];

export const TAG_BIT: Record<TagCode, number> = { A: 1, E: 2, U: 4, J: 8, V: 16 };

export const TAG_LABEL: Record<TagCode, string> = {
  A: 'Abkürzungen',
  E: 'Anglizismen',
  U: 'Umgangssprache',
  J: 'Jugend- & Netzsprache',
  V: 'Vulgär & derb',
};

export interface Dictionary {
  words: string[];
  /** Tag-Bitmaske pro Wort, gleiche Reihenfolge wie `words`. */
  tags: Uint8Array;
}

export function parseDictionary(text: string): Dictionary {
  const lines = text.split('\n');
  const words: string[] = [];
  const tags = new Uint8Array(lines.length);

  for (const line of lines) {
    if (!line) continue;
    const tab = line.indexOf('\t');
    if (tab < 0) {
      words.push(line);
      continue;
    }
    let mask = 0;
    for (let i = tab + 1; i < line.length; i++) {
      mask |= TAG_BIT[line[i] as TagCode] ?? 0;
    }
    tags[words.length] = mask;
    words.push(line.slice(0, tab));
  }

  return { words, tags: tags.subarray(0, words.length) };
}

/** Für Tests und kleine Wortlisten ohne Register. */
export function untagged(words: string[]): Dictionary {
  return { words, tags: new Uint8Array(words.length) };
}
