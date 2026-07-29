import { expect, test } from 'vitest';
import { countsOf, maskOf, normalize } from '../src/core/letters';

test('Whitespace und Groß-/Kleinschreibung fallen weg', () => {
  expect(normalize('  Benedict   GRUBER ', true)).toBe('benedictgruber');
  expect(normalize('a-b, c!', true)).toBe('abc');
});

test('Umlaute auflösen erweitert die Buchstaben', () => {
  expect(normalize('Bär', true)).toBe('baer');
  expect(normalize('Straße', true)).toBe('strasse');
  expect(normalize('Öl über', true)).toBe('oelueber');
});

test('strikter Modus behält Umlaute als eigene Buchstaben', () => {
  expect(normalize('Bär', false)).toBe('bär');
  expect(normalize('Straße', false)).toBe('straße');
});

test('fremdsprachige Diakritika werden geglättet, Umlaute nicht', () => {
  expect(normalize('Café', false)).toBe('cafe');
  expect(normalize('Café', true)).toBe('cafe');
  expect(normalize('naïve Röhre', false)).toBe('naiveröhre');
});

test('Multiset und Maske', () => {
  const counts = countsOf('anna');
  expect(counts[0]).toBe(2); // a
  expect(counts[13]).toBe(2); // n
  expect(maskOf(counts)).toBe((1 << 0) | (1 << 13));
});
