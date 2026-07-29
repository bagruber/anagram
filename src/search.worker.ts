/// <reference lib="webworker" />

// Die Suche läuft komplett hier, damit das UI beim Tippen nicht einfriert.
// Ergebnisse kommen in Batches zurück statt am Stück — bei längeren Eingaben
// ist die Ergebnismenge groß genug, dass "warten bis fertig" keine Option ist.

import { countsOf, normalize } from './core/letters';
import { buildCandidates, enumerate, scoreOf, subtract } from './core/search';
import type { AnagramResult, Pin, WorkerRequest, WorkerResponse } from './core/protocol';

const MAX_RESULTS = 4000;
const MAX_MS = 10_000;
const SLICE_MS = 40;
const MAX_PIN_COMBOS = 64;

let dict: string[] = [];
let activeId = -1;

const post = (msg: WorkerResponse) => self.postMessage(msg);
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  if (msg.type === 'load') {
    load(msg.url);
  } else if (msg.type === 'search') {
    activeId = msg.id;
    void run(msg);
  }
};

async function load(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Wörterbuch nicht ladbar (${res.status})`);
    dict = (await res.text()).split('\n').filter(Boolean);
    post({ type: 'loaded', words: dict.length });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
}

/** Kartesisches Produkt der Pin-Alternativen, gedeckelt. */
function pinCombinations(pins: Pin[]): string[][] {
  let combos: string[][] = [[]];
  for (const alternatives of pins) {
    const next: string[][] = [];
    for (const combo of combos) {
      for (const word of alternatives) {
        if (next.length >= MAX_PIN_COMBOS) break;
        next.push([...combo, word]);
      }
    }
    combos = next;
  }
  return combos;
}

async function run(req: Extract<WorkerRequest, { type: 'search' }>) {
  const { id, settings } = req;
  const started = performance.now();

  const letters = normalize(req.input, settings.resolveUmlauts);
  const target = countsOf(letters);

  if (!letters) {
    post({ type: 'candidates', id, letters, words: [] });
    post({ type: 'done', id, total: 0, truncated: false, ms: 0 });
    return;
  }

  const candidates = buildCandidates(dict, target, settings);
  post({
    type: 'candidates',
    id,
    letters,
    words: candidates.words.map((word, i) => ({ word, rank: candidates.ranks[i] })),
  });

  const seen = new Set<string>();
  let batch: AnagramResult[] = [];
  let total = 0;
  let truncated = false;
  let sliceStart = performance.now();

  const flush = () => {
    if (batch.length === 0) return;
    post({ type: 'results', id, batch });
    batch = [];
  };

  outer: for (const combo of pinCombinations(req.pins)) {
    let rest: Uint8Array | null = target;
    for (const word of combo) {
      rest = rest && subtract(rest, word, settings.resolveUmlauts);
    }
    if (!rest) continue;

    const comboRanks = combo.map((word) => {
      const i = candidates.words.indexOf(word);
      return i >= 0 ? candidates.ranks[i] : dict.indexOf(word);
    });

    for (const indices of enumerate(candidates, rest, settings.maxWords - combo.length, settings.minLen)) {
      const words = [...combo, ...indices.map((i) => candidates.words[i])];
      const key = [...words].sort().join(' ');
      if (!seen.has(key)) {
        seen.add(key);
        const ranks = [...comboRanks, ...indices.map((i) => candidates.ranks[i])];
        batch.push({ words, score: scoreOf(words, ranks) });
        total++;
      }

      if (total >= MAX_RESULTS) {
        truncated = true;
        break outer;
      }

      if (performance.now() - sliceStart > SLICE_MS) {
        flush();
        await tick();
        // Eine neuere Eingabe hat diese Suche überholt.
        if (activeId !== id) return;
        if (performance.now() - started > MAX_MS) {
          truncated = true;
          break outer;
        }
        sliceStart = performance.now();
      }
    }
  }

  flush();
  post({ type: 'done', id, total, truncated, ms: Math.round(performance.now() - started) });
}
