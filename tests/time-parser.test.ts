import { describe, it, expect } from 'vitest';
import { parseTimeToSeconds } from '../lib/instructions/time-parser';

describe('parseTimeToSeconds', () => {
  it('parses standard seconds format', () => {
    expect(parseTimeToSeconds('30s')).toBe(30);
    expect(parseTimeToSeconds('45 seconds')).toBe(45);
    expect(parseTimeToSeconds('20 sec')).toBe(20);
    expect(parseTimeToSeconds('15')).toBe(15);
  });

  it('parses minutes and seconds combinations', () => {
    expect(parseTimeToSeconds('1 minute 20 seconds')).toBe(80);
    expect(parseTimeToSeconds('2 mins 30 secs')).toBe(150);
    expect(parseTimeToSeconds('1m 10s')).toBe(70);
  });

  it('parses colon timestamps (mm:ss and hh:mm:ss)', () => {
    expect(parseTimeToSeconds('1:20')).toBe(80);
    expect(parseTimeToSeconds('01:20')).toBe(80);
    expect(parseTimeToSeconds('0:45')).toBe(45);
    expect(parseTimeToSeconds('1:00:00')).toBe(3600);
  });

  it('parses Hindi / Hinglish colloquial phrases', () => {
    expect(parseTimeToSeconds('aadha minute')).toBe(30);
    expect(parseTimeToSeconds('half a minute')).toBe(30);
    expect(parseTimeToSeconds('ek minute')).toBe(60);
    expect(parseTimeToSeconds('derh minute')).toBe(90);
    expect(parseTimeToSeconds('do minute')).toBe(120);
    expect(parseTimeToSeconds('dhai minute')).toBe(150);
  });

  it('returns null for unparseable input', () => {
    expect(parseTimeToSeconds('whenever')).toBe(null);
    expect(parseTimeToSeconds('')).toBe(null);
  });
});
