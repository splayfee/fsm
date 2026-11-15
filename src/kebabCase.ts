/**
 * @fileOverview A dependency-free port of lodash's `kebabCase`.
 *
 * State and trigger ids are derived with this function, so it must produce output identical to
 * `lodash-es/kebabCase` (which earlier versions of this library depended on) or existing ids would
 * change. The regular expressions and the deburr table below are ported verbatim from lodash
 * 4.17 / 4.18 (MIT License, Copyright OpenJS Foundation and other contributors).
 */

/* eslint-disable no-control-regex, no-misleading-character-class */

/** Latin-1 Supplement and Latin Extended-A letters mapped to basic Latin letters, grouped by replacement. */
const DEBURRED_GROUPS: [string, string][] = [
  ['A', '\u00c0\u00c1\u00c2\u00c3\u00c4\u00c5\u0100\u0102\u0104'],
  ['Ae', '\u00c6'],
  ['C', '\u00c7\u0106\u0108\u010a\u010c'],
  ['E', '\u00c8\u00c9\u00ca\u00cb\u0112\u0114\u0116\u0118\u011a'],
  ['I', '\u00cc\u00cd\u00ce\u00cf\u0128\u012a\u012c\u012e\u0130'],
  ['D', '\u00d0\u010e\u0110'],
  ['N', '\u00d1\u0143\u0145\u0147\u014a'],
  ['O', '\u00d2\u00d3\u00d4\u00d5\u00d6\u00d8\u014c\u014e\u0150'],
  ['U', '\u00d9\u00da\u00db\u00dc\u0168\u016a\u016c\u016e\u0170\u0172'],
  ['Y', '\u00dd\u0176\u0178'],
  ['Th', '\u00de'],
  ['ss', '\u00df'],
  ['a', '\u00e0\u00e1\u00e2\u00e3\u00e4\u00e5\u0101\u0103\u0105'],
  ['ae', '\u00e6'],
  ['c', '\u00e7\u0107\u0109\u010b\u010d'],
  ['e', '\u00e8\u00e9\u00ea\u00eb\u0113\u0115\u0117\u0119\u011b'],
  ['i', '\u00ec\u00ed\u00ee\u00ef\u0129\u012b\u012d\u012f\u0131'],
  ['d', '\u00f0\u010f\u0111'],
  ['n', '\u00f1\u0144\u0146\u0148\u014b'],
  ['o', '\u00f2\u00f3\u00f4\u00f5\u00f6\u00f8\u014d\u014f\u0151'],
  ['u', '\u00f9\u00fa\u00fb\u00fc\u0169\u016b\u016d\u016f\u0171\u0173'],
  ['y', '\u00fd\u00ff\u0177'],
  ['th', '\u00fe'],
  ['G', '\u011c\u011e\u0120\u0122'],
  ['g', '\u011d\u011f\u0121\u0123'],
  ['H', '\u0124\u0126'],
  ['h', '\u0125\u0127'],
  ['IJ', '\u0132'],
  ['ij', '\u0133'],
  ['J', '\u0134'],
  ['j', '\u0135'],
  ['K', '\u0136'],
  ['k', '\u0137\u0138'],
  ['L', '\u0139\u013b\u013d\u013f\u0141'],
  ['l', '\u013a\u013c\u013e\u0140\u0142'],
  ["'n", '\u0149'],
  ['Oe', '\u0152'],
  ['oe', '\u0153'],
  ['R', '\u0154\u0156\u0158'],
  ['r', '\u0155\u0157\u0159'],
  ['S', '\u015a\u015c\u015e\u0160'],
  ['s', '\u015b\u015d\u015f\u0161\u017f'],
  ['T', '\u0162\u0164\u0166'],
  ['t', '\u0163\u0165\u0167'],
  ['W', '\u0174'],
  ['w', '\u0175'],
  ['Z', '\u0179\u017b\u017d'],
  ['z', '\u017a\u017c\u017e']
];

const DEBURRED_LETTERS = new Map<string, string>();
for (const [replacement, letters] of DEBURRED_GROUPS) {
  for (const letter of letters) {
    DEBURRED_LETTERS.set(letter, replacement);
  }
}

const RS_ASTRAL_RANGE = '\\ud800-\\udfff';
const RS_COMBO_RANGE = '\\u0300-\\u036f' + '\\ufe20-\\ufe2f' + '\\u20d0-\\u20ff';
const RS_DINGBAT_RANGE = '\\u2700-\\u27bf';
const RS_LOWER_RANGE = 'a-z\\xdf-\\xf6\\xf8-\\xff';
const RS_MATH_OP_RANGE = '\\xac\\xb1\\xd7\\xf7';
const RS_NON_CHAR_RANGE = '\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf';
const RS_PUNCTUATION_RANGE = '\\u2000-\\u206f';
const RS_SPACE_RANGE =
  ' \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000';
const RS_UPPER_RANGE = 'A-Z\\xc0-\\xd6\\xd8-\\xde';
const RS_VAR_RANGE = '\\ufe0e\\ufe0f';
const RS_BREAK_RANGE = RS_MATH_OP_RANGE + RS_NON_CHAR_RANGE + RS_PUNCTUATION_RANGE + RS_SPACE_RANGE;

const RS_APOS = "['’]";
const RS_BREAK = '[' + RS_BREAK_RANGE + ']';
const RS_COMBO = '[' + RS_COMBO_RANGE + ']';
const RS_DIGITS = '\\d+';
const RS_DINGBAT = '[' + RS_DINGBAT_RANGE + ']';
const RS_LOWER = '[' + RS_LOWER_RANGE + ']';
const RS_MISC =
  '[^' +
  RS_ASTRAL_RANGE +
  RS_BREAK_RANGE +
  RS_DIGITS +
  RS_DINGBAT_RANGE +
  RS_LOWER_RANGE +
  RS_UPPER_RANGE +
  ']';
const RS_FITZ = '\\ud83c[\\udffb-\\udfff]';
const RS_MODIFIER = '(?:' + RS_COMBO + '|' + RS_FITZ + ')';
const RS_NON_ASTRAL = '[^' + RS_ASTRAL_RANGE + ']';
const RS_REGIONAL = '(?:\\ud83c[\\udde6-\\uddff]){2}';
const RS_SURR_PAIR = '[\\ud800-\\udbff][\\udc00-\\udfff]';
const RS_UPPER = '[' + RS_UPPER_RANGE + ']';
const RS_ZWJ = '\\u200d';

const RS_MISC_LOWER = '(?:' + RS_LOWER + '|' + RS_MISC + ')';
const RS_MISC_UPPER = '(?:' + RS_UPPER + '|' + RS_MISC + ')';
const RS_OPT_CONTR_LOWER = '(?:' + RS_APOS + '(?:d|ll|m|re|s|t|ve))?';
const RS_OPT_CONTR_UPPER = '(?:' + RS_APOS + '(?:D|LL|M|RE|S|T|VE))?';
const RE_OPT_MOD = RS_MODIFIER + '?';
const RS_OPT_VAR = '[' + RS_VAR_RANGE + ']?';
const RS_OPT_JOIN =
  '(?:' +
  RS_ZWJ +
  '(?:' +
  [RS_NON_ASTRAL, RS_REGIONAL, RS_SURR_PAIR].join('|') +
  ')' +
  RS_OPT_VAR +
  RE_OPT_MOD +
  ')*';
const RS_ORD_LOWER = '\\d*(?:1st|2nd|3rd|(?![123])\\dth)(?=\\b|[A-Z_])';
const RS_ORD_UPPER = '\\d*(?:1ST|2ND|3RD|(?![123])\\dTH)(?=\\b|[a-z_])';
const RS_SEQ = RS_OPT_VAR + RE_OPT_MOD + RS_OPT_JOIN;
const RS_EMOJI = '(?:' + [RS_DINGBAT, RS_REGIONAL, RS_SURR_PAIR].join('|') + ')' + RS_SEQ;

const RE_UNICODE_WORD = RegExp(
  [
    RS_UPPER +
      '?' +
      RS_LOWER +
      '+' +
      RS_OPT_CONTR_LOWER +
      '(?=' +
      [RS_BREAK, RS_UPPER, '$'].join('|') +
      ')',
    RS_MISC_UPPER +
      '+' +
      RS_OPT_CONTR_UPPER +
      '(?=' +
      [RS_BREAK, RS_UPPER + RS_MISC_LOWER, '$'].join('|') +
      ')',
    RS_UPPER + '?' + RS_MISC_LOWER + '+' + RS_OPT_CONTR_LOWER,
    RS_UPPER + '+' + RS_OPT_CONTR_UPPER,
    RS_ORD_UPPER,
    RS_ORD_LOWER,
    RS_DIGITS,
    RS_EMOJI
  ].join('|'),
  'g'
);
const RE_ASCII_WORD = /[^\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\x7f]+/g;
const RE_HAS_UNICODE_WORD = /[a-z][A-Z]|[A-Z]{2}[a-z]|[0-9][a-zA-Z]|[a-zA-Z][0-9]|[^a-zA-Z0-9 ]/;
const RE_LATIN = /[\xc0-\xd6\xd8-\xf6\xf8-\xffĀ-ſ]/g;
const RE_COMBO_MARK = RegExp(RS_COMBO, 'g');
const RE_APOS = RegExp(RS_APOS, 'g');

/** Splits a string into its words, mirroring lodash's `words`. */
function words(value: string): string[] {
  const pattern = RE_HAS_UNICODE_WORD.test(value) ? RE_UNICODE_WORD : RE_ASCII_WORD;
  return value.match(pattern) ?? [];
}

/** Converts Latin letters to basic Latin letters and removes combining marks, mirroring lodash's `deburr`. */
function deburr(value: string): string {
  return value
    .replace(RE_LATIN, (letter: string): string => {
      return DEBURRED_LETTERS.get(letter) ?? letter;
    })
    .replace(RE_COMBO_MARK, '');
}

/**
 * Converts a string to kebab case, e.g. `'My first State'` becomes `'my-first-state'`.
 * Output is identical to `lodash-es/kebabCase`.
 * @param value The string to convert.
 */
export default function kebabCase(value: string): string {
  return words(deburr(String(value)).replace(RE_APOS, ''))
    .map((word: string): string => {
      return word.toLowerCase();
    })
    .join('-');
}
