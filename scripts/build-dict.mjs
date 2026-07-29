// Baut public/dict.txt aus einer Frequenzliste plus Register-Tags.
//
// Zwei Quellen mit unterschiedlichen Aufgaben:
//
//   Basis    hermitdave/FrequencyWords (OpenSubtitles 2018, MIT). Liefert
//            Häufigkeit und damit die Rangfolge fürs Ranking. Untertitel statt
//            Zeitungskorpus, dadurch von Haus aus viel gesprochene Sprache.
//
//   Register Wiktionary-Kategorien. Liefert, was die Frequenzliste nicht weiß:
//            welches Wort umgangssprachlich, Abkürzung, Anglizismus, Slang
//            oder vulgär ist. Wörter aus den Kategorien, die in der Basis
//            fehlen, kommen dazu — so gelangen "Digga" oder "cringe" überhaupt
//            erst ins Wörterbuch.
//
// Der komplette Wiktionary-Dump wäre über 1 GB. Die Kategorieabfragen holen
// nur die Mitgliederlisten und kosten ein paar hundert Kilobyte.
//
// Ausgabe: eine Zeile pro Wort, "wort" oder "wort<TAB>TAGS", absteigend nach
// Häufigkeit. Der Zeilenindex ist der Frequenzrang.

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FREQUENCY_SOURCE =
  'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_50k.txt';
const frequencyCache = resolve(root, 'data/de_50k.txt');
const categoryCache = resolve(root, 'data/categories');
const out = resolve(root, 'public/dict.txt');

// Tag-Codes, wie sie in dict.txt landen. Siehe src/core/tags.ts.
const CATEGORIES = [
  { site: 'en', name: 'German colloquialisms', tag: 'U' },
  { site: 'en', name: 'German informal terms', tag: 'U' },
  { site: 'en', name: 'German humorous terms', tag: 'U' },
  { site: 'de', name: 'Umgangssprache (Deutsch)', tag: 'U' },
  { site: 'en', name: 'German abbreviations', tag: 'A' },
  { site: 'de', name: 'Abkürzung (Deutsch)', tag: 'A' },
  { site: 'en', name: 'German terms borrowed from English', tag: 'E' },
  { site: 'en', name: 'German slang', tag: 'J' },
  { site: 'en', name: 'German internet slang', tag: 'J' },
  { site: 'en', name: 'German vulgarities', tag: 'V' },
  { site: 'en', name: 'German offensive terms', tag: 'V' },
  { site: 'en', name: 'German ethnic slurs', tag: 'V' },
  // "German derogatory terms" wäre naheliegend, ist aber zu grob: dort stehen
  // Spaß, Mensch, Hund und Stück, weil sie in irgendeiner Wendung abwertend
  // gebraucht werden. Als Filter unbrauchbar.
];

// Wiktionary kategorisiert Seiten, nicht Bedeutungen. "machen" steht in
// "German colloquialisms", weil eine Nebenbedeutung umgangssprachlich ist —
// beim Filtern richtet das mehr Schaden an, als es nützt: wer Umgangssprache
// abwählt, will nicht "und", "gehen" und "haus" verlieren. Häufige Wörter
// gelten deshalb als Kernwortschatz und bleiben ungetaggt.
//
// Ausnahme vulgär: "Vulgär abwählen" muss verlässlich greifen, sonst ist der
// Schalter wertlos. "scheiße" wird also auch auf Rang 300 getaggt.
const CORE_RANK = 3000;
const ALWAYS_TAG = new Set(['V']);

/** "DAS", "DU", "IN" sind Akronyme — kleingeschrieben nicht von echten Wörtern zu trennen. */
const isAcronym = (title) => title.length > 1 && title === title.toUpperCase();

const ALLOWED = /^[a-zäöüß]+$/;

// Untertitel-Korpora enthalten viel kurzen Müll: OCR-Fehler, Kürzel, fremde
// Eigennamen ("ece", "dci", "gao"). Echte kurze deutsche Wörter sind dagegen
// fast ausnahmslos häufig. Ein Frequenz-Deckel pro Länge trennt das; ab fünf
// Buchstaben ist Rauschen selten genug, um es durchzulassen.
const MAX_RANK_BY_LENGTH = { 2: 400, 3: 3000, 4: 10000 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wikimedia drosselt anonyme Abfragen. Zwischen den Seiten wird gewartet, und
// auf 429 wird deutlich länger zurückgezogen — die Kategorien werden einzeln
// gecacht, ein Abbruch kostet also höchstens die laufende Kategorie.
async function fetchRetry(url, attempts = 6) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'anagram-dict-builder' } });
      if (res.status === 429) throw new Error('HTTP 429');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (i >= attempts) throw err;
      const backoff = String(err.message).includes('429') ? 5000 * i : 500 * i;
      await sleep(backoff);
    }
  }
}

/** Alle Seitentitel einer Kategorie, seitenweise über die MediaWiki-API. */
async function categoryMembers(site, name) {
  const slug = `${site}-${name.replace(/[^\p{L}\d]+/gu, '_')}.json`;
  const cached = resolve(categoryCache, slug);
  if (existsSync(cached)) return JSON.parse(await readFile(cached, 'utf8'));

  const titles = [];
  let cont = '';
  do {
    const url =
      `https://${site}.wiktionary.org/w/api.php?action=query&format=json` +
      `&list=categorymembers&cmnamespace=0&cmlimit=500` +
      `&cmtitle=${encodeURIComponent(`${site === 'de' ? 'Kategorie' : 'Category'}:${name}`)}` +
      (cont ? `&cmcontinue=${encodeURIComponent(cont)}` : '');
    const data = await (await fetchRetry(url)).json();
    for (const member of data.query?.categorymembers ?? []) titles.push(member.title);
    cont = data.continue?.cmcontinue ?? '';
    if (cont) await sleep(400);
  } while (cont);

  await mkdir(categoryCache, { recursive: true });
  await writeFile(cached, JSON.stringify(titles), 'utf8');
  console.log(`  ${site}:${name} — ${titles.length}`);
  return titles;
}

if (!existsSync(frequencyCache)) {
  console.log('lade', FREQUENCY_SOURCE);
  await mkdir(dirname(frequencyCache), { recursive: true });
  await writeFile(frequencyCache, await (await fetchRetry(FREQUENCY_SOURCE)).text(), 'utf8');
}

// Basis zuerst: die Rangfolge entscheidet mit, ob ein Tag überhaupt greift.
const baseRank = new Map();
for (const line of (await readFile(frequencyCache, 'utf8')).split('\n')) {
  const word = line.split(' ')[0]?.trim().toLowerCase();
  if (!word || word.length < 2 || !ALLOWED.test(word) || baseRank.has(word)) continue;
  baseRank.set(word, baseRank.size);
}

console.log('Register-Kategorien:');
const tags = new Map();
let skippedAcronym = 0;
let skippedCore = 0;
for (const { site, name, tag } of CATEGORIES) {
  for (const title of await categoryMembers(site, name)) {
    const word = title.toLowerCase();
    if (word.length < 2 || !ALLOWED.test(word)) continue;

    const rank = baseRank.get(word);
    if (rank !== undefined && isAcronym(title)) {
      skippedAcronym += 1;
      continue;
    }
    if (rank !== undefined && rank < CORE_RANK && !ALWAYS_TAG.has(tag)) {
      skippedCore += 1;
      continue;
    }

    const existing = tags.get(word) ?? '';
    if (!existing.includes(tag)) tags.set(word, existing + tag);
  }
}
console.log(`  ${skippedAcronym} Akronym-Kollisionen, ${skippedCore} Kernwortschatz übersprungen`);

const lines = [];
for (const [word, rank] of baseRank) {
  // Getaggte Wörter sind belegt und überstehen den Rausch-Deckel.
  if (!tags.has(word) && rank + 1 > (MAX_RANK_BY_LENGTH[word.length] ?? Infinity)) continue;
  const tag = tags.get(word);
  lines.push(tag ? `${word}\t${tag}` : word);
}
const fromFrequency = lines.length;

// Was die Kategorien kennen, die Untertitel aber nicht: hinten anhängen, damit
// die Frequenzränge der Basis unberührt bleiben.
for (const word of [...tags.keys()].sort((a, b) => a.localeCompare(b, 'de'))) {
  if (baseRank.has(word)) continue;
  lines.push(`${word}\t${tags.get(word)}`);
}

await mkdir(dirname(out), { recursive: true });
await writeFile(out, lines.join('\n'), 'utf8');

const counts = {};
for (const tag of 'AEUJV') counts[tag] = lines.filter((l) => l.split('\t')[1]?.includes(tag)).length;
console.log(
  `\n${lines.length} Wörter → public/dict.txt` +
    `\n  ${fromFrequency} aus der Frequenzliste, ${lines.length - fromFrequency} nur aus Kategorien` +
    `\n  Tags: ${Object.entries(counts).map(([t, n]) => `${t}=${n}`).join('  ')}`,
);

if (!existsSync(categoryCache) || (await readdir(categoryCache)).length === 0) {
  console.warn('Warnung: keine Kategoriedaten, dict.txt enthält keine Tags.');
}
