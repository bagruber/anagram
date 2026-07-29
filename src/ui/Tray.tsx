/**
 * Die Eingabe als Buchstabensteine. Was gepinnt ist, wird ausgegraut — der
 * Rest ist das, womit noch gearbeitet werden kann.
 */
export function Tray({ letters, consumed }: { letters: string; consumed: string }) {
  if (!letters) return null;

  const budget = new Map<string, number>();
  for (const ch of consumed) budget.set(ch, (budget.get(ch) ?? 0) + 1);

  const tiles = [...letters].map((ch) => {
    const left = budget.get(ch) ?? 0;
    if (left > 0) {
      budget.set(ch, left - 1);
      return { ch, used: true };
    }
    return { ch, used: false };
  });

  const open = tiles.filter((t) => !t.used).length;

  return (
    <div class="tray">
      <div class="tray-tiles">
        {tiles.map((tile, i) => (
          <span key={i} class={tile.used ? 'tile tile-used' : 'tile'}>
            {tile.ch}
          </span>
        ))}
      </div>
      <p class="tray-count">
        {open} von {tiles.length} Buchstaben offen
      </p>
    </div>
  );
}
