import { useState } from 'preact/hooks';
import type { Pin } from '../core/protocol';
import type { WordGroup } from './grouping';

/**
 * Alle Wörter, die in den Buchstabensatz passen. Ein Tipp darauf pinnt sie und
 * filtert damit die Anagramm-Liste — der eigentliche kreative Arbeitsablauf.
 *
 * Die meisten Kandidaten sind unbrauchbar, weil sich der Rest der Buchstaben
 * nicht sinnvoll unterbringen lässt. Wörter, die nachweislich in einem
 * vollständigen Anagramm vorkommen, stehen deshalb oben und ausgeschrieben,
 * der Rest bleibt gedimmt stehen. Bewusst gedimmt statt versteckt: solange die
 * Suche läuft oder gekappt wurde, heißt "nicht nachgewiesen" nicht "unmöglich".
 */
export function WordList({
  groups,
  usage,
  limit,
  searching,
  truncated,
  onMore,
  onPin,
}: {
  groups: WordGroup[];
  usage: Map<string, number>;
  limit: number;
  searching: boolean;
  truncated: boolean;
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

  const scored = groups.map((group) => ({
    ...group,
    uses: group.words.reduce((sum, w) => sum + (usage.get(w.word) ?? 0), 0),
  }));

  // Erst bewerten, wenn es etwas zu bewerten gibt — sonst wäre beim Tippen
  // kurz die gesamte Liste grau.
  const graded = usage.size > 0 || !searching;
  // Array.sort ist stabil, die Längensortierung innerhalb der Gruppen bleibt.
  const ordered = graded
    ? [...scored].sort((a, b) => Number(b.uses > 0) - Number(a.uses > 0))
    : scored;

  const usable = scored.filter((g) => g.uses > 0).length;
  const visible = ordered.slice(0, limit);

  return (
    <>
      {graded && (
        <p class="list-note">
          {usable} von {groups.length} Wörtern gehen auf
          {searching && ' · prüft noch'}
          {truncated && ' · Suche gekappt, es können mehr sein'}
        </p>
      )}

      <ul class="rows">
        {visible.map((group) => {
          const isGroup = group.words.length > 1;
          const open = expanded.has(group.stem);
          const dead = graded && group.uses === 0;
          return (
            <li key={group.stem}>
              <div class="word-row">
                <button
                  class={dead ? 'row row-word-main row-dead' : 'row row-word-main'}
                  onClick={() => onPin(group.words.map((w) => w.word))}
                >
                  <span class="row-word">
                    {group.stem}
                    {isGroup && <small>+{group.words.length - 1}</small>}
                  </span>
                  {group.uses > 0 && <span class="row-hint">{group.uses}×</span>}
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
                  {group.words.map((info) => {
                    const uses = usage.get(info.word) ?? 0;
                    return (
                      <li key={info.word}>
                        <button
                          class={graded && uses === 0 ? 'row row-form row-dead' : 'row row-form'}
                          onClick={() => onPin([info.word])}
                        >
                          <span>{info.word}</span>
                          {uses > 0 && <span class="row-hint">{uses}×</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {ordered.length > limit && (
        <button class="more" onClick={onMore}>
          Weitere {Math.min(200, ordered.length - limit)} anzeigen
        </button>
      )}
    </>
  );
}
