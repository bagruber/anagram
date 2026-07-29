// Baut public/dict.txt aus einer Frequenzliste.
//
// Quelle: hermitdave/FrequencyWords (OpenSubtitles 2018, MIT).
// Untertitel statt Zeitungskorpus — dadurch deutlich mehr gesprochene Sprache
// als in klassischen Wortlisten. Zwischenlösung für Milestone 1; die getaggte
// Wiktionary-Pipeline ersetzt das später.
//
// Ausgabe: ein Wort pro Zeile, absteigend nach Frequenz. Der Zeilenindex ist
// der Frequenzrang und wird zur Laufzeit fürs Ranking benutzt.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_50k.txt';
const cache = resolve(root, 'data/de_50k.txt');
const out = resolve(root, 'public/dict.txt');

const ALLOWED = /^[a-zäöüß]+$/;

// Untertitel-Korpora enthalten viel kurzen Müll: OCR-Fehler, Kürzel, fremde
// Eigennamen ("ece", "dci", "gao"). Echte kurze deutsche Wörter sind dagegen
// fast ausnahmslos häufig. Ein Frequenz-Deckel pro Länge trennt das sauber;
// ab fünf Buchstaben ist Rauschen selten genug, um es durchzulassen.
const MAX_RANK_BY_LENGTH = { 2: 400, 3: 3000, 4: 10000 };

if (!existsSync(cache)) {
  console.log('lade', SOURCE);
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`Download fehlgeschlagen: ${res.status}`);
  await mkdir(dirname(cache), { recursive: true });
  await writeFile(cache, await res.text(), 'utf8');
}

const seen = new Set();
const words = [];
let rank = 0;
for (const line of (await readFile(cache, 'utf8')).split('\n')) {
  const word = line.split(' ')[0]?.trim().toLowerCase();
  if (!word || word.length < 2 || !ALLOWED.test(word) || seen.has(word)) continue;
  seen.add(word);
  rank += 1;
  if (rank > (MAX_RANK_BY_LENGTH[word.length] ?? Infinity)) continue;
  words.push(word);
}

await mkdir(dirname(out), { recursive: true });
await writeFile(out, words.join('\n'), 'utf8');
console.log(`${words.length} Wörter → public/dict.txt`);
