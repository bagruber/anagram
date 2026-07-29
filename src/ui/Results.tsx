import { useState } from 'preact/hooks';
import type { AnagramResult } from '../core/protocol';

export function Results({
  results,
  limit,
  onMore,
}: {
  results: AnagramResult[];
  limit: number;
  onMore: () => void;
}) {
  const [copied, setCopied] = useState(-1);

  const copy = (index: number, text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied((c) => (c === index ? -1 : c)), 1200);
  };

  const visible = results.slice(0, limit);

  return (
    <>
      <ul class="rows">
        {visible.map((result, i) => {
          const text = result.words.join(' ');
          return (
            <li key={text}>
              <button class="row" onClick={() => copy(i, text)}>
                <span class="row-text">
                  {result.words.map((word, w) => (
                    <span key={w} class="row-word">
                      {word}
                    </span>
                  ))}
                </span>
                <span class="row-hint">{copied === i ? 'kopiert' : ''}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {results.length > limit && (
        <button class="more" onClick={onMore}>
          Weitere {Math.min(200, results.length - limit)} anzeigen
        </button>
      )}
    </>
  );
}
