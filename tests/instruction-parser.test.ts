import { describe, it, expect } from 'vitest';
import { RuleBasedInstructionInterpreter } from '../lib/instructions/rule-parser';
import { InstructionContext } from '../lib/types/instructions';
import { AudioTrack } from '../lib/types/audio';

describe('RuleBasedInstructionInterpreter', () => {
  const interpreter = new RuleBasedInstructionInterpreter();

  const track1: AudioTrack = {
    id: 'track_1',
    filename: 'song1.mp3',
    duration: 180, // 3 minutes
    format: 'mp3',
    size: 4000000,
    metadata: { duration: 180, format: 'mp3', size: 4000000 },
  };

  const track2: AudioTrack = {
    id: 'track_2',
    filename: 'song2.mp3',
    duration: 120, // 2 minutes
    format: 'mp3',
    size: 3000000,
    metadata: { duration: 120, format: 'mp3', size: 3000000 },
  };

  const context: InstructionContext = {
    tracks: [track1, track2],
    activeTrackId: 'track_1',
  };

  describe('English Instructions', () => {
    it('parses "cut first 30 seconds"', () => {
      const res = interpreter.interpret('cut first 30 seconds', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'trim', trackId: 'track_1', start: 30, end: 180 },
        ]);
      }
    });

    it('parses "remove first 20 seconds"', () => {
      const res = interpreter.interpret('remove first 20 seconds', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'trim', trackId: 'track_1', start: 20, end: 180 },
        ]);
      }
    });

    it('parses "keep 30 seconds to 1 minute"', () => {
      const res = interpreter.interpret('keep 30 seconds to 1 minute', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'trim', trackId: 'track_1', start: 30, end: 60 },
        ]);
      }
    });

    it('parses "keep only 45 seconds to 1 minute 20 seconds"', () => {
      const res = interpreter.interpret(
        'keep only 45 seconds to 1 minute 20 seconds',
        context
      );
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'trim', trackId: 'track_1', start: 45, end: 80 },
        ]);
      }
    });

    it('parses "fade out at the end"', () => {
      const res = interpreter.interpret('fade out at the end', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'fade_out', trackId: 'track_1', duration: 4 },
        ]);
      }
    });

    it('parses "fade out for 5 seconds"', () => {
      const res = interpreter.interpret('fade out for 5 seconds', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'fade_out', trackId: 'track_1', duration: 5 },
        ]);
      }
    });

    it('parses "fade in"', () => {
      const res = interpreter.interpret('fade in', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'fade_in', trackId: 'track_1', duration: 3 },
        ]);
      }
    });

    it('parses "join these two songs"', () => {
      const res = interpreter.interpret('join these two songs', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'merge', tracks: ['track_1', 'track_2'] },
        ]);
      }
    });

    it('parses "crossfade both songs"', () => {
      const res = interpreter.interpret('crossfade both songs', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'merge', tracks: ['track_1', 'track_2'], crossfade: true, crossfadeDuration: 3 },
        ]);
      }
    });

    it('parses Hindi crossfade: "dono gane smoothly jod do"', () => {
      const res = interpreter.interpret('dono gane smoothly jod do', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'merge', tracks: ['track_1', 'track_2'], crossfade: true, crossfadeDuration: 3 },
        ]);
      }
    });

    it('parses compound command: "remove first 30 seconds and fade out the ending"', () => {
      const res = interpreter.interpret(
        'remove first 30 seconds and fade out the ending',
        context
      );
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'trim', trackId: 'track_1', start: 30, end: 180 },
          { type: 'fade_out', trackId: 'track_1', duration: 4 },
        ]);
      }
    });

    it('parses compound command: "keep the first song from 30 seconds to 1 minute and then play the second song"', () => {
      const res = interpreter.interpret(
        'keep the first song from 30 seconds to 1 minute and then play the second song',
        context
      );
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'trim', trackId: 'track_1', start: 30, end: 60 },
          { type: 'merge', tracks: ['track_1', 'track_2'] },
        ]);
      }
    });
  });

  describe('Hindi / Hinglish Instructions', () => {
    it('parses "pehle 30 second hata do"', () => {
      const res = interpreter.interpret('pehle 30 second hata do', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'trim', trackId: 'track_1', start: 30, end: 180 },
        ]);
      }
    });

    it('parses "first 30 seconds remove"', () => {
      const res = interpreter.interpret('first 30 seconds remove', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'trim', trackId: 'track_1', start: 30, end: 180 },
        ]);
      }
    });

    it('parses "30 second se 1 minute tak rakho"', () => {
      const res = interpreter.interpret('30 second se 1 minute tak rakho', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'trim', trackId: 'track_1', start: 30, end: 60 },
        ]);
      }
    });

    it('parses "aadha minute se ek minute tak chalao"', () => {
      const res = interpreter.interpret('aadha minute se ek minute tak chalao', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'trim', trackId: 'track_1', start: 30, end: 60 },
        ]);
      }
    });

    it('parses "end mein fade kar do"', () => {
      const res = interpreter.interpret('end mein fade kar do', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'fade_out', trackId: 'track_1', duration: 4 },
        ]);
      }
    });

    it('parses "last mein dheere dheere band karo"', () => {
      const res = interpreter.interpret('last mein dheere dheere band karo', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'fade_out', trackId: 'track_1', duration: 4 },
        ]);
      }
    });

    it('parses "dono gane jod do"', () => {
      const res = interpreter.interpret('dono gane jod do', context);
      expect(res.status).toBe('success');
      if (res.status === 'success') {
        expect(res.operations).toEqual([
          { type: 'merge', tracks: ['track_1', 'track_2'] },
        ]);
      }
    });
  });

  describe('Ambiguity and Clarification Guardrails', () => {
    it('returns needs_clarification on ambiguous instructions (no guessing)', () => {
      const res = interpreter.interpret('make this sound like morning', context);
      expect(res.status).toBe('needs_clarification');
      if (res.status === 'needs_clarification') {
        expect(res.question).toContain("couldn't understand");
      }
    });

    it('returns needs_clarification when cut time exceeds track duration', () => {
      const res = interpreter.interpret('cut first 300 seconds', context);
      expect(res.status).toBe('needs_clarification');
      if (res.status === 'needs_clarification') {
        expect(res.question).toContain('exceeds');
      }
    });

    it('returns needs_clarification when merge is called with only 1 track', () => {
      const singleTrackContext: InstructionContext = {
        tracks: [track1],
        activeTrackId: 'track_1',
      };
      const res = interpreter.interpret('merge these songs', singleTrackContext);
      expect(res.status).toBe('needs_clarification');
      if (res.status === 'needs_clarification') {
        expect(res.question).toContain('at least two songs');
      }
    });
  });
});
