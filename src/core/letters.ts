// Normalisierung und Buchstaben-Multisets.

export const ALPHABET = 'abcdefghijklmnopqrstuvwxyzäöüß';
export const A = ALPHABET.length;

// charCode → Alphabet-Index. ä=228, ö=246, ü=252, ß=223 liegen alle unter 384.
const INDEX = new Int8Array(384).fill(-1);
for (let i = 0; i < A; i++) INDEX[ALPHABET.charCodeAt(i)] = i;

export function letterIndex(code: number): number {
  return code < 384 ? INDEX[code] : -1;
}

const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

const UMLAUTS = [
  ['ä', 'ae'],
  ['ö', 'oe'],
  ['ü', 'ue'],
  ['ß', 'ss'],
] as const;

/**
 * Whitespace, Interpunktion und Groß-/Kleinschreibung fallen weg.
 *
 * `resolveUmlauts` ist mengentheoretisch eine Obermenge: löst man auf beiden
 * Seiten auf, bleibt jeder Treffer des strikten Modus erhalten, und Inputs ohne
 * Umlaute können zusätzlich Umlautwörter bilden.
 */
export function normalize(input: string, resolveUmlauts: boolean): string {
  let s = input.normalize('NFC').toLowerCase();

  if (resolveUmlauts) {
    for (const [from, to] of UMLAUTS) s = s.replaceAll(from, to);
  } else {
    // NFD würde ä in a + Trema zerlegen; vorher auf Sentinels ausweichen.
    UMLAUTS.forEach(([from], i) => (s = s.replaceAll(from, String.fromCharCode(1 + i))));
  }

  // Fremdsprachige Diakritika glätten (café → cafe).
  s = s.normalize('NFD').replace(COMBINING_MARKS, '');

  if (!resolveUmlauts) {
    UMLAUTS.forEach(([from], i) => (s = s.replaceAll(String.fromCharCode(1 + i), from)));
  }

  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (letterIndex(s.charCodeAt(i)) >= 0) out += s[i];
  }
  return out;
}

export function countsOf(word: string): Uint8Array {
  const counts = new Uint8Array(A);
  for (let i = 0; i < word.length; i++) {
    const idx = letterIndex(word.charCodeAt(i));
    if (idx >= 0) counts[idx]++;
  }
  return counts;
}

/** Ein Bit pro vorkommendem Buchstaben — erlaubt Teilmengen-Vorfilter in einer Operation. */
export function maskOf(counts: Uint8Array): number {
  let mask = 0;
  for (let i = 0; i < A; i++) if (counts[i] > 0) mask |= 1 << i;
  return mask;
}
