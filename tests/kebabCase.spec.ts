import { describe, expect, it } from 'vitest';
import lodashKebabCase from 'lodash-es/kebabCase';

import kebabCase from '../src/kebabCase';

/** Deterministic PRNG so failures are reproducible. */
function _mulberry32(seed: number): () => number {
  return (): number => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALPHABET = [
  ...'abcxyzABCXYZ0123456789',
  ..." -_:.'’/\t",
  ...'éÉøØßÆæĳŒſÞð',
  '́', // combining acute accent
  '×', // multiplication sign
  '—', // em dash
  '☃', // snowman (dingbat range neighbor)
  '✅', // dingbat
  '😀', // emoji (surrogate pair)
  '中', // CJK
  'Ж' // Cyrillic
];

describe('kebabCase', () => {
  it.each([
    'My first state',
    'my first state machine',
    'goTwo',
    'gotoThree',
    'state1',
    'STATE_TWO',
    'HTMLParser',
    'foo2bar',
    "don't stop",
    'Crème Brûlée',
    '1st place',
    '__private__',
    'already-kebab',
    '',
    '   ',
    'a:b'
  ])('matches lodash for %j', (input: string) => {
    expect(kebabCase(input)).toBe(lodashKebabCase(input));
  });

  it('matches lodash for 20,000 random strings', () => {
    const random = _mulberry32(42);
    for (let i = 0; i < 20000; i++) {
      const length = Math.floor(random() * 12);
      let input = '';
      for (let j = 0; j < length; j++) {
        input += ALPHABET[Math.floor(random() * ALPHABET.length)];
      }
      expect(kebabCase(input), JSON.stringify(input)).toBe(lodashKebabCase(input));
    }
  });
});
