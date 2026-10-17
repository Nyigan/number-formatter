import format, { formatNumber, createFormatter, currency, percent, compact, signed, bytes, parse } from '../index';

const a: string = format(1);
const b: string = formatNumber(1n, 'de-DE', { style: 'percent' });
const c: string = format('1234.50', new Intl.Locale('en-US'), null);
const d: string = format(null, undefined, { fallback: '—' });
const e: string = createFormatter('en-US', { fallback: 'n/a' })(undefined);
const f: string = createFormatter()(5);
const g: string[] = [currency(1, 'USD'), percent(0.1), compact(1e6), signed(1), bytes(1500, 'de-DE', { maximumFractionDigits: 2 })];

const h: number = parse('1.234,5', 'de-DE');
const i: number = parse('26%', 'en-US', { style: 'percent' });
const j: number = parse('x', undefined, { fallback: NaN });
const k: number | null = parse(null, 'en-US', { fallback: null });
const l: number | string = parse('x', 'en-US', { fallback: 'n/a' });

// @ts-expect-error parse needs a string
parse(5);
// @ts-expect-error a fallback does not allow other types
parse(5, 'en-US', { fallback: 0 });
// @ts-expect-error null needs a fallback
parse(null);
// @ts-expect-error null needs a fallback
format(null);
// @ts-expect-error objects are never valid
format({});
// @ts-expect-error without a fallback the formatter rejects undefined
createFormatter()(undefined);
// @ts-expect-error fallback must be a string
format(1, 'en-US', { fallback: 0 });
// @ts-expect-error currency code is required
currency(1);

export { a, b, c, d, e, f, g, h, i, j, k, l };
