import { useState } from 'preact/hooks';
import type { Pin } from '../core/protocol';
import type { WordGroup } from './grouping';

/**
 * Alle Wörter, die in den Buchstabensatz passen. Ein Tipp darauf pinnt sie und
 * filtert damit die Anagramm-Liste — der eigentliche kreative Arbeitsablauf.
 */
export function WordList({
  groups,
  limit,
  onMore,
  onPin,
}: {
  groups: WordGroup[];
  limit: number;
  onMore: () => void;
  onPin: (pin: Pin) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (stem: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(stem)) next.delete(stem);
      else next.add(stem);
      return next;
    });

  const visible = groups.slice(0, limit);

  return (
    <>
      <ul class="rows">
        {visible.map((group) => {
          const isGroup = group.words.length > 1;
          const open = expanded.has(group.stem);
          return (
            <li key={group.stem}>
              <div class="word-row">
                <button
                  class="row row-word-main"
                  onClick={() => onPin(group.words.map((w) => w.word))}
                >
                  <span class="row-word">{group.stem}</span>
                  {isGroup && <span class="row-hint">+{group.words.length - 1} Formen</span>}
                </button>
                {isGroup && (
                  <button
                    class="expand"
                    aria-expanded={open}
                    aria-label={`Formen von ${group.stem}`}
                    onClick={() => toggle(group.stem)}
                  >
                    {open ? '−' : '+'}
                  </button>
                )}
              </div>
              {isGroup && open && (
                <ul class="forms">
                  {group.words.map((info) => (
                    <li key={info.word}>
                      <button class="row row-form" onClick={() => onPin([info.word])}>
                        {info.word}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {groups.length > limit && (
        <button class="more" onClick={onMore}>
          Weitere {Math.min(200, groups.length - limit)} anzeigen
        </button>
      )}
    </>
  );
}
