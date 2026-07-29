import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { countsOf, normalize } from '../src/core/letters';
import { parseDictionary, TAG_BIT } from '../src/core/dictionary';
import { DEFAULT_SETTINGS } from '../src/core/protocol';
import { buildCandidates, enumerate, scoreOf, type Settings } from '../src/core/search';

// Sichert die Ergebnis*qualität*, nicht nur die Korrektheit: dass gute Treffer
// gefunden werden und oben landen. Mit SAMPLE=1 werden die Top-Treffer
// ausgegeben — der Weg, das Ranking zu justieren:
//
//   SAMPLE=1 npx vitest run test/sample.test.ts --disable-console-intercept

const dict = parseDictionary(readFileSync(resolve(__dirname, '../public/dict.txt'), 'utf8'));
// Genau die Einstellungen, die Nutzer beim Öffnen sehen.
const BASE: Settings = DEFAULT_SETTINGS;

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
    expect(dict.words).not.toContain(junk);
  }
  // Echte kurze Wörter bleiben.
  for (const real of ['und', 'ist', 'tag', 'arm', 'uhr']) {
    expect(dict.words).toContain(real);
  }
});

// Wiktionary kategorisiert Seiten, nicht Bedeutungen: ohne Schutz landen "und",
// "machen" und "haus" in "German colloquialisms" und verschwinden, sobald jemand
// Umgangssprache abwählt. Vulgär ist bewusst ausgenommen — "scheiße" gehört
// getaggt, obwohl es häufig ist.
test('Kernwortschatz trägt kein Register außer vulgär', () => {
  const filterable = TAG_BIT.A | TAG_BIT.E | TAG_BIT.U | TAG_BIT.J;
  const tagOf = (word: string) => dict.tags[dict.words.indexOf(word)];

  // Die Wörter, an denen es zuerst weh tut: alle standen vor der Schutzregel
  // in einer Registerkategorie.
  for (const word of ['und', 'machen', 'gehen', 'haus', 'das', 'du', 'in', 'so', 'tag']) {
    expect(tagOf(word) & filterable).toBe(0);
  }

  // Die Schutzregel misst den Rang in der Quellliste, dieser Test die Position
  // in dict.txt — dazwischen liegt der Kurzwort-Filter, weshalb sich am Rand
  // ein paar Wörter verschieben. Entscheidend ist, dass es Einzelfälle bleiben.
  const tainted = dict.words.slice(0, 3000).filter((_, i) => (dict.tags[i] & filterable) !== 0);
  expect(tainted.length).toBeLessThan(10);
});

test('Abkürzungen sind vorhanden, aber standardmäßig abgewählt', () => {
  expect(DEFAULT_SETTINGS.blockedTags & TAG_BIT.A).toBeTruthy();
  const abbreviations = dict.words.filter((_, i) => (dict.tags[i] & TAG_BIT.A) !== 0);
  expect(abbreviations.length).toBeGreaterThan(1000);
});

test('17 Buchstaben bleiben unter einer Sekunde', () => {
  const started = performance.now();
  ranked('Anagramm Generator');
  expect(performance.now() - started).toBeLessThan(1000);
});
