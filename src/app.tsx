import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { normalize } from './core/letters';
import type { Settings } from './core/search';
import {
  DEFAULT_SETTINGS,
  MAX_MS,
  type AnagramResult,
  type Pin,
  type WordInfo,
  type WorkerResponse,
} from './core/protocol';
import { groupWords } from './ui/grouping';
import { Tray } from './ui/Tray';
import { Results } from './ui/Results';
import { WordList } from './ui/WordList';
import { SettingsSheet } from './ui/SettingsSheet';

const PAGE = 200;
const DEBOUNCE_MS = 250;
/** Erst ab hier lohnt eine Anzeige — darunter wäre sie ein Flackern. */
const SPINNER_AFTER_MS = 400;

export function App() {
  const [input, setInput] = useState('');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [pins, setPins] = useState<Pin[]>([]);
  const [tab, setTab] = useState<'anagrams' | 'words'>('anagrams');
  const [sheetOpen, setSheetOpen] = useState(false);

  const [letters, setLetters] = useState('');
  const [candidates, setCandidates] = useState<WordInfo[]>([]);
  const [results, setResults] = useState<AnagramResult[]>([]);
  const [limit, setLimit] = useState(PAGE);

  const [dictSize, setDictSize] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<{ total: number; truncated: boolean; ms: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [elapsed, setElapsed] = useState(0);
  const requestId = useRef(0);
  const worker = useMemo(
    () => new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' }),
    [],
  );

  useEffect(() => {
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.type === 'loaded') {
        setDictSize(msg.words);
        return;
      }
      if (msg.type === 'error') {
        setError(msg.message);
        setRunning(false);
        return;
      }
      // Antworten überholter Suchläufe verwerfen.
      if (msg.id !== requestId.current) return;

      if (msg.type === 'candidates') {
        setLetters(msg.letters);
        setCandidates(msg.words);
        setResults([]);
        setLimit(PAGE);
      } else if (msg.type === 'results') {
        setResults((prev) => prev.concat(msg.batch));
      } else if (msg.type === 'done') {
        setRunning(false);
        setDone({ total: msg.total, truncated: msg.truncated, ms: msg.ms });
      }
    };

    worker.postMessage({ type: 'load', url: `${import.meta.env.BASE_URL}dict.txt` });
    return () => worker.terminate();
  }, [worker]);

  useEffect(() => {
    if (!dictSize) return;
    const handle = setTimeout(() => {
      requestId.current += 1;
      setRunning(true);
      setDone(null);
      worker.postMessage({ type: 'search', id: requestId.current, input, settings, pins });
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [input, settings, pins, dictSize, worker]);

  useEffect(() => {
    if (!running) {
      setElapsed(0);
      return;
    }
    const startedAt = performance.now();
    const handle = setInterval(() => setElapsed(performance.now() - startedAt), 80);
    return () => clearInterval(handle);
  }, [running]);

  const sorted = useMemo(() => [...results].sort((a, b) => b.score - a.score), [results]);
  const groups = useMemo(() => groupWords(candidates), [candidates]);

  // Ob ein Wort überhaupt zu einem vollständigen Anagramm führt, steht bereits
  // in den Treffern — jedes dort verwendete Wort ist per Definition auflösbar.
  // Kostet damit keine zweite Suche und wächst mit den Batches mit.
  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const result of results) {
      for (const word of result.words) counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    return counts;
  }, [results]);

  // Gruppen-Pins teilen sich den Stamm, dessen Buchstaben also in jeder
  // Alternative verbraucht werden — das kürzeste Wort ist die sichere Untergrenze.
  const consumed = useMemo(
    () =>
      pins
        .map((pin) => pin.reduce((a, b) => (b.length < a.length ? b : a)))
        .map((word) => normalize(word, settings.resolveUmlauts))
        .join(''),
    [pins, settings.resolveUmlauts],
  );

  const addPin = (pin: Pin) => {
    // Zweimal dasselbe Wort zöge die Buchstaben doppelt ab und führte in eine
    // leere Ergebnisliste.
    setPins((prev) => (prev.some((p) => p.join() === pin.join()) ? prev : [...prev, pin]));
    setTab('anagrams');
  };

  const showMore = () => setLimit((l) => l + PAGE);

  return (
    <div class="app">
      <header class="head">
        <input
          class="input"
          value={input}
          placeholder="Name oder Satz"
          autocomplete="off"
          autocapitalize="off"
          spellcheck={false}
          onInput={(e) => setInput(e.currentTarget.value)}
        />

        <Tray letters={letters} consumed={consumed} />

        {pins.length > 0 && (
          <div class="pins">
            {pins.map((pin, i) => (
              <button key={pin.join()} class="pin" onClick={() => setPins((p) => p.filter((_, j) => j !== i))}>
                <span>{pin.join(' / ')}</span>
                <span class="pin-x">✕</span>
              </button>
            ))}
          </div>
        )}
      </header>

      <nav class="tabs">
        <button class={tab === 'anagrams' ? 'tab tab-on' : 'tab'} onClick={() => setTab('anagrams')}>
          Anagramme <b>{sorted.length}</b>
        </button>
        <button class={tab === 'words' ? 'tab tab-on' : 'tab'} onClick={() => setTab('words')}>
          Wörter <b>{groups.length}</b>
        </button>
      </nav>

      <main class="list">
        {error && <p class="empty">{error}</p>}

        {!error && !letters && dictSize > 0 && (
          <p class="empty">{dictSize.toLocaleString('de-DE')} Wörter geladen. Tipp etwas ein.</p>
        )}

        {!error && !dictSize && (
          <div class="empty">
            <p>Wörterbuch lädt …</p>
            {/* Unbestimmt, weil GitHub Pages gzip ausliefert: Content-Length
                misst die komprimierten Bytes, der Stream die entpackten. Ein
                Byte-Balken darauf wäre schlicht falsch. */}
            <div class="bar bar-idle">
              <div class="bar-fill" />
            </div>
          </div>
        )}

        {!error && letters && tab === 'anagrams' && (
          sorted.length > 0 ? (
            <Results results={sorted} limit={limit} onMore={showMore} />
          ) : (
            !running && <p class="empty">Keine Anagramme. Weniger Mindestlänge oder mehr Wörter erlauben.</p>
          )
        )}

        {!error && letters && tab === 'words' && (
          <WordList
            groups={groups}
            usage={usage}
            limit={limit}
            searching={running}
            truncated={done?.truncated ?? false}
            onMore={showMore}
            onPin={addPin}
          />
        )}
      </main>

      {running && elapsed > SPINNER_AFTER_MS && (
        <div
          class="bar"
          role="progressbar"
          aria-label="Suche läuft"
          aria-valuemin={0}
          aria-valuemax={MAX_MS}
          aria-valuenow={Math.round(elapsed)}
        >
          <div class="bar-fill" style={{ width: `${Math.min(100, (elapsed / MAX_MS) * 100)}%` }} />
        </div>
      )}

      <footer class="foot">
        <span class="status">
          {running &&
            (sorted.length > 0
              ? `sucht … ${sorted.length.toLocaleString('de-DE')} gefunden`
              : 'sucht …')}
          {!running && done && `${done.total.toLocaleString('de-DE')} in ${done.ms} ms`}
          {!running && done?.truncated && ' · gekappt, pinne ein Wort'}
        </span>
        <button class="settings-btn" onClick={() => setSheetOpen(true)}>
          Einstellungen
        </button>
      </footer>

      {sheetOpen && (
        <SettingsSheet settings={settings} onChange={setSettings} onClose={() => setSheetOpen(false)} />
      )}
    </div>
  );
}
