import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { countsOf, normalize } from '../src/core/letters';
import { buildCandidates, enumerate, scoreOf, type Settings } from '../src/core/search';

// Sichert die Ergebnis*qualität*, nicht nur die Korrektheit: dass gute Treffer
// gefunden werden und oben landen. Mit SAMPLE=1 werden die Top-Treffer
// ausgegeben — der Weg, das Ranking zu justieren:
//
//   SAMPLE=1 npx vitest run test/sample.test.ts --disable-console-intercept

const dict = readFileSync(resolve(__dirname, '../public/dict.txt'), 'utf8').split('\n').filter(Boolean);
const BASE: Settings = { minLen: 3, maxLen: 20, maxWords: 3, resolveUmlauts: true };

function ranked(input: string, settings: Settings = BASE) {
  const started = performance.now();
  const target = countsOf(normalize(input, settings.resolveUmlauts));
  const candidates = buildCandidates(dict, target, settings);

  const found: { words: string[]; score: number }[] = [];
  for (const indices of enumerate(candidates, target, settings.maxWords, settings.minLen)) {
    const words = indices.map((i) => candidates.words[i]);
    found.push({ words, score: scoreOf(words, indices.map((i) => candidates.ranks[i])) });
  }
  found.sort((a, b) => b.score - a.score);

  if (process.env.SAMPLE) {
    const ms = Math.round(performance.now() - started);
    console.log(`\n"${input}" · ${candidates.n} Kandidaten · ${found.length} Treffer · ${ms} ms`);
    for (const r of found.slice(0, 12)) console.log('   ' + r.words.join(' · '));
  }
  return found.map((r) => [...r.words].sort().join(' '));
}

test('gute Zwei-Wort-Treffer landen ganz oben', () => {
  expect(ranked('Anagramm Generator').slice(0, 3)).toContain('anagramm generator');
  expect(ranked('Benedict Gruber').slice(0, 3)).toContain('benedict gruber');
});

test('kurze Müllwörter sind aus dem Wörterbuch gefiltert', () => {
  for (const junk of ['ece', 'dci', 'bic', 'rde', 'gao']) {
    expect(dict).not.toContain(junk);
  }
  // Echte kurze Wörter bleiben.
  for (const real of ['und', 'ist', 'tag', 'arm', 'uhr']) {
    expect(dict).toContain(real);
  }
});

test('17 Buchstaben bleiben unter einer Sekunde', () => {
  const started = performance.now();
  ranked('Anagramm Generator');
  expect(performance.now() - started).toBeLessThan(1000);
});
