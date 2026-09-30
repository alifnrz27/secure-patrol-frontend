import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('quotes separators, quotes and newlines', () => {
    expect(toCsv(['a', 'b'], [['x,y', 'say "hi"'], ['line\nbreak', 3]])).toBe(
      'a,b\r\n"x,y","say ""hi"""\r\n"line\nbreak",3',
    );
  });

  it('neutralizes formula-like text and keeps numbers', () => {
    expect(toCsv(['n'], [['=SUM(A1)'], [-5], [null]])).toBe("n\r\n'=SUM(A1)\r\n-5\r\n");
  });
});
