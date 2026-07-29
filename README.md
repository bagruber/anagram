# Anagramm

Anagramm-Generator für die deutsche Sprache. Läuft vollständig im Browser,
ohne Server.

Der Unterschied zu bestehenden Tools soll der Wortschatz sein: Umgangssprache,
Abkürzungen, Anglizismen und Slang statt reiner Standardsprache — zuschaltbar
über Register-Filter.

## Loslegen

```sh
npm install
npm run dict     # baut public/dict.txt (einmalig, lädt die Quelle nach)
npm run dev
```

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Dev-Server |
| `npm run build` | Typecheck + Production-Build nach `dist/` |
| `npm test` | Korrektheit der Suche und Qualität des Rankings |
| `npm run dict` | Wörterbuch neu bauen |

Ranking justieren und Beispiel-Treffer ansehen:

```sh
SAMPLE=1 npx vitest run test/sample.test.ts --disable-console-intercept
```

## Wie es funktioniert

Die Eingabe wird zu einem Buchstaben-Multiset normalisiert. Gesucht sind alle
Kombinationen von Wörterbuch-Wörtern, deren Multisets sich exakt dazu
aufsummieren — eine Tiefensuche, die pro Schritt ein Wort abzieht.

Drei Dinge machen das browsertauglich:

- **Kandidatenfilter** — nur Wörter, die Teilmenge der Eingabe sind. Von 46.000
  Wörtern bleiben typisch einige Hundert.
- **Bitmasken** — ein Wort mit einem Buchstaben außerhalb der Restmenge fällt
  mit einer einzigen Integer-Operation raus.
- **Index-Ordnung** — ein Wort darf nur an Position ≥ dem Vorgänger gewählt
  werden, sonst käme dieselbe Lösung in jeder Reihenfolge heraus.

Gemessen: 17 Buchstaben, 365 Kandidaten, 1033 Treffer in 65 ms.

Die Suche läuft in einem Web Worker und streamt Treffer in Batches, damit das
UI beim Tippen nicht einfriert und eine neue Eingabe die laufende Suche
abbrechen kann.

### Ranking

`Σ Wortlänge² + Rang-Bonus`. Die Summe der Quadrate erledigt die Hauptarbeit
von allein: bei konstanter Gesamtlänge wird sie maximal, wenn die Buchstaben
auf wenige lange Wörter fallen. Zwei lange Wörter schlagen also automatisch
sechs kurze. Der Rang-Bonus hebt seltene Wörter leicht an.

### Umlaute

Standardmäßig werden ä/ö/ü/ß beidseitig zu ae/oe/ue/ss aufgelöst. Das ist
mengentheoretisch eine Obermenge des strikten Modus — es geht kein Treffer
verloren, und Eingaben ohne Umlaute können trotzdem Umlautwörter bilden.
Abschaltbar in den Einstellungen.

## Wörterbuch

Aktuell: [FrequencyWords](https://github.com/hermitdave/FrequencyWords)
(OpenSubtitles 2018, MIT), ~46.000 Formen mit Frequenz. Untertitel statt
Zeitungskorpus, dadurch von Haus aus mehr gesprochene Sprache.

`scripts/build-dict.mjs` verwirft kurze seltene Tokens: Untertitel-Korpora sind
voll von OCR-Müll wie `ece`, `dci`, `gao`, während echte kurze deutsche Wörter
fast ausnahmslos häufig sind. Ein Frequenz-Deckel pro Wortlänge trennt das.

**Noch nicht gelöst:** Register-Tags. Die Frequenzliste weiß nicht, was
Umgangssprache, Abkürzung oder Anglizismus ist — die Schalter dafür sind im UI
angelegt, aber inaktiv.

## Stand und nächste Schritte

Milestone 1 steht: Suche, Streaming, Tray, Pinning, Wortliste, Einstellungen.

**Milestone 2 — Wörterbuch mit Tags.** [kaikki.org](https://kaikki.org/dewiktionary/index.html)
extrahiert das deutsche Wiktionary maschinenlesbar (~3,18 Mio. deutsche Senses,
CC-BY-SA) und behält in `raw_tags` genau die Marker, die als Filter gebraucht
werden: `umgangssprachlich`, `Abkürzung`, `vulgär`, `derb`, `salopp`,
`Jugendsprache`. Dazu [igerman98](https://www.j3e.de/ispell/igerman98/) für
Breite und eine handgepflegte Liste für aktuelle Jugendsprache, die in
Wiktionary schlecht abgedeckt ist.

Bei ~1 Mio. Formen wird die Größe zum Thema. Geplant: Wortliste front-coded und
brotli-komprimiert, in Tiers geladen — die häufigsten Formen sofort, der Rest
im Hintergrund nach.

**Milestone 3 — kreative Auslassungen.** `fotzen → fotzn`, `haben → habm`,
`super → supa`. Regelbasierte Varianten, zum Build-Zeitpunkt erzeugt und als
Slang markiert. Ändert das Buchstaben-Multiset und öffnet dadurch neue
Lösungen, kostet im Suchalgorithmus aber nichts.

**Weitere Sprachen.** Der Kern ist sprachunabhängig bis auf das Alphabet in
`src/core/letters.ts` und die Umlaut-Regeln.

## Deployment

`.github/workflows/deploy.yml` baut bei jedem Push auf `main` und veröffentlicht
nach GitHub Pages. Voraussetzung: in den Repo-Einstellungen unter *Pages* als
Quelle *GitHub Actions* wählen.

`base` in `vite.config.ts` steht auf `/anagram/`. Für eine eigene Domain:

```sh
DEPLOY_BASE=/ npm run build
```
