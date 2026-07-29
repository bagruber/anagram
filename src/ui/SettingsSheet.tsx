import type { Settings } from '../core/search';

const WORD_COUNTS = [1, 2, 3, 4, 5, 6];

// Register-Filter aus der Anforderung. Die Schalter stehen hier bereits, sind
// aber inaktiv: die Frequenzliste aus Milestone 1 trägt keine Marker. Erst die
// Wiktionary-Pipeline liefert `umgangssprachlich`, `Abkürzung`, `vulgär` usw.
const REGISTERS = [
  'Abkürzungen',
  'Anglizismen',
  'Umgangssprache & Slang',
  'Vulgär & derb',
  'Eigennamen',
];

export function SettingsSheet({
  settings,
  onChange,
  onClose,
}: {
  settings: Settings;
  onChange: (next: Settings) => void;
  onClose: () => void;
}) {
  const patch = (part: Partial<Settings>) => onChange({ ...settings, ...part });

  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet" role="dialog" aria-label="Einstellungen" onClick={(e) => e.stopPropagation()}>
        <div class="sheet-grip" />

        <label class="field">
          <span class="field-label">
            Kürzestes Wort <b>{settings.minLen}</b>
          </span>
          <input
            type="range"
            min={1}
            max={8}
            value={settings.minLen}
            onInput={(e) => patch({ minLen: Number(e.currentTarget.value) })}
          />
        </label>

        <label class="field">
          <span class="field-label">
            Längstes Wort <b>{settings.maxLen}</b>
          </span>
          <input
            type="range"
            min={3}
            max={24}
            value={settings.maxLen}
            onInput={(e) => patch({ maxLen: Number(e.currentTarget.value) })}
          />
        </label>

        <div class="field">
          <span class="field-label">Wörter maximal</span>
          <div class="segmented">
            {WORD_COUNTS.map((count) => (
              <button
                key={count}
                class={count === settings.maxWords ? 'seg seg-on' : 'seg'}
                onClick={() => patch({ maxWords: count })}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <label class="toggle">
          <input
            type="checkbox"
            checked={settings.resolveUmlauts}
            onChange={(e) => patch({ resolveUmlauts: e.currentTarget.checked })}
          />
          <span>
            Umlaute auflösen
            <em>ä = ae, ö = oe, ü = ue, ß = ss — findet deutlich mehr</em>
          </span>
        </label>

        <div class="field">
          <span class="field-label">Wortschatz</span>
          <div class="chips">
            {REGISTERS.map((name) => (
              <button key={name} class="chip" disabled>
                {name}
              </button>
            ))}
          </div>
          <em class="note">Braucht das getaggte Wörterbuch — Milestone 2.</em>
        </div>

        <button class="sheet-close" onClick={onClose}>
          Fertig
        </button>
      </div>
    </div>
  );
}
