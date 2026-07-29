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

Gemessen: 17 Buchstaben, 398 Kandidaten, 1363 Treffer in 60 ms.

Die Suche läuft in einem Web Worker und streamt Treffer in Batches, damit das
UI beim Tippen nicht einfriert und eine neue Eingabe die laufende Suche
abbrechen kann.

### Ranking

`Σ Wortlänge² + Rang-Bonus`. Die Summe der Quadrate erledigt die Hauptarbeit
von allein: bei konstanter Gesamtlänge wird sie maximal, wenn die Buchstaben
auf wenige lange Wörter fallen. Zwei lange Wörter schlagen also automatisch
sechs kurze. Der Rang-Bonus hebt seltene Wörter leicht an, ist aber gedeckelt —
jenseits von Rang 20.000 sagt Seltenheit nichts mehr über Witz aus, dort stehen
Fachbegriffe und Kürzel.

### Umlaute

Standardmäßig werden ä/ö/ü/ß beidseitig zu ae/oe/ue/ss aufgelöst. Das ist
mengentheoretisch eine Obermenge des strikten Modus — es geht kein Treffer
verloren, und Eingaben ohne Umlaute können trotzdem Umlautwörter bilden.
Abschaltbar in den Einstellungen.

### Verwendbare Wörter

Die meisten Wörter, die in den Buchstabensatz passen, sind wertlos, weil sich
der Rest nicht mehr unterbringen lässt. Welche aufgehen, muss aber nicht extra
berechnet werden: jedes Wort, das in einem Treffer vorkommt, ist per Definition
auflösbar. Die Wortliste leitet das aus den ohnehin streamenden Ergebnissen ab,
sortiert die verwendbaren nach oben und dimmt den Rest.

Gedimmt statt versteckt, weil die Suche gekappt sein kann — „nicht
nachgewiesen“ heißt dann nicht „unmöglich“. Die Kopfzeile sagt, welcher Fall
vorliegt.

## Wörterbuch

Zwei Quellen mit verschiedenen Aufgaben, zusammengebaut von
`scripts/build-dict.mjs`:

**Basis** — [FrequencyWords](https://github.com/hermitdave/FrequencyWords)
(OpenSubtitles 2018, MIT). Liefert Häufigkeit und damit die Rangfolge fürs
Ranking. Untertitel statt Zeitungskorpus, dadurch von Haus aus viel gesprochene
Sprache.

**Register** — Wiktionary-Kategorien über die MediaWiki-API. Liefert, was die
Frequenzliste nicht weiß: welches Wort umgangssprachlich, Abkürzung,
Anglizismus, Slang oder vulgär ist. Wörter aus den Kategorien, die in der Basis
fehlen, kommen dazu — so gelangen „Digga“ oder „cringe“ überhaupt erst ins
Wörterbuch. Der komplette Wiktionary-Dump wäre über 1 GB; die
Kategorieabfragen kosten ein paar hundert Kilobyte.

Stand: 54.679 Wörter, davon 8.345 nur aus den Kategorien.
Tags: 2.495 Abkürzungen, 1.423 Anglizismen, 6.841 Umgangssprache,
507 Jugend-/Netzsprache, 371 vulgär.

### Drei Fallen, die das Wörterbuch sonst ruinieren

**Kurzer Korpus-Müll.** Untertitel sind voll von OCR-Fehlern und fremden
Eigennamen (`ece`, `dci`, `gao`). Echte kurze deutsche Wörter sind dagegen fast
ausnahmslos häufig, ein Frequenz-Deckel pro Wortlänge trennt das sauber.

**Akronyme, die zu Alltagswörtern werden.** `DAS`, `DU`, `IN`, `SO` stehen als
Abkürzungen in Wiktionary. Kleingeschrieben kollidieren sie mit den häufigsten
deutschen Wörtern. Titel in Großbuchstaben werden deshalb übersprungen, wenn
die Kleinschreibung bereits ein Wort der Basis ist.

**Wiktionary kategorisiert Seiten, nicht Bedeutungen.** „machen“ steht in
*German colloquialisms*, weil eine Nebenbedeutung umgangssprachlich ist. Ohne
Schutz waren 26 % der 500 häufigsten Wörter getaggt — wer Umgangssprache
abwählt, hätte `und`, `gehen` und `haus` verloren. Häufige Wörter gelten
deshalb als Kernwortschatz und bleiben ungetaggt. Ausnahme ist *vulgär*: der
Schalter muss verlässlich greifen, `scheiße` wird also auch auf Rang 300
getaggt. Ein Test hält das fest.

Abkürzungen sind aus demselben Grund **standardmäßig abgewählt**: `utc`, `bgb`,
`egmr` sind konsonantische Buchstabensenken, die jeden Rest aufsaugen, ohne
dass ein lesbares Anagramm entsteht.

## Nächste Schritte

**Größerer Wortschatz.** Die Basis ist mit 46.000 Formen dünn und kennt kaum
Flexion. [kaikki.org](https://kaikki.org/dewiktionary/index.html) extrahiert
das deutsche Wiktionary maschinenlesbar (~3,18 Mio. deutsche Senses, CC-BY-SA),
dazu [igerman98](https://www.j3e.de/ispell/igerman98/) für Breite. Bei ~1 Mio.
Formen wird die Größe zum Thema: Wortliste front-coded und brotli-komprimiert,
in Tiers geladen — die häufigsten Formen sofort, der Rest im Hintergrund nach.

**Echte Lemmatisierung.** Die Wortgruppen in der Wortliste laufen über
gemeinsame Präfixe. Das trifft die häufigen deutschen Endungen, liegt bei
Komposita aber daneben.

**Aktuelle Jugendsprache.** Wiktionary hinkt hinterher. Eine handgepflegte
Liste wäre der Teil, den kein Konkurrent hat.

**Kreative Auslassungen.** `fotzen → fotzn`, `haben → habm`, `super → supa`.
Regelbasierte Varianten, zum Build-Zeitpunkt erzeugt und als Slang markiert.
Ändert das Buchstaben-Multiset und öffnet dadurch neue Lösungen, kostet im
Suchalgorithmus aber nichts.

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
