import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { countsOf, normalize } from '../src/core/letters';
import { parseDictionary, TAG_BIT, untagged, type Dictionary } from '../src/core/dictionary';
import { buildCandidates, enumerate, type Settings } from '../src/core/search';

const BASE: Settings = {
  minLen: 3,
  maxLen: 20,
  maxWords: 3,
  resolveUmlauts: true,
  blockedTags: 0,
};

function solve(dict: string[] | Dictionary, input: string, settings: Settings = BASE): string[][] {
  const letters = normalize(input, settings.resolveUmlauts);
  const target = countsOf(letters);
  const candidates = buildCandidates(Array.isArray(dict) ? untagged(dict) : dict, target, settings);
  const out: string[][] = [];
  for (const indices of enumerate(candidates, target, settings.maxWords, settings.minLen)) {
    out.push(indices.map((i) => candidates.words[i]));
  }
  return out;
}

const sortedLetters = (s: string) => [...s].sort().join('');

test('findet einfache Anagramme', () => {
  const found = solve(['lager', 'regal', 'grale', 'tor', 'ort'], 'Regal');
  const flat = found.map((w) => w.join(' ')).sort();
  expect(flat).toEqual(['grale', 'lager', 'regal']);
});

test('mehrere Wörter werden kombiniert', () => {
  const found = solve(['tor', 'rot', 'nase'], 'Torhase', { ...BASE, minLen: 3 });
  // "tor" + "hase" existiert nicht im Mini-Wörterbuch, "rot" + ... auch nicht.
  expect(found).toEqual([]);

  const combined = solve(['tor', 'nase'], 'Nase Tor');
  expect(combined.map((w) => [...w].sort().join(' '))).toEqual(['nase tor']);
});

test('keine Permutations-Duplikate', () => {
  const found = solve(['abc', 'def'], 'abcdef');
  expect(found).toHaveLength(1);
});

test('Wiederholungen desselben Wortes sind erlaubt', () => {
  const found = solve(['die'], 'diedie');
  expect(found).toEqual([['die', 'die']]);
});

test('maxWords wird eingehalten', () => {
  const dict = ['tor', 'nase', 'rat'];
  expect(solve(dict, 'Nase Tor', { ...BASE, maxWords: 1 })).toEqual([]);
  expect(solve(dict, 'Nase Tor', { ...BASE, maxWords: 2 })).toHaveLength(1);
});

test('minLen und maxLen filtern Kandidaten', () => {
  const dict = ['ab', 'cd', 'abcd'];
  expect(solve(dict, 'abcd', { ...BASE, minLen: 2, maxWords: 2 })).toHaveLength(2);
  expect(solve(dict, 'abcd', { ...BASE, minLen: 3, maxWords: 2 })).toEqual([['abcd']]);
  expect(solve(dict, 'abcd', { ...BASE, minLen: 2, maxLen: 3, maxWords: 2 })).toEqual([['ab', 'cd']]);
});

// Die zentrale Invariante: ein Anagramm verbraucht exakt die Buchstaben der
// Eingabe — keinen zu viel, keinen zu wenig.
test.each([true, false])('jedes Ergebnis ist buchstabengleich zur Eingabe (resolveUmlauts=%s)', (resolveUmlauts) => {
  const dict = parseDictionary(readFileSync(resolve(__dirname, '../public/dict.txt'), 'utf8'));
  const input = 'Benedict Gruber';
  const letters = normalize(input, resolveUmlauts);

  const found = solve(dict, input, { ...BASE, maxWords: 3, resolveUmlauts });
  expect(found.length).toBeGreaterThan(0);

  for (const words of found) {
    // Im aufgelösten Modus kostet ein "ü" zwei Buchstaben — die Ergebnisseite
    // muss dieselbe Normalisierung durchlaufen wie die Eingabe.
    const spent = words.map((w) => normalize(w, resolveUmlauts)).join('');
    expect(sortedLetters(spent)).toBe(sortedLetters(letters));
  }

  const keys = found.map((w) => [...w].sort().join(' '));
  expect(new Set(keys).size).toBe(keys.length);
});

test('Register-Format wird korrekt geparst', () => {
  const dict = parseDictionary('haus\nkacke\tV\ncringe\tEJ\n');
  expect(dict.words).toEqual(['haus', 'kacke', 'cringe']);
  expect([...dict.tags]).toEqual([0, TAG_BIT.V, TAG_BIT.E | TAG_BIT.J]);
});

test('abgewählte Register verschwinden aus den Kandidaten', () => {
  const dict = parseDictionary('rat\ntar\tV\n');
  expect(solve(dict, 'rat').flat().sort()).toEqual(['rat', 'tar']);
  expect(solve(dict, 'rat', { ...BASE, blockedTags: TAG_BIT.V }).flat()).toEqual(['rat']);
});

test('Standardsprache bleibt, egal was blockiert ist', () => {
  const dict = parseDictionary('rat\ntar\tV\n');
  const allBlocked = TAG_BIT.A | TAG_BIT.E | TAG_BIT.U | TAG_BIT.J | TAG_BIT.V;
  expect(solve(dict, 'rat', { ...BASE, blockedTags: allBlocked }).flat()).toEqual(['rat']);
});

test('das gebaute Wörterbuch trägt die erwarteten Register', () => {
  const dict = parseDictionary(readFileSync(resolve(__dirname, '../public/dict.txt'), 'utf8'));
  const tagOf = (word: string) => dict.tags[dict.words.indexOf(word)];

  expect(dict.words).toContain('digga');
  expect(tagOf('digga') & TAG_BIT.J).toBeTruthy();
  expect(tagOf('cringe') & TAG_BIT.E).toBeTruthy();
  expect(tagOf('fotze') & TAG_BIT.V).toBeTruthy();
  // Alltagswörter dürfen kein Register tragen, sonst filtert man sie versehentlich weg.
  expect(tagOf('haus')).toBe(0);
});

test('strikter Modus liefert eine Teilmenge des aufgelösten Modus', () => {
  const dict = ['bär', 'bare', 'aber', 'erbe'];
  const strict = solve(dict, 'Bär', { ...BASE, resolveUmlauts: false }).flat();
  const resolved = solve(dict, 'Bär', { ...BASE, resolveUmlauts: true }).flat();
  expect(strict).toEqual(['bär']);
  expect(resolved).toContain('bär');
  expect(resolved.length).toBeGreaterThanOrEqual(strict.length);
});
