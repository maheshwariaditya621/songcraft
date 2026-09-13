import { describe, it, expect } from 'vitest';
import { RuleBasedInstructionInterpreter } from '../lib/instructions/rule-parser';
import { parseTimeToSeconds } from '../lib/instructions/time-parser';
import { InstructionContext } from '../lib/types/instructions';
import { AudioTrack } from '../lib/types/audio';

describe('Native Devanagari Hindi Instruction Parsing', () => {
  const track1: AudioTrack = {
    id: 'track_1',
    filename: 'gaana.mp3',
    duration: 180,
    format: 'mp3',
    size: 4000000,
    metadata: { duration: 180, format: 'mp3', size: 4000000 },
  };

  const track2: AudioTrack = {
    id: 'track_2',
    filename: 'gaana2.mp3',
    duration: 120,
    format: 'mp3',
    size: 3000000,
    metadata: { duration: 120, format: 'mp3', size: 3000000 },
  };

  const context: InstructionContext = {
    tracks: [track1, track2],
    activeTrackId: 'track_1',
  };

  const interpreter = new RuleBasedInstructionInterpreter();

  describe('Devanagari Time Parser', () => {
    it('parses numeric seconds in Devanagari: "30 सेकंड"', () => {
      expect(parseTimeToSeconds('30 सेकंड')).toBe(30);
      expect(parseTimeToSeconds('20 सेकंड')).toBe(20);
      expect(parseTimeToSeconds('10 सेकंड्स')).toBe(10);
    });

    it('parses Devanagari numerals: "३० सेकंड"', () => {
      expect(parseTimeToSeconds('३० सेकंड')).toBe(30);
    });

    it('parses Devanagari written numbers: "तीस सेकंड", "चालीस सेकंड"', () => {
      expect(parseTimeToSeconds('तीस सेकंड')).toBe(30);
      expect(parseTimeToSeconds('चालीस सेकंड')).toBe(40);
      expect(parseTimeToSeconds('बीस सेकंड')).toBe(20);
      expect(parseTimeToSeconds('दस सेकंड')).toBe(10);
    });

    it('parses colloquial Devanagari minute phrases: "आधा मिनट", "एक मिनट"', () => {
      expect(parseTimeToSeconds('आधा मिनट')).toBe(30);
      expect(parseTimeToSeconds('एक मिनट')).toBe(60);
      expect(parseTimeToSeconds('डेढ़ मिनट')).toBe(90);
      expect(parseTimeToSeconds('दो मिनट')).toBe(120);
    });
  });

  describe('Devanagari Instructions from User Speech', () => {
    it('parses user screenshot exact phrase: "पहले 30 सेकंड हटा दो"', () => {
      const res = interpreter.interpret('पहले 30 सेकंड हटा दो', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'trim', trackId: 'track_1', start: 30, end: 180 },
        ]);
        expect(res.explanation).toContain('Cut the first 30s');
      }
    });

    it('parses "30 सेकंड से 1 मिनट तक रखो"', () => {
      const res = interpreter.interpret('30 सेकंड से 1 मिनट तक रखो', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'trim', trackId: 'track_1', start: 30, end: 60 },
        ]);
      }
    });

    it('parses "शुरू के 20 सेकंड काट दो"', () => {
      const res = interpreter.interpret('शुरू के 20 सेकंड काट दो', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'trim', trackId: 'track_1', start: 20, end: 180 },
        ]);
      }
    });

    it('parses "आखिरी 10 सेकंड हटा दो"', () => {
      const res = interpreter.interpret('आखिरी 10 सेकंड हटा दो', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'trim', trackId: 'track_1', start: 0, end: 170 },
        ]);
      }
    });

    it('parses "अंत में 5 सेकंड फेड कर दो"', () => {
      const res = interpreter.interpret('अंत में 5 सेकंड फेड कर दो', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'fade_out', trackId: 'track_1', duration: 5 },
        ]);
      }
    });

    it('parses "दोनों गाने जोड़ दो"', () => {
      const res = interpreter.interpret('दोनों गाने जोड़ दो', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'merge', tracks: ['track_1', 'track_2'] },
        ]);
      }
    });

    it('parses compound command: "पहले 30 सेकंड हटा दो और अंत में 5 सेकंड फेड कर दो"', () => {
      const res = interpreter.interpret(
        'पहले 30 सेकंड हटा दो और अंत में 5 सेकंड फेड कर दो',
        context
      );
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'trim', trackId: 'track_1', start: 30, end: 180 },
          { type: 'fade_out', trackId: 'track_1', duration: 5 },
        ]);
      }
    });

    it('parses negation / correction: "नहीं, 40 सेकंड से 1 मिनट तक"', () => {
      const res = interpreter.interpret('नहीं, 40 सेकंड से 1 मिनट तक', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'trim', trackId: 'track_1', start: 40, end: 60 },
        ]);
      }
    });

    it('clarifies vague phrase: "इसको अच्छा बना दो"', () => {
      const res = interpreter.interpret('इसको अच्छा बना दो', context);
      expect(res.status).toBe('needs_clarification');
      if (res.status === 'needs_clarification') {
        expect(res.possibleOptions?.length).toBeGreaterThanOrEqual(3);
      }
    });
  });
});
