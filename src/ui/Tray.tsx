/**
 * Die Eingabe als Buchstabensteine, ein Stein pro verschiedenem Buchstaben.
 *
 * Mehrfachvorkommen stehen als Zähler auf dem Stein statt als Wiederholung —
 * "mississippi" wären sonst elf Kacheln für vier Buchstaben. Der Zähler zeigt,
 * was nach den Pins noch offen ist; die Kachel ist der Arbeitsvorrat, keine
 * Quittung über die Eingabe.
 */
export function Tray({ letters, consumed }: { letters: string; consumed: string }) {
  if (!letters) return null;

  const total = new Map<string, number>();
  for (const ch of letters) total.set(ch, (total.get(ch) ?? 0) + 1);
  const used = new Map<string, number>();
  for (const ch of consumed) used.set(ch, (used.get(ch) ?? 0) + 1);

  const tiles = [...total.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'de'))
    .map(([ch, count]) => ({ ch, left: count - (used.get(ch) ?? 0) }));

  const open = tiles.reduce((sum, tile) => sum + Math.max(0, tile.left), 0);

  return (
    <div class="tray">
      <div class="tray-tiles">
        {tiles.map((tile) => (
          <span key={tile.ch} class={tile.left > 0 ? 'tile' : 'tile tile-used'}>
            <b>{tile.ch}</b>
            {tile.left > 1 && <i>{tile.left}</i>}
          </span>
        ))}
      </div>
      <p class="tray-count">
        {open} von {letters.length} Buchstaben offen
      </p>
    </div>
  );
}
